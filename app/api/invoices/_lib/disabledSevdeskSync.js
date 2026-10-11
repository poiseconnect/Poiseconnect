import { randomUUID } from "node:crypto";
import { getUserFromBearer, json, supabaseAdmin } from "../../_lib/server.js";
import {
  getCoachInvoiceLinkState,
  isCoachInvoiceLinkBlocked,
  SEVDESK_LINK_CONFLICT_MESSAGE,
} from "../../../lib/coachInvoiceLink.js";

export async function disabledSevdeskSync(req) {
  const { user } = await getUserFromBearer(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const supabase = supabaseAdmin();
  const { data: member, error } = await supabase.from("team_members")
    .select("id, role, active").eq("user_id", user.id).maybeSingle();
  if (error || !member || member.active !== true || member.role !== "admin") {
    return json({ error: "forbidden" }, 403);
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request_body" }, 400);
  }
  const invoiceId = String(body?.coachInvoiceId || "").trim();
  if (!invoiceId) return json({ error: "missing_coach_invoice_id" }, 400);
  const requestId = randomUUID();
  let state;
  try {
    state = await getCoachInvoiceLinkState(supabase, invoiceId);
  } catch {
    console.error("coach_invoice_sync_blocked", { requestId, code: "invoice_link_check_unavailable" });
    return json({ error: "invoice_link_check_unavailable", requestId }, 503);
  }
  const code = isCoachInvoiceLinkBlocked(state)
    ? "sevdesk_invoice_link_conflict"
    : "sevdesk_write_sync_disabled";
  console.error("coach_invoice_sync_blocked", { requestId, code });
  return json({
    error: code,
    message: isCoachInvoiceLinkBlocked(state)
      ? SEVDESK_LINK_CONFLICT_MESSAGE
      : "sevDesk-Schreib-Synchronisierung ist stillgelegt. Entwürfe bitte ausschließlich in sevDesk kontrollieren.",
    requestId,
  }, 409);
}
