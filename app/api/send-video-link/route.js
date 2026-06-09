export const dynamic = "force-dynamic";

import { json, supabaseAdmin } from "../_lib/server";
import { Resend } from "resend";

export async function POST(req) {
  try {
    const { requestId } = await req.json();

    if (!requestId) {
      return json({ error: "MISSING_REQUEST_ID" }, 400);
    }

    const sb = supabaseAdmin();

    const { data: anfrage, error } = await sb
      .from("anfragen")
      .select("*")
      .eq("id", requestId)
      .single();

    if (error || !anfrage) {
      return json({ error: "ANFRAGE_NOT_FOUND" }, 404);
    }

    if (!anfrage.email) {
      return json({ error: "MISSING_EMAIL" }, 400);
    }

    const videoLink = anfrage.meeting_link_override;

    if (!videoLink) {
      return json({ error: "MISSING_VIDEO_LINK" }, 400);
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "Poise <noreply@mypoise.de>",
      to: anfrage.email,
      subject: "Dein Videolink für das Gespräch 🤍",
      html: `
        <p>Hallo ${anfrage.vorname || ""},</p>

        <p>hier ist dein Videolink für das Gespräch:</p>

        <p>
          <a
            href="${videoLink}"
            style="display:inline-block;padding:12px 18px;background:#6f4f49;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;"
          >
            Zum Videogespräch
          </a>
        </p>

        <p>
          Oder direkt über diesen Link:<br />
          <a href="${videoLink}">${videoLink}</a>
        </p>

        <p>Liebe Grüße<br />Dein Poise-Team</p>
      `,
    });
await sb
  .from("anfragen")
  .update({
    video_link_sent_at: new Date().toISOString(),
  })
  .eq("id", requestId);
    return json({ ok: true, videoLink });
  } catch (e) {
    console.error("SEND VIDEO LINK ERROR:", e);
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
