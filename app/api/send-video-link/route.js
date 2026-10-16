export const dynamic = "force-dynamic";

import {
  canAccessAssignedRequest,
  getActiveTeamMember,
  json,
} from "../_lib/server";
import { Resend } from "resend";

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
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
      return json({ error: "MISSING_REQUEST_ID" }, 400);
    }

    const { data: anfrage, error } = await auth.supabase
      .from("anfragen")
      .select("id, email, vorname, assigned_therapist_id, meeting_link_override")
      .eq("id", requestId)
      .single();

    if (error || !anfrage) {
      return json({ error: "ANFRAGE_NOT_FOUND" }, 404);
    }
    if (!canAccessAssignedRequest(auth.member, anfrage.assigned_therapist_id)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    if (!anfrage.email) {
      return json({ error: "MISSING_EMAIL" }, 400);
    }

    let bookingSettings = null;

    if (!anfrage.meeting_link_override && anfrage.assigned_therapist_id) {
      const { data, error: bookingError } = await auth.supabase
        .from("therapist_booking_settings")
        .select("meeting_link")
        .eq("therapist_id", anfrage.assigned_therapist_id)
        .maybeSingle();

      if (bookingError) {
        console.error("SEND VIDEO LINK BOOKING SETTINGS LOAD ERROR:", {
          code: bookingError.code || null,
        });
        return json({ error: "BOOKING_SETTINGS_LOAD_FAILED" }, 500);
      }

      bookingSettings = data;
    }

    const videoLink =
      anfrage.meeting_link_override ||
      bookingSettings?.meeting_link;

    if (!videoLink) {
      return json({ error: "MISSING_VIDEO_LINK" }, 400);
    }
    let parsedVideoLink;
    try {
      parsedVideoLink = new URL(videoLink);
    } catch {
      return json({ error: "INVALID_VIDEO_LINK" }, 400);
    }
    if (parsedVideoLink.protocol !== "https:") {
      return json({ error: "INVALID_VIDEO_LINK" }, 400);
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const safeVideoLink = escapeHtml(parsedVideoLink.toString());

    const { error: mailError } = await resend.emails.send({
      from: "Poise <noreply@mypoise.de>",
      to: anfrage.email,
      subject: "Dein Videolink für das Gespräch 🤍",
      html: `
        <p>Hallo ${escapeHtml(anfrage.vorname || "")},</p>

        <p>hier ist dein Videolink für das Gespräch:</p>

        <p>
          <a
            href="${safeVideoLink}"
            style="display:inline-block;padding:12px 18px;background:#6f4f49;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;"
          >
            Zum Videogespräch
          </a>
        </p>

        <p>
          Oder direkt über diesen Link:<br />
          <a href="${safeVideoLink}">${safeVideoLink}</a>
        </p>

        <p>Liebe Grüße<br />Dein Poise-Team</p>
      `,
    });
    if (mailError) {
      console.error("SEND VIDEO LINK MAIL FAILED");
      return json({ error: "VIDEO_LINK_EMAIL_FAILED" }, 502);
    }
const { error: updateError } = await auth.supabase
  .from("anfragen")
  .update({
    video_link_sent_at: new Date().toISOString(),
  })
  .eq("id", requestId);
    if (updateError) {
      console.error("SEND VIDEO LINK TIMESTAMP UPDATE ERROR:", {
        code: updateError.code || null,
      });
      return json({ error: "VIDEO_LINK_SENT_TIMESTAMP_FAILED" }, 500);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("SEND VIDEO LINK ERROR");
    return json({ error: "SERVER_ERROR", detail: "INTERNAL_ERROR" }, 500);
  }
}
