export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  canAccessAssignedRequest,
  getActiveTeamMember,
  json,
} from "../_lib/server";

export async function POST(req) {
  try {
    const auth = await getActiveTeamMember(req);
    if (!auth.member) return json({ error: auth.error }, auth.status);
    if (!["admin", "therapist"].includes(auth.member.role)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const body = await req.json();
    const { anfrageId, vat_mode, vat_country, vat_rate, vat_reason } = body || {};

    if (!anfrageId) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const { data: anfrage, error: fetchErr } = await auth.supabase
      .from("anfragen")
      .select("id, assigned_therapist_id")
      .eq("id", anfrageId)
      .maybeSingle();

    if (fetchErr) {
      return json({ error: "REQUEST_LOAD_FAILED" }, 500);
    }
    if (!anfrage) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    if (!canAccessAssignedRequest(auth.member, anfrage.assigned_therapist_id)) {
      return json({ error: "FORBIDDEN" }, 403);
    }

    const mode = vat_mode || "exempt";
    const rate = mode === "taxable" ? Number(vat_rate || 0) : 0;
    if (
      !["exempt", "taxable"].includes(mode) ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 100
    ) {
      return json({ error: "INVALID_VAT_DATA" }, 400);
    }

    let update = auth.supabase
      .from("anfragen")
      .update({
        vat_mode: mode,
        vat_country: vat_country || null,
        vat_rate: rate,
        vat_reason: vat_reason || null,
        vat_decided_by: auth.member.email || auth.user.email || null,
      })
      .eq("id", anfrageId);
    if (auth.member.role === "therapist") {
      update = update.eq("assigned_therapist_id", auth.member.id);
    }
    const { data: updated, error: updErr } = await update
      .select("id")
      .maybeSingle();

    if (updErr || !updated) {
      console.error("update-client-vat error", { code: updErr?.code || null });
      return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("update-client-vat server error");
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
