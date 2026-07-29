export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

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

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return json({ error: "missing_token" }, 400);
    }

    // ------------------------------------------------
    // Anfrage über sicheren booking_token laden
    // ------------------------------------------------
    const { data: request, error: requestError } = await supabase
      .from("anfragen")
      .select(`
        id,
        assigned_therapist_id,
        bevorzugte_zeit
      `)
      .eq("booking_token", token)
      .single();

    if (requestError || !request) {
      return json({ error: "invalid_token" }, 404);
    }

    if (!request.assigned_therapist_id) {
      return json({ error: "no_therapist_assigned" }, 404);
    }

    // ------------------------------------------------
    // Aktuellen geblockten Termin laden
    // ------------------------------------------------
    const nowIso = new Date().toISOString();

    const { data: blockedSlots, error: blockedError } = await supabase
      .from("blocked_slots")
      .select(`
        start_at,
        end_at,
        therapist_id
      `)
      .eq("anfrage_id", request.id)
      .eq("therapist_id", request.assigned_therapist_id)
      .gte("start_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(1);

    if (blockedError) {
      console.error("CLIENT APPOINTMENT BLOCK LOAD FAILED:", blockedError);

      return json(
        {
          error: "appointment_load_failed",
          detail: blockedError.message,
        },
        500
      );
    }

    const blockedSlot =
      Array.isArray(blockedSlots) && blockedSlots.length > 0
        ? blockedSlots[0]
        : null;

    if (!blockedSlot) {
      return json({ error: "no_upcoming_appointment" }, 404);
    }

    // ------------------------------------------------
    // Coach laden
    // ------------------------------------------------
    const { data: coach, error: coachError } = await supabase
      .from("team_members")
      .select(`
        id,
        name,
        profile_calendar_mode
      `)
      .eq("id", request.assigned_therapist_id)
      .single();

    if (coachError || !coach) {
      console.error("CLIENT APPOINTMENT COACH LOAD FAILED:", coachError);

      return json(
        {
          error: "coach_not_found",
        },
        404
      );
    }

    return json({
      start: blockedSlot.start_at,
      end: blockedSlot.end_at,
      therapistName: coach.name || "",
      calendarMode: coach.profile_calendar_mode || null,
    });
  } catch (err) {
    console.error("CLIENT APPOINTMENT ROUTE ERROR:", err);

    return json(
      {
        error: "server_error",
        detail: String(err),
      },
      500
    );
  }
}
