export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      requestId,
      email,
      vorname,
      bookingToken,
      therapistName,
    } = body || {};

    if (!requestId || !email || !bookingToken) {
      return json({ error: "missing_fields" }, 400);
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://poiseconnect.vercel.app";

    const bookingUrl = `${baseUrl}/booking/${bookingToken}`;

    const mailResult = await resend.emails.send({
      from: "Poise <noreply@mypoise.de>",
      to: email,
      subject: "Buche hier deinen nächsten Termin 🤍",
      html: `
        <p>Hallo ${vorname || ""},</p>

        <p>
          hier kannst du direkt deinen nächsten Termin buchen.
        </p>

        <p>
          ${
            therapistName
              ? `Dein/e Therapeut:in: <strong>${therapistName}</strong><br /><br />`
              : ""
          }
          <a
            href="${bookingUrl}"
            style="display:inline-block;padding:12px 18px;background:#6f4f49;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;"
          >
            Termin buchen
          </a>
        </p>

        <p>
          Oder direkt über diesen Link:
          <br />
          <a href="${bookingUrl}">${bookingUrl}</a>
        </p>

        <p>Liebe Grüße<br />Dein Poise-Team</p>
      `,
    });

    console.log("SEND BOOKING LINK MAIL RESULT:", mailResult);

    return json({ ok: true, bookingUrl });
  } catch (err) {
    console.error("SEND BOOKING LINK ERROR:", err);
    return json(
      { error: "server_error", detail: String(err) },
      500
    );
  }
}
