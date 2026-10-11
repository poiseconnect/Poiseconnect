// Read-only probe: the quarterly release / sevDesk draft workflow requires
// migrations 20261008, 20261009, 20261011 and 20261012. Until all of them are
// installed, existing invoice views stay readable and every new write action
// is blocked server-side.

export const COACH_QUARTER_WORKFLOW_UNAVAILABLE_MESSAGE =
  "Die Quartalsfreigabe ist noch nicht verfügbar. Bestehende Rechnungen bleiben sichtbar; Freigabe, Speichern, Neuberechnung und sevDesk-Erstellung sind bis zur Systemumstellung gesperrt.";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const READY_CACHE_MS = 60_000;
const MISSING_SCHEMA_CODES = new Set([
  "42P01",
  "42703",
  "42883",
  "PGRST200",
  "PGRST202",
  "PGRST204",
  "PGRST205",
]);

const REQUIRED_INVOICE_COLUMNS = [
  "sevdesk_send_status",
  "sevdesk_send_error_code",
  "coach_quarter_release_version",
  "sevdesk_draft_invoice_number",
  "sevdesk_creation_candidate_id",
].join(", ");

let readyUntil = 0;

export function resetCoachQuarterWorkflowReadinessCache() {
  readyUntil = 0;
}

function classify(error) {
  return MISSING_SCHEMA_CODES.has(String(error?.code || ""))
    ? "schema_pending"
    : "check_failed";
}

export async function getCoachQuarterWorkflowReadiness(supabase) {
  if (Date.now() < readyUntil) return { ready: true, reason: null };
  try {
    const checks = [
      ["coach_invoices_columns", () =>
        supabase.from("coach_invoices").select(REQUIRED_INVOICE_COLUMNS).limit(1)],
      ["coach_quarter_releases", () =>
        supabase.from("coach_quarter_releases").select("coach_id").limit(1)],
      ["check_coach_invoice_link", () =>
        supabase.rpc("check_coach_invoice_link", { p_invoice_id: NIL_UUID })],
    ];
    for (const [object, run] of checks) {
      const { data, error } = await run();
      const linkProbeInvalid = object === "check_coach_invoice_link" && !error && data !== "missing";
      if (error || linkProbeInvalid) {
        const reason = error ? classify(error) : "check_failed";
        console.warn("coach_quarter_workflow_unavailable", { object, reason });
        return { ready: false, reason };
      }
    }
  } catch {
    console.warn("coach_quarter_workflow_unavailable", { object: "probe", reason: "check_failed" });
    return { ready: false, reason: "check_failed" };
  }
  readyUntil = Date.now() + READY_CACHE_MS;
  return { ready: true, reason: null };
}

export function coachQuarterWorkflowUnavailableBody(readiness) {
  return {
    error: "coach_quarter_workflow_unavailable",
    reason: readiness?.reason || "check_failed",
    message: COACH_QUARTER_WORKFLOW_UNAVAILABLE_MESSAGE,
  };
}
