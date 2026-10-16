export const dynamic = "force-dynamic";

import {
  canAccessAssignedRequest,
  getActiveTeamMember,
  json,
} from "../_lib/server";
import { closeConversation } from "../../lib/messaging/conversations";

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

    const { data: requestRow, error: loadError } = await auth.supabase
      .from("anfragen")
      .select("id, assigned_therapist_id, email, vorname, wunschtherapeut")
      .eq("id", requestId)
      .maybeSingle();
    if (loadError) return json({ error: "REQUEST_LOAD_FAILED" }, 500);
    if (!requestRow) return json({ error: "REQUEST_NOT_FOUND" }, 404);
    if (!canAccessAssignedRequest(auth.member, requestRow.assigned_therapist_id)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    // 1️⃣ Anfrage updaten
    let update = auth.supabase
      .from("anfragen")
      .update({
        status: "abgelehnt",
        bevorzugte_zeit: null,
      })
      .eq("id", requestId);
    if (auth.member.role === "therapist") {
      update = update.eq("assigned_therapist_id", auth.member.id);
    }
    const { data: updated, error: updateError } = await update
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      console.error("REJECT UPDATE ERROR:", { code: updateError?.code || null });
      return json({ error: "update_failed", detail: "INTERNAL_ERROR" }, 500);
    }

    await closeConversation({
      supabase: auth.supabase,
      anfrageId: requestId,
      reason: "abgelehnt",
    });

    if (!requestRow.email) return json({ ok: true });

    // 2️⃣ Mail an Klient:in
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: requestRow.email,
        subject: "Termin wurde abgesagt 🤍",
        html: `
          <p>Hallo ${requestRow.vorname || ""},</p>

          <p>Leider musste ${requestRow.wunschtherapeut || "die Begleitung"} deinen Termin absagen.</p>

          <p>Du kannst jederzeit eine neue Anfrage stellen.</p>

          <p>Liebe Grüße<br>dein Poise-Team 🤍</p>
        `,
      }),
    });

    if (!mailRes.ok) {
      console.warn("REJECT MAIL FAILED – DB UPDATE OK");
    }

    return json({ ok: true });
  } catch (err) {
    console.error("REJECT SERVER ERROR");
    return json({ error: "server_error", detail: "INTERNAL_ERROR" }, 500);
  }
}
