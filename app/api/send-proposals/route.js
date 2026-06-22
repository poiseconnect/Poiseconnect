import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
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
export async function POST(req) {
  try {
    const { requestId, therapist_id, proposals } = await req.json();

    if (!requestId || !therapist_id || !Array.isArray(proposals)) {
      return json({ error: "INVALID_INPUT" }, 400);
    }

    // Anfrage laden → für Mail
    const { data: request } = await supabase
      .from("anfragen")
      .select("email, vorname")
      .eq("id", requestId)
      .single();

    if (!request) return json({ error: "REQUEST_NOT_FOUND" }, 404);

    // Vorschläge speichern
    const inserts = proposals.map((p) => ({
      request_id: requestId,
      therapist_id,
      proposed_at: new Date(p).toISOString(),
    }));

    const { error } = await supabase
      .from("appointment_proposals")
      .insert(inserts);

    if (error) {
      console.error(error);
      return json({ error: "DB_ERROR" }, 500);
    }

    // ================= MAIL =================

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://app.mypoise.de";

const links = inserts
  .map(
    (p) => `
      <p>
        <a href="${baseUrl}/confirm-proposal?id=${p.proposed_at}">
          ${safeDateString(p.proposed_at)}
        </a>
      </p>`
  )
  .join("");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: request.email,
        subject: "Terminvorschläge für dein Erstgespräch 🤍",
        html: `
          <p>Hallo ${request.vorname || ""},</p>
          <p>bitte wähle einen Termin:</p>
          ${links}
        `,
      }),
    });

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
