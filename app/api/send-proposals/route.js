export const dynamic = "force-dynamic";
import {
  canAccessAssignedRequest,
  getActiveTeamMember,
} from "../_lib/server";

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
    const auth = await getActiveTeamMember(req);
    if (!auth.member) return json({ error: auth.error }, auth.status);
    if (!["admin", "therapist"].includes(auth.member.role)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const { requestId, proposals } = await req.json();

    if (!requestId || !Array.isArray(proposals) || proposals.length === 0) {
      return json({ error: "INVALID_INPUT" }, 400);
    }

    // Anfrage laden → für Mail
    const { data: request, error: requestError } = await auth.supabase
      .from("anfragen")
      .select("id, assigned_therapist_id, email, vorname, booking_token")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) return json({ error: "REQUEST_LOAD_FAILED" }, 500);
    if (!request) return json({ error: "REQUEST_NOT_FOUND" }, 404);
    if (!request.assigned_therapist_id) {
      return json({ error: "REQUEST_NOT_ASSIGNED" }, 409);
    }
    if (!canAccessAssignedRequest(auth.member, request.assigned_therapist_id)) {
      return json({ error: "NO_ACCESS" }, 403);
    }
    if (!request.email) return json({ error: "CLIENT_EMAIL_MISSING" }, 400);

    const proposedDates = proposals.map((proposal) => new Date(proposal));
    if (proposedDates.some((date) => Number.isNaN(date.getTime()))) {
      return json({ error: "INVALID_PROPOSAL_DATE" }, 400);
    }

    // Vorschläge speichern
    const inserts = proposedDates.map((date) => ({
      request_id: requestId,
      therapist_id: request.assigned_therapist_id,
      proposed_at: date.toISOString(),
    }));

    const { error } = await auth.supabase
      .from("appointment_proposals")
      .insert(inserts);

    if (error) {
      console.error("SEND PROPOSALS DB ERROR", { code: error?.code || null });
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
        <a href="${baseUrl}/confirm-proposal?${request.booking_token
          ? `token=${encodeURIComponent(request.booking_token)}`
          : `request=${encodeURIComponent(requestId)}`}">
          ${safeDateString(p.proposed_at)}
        </a>
      </p>`
  )
  .join("");

    const mailResponse = await fetch("https://api.resend.com/emails", {
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
    if (!mailResponse.ok) {
      console.error("SEND PROPOSALS MAIL FAILED");
      return json({ error: "PROPOSALS_MAIL_FAILED", proposalsCreated: true }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("SEND PROPOSALS SERVER ERROR");
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
