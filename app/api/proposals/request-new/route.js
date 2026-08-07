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
        { error: "invalid_token" },
        404
      );
    }

    // ------------------------------------------------
    // BEREITS ANGEFORDERT?
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

    console.log(
      "🔁 NEW PROPOSALS REQUESTED:",
      {
        requestId:
          request.id,
        client:
          request.email,
        coach:
          request.wunschtherapeut,
      }
    );

    return json({
      ok: true,
      alreadyRequested: false,
      requested_at: requestedAt,
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
