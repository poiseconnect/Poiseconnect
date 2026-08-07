export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// ------------------------------------------------
// MAIL ÜBER RESEND VERSENDEN
// ------------------------------------------------
async function sendMail({
  to,
  subject,
  html,
}) {
  const res = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <hallo@mypoise.de>",
        to,
        subject,
        html,
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();

    console.error(
      "❌ PROPOSAL REMINDER MAIL ERROR:",
      {
        to,
        subject,
        error: errorText,
      }
    );

    return false;
  }

  return true;
}

// ------------------------------------------------
// PRÜFEN, OB NOCH GÜLTIGE VORSCHLÄGE EXISTIEREN
// ------------------------------------------------
async function hasActiveProposals(
  requestId,
  now
) {
  const {
    count,
    error,
  } = await supabase
    .from("appointment_proposals")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("anfrage_id", requestId)
    .gt("expires_at", now);

  if (error) {
    console.error(
      "❌ ACTIVE PROPOSALS CHECK ERROR:",
      {
        requestId,
        error,
      }
    );

    return false;
  }

  return Number(count || 0) > 0;
}

export async function GET(req) {
  try {
    // ------------------------------------------------
    // CRON SECRET PRÜFEN
    // ------------------------------------------------
    const authHeader =
      req.headers.get("authorization") || "";

    if (
      process.env.CRON_SECRET &&
      authHeader !==
        `Bearer ${process.env.CRON_SECRET}`
    ) {
      return json(
        {
          error: "unauthorized",
        },
        401
      );
    }

    // ------------------------------------------------
    // ZEITGRENZEN
    // ------------------------------------------------
    const nowDate = new Date();
    const now = nowDate.toISOString();

    const reminder1Threshold =
      new Date(
        nowDate.getTime() -
          24 * 60 * 60 * 1000
      ).toISOString();

    const reminder2Threshold =
      new Date(
        nowDate.getTime() -
          72 * 60 * 60 * 1000
      ).toISOString();

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://app.mypoise.de";

    let reminder1Sent = 0;
    let reminder2Sent = 0;

    // =================================================
    // REMINDER 1
    // NACH MINDESTENS 24 STUNDEN
    // =================================================

    const {
      data: reminder1Requests,
      error: reminder1LoadError,
    } = await supabase
      .from("anfragen")
      .select(`
        id,
        email,
        vorname,
        wunschtherapeut,
        booking_token,
        proposals_sent_at,
        proposal_reminder_1_at
      `)
      .not(
        "proposals_sent_at",
        "is",
        null
      )
      .is(
        "proposal_reminder_1_at",
        null
      )
      .lte(
        "proposals_sent_at",
        reminder1Threshold
      );

    if (reminder1LoadError) {
      console.error(
        "❌ REMINDER 1 LOAD ERROR:",
        reminder1LoadError
      );
    } else {
      for (
        const request of
        reminder1Requests || []
      ) {
        if (
          !request.email ||
          !request.booking_token
        ) {
          continue;
        }

        // Nur erinnern, wenn noch
        // gültige Terminvorschläge existieren.
        const active =
          await hasActiveProposals(
            request.id,
            now
          );

        if (!active) {
          continue;
        }

        const link =
          `${baseUrl}/confirm-proposal?token=${encodeURIComponent(
            request.booking_token
          )}`;

        const coachName =
          request.wunschtherapeut ||
          "dein Coach";

        const mailSent =
          await sendMail({
            to: request.email,

            subject:
              "Deine Terminvorschläge warten auf dich 🤍",

            html: `
              <div
                style="
                  font-family: Arial, sans-serif;
                  line-height: 1.6;
                  color: #111;
                "
              >
                <p>
                  Hallo ${
                    request.vorname ||
                    "du"
                  },
                </p>

                <p>
                  wir wollten dich kurz daran erinnern,
                  dass noch Terminvorschläge für dein
                  Erstgespräch auf dich warten.
                </p>

                <p>
                  Such dir gerne den Termin aus,
                  der für dich am besten passt.
                </p>

                <p style="margin:24px 0;">
                  <a
                    href="${link}"
                    style="
                      background:#111;
                      color:#fff;
                      padding:12px 18px;
                      border-radius:999px;
                      text-decoration:none;
                      display:inline-block;
                      font-weight:600;
                    "
                  >
                    Termin auswählen
                  </a>
                </p>

                <p>
                  Deine Terminvorschläge sind
                  insgesamt vier Tage für dich
                  reserviert.
                </p>

                <p style="margin-top:24px;">
                  Alles Liebe<br />
                  ${coachName} 🤍
                </p>
              </div>
            `,
          });

        if (!mailSent) {
          continue;
        }

        const {
          error: updateError,
        } = await supabase
          .from("anfragen")
          .update({
            proposal_reminder_1_at:
              new Date().toISOString(),
          })
          .eq("id", request.id);

        if (updateError) {
          console.error(
            "❌ REMINDER 1 UPDATE ERROR:",
            {
              requestId:
                request.id,
              error:
                updateError,
            }
          );

          continue;
        }

        reminder1Sent += 1;

        console.log(
          "✅ PROPOSAL REMINDER 1 SENT:",
          {
            requestId:
              request.id,
            email:
              request.email,
          }
        );
      }
    }

    // =================================================
    // REMINDER 2
    // NACH MINDESTENS 72 STUNDEN
    // =================================================

    const {
      data: reminder2Requests,
      error: reminder2LoadError,
    } = await supabase
      .from("anfragen")
      .select(`
        id,
        email,
        vorname,
        wunschtherapeut,
        booking_token,
        proposals_sent_at,
        proposal_reminder_1_at,
        proposal_reminder_2_at
      `)
      .not(
        "proposals_sent_at",
        "is",
        null
      )
      .not(
        "proposal_reminder_1_at",
        "is",
        null
      )
      .is(
        "proposal_reminder_2_at",
        null
      )
      .lte(
        "proposals_sent_at",
        reminder2Threshold
      );

    if (reminder2LoadError) {
      console.error(
        "❌ REMINDER 2 LOAD ERROR:",
        reminder2LoadError
      );
    } else {
      for (
        const request of
        reminder2Requests || []
      ) {
        if (
          !request.email ||
          !request.booking_token
        ) {
          continue;
        }

        const active =
          await hasActiveProposals(
            request.id,
            now
          );

        if (!active) {
          continue;
        }

        const link =
          `${baseUrl}/confirm-proposal?token=${encodeURIComponent(
            request.booking_token
          )}`;

        const coachName =
          request.wunschtherapeut ||
          "dein Coach";

        const mailSent =
          await sendMail({
            to: request.email,

            subject:
              "Deine Terminvorschläge laufen bald ab 🤍",

            html: `
              <div
                style="
                  font-family: Arial, sans-serif;
                  line-height: 1.6;
                  color: #111;
                "
              >
                <p>
                  Hallo ${
                    request.vorname ||
                    "du"
                  },
                </p>

                <p>
                  deine Terminvorschläge für dein
                  Erstgespräch sind nur noch für
                  kurze Zeit reserviert.
                </p>

                <p>
                  Wenn du weiterhin ein Erstgespräch
                  möchtest, wähle bitte einen der
                  vorgeschlagenen Termine aus.
                </p>

                <p style="margin:24px 0;">
                  <a
                    href="${link}"
                    style="
                      background:#111;
                      color:#fff;
                      padding:12px 18px;
                      border-radius:999px;
                      text-decoration:none;
                      display:inline-block;
                      font-weight:600;
                    "
                  >
                    Jetzt Termin auswählen
                  </a>
                </p>

                <p>
                  Falls keiner der Termine für dich
                  passt, kannst du nach Ablauf neue
                  Terminvorschläge anfordern.
                </p>

                <p style="margin-top:24px;">
                  Alles Liebe<br />
                  ${coachName} 🤍
                </p>
              </div>
            `,
          });

        if (!mailSent) {
          continue;
        }

        const {
          error: updateError,
        } = await supabase
          .from("anfragen")
          .update({
            proposal_reminder_2_at:
              new Date().toISOString(),
          })
          .eq("id", request.id);

        if (updateError) {
          console.error(
            "❌ REMINDER 2 UPDATE ERROR:",
            {
              requestId:
                request.id,
              error:
                updateError,
            }
          );

          continue;
        }

        reminder2Sent += 1;

        console.log(
          "✅ PROPOSAL REMINDER 2 SENT:",
          {
            requestId:
              request.id,
            email:
              request.email,
          }
        );
      }
    }

    // ------------------------------------------------
    // FERTIG
    // ------------------------------------------------

    return json({
      ok: true,
      reminder1Sent,
      reminder2Sent,
      checkedAt: now,
    });
  } catch (e) {
    console.error(
      "🔥 PROPOSAL REMINDER CRON ERROR:",
      e
    );

    return json(
      {
        error: "server_error",
        detail: String(e),
      },
      500
    );
  }
}
