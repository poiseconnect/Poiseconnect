import {
  getActiveTeamMember,
  json,
} from "../../_lib/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const auth = await getActiveTeamMember(req);
    if (!auth.member) return json({ error: auth.error }, auth.status);
    if (!["admin", "therapist"].includes(auth.member.role)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    let query = auth.supabase
      .from("sessions")
      .select("id, date, duration_min, price, commission, payout, therapist_id, anfrage_id, google_event_id")
      .order("date", { ascending: true });

    if (auth.member.role === "therapist") {
      query = query.or(
        `therapist_id.eq.${auth.member.id},therapist_id.eq.${auth.user.id}`
      );
    }

    const { data, error } = await query;
    if (error) {
      console.error("ADMIN SESSIONS ERROR", { code: error?.code || null });
      return json({ error: "INTERNAL_ERROR" }, 500);
    }

    return json({ data: data || [] });
  } catch (err) {
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
}
