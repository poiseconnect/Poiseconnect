export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getUserFromBearer(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

export async function POST(req) {
  try {
    const user = await getUserFromBearer(req);

    if (!user) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = await req.json();
    const { requestId, subject, message } = body;

    if (!requestId || !subject || !message) {
      return json({ error: "missing_data" }, 400);
    }

    const { data: coach, error: coachError } = await supabase
      .from("team_members")
      .select("id, name, email")
      .eq("user_id", user.id)
      .single();

    if (coachError || !coach) {
      return json({ error: "coach_not_found" }, 404);
    }

    const { data: request, error: requestError } = await supabase
      .from("anfragen")
      .select("id, vorname, email, assigned_therapist_id, status")
      .eq("id", requestId)
      .single();

    if (requestError || !request?.email) {
      return json({ error: "request_not_found" }, 404);
    }

    if (String(request.assigned_therapist_id) !== String(coach.id)) {
      return json({ error: "not_allowed" }, 403);
    }

    if (request.status !== "termin_bestaetigt") {
      return json({ error: "wrong_status" }, 400);
    }

    await resend.emails.send({
      from: "Poise <noreply@mypoise.de>",
      to: request.email,
      replyTo: coach.email || undefined,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.6; color:#111;">
          <p>Hallo ${request.vorname || ""},</p>

          <div style="white-space: pre-line;">
            ${String(message)
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;")}
          </div>

          <p style="margin-top:24px;">
            Liebe Grüße<br/>
            ${coach.name || "dein Coach"}
          </p>
        </div>
      `,
    });

    return json({ ok: true });
  } catch (err) {
    console.error("SEND PERSONAL MESSAGE ERROR:", err);
    return json({ error: "server_error", detail: String(err) }, 500);
  }
}
