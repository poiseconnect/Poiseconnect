export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

export async function POST(req) {
  try {
    const { requestId, proposalId } = await req.json();
    console.log("✅ CONFIRM PROPOSAL API HIT", { requestId, proposalId });

    if (!requestId || !proposalId) {
      return json({ error: "missing_data" }, 400);
    }

    const { data: proposal, error: pError } = await supabase
      .from("appointment_proposals")
      .select("id, anfrage_id, therapist_id, date")
      .eq("id", proposalId)
      .single();

    if (pError || !proposal) {
      console.error("proposal_not_found", pError);
      return json({ error: "proposal_not_found" }, 404);
    }

    if (String(proposal.anfrage_id) !== String(requestId)) {
      return json({ error: "proposal_request_mismatch" }, 400);
    }

    const start = new Date(proposal.date);
    if (Number.isNaN(start.getTime())) {
      return json({ error: "invalid_proposal_date" }, 400);
    }

    const end = new Date(start.getTime() + 60 * 60000);

    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        bevorzugte_zeit: proposal.date,
        assigned_therapist_id: proposal.therapist_id,
        status: "termin_bestaetigt",
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("updateError", updateError);
      return json({ error: updateError.message }, 500);
    }

    const { error: blockError } = await supabase.from("blocked_slots").insert({
      anfrage_id: requestId,
      therapist_id: proposal.therapist_id,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      reason: "proposal_confirmed",
    });

    if (blockError) {
      console.error("blockError", blockError);
      return json({ error: blockError.message }, 500);
    }

    const { error: delError } = await supabase
      .from("appointment_proposals")
      .delete()
      .eq("anfrage_id", requestId)
      .neq("id", proposalId);

    if (delError) {
      console.error("delError", delError);
    }

    const { data: existingRequest, error: reqError } = await supabase
      .from("anfragen")
      .select(`
        id,
        vorname,
        email,
        bevorzugte_zeit,
        assigned_therapist_id,
        wunschtherapeut,
        meeting_link_override
      `)
      .eq("id", requestId)
      .single();

    if (reqError || !existingRequest) {
      console.error("request_load_failed", reqError);
      return json({ ok: true, warning: "request_updated_but_mail_skipped" });
    }

    console.log("📨 REQUEST FOR MAIL:", existingRequest);

    let bookingSettings = null;

    if (existingRequest.assigned_therapist_id) {
      const { data: bookingData, error: bookingError } = await supabase
        .from("therapist_booking_settings")
        .select("meeting_link")
        .eq("therapist_id", existingRequest.assigned_therapist_id)
        .single();

      if (bookingError) {
        console.warn("booking_settings_load_failed", bookingError);
      } else {
        bookingSettings = bookingData;
      }
    }

    const therapistName =
      existingRequest.wunschtherapeut?.trim() || "dein Coach";

    const terminText = existingRequest.bevorzugte_zeit
      ? safeDateString(existingRequest.bevorzugte_zeit)
      : "wird dir separat mitgeteilt";

    const videoLink =
      existingRequest.meeting_link_override ||
      bookingSettings?.meeting_link ||
      "";

    console.log("📧 about to send mail", {
      to: existingRequest.email,
      therapistName,
      terminText,
      videoLink,
    });

    if (existingRequest.email) {
      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Poise <noreply@mypoise.de>",
          to: existingRequest.email,
          subject: "Dein Erstgespräch ist bestätigt 🤍",
          html: `
            <p>Hallo ${existingRequest.vorname || ""},</p>

            <p>
              danke dir – dein Erstgespräch wurde erfolgreich bestätigt.
            </p>

            <p>
              <strong>Dein Coach:</strong> ${therapistName}<br/>
              <strong>Termin:</strong> ${terminText}
            </p>

            ${
              videoLink
                ? `
                <p>
                  <strong>Hier geht es zu eurem Video-Call:</strong><br/>
                  <a href="${videoLink}" target="_blank" style="color:#8E3A4A; font-weight:600;">
                    👉 Zum Video-Call
                  </a>
                </p>
                `
                : `
                <p>
                  Den Link für euren Video-Call erhältst du in Kürze separat.
                </p>
                `
            }

            <p>
              Falls du den Termin doch nicht wahrnehmen kannst oder etwas dazwischenkommt,
              melde dich bitte unter
              <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.
            </p>

            <p>
              Alles Liebe<br/>
              ${therapistName} 🤍
            </p>
          `,
        }),
      });

      console.log("📧 RESEND STATUS:", mailRes.status);
      const mailText = await mailRes.text();
      console.log("📧 RESEND RESPONSE:", mailText);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("CONFIRM ERROR:", e);
    return json({ error: "server_error" }, 500);
  }
}
