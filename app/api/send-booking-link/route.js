export const dynamic = "force-dynamic";

import { Resend } from "resend";
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

export async function POST(req) {
  try {
    const auth = await getActiveTeamMember(req);
    if (!auth.member) return json({ error: auth.error }, auth.status);
    if (!["admin", "therapist"].includes(auth.member.role)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const { requestId } = await req.json();
    if (!requestId) {
      return json({ error: "missing_fields" }, 400);
    }

    const { data: requestRow, error: requestError } = await auth.supabase
      .from("anfragen")
      .select("id, email, vorname, booking_token, wunschtherapeut, assigned_therapist_id")
      .eq("id", requestId)
      .maybeSingle();
    if (requestError) return json({ error: "REQUEST_LOAD_FAILED" }, 500);
    if (!requestRow) return json({ error: "REQUEST_NOT_FOUND" }, 404);
    if (!canAccessAssignedRequest(auth.member, requestRow.assigned_therapist_id)) {
      return json({ error: "NO_ACCESS" }, 403);
    }
    if (!requestRow.email || !requestRow.booking_token) {
      return json({ error: "MISSING_BOOKING_DATA" }, 400);
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const configuredBaseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://app.mypoise.de";
    const baseUrl = new URL(configuredBaseUrl);
    if (baseUrl.protocol !== "https:") {
      return json({ error: "INVALID_SITE_URL" }, 500);
    }

    const bookingUrl = new URL(
      `/booking/${encodeURIComponent(requestRow.booking_token)}`,
      baseUrl
    ).toString();
    const safeUrl = bookingUrl.replace(/&/g, "&amp;");
    const safeName = String(requestRow.vorname || "").replace(/[&<>"']/g, "");
    const safeTherapistName = String(requestRow.wunschtherapeut || "").replace(/[&<>"']/g, "");

    const mailResult = await resend.emails.send({
      from: "Poise <noreply@mypoise.de>",
      to: requestRow.email,
      subject: "Buche hier deinen nächsten Termin 🤍",
      html: `
        <p>Hallo ${safeName},</p>

        <p>
          hier kannst du direkt deinen nächsten Termin buchen.
        </p>

        <p>
          ${
            safeTherapistName
              ? `Dein/e Therapeut:in: <strong>${safeTherapistName}</strong><br /><br />`
              : ""
          }
          <a
            href="${safeUrl}"
            style="display:inline-block;padding:12px 18px;background:#6f4f49;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;"
          >
            Termin buchen
          </a>
        </p>

        <p>
          Oder direkt über diesen Link:
          <br />
          <a href="${safeUrl}">${safeUrl}</a>
        </p>

        <p>Liebe Grüße<br />Dein Poise-Team</p>
      `,
    });

    if (mailResult?.error) {
      console.error("SEND BOOKING LINK MAIL FAILED");
      return json({ error: "BOOKING_LINK_EMAIL_FAILED" }, 502);
    }

    return json({ ok: true });
  } catch {
    console.error("SEND BOOKING LINK ERROR");
    return json(
      { error: "server_error", detail: "INTERNAL_ERROR" },
      500
    );
  }
}
