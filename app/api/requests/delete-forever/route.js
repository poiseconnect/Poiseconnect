import { getActiveTeamMember, json } from "../../_lib/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const auth = await getActiveTeamMember(req);
    if (!auth.member) return json({ error: auth.error }, auth.status);
    if (auth.member.role !== "admin") {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const { requestId } = await req.json();

    if (!requestId) {
      return json({ error: "missing_requestId" }, 400);
    }

    const { error } = await auth.supabase
      .from("anfragen")
      .delete()
      .eq("id", requestId);

    if (error) {
      console.error("DELETE ERROR:", { code: error?.code || null });
      return json({ error: "db_delete_failed" }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("DELETE SERVER ERROR");
    return json({ error: "server_error" }, 500);
  }
}
