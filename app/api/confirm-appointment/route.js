export const dynamic = "force-dynamic";

import {
  canAccessAssignedRequest,
  getActiveTeamMember,
  json,
} from "../_lib/server";
import { ensureOpenConversation } from "../../lib/messaging/conversations";

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
  });
}

export async function POST(request) {
  try {
    const auth = await getActiveTeamMember(request);
    if (!auth.member) return json({ error: auth.error }, auth.status);
    if (!["admin", "therapist"].includes(auth.member.role)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const body = await request.json();
    const { requestId } = body || {};

    if (!requestId) {
      return json({ error: "missing_fields" }, 400);
    }

    /* --------------------------------------------------
       1️⃣ AKTUELLE ANFRAGE LADEN
    -------------------------------------------------- */
    const { data: existing, error: loadError } = await auth.supabase
      .from("anfragen")
      .select(`
        id,
        status,
        bevorzugte_zeit,
        assigned_therapist_id,
        wunschtherapeut,
        meeting_link_override,
        booking_token,
        email,
        vorname
      `)
      .eq("id", requestId)
      .maybeSingle();

    if (loadError || !existing) {
      console.error("CONFIRM APPOINTMENT REQUEST LOAD ERROR:", { code: loadError?.code || null });
      return json({ error: "request_not_found" }, 404);
    }
    if (!canAccessAssignedRequest(auth.member, existing.assigned_therapist_id)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    // ❗ Schon bestätigt → nichts tun
    if (existing.status === "termin_bestaetigt") {
      return json({ ok: true, alreadyConfirmed: true });
    }

    /* --------------------------------------------------
       2️⃣ STATUS → termin_bestaetigt
    -------------------------------------------------- */
    let update = auth.supabase
      .from("anfragen")
      .update(
        { status: "termin_bestaetigt" },
        { returning: "minimal" }
      )
      .eq("id", requestId);
    if (auth.member.role === "therapist") {
      update = update.eq("assigned_therapist_id", auth.member.id);
    }
    const { error: updateError } = await update;

    if (updateError) {
      console.error("CONFIRM APPOINTMENT UPDATE ERROR:", { code: updateError?.code || null });
      return json({ error: "update_failed", detail: "INTERNAL_ERROR" }, 500);
    }

    if (existing.assigned_therapist_id) {
      await ensureOpenConversation({
        supabase: auth.supabase,
        anfrageId: requestId,
        therapistId: existing.assigned_therapist_id,
      });
    }

    /* --------------------------------------------------
       3️⃣ BOOKING SETTINGS DES COACHS LADEN
    -------------------------------------------------- */
    let bookingSettings = null;

    if (existing.assigned_therapist_id) {
      const { data: bookingData, error: bookingError } = await auth.supabase
        .from("therapist_booking_settings")
        .select("meeting_link")
        .eq("therapist_id", existing.assigned_therapist_id)
        .single();

      if (bookingError) {
        console.warn("BOOKING SETTINGS LOAD FAILED:", { code: bookingError?.code || null });
      } else {
        bookingSettings = bookingData;
      }
    }

    const therapistName =
      existing.wunschtherapeut?.trim() || "dein Coach";

    const terminText = existing.bevorzugte_zeit
      ? safeDateString(existing.bevorzugte_zeit)
      : "wird dir separat mitgeteilt";

    const videoLink =
      existing.meeting_link_override ||
      bookingSettings?.meeting_link ||
      "";
const appBaseUrl = (
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://poiseconnect.vercel.app"
).replace(/\/$/, "");

const manageLink = existing.booking_token
  ? `${appBaseUrl}/termin-verwalten/${encodeURIComponent(
      existing.booking_token
    )}`
  : null;
    /* --------------------------------------------------
       4️⃣ MAIL AN KLIENT:IN
    -------------------------------------------------- */
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: existing.email,
        subject: "Dein Termin ist bestätigt 🤍",
        html: `
          <p>Hallo ${existing.vorname || ""},</p>

          <p>
            dein Termin wurde erfolgreich bestätigt – wir freuen uns sehr auf dich.
          </p>

          <p>
            <strong>Dein Coach:</strong> ${therapistName}<br/>
            <strong>Termin:</strong> ${terminText}
          </p>

          <p>
            ${therapistName} freut sich darauf, dich kennenzulernen und dich ein Stück auf deinem Weg zu begleiten.
          </p>

          ${
            videoLink
              ? `
              <p>
                <strong>Video-Call:</strong><br/>
                <a href="${videoLink}" target="_blank" style="color:#6f4f49; font-weight:bold;">
                  Zum Gespräch
                </a>
              </p>
              `
              : ""
          }

          <p>
            Bitte plane dir ausreichend Zeit und einen ruhigen Ort für das Gespräch ein.
          </p>

${
  manageLink
    ? `
    <p>
      Deinen Termin kannst du über den folgenden Button jederzeit ansehen und verwalten:
    </p>

    <p style="margin:24px 0;">
      <a
        href="${manageLink}"
        target="_blank"
        style="
          display:inline-block;
          background:#8E3A4A;
          color:#ffffff;
          padding:14px 22px;
          border-radius:10px;
          text-decoration:none;
          font-weight:600;
        "
      >
        Termin verwalten
      </a>
    </p>

    <p style="font-size:14px; color:#666666;">
      Dort kannst du deinen Termin ansehen, eine Änderung anfragen oder den Termin absagen.
    </p>

    <p style="font-size:13px; color:#777777;">
      Falls der Button nicht funktioniert, kannst du diesen Link in deinen Browser kopieren:<br/>
      <a href="${manageLink}" style="color:#8E3A4A;">
        ${manageLink}
      </a>
    </p>
    `
    : `
    <p>
      Solltest du den Termin doch nicht wahrnehmen können, melde dich bitte rechtzeitig unter
      <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.
    </p>
    `
}

          <p>
            Herzliche Grüße<br/>
            Sebastian<br/>
            Poise
          </p>
        `,
      }),
    });

    if (!mailRes.ok) {
      console.warn("MAIL FAILED – STATUS IS STILL CORRECT");
    }

    return json({ ok: true });
  } catch (err) {
    console.error("CONFIRM APPOINTMENT SERVER ERROR");
    return json({ error: "server_error", detail: "INTERNAL_ERROR" }, 500);
  }
}
