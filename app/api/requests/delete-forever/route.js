import { getActiveTeamMember, json } from "../../_lib/server";

export const dynamic = "force-dynamic";

const DELETE_ERRORS = {
  NO_ACCESS: 403,
  REQUEST_NOT_FOUND: 404,
  REQUEST_DELETE_FAILED: 503,
};

export async function POST(req) {
  try {
    const auth = await getActiveTeamMember(req);
    if (!auth.member) return json({ error: auth.error }, auth.status);
    if (auth.member.role !== "admin") {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const body = await req.json();
    const requestId = body?.requestId;

    if (!requestId) {
      return json({ error: "missing_requestId" }, 400);
    }
    if (typeof requestId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
      return json({ error: "invalid_requestId" }, 400);
    }

    const { data, error } = await auth.supabase.rpc("privacy_delete_request", {
      p_request_id: requestId,
      p_actor_id: auth.member.id,
    });

    if (error) {
      if (Object.hasOwn(DELETE_ERRORS, error.message || "")) {
        return json({ error: error.message }, DELETE_ERRORS[error.message]);
      }
      if (error.code === "23503") {
        return json({
          error: "REQUEST_DELETE_BLOCKED",
          blockers: ["UNCLASSIFIED_DATABASE_DEPENDENCY"],
        }, 409);
      }
      console.error("REQUEST_DELETE_RPC_FAILED", { code: error.code || null });
      return json({ error: "REQUEST_DELETE_UNAVAILABLE" }, 503);
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.error("REQUEST_DELETE_RPC_INVALID_RESULT", { code: null });
      return json({ error: "REQUEST_DELETE_UNAVAILABLE" }, 503);
    }
    if (data.deleted === false && data.code === "REQUEST_DELETE_BLOCKED" &&
        Array.isArray(data.blockers) && data.blockers.every((item) => typeof item === "string")) {
      return json({
        error: "REQUEST_DELETE_BLOCKED",
        blockers: data.blockers,
      }, 409);
    }
    if (data.deleted !== true) {
      console.error("REQUEST_DELETE_RPC_INVALID_RESULT", { code: null });
      return json({ error: "REQUEST_DELETE_UNAVAILABLE" }, 503);
    }
    return json({ ok: true });
  } catch {
    console.error("REQUEST_DELETE_SERVER_ERROR");
    return json({ error: "server_error" }, 500);
  }
}
