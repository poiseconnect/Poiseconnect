export const dynamic = "force-dynamic";

import {
  getUserFromBearer,
  json,
  supabaseAdmin,
} from "../_lib/server";
import { closeConversation } from "../../lib/messaging/conversations";

export async function POST(request) {
  try {
    const { user, error: authError } = await getUserFromBearer(request);
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
      body = await request.json();
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }

    const { requestId } = body || {};

    if (!requestId) {
      return json({ error: "MISSING_REQUEST_ID" }, 400);
    }

    const { data: anfrage, error: anfrageErr } = await sb
      .from("anfragen")
      .select("id, assigned_therapist_id, email, vorname, wunschtherapeut")
      .eq("id", requestId)
      .single();

    if (anfrageErr || !anfrage) {
      return json({ error: "REQUEST_NOT_FOUND" }, 404);
    }

    if (
      isTherapist &&
      String(anfrage.assigned_therapist_id) !== String(member.id)
    ) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    if (!anfrage.email) {
      return json({ error: "CLIENT_EMAIL_MISSING" }, 400);
    }

    const excludedTherapist = anfrage.wunschtherapeut;

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://app.mypoise.de";

    const link = `${baseUrl}?resume=8&rid=${requestId}`;

    await closeConversation({
      supabase: sb,
      anfrageId: anfrage.id,
      reason: "assignment_removed",
    });

    // 1️⃣ Anfrage korrekt weiterleiten
    const { error: updateError } = await sb
      .from("anfragen")
      .update({
        status: "admin_weiterleiten",
        wunschtherapeut: null,
        bevorzugte_zeit: null,
        assigned_therapist_id: null,
        excluded_therapeuten: excludedTherapist
          ? [excludedTherapist]
          : [],
      })
      .eq("id", requestId);

    if (updateError) {
      return json({ error: "UPDATE_FAILED" }, 500);
    }

    // 2️⃣ Mail an Klient:in
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: anfrage.email,
        subject: "Wähle jetzt deine passende Begleitung 🤍",
        html: `
          <p>Hallo ${anfrage.vorname || ""},</p>

          <p>
            danke dir für dein Vertrauen 🤍
          </p>

          <p>
            die von dir ursprünglich ausgewählte Begleitung hat aktuell leider keine freien Kapazitäten.
          </p>

          <p>
            Damit du trotzdem gut begleitet wirst, kannst du jetzt eine andere passende Begleitung aus unserem Team auswählen.
          </p>

          <p>
            <a href="${link}"
               style="color:#8E3A4A; font-weight:600;">
              👉 Passende Begleitung auswählen
            </a>
          </p>

          <p>
            Nimm dir dafür gerne einen Moment Zeit und wähle die Person aus, die sich für dich stimmig anfühlt.
          </p>

          <p>
            Wenn du Fragen hast, melde dich jederzeit gern bei uns.
          </p>

          <br />

          <p>
            Alles Liebe<br />
            dein Poise-Team 🤍
          </p>
        `,
      }),
    });

    if (!mailRes.ok) {
      console.warn("FORWARD MAIL FAILED – DB UPDATE OK");
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
