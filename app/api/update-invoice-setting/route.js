export const dynamic = "force-dynamic";

import {
  canAccessAssignedRequest,
  getActiveTeamMember,
} from "../_lib/server";

function sendJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request) {
  try {
    const auth = await getActiveTeamMember(request);
    if (!auth.member) return sendJson({ error: auth.error }, auth.status);
    if (!["admin", "therapist"].includes(auth.member.role)) {
      return sendJson({ error: "NO_ACCESS" }, 403);
    }

    const body = await request.json();

    const { anfrageId, invoice_with_vat } = body || {};

    if (!anfrageId || typeof invoice_with_vat !== "boolean") {
      return sendJson(
        { error: "MISSING_FIELDS" },
        400
      );
    }

    const { data: requestRow, error: requestError } = await auth.supabase
      .from("anfragen")
      .select("id, assigned_therapist_id")
      .eq("id", anfrageId)
      .maybeSingle();
    if (requestError) return sendJson({ error: "REQUEST_LOAD_FAILED" }, 500);
    if (!requestRow) return sendJson({ error: "REQUEST_NOT_FOUND" }, 404);
    if (!canAccessAssignedRequest(auth.member, requestRow.assigned_therapist_id)) {
      return sendJson({ error: "NO_ACCESS" }, 403);
    }

    let update = auth.supabase
      .from("anfragen")
      .update({ invoice_with_vat })
      .eq("id", anfrageId);
    if (auth.member.role === "therapist") {
      update = update.eq("assigned_therapist_id", auth.member.id);
    }
    const { data, error } = await update
      .select("id, invoice_with_vat")
      .single();

    if (error) {
      console.error("UPDATE INVOICE SETTING SUPABASE ERROR:", { code: error?.code || null });
      return sendJson({ error: "UPDATE_FAILED" }, 500);
    }

    return sendJson({ ok: true, data });
  } catch {
    console.error("UPDATE INVOICE SETTING SERVER ERROR");

    return sendJson(
      {
        error: "SERVER_ERROR",
        message: "INTERNAL_ERROR",
      },
      500
    );
  }
}
