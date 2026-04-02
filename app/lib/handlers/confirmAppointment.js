function safeDateString(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function confirmAppointment({
  supabase,
  requestId,
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
      meeting_link_override
    `)
    .eq("id", requestId)
    .single();

  if (loadError || !existing) {
    throw new Error("request_not_found");
  }

  // Schon bestätigt → nichts doppelt schicken
  if (existing.status === "termin_bestaetigt") {
    return { alreadyConfirmed: true };
  }

  /* --------------------------------------------------
     2️⃣ STATUS → termin_bestaetigt
  -------------------------------------------------- */
  const { error: updateError } = await supabase
    .from("anfragen")
    .update(
      { status: "termin_bestaetigt" },
      { returning: "minimal" }
    )
    .eq("id", requestId);

  if (updateError) {
    throw new Error(updateError.message);
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

  const therapistName =
    (existing.wunschtherapeut || "").trim() || "dein Coach";

  const terminText = existing.bevorzugte_zeit
    ? safeDateString(existing.bevorzugte_zeit)
    : "wird dir separat mitgeteilt";

  const videoLink =
    existing.meeting_link_override ||
    bookingSettings?.meeting_link ||
    "";

  /* --------------------------------------------------
     4️⃣ MAIL AN KLIENT:IN
  -------------------------------------------------- */
  try {
    await fetch("https://api.resend.com/emails", {
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
            Falls der Termin doch nicht eingehalten werden kann, melde dich bitte rechtzeitig unter
            <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.
          </p>

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
  } catch {
    console.warn("⚠️ Mail fehlgeschlagen – Status aber korrekt");
  }

  return { success: true };
}
