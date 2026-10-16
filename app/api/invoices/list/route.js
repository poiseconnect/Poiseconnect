import { getActiveTeamMember, json } from "../../_lib/server";

export async function GET(req) {
  const auth = await getActiveTeamMember(req);
  if (!auth.member) return json({ error: auth.error }, auth.status);
  if (!["admin", "therapist"].includes(auth.member.role)) {
    return json({ error: "NO_ACCESS" }, 403);
  }

  const { searchParams } = new URL(req.url);
  const requestedTherapistId = searchParams.get("therapist_id");
  const therapistId =
    auth.member.role === "admin"
      ? requestedTherapistId
      : auth.member.id;

  if (!therapistId) {
    return json({ error: "NO_THERAPIST_ID" }, 400);
  }
  if (
    auth.member.role === "therapist" &&
    requestedTherapistId &&
    String(requestedTherapistId) !== String(auth.member.id)
  ) {
    return json({ error: "NO_ACCESS" }, 403);
  }

  const { data, error } = await auth.supabase
    .from("invoices")
    .select("*")
    .eq("therapist_id", therapistId)
    .order("created_at", { ascending: false });

  if (error) {
    return json({ error: "INTERNAL_ERROR" }, 500);
  }

  return json({ data });
}
