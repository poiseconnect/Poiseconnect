export const dynamic = "force-dynamic";

import { getActiveTeamMember, json as serverJson } from "../../_lib/server";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const auth = await getActiveTeamMember(req);
    if (!auth.member) return serverJson({ error: auth.error }, auth.status);
    if (!["admin", "therapist"].includes(auth.member.role)) {
      return serverJson({ error: "NO_ACCESS" }, 403);
    }

    const body = await req.json();
    const { teamMemberId, available } = body || {};

    if (!teamMemberId || typeof available !== "boolean") {
      return json({ error: "missing_fields" }, 400);
    }

    if (
      auth.member.role === "therapist" &&
      String(teamMemberId) !== String(auth.member.id)
    ) {
      return serverJson({ error: "NO_ACCESS" }, 403);
    }

    let update = auth.supabase
      .from("team_members")
      .update({
        available_for_intake: available,
      })
      .eq("id", auth.member.role === "therapist" ? auth.member.id : teamMemberId);
    if (auth.member.role === "therapist") {
      update = update.eq("user_id", auth.user.id);
    }
    const { error } = await update;

    if (error) {
      console.error("TOGGLE AVAILABILITY ERROR:", { code: error?.code || null });
      return json({ error: "UPDATE_FAILED" }, 500);
    }

    return json({ ok: true });
  } catch {
    console.error("TOGGLE AVAILABILITY SERVER ERROR");
    return json(
      { error: "server_error", detail: "INTERNAL_ERROR" },
      500
    );
  }
}
