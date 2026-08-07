export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(
  process.env.RESEND_API_KEY
);

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
      },
    }
  );
}

export async function POST(req) {
  try {
    const { token } = await req.json();

    if (!token) {
      return json(
        { error: "missing_token" },
        400
      );
    }

    // ------------------------------------------------
    // ANFRAGE ÜBER BOOKING TOKEN LADEN
    // ------------------------------------------------

    const {
      data: request,
      error: requestError,
    } = await supabase
      .from("anfragen")
      .select(`
        id,
        email,
        vorname,
        wunschtherapeut,
        assigned_therapist_id,
        booking_token,
        new_proposals_requested_at
      `)
      .eq("booking_token", token)
      .single();

    if (
      requestError ||
      !request
    ) {
      console.error(
        "❌ REQUEST NEW PROPOSALS TOKEN ERROR:",
        requestError
      );

      return json(
        {
          error: "invalid_token",
        },
        404
      );
    }

    // ------------------------------------------------
    // SCHON ANGEFORDERT?
    // ------------------------------------------------

    if (
      request.new_proposals_requested_at
    ) {
      return json({
        ok: true,
        alreadyRequested: true,
        requested_at:
          request.new_proposals_requested_at,
      });
    }

    // ------------------------------------------------
    // ZEITPUNKT SPEICHERN
    // ------------------------------------------------

    const requestedAt =
      new Date().toISOString();

    const {
      error: updateError,
    } = await supabase
      .from("anfragen")
      .update({
        new_proposals_requested_at:
          requestedAt,
      })
      .eq("id", request.id);

    if (updateError) {
      console.error(
        "❌ REQUEST NEW PROPOSALS UPDATE ERROR:",
        updateError
      );

      return json(
        {
          error:
            "request_update_failed",
          detail:
            updateError.message,
        },
        500
      );
    }

    // ------------------------------------------------
    // COACH LADEN
    // ------------------------------------------------

    let coachEmail = null;
    let coachName =
      request.wunschtherapeut ||
      "dein Coach";

    if (
      request.assigned_therapist_id
    ) {
      const {
        data: coach,
        error: coachError,
      } = await supabase
        .from("team_members")
        .select(
          "id, name, email"
        )
        .eq(
          "id",
          request.assigned_therapist_id
        )
        .single();

      if (coachError) {
        console.warn(
          "⚠️ COACH LOAD FAILED:",
          coachError
        );
      }

      if (coach) {
        coachEmail =
          coach.email || null;

        coachName =
          coach.name ||
          coachName;
      }
    }

    // ------------------------------------------------
    // COACH INFORMIEREN
    // ------------------------------------------------

    if (coachEmail) {
      try {
        await resend.emails.send({
          from:
            "Poise <noreply@mypoise.de>",

          to: coachEmail,

          subject:
            "Neue Terminvorschläge angefordert 🤍",

          html: `
            <p>Hallo ${coachName},</p>

            <p>
              ${
                request.vorname ||
                "Ein:e Klient:in"
              }
              hat neue Terminvorschläge angefordert.
            </p>

            <p>
              Bitte öffne dein Poise Dashboard
              und sende möglichst zeitnah neue
              Terminvorschläge.
            </p>

            <p>
              Liebe Grüße<br/>
              Sebastian
            </p>
          `,
        });

        console.log(
          "✅ NEW PROPOSALS COACH MAIL SENT TO:",
          coachEmail
        );
      } catch (mailError) {
        // Anfrage bleibt trotzdem gespeichert
        console.warn(
          "⚠️ NEW PROPOSALS COACH MAIL FAILED:",
          mailError
        );
      }
    } else {
      console.warn(
        "⚠️ Keine Coach-E-Mail gefunden:",
        {
          requestId:
            request.id,

          assignedTherapistId:
            request.assigned_therapist_id,

          therapist:
            request.wunschtherapeut,
        }
      );
    }

    // ------------------------------------------------
    // FERTIG
    // ------------------------------------------------

    console.log(
      "🔁 NEW PROPOSALS REQUESTED:",
      {
        requestId:
          request.id,

        client:
          request.email,

        coach:
          coachName,
      }
    );

    return json({
      ok: true,
      alreadyRequested: false,
      requested_at:
        requestedAt,
    });
  } catch (e) {
    console.error(
      "🔥 REQUEST NEW PROPOSALS ERROR:",
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
