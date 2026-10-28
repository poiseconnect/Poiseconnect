export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { appointmentCareContext, withAppointmentOperation } from "../../../../lib/appointmentCare";

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

export async function POST(req) {
  return withAppointmentOperation((operation) => executePost(req, operation));
}

async function executePost(req, operation) {
  try {
    const { token, expectedCareVersion } = await req.json();

    if (!token) {
      return json({ error: "missing_token" }, 400);
    }

    // Anfrage über sicheren Token laden
    const { data: request, error: requestError } = await supabase
      .from("anfragen")
      .select(`
        id,
        vorname,
        nachname,
        email,
        assigned_therapist_id,
        wunschtherapeut,
        status
      `)
      .eq("booking_token", token)
      .single();

    if (requestError || !request) {
      return json({ error: "invalid_token" }, 404);
    }

    if (!request.assigned_therapist_id) {
      return json({ error: "no_therapist_assigned" }, 400);
    }
    const care = await appointmentCareContext(supabase, request.id, request.assigned_therapist_id, {
      link: true, expectedVersion: expectedCareVersion ?? null,
    });
    if (care.error) return json({ error: care.error }, care.status);

    // Coach laden
    const { data: coach, error: coachError } = await supabase
      .from("team_members")
      .select(`
        id,
        name,
        email,
        profile_calendar_mode
      `)
      .eq("id", request.assigned_therapist_id)
      .single();

    if (coachError || !coach) {
      return json({ error: "coach_not_found" }, 404);
    }

    if (coach.profile_calendar_mode !== "proposal") {
      return json(
        { error: "not_proposal_mode" },
        400
      );
    }

    // WICHTIG:
    // bestehenden Termin NICHT löschen.
    // Nur Änderungswunsch markieren.
    const claim = await operation.begin(supabase, request.id, request.assigned_therapist_id, care.careVersion);
    if (claim.error) return json({ error: claim.error }, claim.status);
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        match_state: "reschedule_requested",
      })
      .eq("id", request.id)
      .eq("assigned_therapist_id", request.assigned_therapist_id)
      .eq("care_version", care.careVersion);

    if (updateError) {
      console.error("RESCHEDULE REQUEST UPDATE FAILED:", { code: updateError?.code || null });

      return json(
        {
          error: "request_update_failed",
          detail: "INTERNAL_ERROR",
        },
        500
      );
    }

    // Coach informieren
    if (coach.email) {
      const clientName =
        `${request.vorname || ""} ${request.nachname || ""}`.trim() ||
        "Klient:in";

      try {
        const mail = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Poise <noreply@mypoise.de>",
            to: coach.email,
            subject: "Neuer Termin gewünscht 🤍",
            html: `
              <p>Hallo ${coach.name || ""},</p>

              <p>
                ${clientName} möchte den bestehenden Termin ändern.
              </p>

              <p>
                Der aktuelle Termin bleibt vorerst bestehen.
                Bitte sende über Poise Connect neue Terminvorschläge.
              </p>

              <p>
                Liebe Grüße<br/>
                Poise Connect
              </p>
            `,
          }),
        });
        if (!mail.ok) operation.markUnknown();
      } catch (mailError) {
        operation.markUnknown();
        console.error("RESCHEDULE REQUEST MAIL FAILED");
      }
    }

    return json({
      ok: true,
      requested: true,
    });
  } catch (err) {
    console.error("RESCHEDULE REQUEST ERROR");

    return json(
      {
        error: "server_error",
        detail: "INTERNAL_ERROR",
      },
      500
    );
  }
}
