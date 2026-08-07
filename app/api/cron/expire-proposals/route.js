export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { oauthClient } from "../../_lib/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ------------------------------------------------
// MAIL VERSENDEN
// ------------------------------------------------
async function sendMail({ to, subject, html }) {
  const res = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
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
    const text = await res.text();

    console.error("❌ RESEND MAIL FAILED:", {
      to,
      subject,
      error: text,
    });

    return false;
  }

  return true;
}

export async function GET(req) {
  try {
    // ------------------------------------------------
    // CRON SCHUTZ
    // ------------------------------------------------
    const authHeader =
      req.headers.get("authorization") || "";

    if (
      process.env.CRON_SECRET &&
      authHeader !==
        `Bearer ${process.env.CRON_SECRET}`
    ) {
      return json(
        { error: "unauthorized" },
        401
      );
    }

    // ------------------------------------------------
    // ZEITEN
    // ------------------------------------------------
    const nowDate = new Date();
    const now = nowDate.toISOString();

    const reminder1Threshold = new Date(
      nowDate.getTime() -
        24 * 60 * 60 * 1000
    ).toISOString();

    const reminder2Threshold = new Date(
      nowDate.getTime() -
        72 * 60 * 60 * 1000
    ).toISOString();

    // Damit Reminder 1 und Reminder 2
    // nicht im selben Cron-Lauf verschickt werden.
    const reminder1MustBeOlderThan =
      new Date(
        nowDate.getTime() -
          12 * 60 * 60 * 1000
      ).toISOString();

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://app.mypoise.de";

    let reminder1Sent = 0;
    let reminder2Sent = 0;
    let deletedGoogleEvents = 0;
    let expiredRequests = 0;

    // =================================================
    // 1. REMINDER NACH 24 STUNDEN
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

        // Gibt es überhaupt noch gültige Vorschläge?
        const {
          count,
          error: proposalCountError,
        } = await supabase
          .from("appointment_proposals")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "anfrage_id",
            request.id
          )
          .gt("expires_at", now);

        if (proposalCountError) {
          console.error(
            "❌ REMINDER 1 PROPOSAL CHECK ERROR:",
            proposalCountError
          );

          continue;
        }

        if (!count) {
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
              <div style="
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #111;
              ">
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
                  Die Vorschläge bleiben insgesamt
                  vier Tage für dich reserviert.
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
          error: reminder1UpdateError,
        } = await supabase
          .from("anfragen")
          .update({
            proposal_reminder_1_at:
              new Date().toISOString(),
          })
          .eq("id", request.id);

        if (reminder1UpdateError) {
          console.error(
            "❌ REMINDER 1 STATUS UPDATE ERROR:",
            reminder1UpdateError
          );

          continue;
        }

        reminder1Sent += 1;

        console.log(
          "✅ REMINDER 1 SENT:",
          request.email
        );
      }
    }

    // =================================================
    // 2. REMINDER NACH 72 STUNDEN
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
      )
      .lte(
        "proposal_reminder_1_at",
        reminder1MustBeOlderThan
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

        const {
          count,
          error: proposalCountError,
        } = await supabase
          .from("appointment_proposals")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "anfrage_id",
            request.id
          )
          .gt("expires_at", now);

        if (proposalCountError) {
          console.error(
            "❌ REMINDER 2 PROPOSAL CHECK ERROR:",
            proposalCountError
          );

          continue;
        }

        if (!count) {
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
              <div style="
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #111;
              ">
                <p>
                  Hallo ${
                    request.vorname ||
                    "du"
                  },
                </p>

                <p>
                  deine Terminvorschläge für das
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
                  Falls keiner der Termine passt,
                  kannst du nach Ablauf einfach
                  neue Terminvorschläge anfordern.
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
          error: reminder2UpdateError,
        } = await supabase
          .from("anfragen")
          .update({
            proposal_reminder_2_at:
              new Date().toISOString(),
          })
          .eq("id", request.id);

        if (reminder2UpdateError) {
          console.error(
            "❌ REMINDER 2 STATUS UPDATE ERROR:",
            reminder2UpdateError
          );

          continue;
        }

        reminder2Sent += 1;

        console.log(
          "✅ REMINDER 2 SENT:",
          request.email
        );
      }
    }

    // =================================================
    // 3. ABGELAUFENE PROPOSALS LADEN
    // =================================================

    const {
      data: expiredProposals,
      error: loadError,
    } = await supabase
      .from("appointment_proposals")
      .select(`
        id,
        anfrage_id,
        therapist_id,
        google_event_id,
        expires_at
      `)
      .lt("expires_at", now);

    if (loadError) {
      console.error(
        "❌ EXPIRED PROPOSALS LOAD FAILED:",
        loadError
      );

      return json(
        {
          error:
            "expired_proposals_load_failed",
          detail: loadError.message,
        },
        500
      );
    }

    // WICHTIG:
    // Hier KEIN return mehr, wenn nichts
    // abgelaufen ist.
    //
    // Sonst würden zukünftige Erweiterungen
    // des Cron-Flows wieder übersprungen.

    if (
      expiredProposals &&
      expiredProposals.length > 0
    ) {
      // ----------------------------------------------
      // Betroffene Anfrage-IDs merken
      // ----------------------------------------------

      const expiredRequestIds = [
        ...new Set(
          expiredProposals.map(
            (proposal) =>
              proposal.anfrage_id
          )
        ),
      ];

      // ----------------------------------------------
      // Google Calendar vorbereiten
      // ----------------------------------------------

      const oauth = oauthClient();

      oauth.setCredentials({
        access_token:
          process.env.GOOGLE_ACCESS_TOKEN,

        refresh_token:
          process.env.GOOGLE_REFRESH_TOKEN,
      });

      const calendar =
        google.calendar({
          version: "v3",
          auth: oauth,
        });

      const proposalIdsToDelete = [];

      // ----------------------------------------------
      // JEDES ABGELAUFENE PROPOSAL VERARBEITEN
      // ----------------------------------------------

      for (
        const proposal of
        expiredProposals
      ) {
        const {
          data: bookingSettings,
          error: bookingSettingsError,
        } = await supabase
          .from(
            "therapist_booking_settings"
          )
          .select(
            "selected_calendar_id"
          )
          .eq(
            "therapist_id",
            proposal.therapist_id
          )
          .single();

        if (
          bookingSettingsError ||
          !bookingSettings
            ?.selected_calendar_id
        ) {
          console.error(
            "❌ CALENDAR ID MISSING FOR EXPIRED PROPOSAL:",
            {
              proposalId:
                proposal.id,
              therapistId:
                proposal.therapist_id,
              error:
                bookingSettingsError,
            }
          );

          // Nicht löschen.
          // Beim nächsten Cron erneut versuchen.
          continue;
        }

        // ------------------------------------------
        // Google Reservierung löschen
        // ------------------------------------------

        if (
          proposal.google_event_id
        ) {
          try {
            await calendar.events.delete({
              calendarId:
                bookingSettings
                  .selected_calendar_id,

              eventId:
                proposal.google_event_id,
            });

            deletedGoogleEvents += 1;

            console.log(
              "🗑️ EXPIRED GOOGLE PROPOSAL DELETED:",
              proposal.google_event_id
            );
          } catch (
            googleDeleteError
          ) {
            const status =
              googleDeleteError
                ?.response?.status ||
              googleDeleteError?.code;

            if (status === 404) {
              console.warn(
                "⚠️ GOOGLE EVENT ALREADY GONE:",
                proposal.google_event_id
              );
            } else {
              console.error(
                "❌ EXPIRED GOOGLE EVENT DELETE FAILED:",
                {
                  proposalId:
                    proposal.id,

                  googleEventId:
                    proposal.google_event_id,

                  error:
                    googleDeleteError,
                }
              );

              // Bei echtem Google-Fehler
              // Proposal behalten.
              continue;
            }
          }
        }

        proposalIdsToDelete.push(
          proposal.id
        );
      }

      // ----------------------------------------------
      // PROPOSALS AUS SUPABASE LÖSCHEN
      // ----------------------------------------------

      if (
        proposalIdsToDelete.length >
        0
      ) {
        const {
          error: deleteDbError,
        } = await supabase
          .from(
            "appointment_proposals"
          )
          .delete()
          .in(
            "id",
            proposalIdsToDelete
          );

        if (deleteDbError) {
          console.error(
            "❌ EXPIRED PROPOSALS DB DELETE FAILED:",
            deleteDbError
          );

          return json(
            {
              error:
                "expired_proposals_db_delete_failed",

              detail:
                deleteDbError.message,
            },
            500
          );
        }
      }

      // ----------------------------------------------
      // ANFRAGEN ALS ABGELAUFEN MARKIEREN
      // ----------------------------------------------

      for (
        const requestId of
        expiredRequestIds
      ) {
        // Prüfen, ob für diese Anfrage
        // wirklich KEINE Proposal mehr existiert.
        //
        // Falls z.B. ein Google-Fehler auftrat,
        // markieren wir sie noch nicht als abgelaufen.

        const {
          count,
          error: remainingError,
        } = await supabase
          .from(
            "appointment_proposals"
          )
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "anfrage_id",
            requestId
          );

        if (remainingError) {
          console.error(
            "❌ REMAINING PROPOSALS CHECK ERROR:",
            remainingError
          );

          continue;
        }

        if (count > 0) {
          continue;
        }

        const {
          error: expiredUpdateError,
        } = await supabase
          .from("anfragen")
          .update({
            proposals_expired_at:
              new Date().toISOString(),
          })
          .eq("id", requestId);

        if (
          expiredUpdateError
        ) {
          console.error(
            "❌ EXPIRED STATUS UPDATE ERROR:",
            expiredUpdateError
          );

          continue;
        }

        expiredRequests += 1;

        console.log(
          "✅ REQUEST PROPOSALS EXPIRED:",
          requestId
        );
      }
    }

    // =================================================
    // FERTIG
    // =================================================

    return json({
      ok: true,

      reminder1Sent,
      reminder2Sent,

      expired:
        expiredProposals?.length ||
        0,

      expiredRequests,

      deletedGoogleEvents,
    });
  } catch (e) {
    console.error(
      "🔥 EXPIRE PROPOSALS CRON ERROR:",
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
