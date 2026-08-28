export const dynamic = "force-dynamic";

import { json, supabaseAdmin } from "../_lib/server";

export async function GET() {
  try {
    const sb = supabaseAdmin();

const { data: members, error: membersError } = await sb
  .from("team_members")
  .select("id, available_for_intake, active, matching_scores");

    if (membersError) {
      console.error("PUBLIC AVAILABILITY MEMBERS ERROR:", { code: membersError?.code || null });
      return json(
        { error: "MEMBERS_LOAD_FAILED", detail: "INTERNAL_ERROR" },
        500
      );
    }

    const { data: bookingSettings, error: bookingError } = await sb
      .from("therapist_booking_settings")
      .select("therapist_id, booking_enabled");

    if (bookingError) {
      console.error("PUBLIC AVAILABILITY BOOKING ERROR:", { code: bookingError?.code || null });
      return json(
        { error: "BOOKING_LOAD_FAILED", detail: "INTERNAL_ERROR" },
        500
      );
    }

    return json({
      ok: true,
      members: members || [],
      bookingSettings: bookingSettings || [],
    });
  } catch (e) {
    console.error("PUBLIC AVAILABILITY SERVER ERROR");
    return json(
      { error: "SERVER_ERROR", detail: "INTERNAL_ERROR" },
      500
    );
  }
}
