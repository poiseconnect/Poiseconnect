import { ensureOpenConversation } from "../messaging/conversations";
import { appointmentCareContext, beginAppointmentOperation, endAppointmentOperation } from "../appointmentCare";
import { currentMeetingLinkOverride } from "../meetingLinkScope";

function safeDateString(v) {
  if (!v) return "";

  const d = new Date(v);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleString("de-AT", {
    timeZone: "Europe/Vienna",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function confirmAppointment({
  supabase,
  requestId,
  expectedAssignedTherapistId,
  expectedCareVersion = null,
  client,
  vorname,
}) {
  /* --------------------------------------------------
     1️⃣ AKTUELLE ANFRAGE LADEN
  -------------------------------------------------- */
  const { data: existing, error: loadError } = await supabase
    .from("anfragen")
    .select(`
      id,
      status,
      bevorzugte_zeit,
      assigned_therapist_id,
      wunschtherapeut,
      meeting_link_override,
      care_version,
      meeting_link_care_version
    `)
    .eq("id", requestId)
    .maybeSingle();

  if (loadError || !existing) {
    throw new Error("request_not_found");
  }
  if (
    expectedAssignedTherapistId &&
    String(existing.assigned_therapist_id || "") !==
      String(expectedAssignedTherapistId)
  ) {
    throw new Error("request_assignment_changed");
  }
  const care = await appointmentCareContext(supabase, requestId, existing.assigned_therapist_id, {
    expectedVersion: expectedCareVersion,
  });
  if (care.error) throw new Error(care.error);

  // Schon bestätigt → nichts doppelt schicken
  if (existing.status === "termin_bestaetigt") {
    return { alreadyConfirmed: true };
  }
  const operation = await beginAppointmentOperation(supabase, requestId, existing.assigned_therapist_id, care.careVersion);
  if (operation.error) throw new Error(operation.error);

  /* --------------------------------------------------
     2️⃣ STATUS → termin_bestaetigt
  -------------------------------------------------- */
  let update = supabase
    .from("anfragen")
    .update(
      { status: "termin_bestaetigt" },
      { returning: "minimal" }
    )
    .eq("id", requestId)
    .eq("assigned_therapist_id", existing.assigned_therapist_id)
    .eq("care_version", care.careVersion);
  if (expectedAssignedTherapistId) {
    update = update.eq("assigned_therapist_id", expectedAssignedTherapistId);
  }
  const { data: updated, error: updateError } = await update
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    throw new Error(updateError?.message || "request_assignment_changed");
  }

  if (existing.assigned_therapist_id) {
    await ensureOpenConversation({
      supabase,
      anfrageId: requestId,
      therapistId: existing.assigned_therapist_id,
    });
  }

  /* --------------------------------------------------
     3️⃣ BOOKING SETTINGS DES COACHS LADEN
  -------------------------------------------------- */
  let bookingSettings = null;

  if (existing.assigned_therapist_id) {
    const { data: bookingData } = await supabase
      .from("therapist_booking_settings")
      .select("meeting_link")
      .eq("therapist_id", existing.assigned_therapist_id)
      .single();

    bookingSettings = bookingData || null;
  }

  const { data: currentCoach } = await supabase.from("team_members")
    .select("name").eq("id", existing.assigned_therapist_id).maybeSingle();
  const therapistName = currentCoach?.name || "dein Coach";

  const terminText = existing.bevorzugte_zeit
    ? safeDateString(existing.bevorzugte_zeit)
    : "wird dir separat mitgeteilt";

  const videoLink =
    currentMeetingLinkOverride(existing) ||
    bookingSettings?.meeting_link ||
    "";

  /* --------------------------------------------------
     4️⃣ MAIL AN KLIENT:IN
  -------------------------------------------------- */
  try {
    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Dein Termin ist bestätigt 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>

          <p>
            dein Termin wurde erfolgreich bestätigt – wir freuen uns sehr auf dich.
          </p>

          <p>
            <strong>Dein Coach:</strong> ${therapistName}<br />
            <strong>Termin:</strong> ${terminText}
          </p>

          ${
            videoLink
              ? `
          <p>
            <strong>Video-Call:</strong><br />
            <a
              href="${videoLink}"
              target="_blank"
              style="color:#6f4f49; font-weight:bold;"
            >
              Hier geht's direkt zum Gespräch
            </a>
          </p>
          `
              : `
          <p>
            Den Link zum Gespräch erhältst du separat.
          </p>
          `
          }

         <p>
  Bitte plane dir ausreichend Zeit und einen ruhigen Ort für das Gespräch ein.
</p>

<p>
  Bitte sei ein paar Minuten vor Beginn bereit und stelle sicher,
  dass Kamera, Mikrofon und Internetverbindung funktionieren.
</p>

<br />

<p>
  <strong>Termin ändern oder absagen</strong>
</p>

<p>
  Falls du den Termin nicht wahrnehmen kannst oder Fragen dazu hast,
  melde dich bitte rechtzeitig unter:
</p>

<p>
  <a href="mailto:hallo@mypoise.de">
    <strong>hallo@mypoise.de</strong>
  </a>
</p>

<p>
  Wir kümmern uns schnell um eine Lösung und finden gemeinsam einen neuen Termin.
</p>

<p>
  Bitte gib uns möglichst früh Bescheid, falls du den Termin nicht wahrnehmen kannst.
</p>

<br />

<p>
  Wir freuen uns auf dich 🤍
</p>

          <p>
            Herzliche Grüße<br />
            ${therapistName}
          </p>
        `,
      }),
    });
    if (!mail.ok) throw new Error("APPOINTMENT_OPERATION_PENDING");
  } catch {
    throw new Error("APPOINTMENT_OPERATION_PENDING");
  }

  if (!(await endAppointmentOperation(operation))) throw new Error("APPOINTMENT_OPERATION_PENDING");
  return { success: true };
}
