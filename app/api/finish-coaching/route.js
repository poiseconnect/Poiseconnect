export const dynamic = "force-dynamic";

import {
  getUserFromBearer,
  json,
  supabaseAdmin,
} from "../_lib/server";
import { closeConversation } from "../../lib/messaging/conversations";

// 🔗 Feedback-Link (Microsoft Forms)
const FEEDBACK_URL =
  "https://forms.office.com/Pages/ResponsePage.aspx?id=DQSIkWdsW0yxEjajBLZtrQAAAAAAAAAAAAN__lvx3A5UMEFTNzZUQkVFQVVLRE5TTVFQVFMxWURETi4u"; 
// ⬆️ HIER deinen echten Forms-Link einsetzen

export async function POST(req) {
  try {
    const { user, error: authError } = await getUserFromBearer(req);
    if (!user) return json({ error: authError || "NO_TOKEN" }, 401);

    const sb = supabaseAdmin();

    const { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member || member.active !== true) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const isAdmin = member.role === "admin";
    const isTherapist = member.role === "therapist";

    if (!isAdmin && !isTherapist) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }

    const { anfrageId } = body || {};

    if (!anfrageId) {
      return json({ error: "MISSING_ANFRAGE_ID" }, 400);
    }

    const { data: existingAnfrage, error: anfrageErr } = await sb
      .from("anfragen")
      .select("id, assigned_therapist_id")
      .eq("id", anfrageId)
      .single();

    if (anfrageErr || !existingAnfrage) {
      return json({ error: "REQUEST_NOT_FOUND" }, 404);
    }

    if (
      isTherapist &&
      String(existingAnfrage.assigned_therapist_id) !== String(member.id)
    ) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    await closeConversation({
      supabase: sb,
      anfrageId,
      reason: "beendet",
    });

    const { data: anfrage, error: updateError } = await sb
      .from("anfragen")
      .update({ status: "beendet" })
      .eq("id", anfrageId)
      .select("email, vorname")
      .single();

    if (updateError) {
      return json({ error: "UPDATE_FAILED" }, 500);
    }

    // 📧 Feedback-Mail senden
    if (anfrage?.email) {
      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Poise <noreply@mypoise.de>",
          to: anfrage.email,
          subject: "Danke für dein Vertrauen 🤍 – kurzes Feedback",
          html: `
            <p>Hallo ${anfrage.vorname || ""},</p>

            <p>
              vielen Dank für dein Vertrauen und die gemeinsame Zeit.
              Wir würden uns sehr über dein kurzes Feedback freuen.
            </p>

            <p>
              👉 <a href="${FEEDBACK_URL}"
                   style="color:#6f4f49; font-weight:bold;">
                Zum Feedbackbogen
              </a>
            </p>

            <p>Danke dir 🤍<br/>Dein Poise-Team</p>
          `,
        }),
      });

      if (!mailRes.ok) {
        console.warn("⚠️ FEEDBACK MAIL FAILED – STATUS IST TROTZDEM BEENDET");
      }
    }

    return json({ ok: true });

  } catch (err) {
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
