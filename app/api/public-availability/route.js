export const dynamic = "force-dynamic";

import { json, supabaseAdmin } from "../_lib/server";

export async function GET() {
  try {
    const sb = supabaseAdmin();

const { data: members, error: membersError } = await sb
  .from("team_members")
  .select("id, available_for_intake, active, matching_scores");

    if (membersError) {
      console.error("PUBLIC AVAILABILITY members ERROR:", membersError);
      return json(
        { error: "MEMBERS_LOAD_FAILED", detail: membersError.message },
        500
      );
    }

    const { data: bookingSettings, error: bookingError } = await sb
      .from("therapist_booking_settings")
      .select("therapist_id, booking_enabled");

    if (bookingError) {
      console.error("PUBLIC AVAILABILITY booking ERROR:", bookingError);
      return json(
        { error: "BOOKING_LOAD_FAILED", detail: bookingError.message },
        500
      );
    }

    return json({
      ok: true,
      members: members || [],
      bookingSettings: bookingSettings || [],
    });
  } catch (e) {
    console.error("PUBLIC AVAILABILITY SERVER ERROR:", e);
    return json(
      { error: "SERVER_ERROR", detail: String(e) },
      500
    );
  }
}
