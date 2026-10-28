import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261028000000_privacy_phase1_access.sql", "utf8");
const functionBody = (name) => {
  const start = sql.indexOf(`create function public.${name}(`);
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("\n$$;", start));
};

describe("prepared privacy migration contracts (static only; not a PostgreSQL/RLS proof)", () => {
  it("keeps historical financial sources out of the transfer write set", () => {
    const transfer = functionBody("privacy_handover_request");
    expect(transfer).not.toMatch(/(?:update|insert into|delete from) public\.(sessions|invoices|coach_invoices|blocked_slots)/i);
    expect(transfer).not.toContain("SESSION_HANDOVER_REQUIRES_REVIEW");
    expect(transfer).not.toMatch(/bevorzugte_zeit\s*=/);
    expect(transfer).not.toMatch(/wunschtherapeut\s*=/);
    expect(transfer).not.toMatch(/anliegen|diagnose|leidensdruck/);
  });
  it("uses a request lock, explicit version, atomic alias closure and durable idempotency record", () => {
    const transfer = functionBody("privacy_handover_request");
    expect(transfer).toContain("for update");
    expect(transfer).toContain("CARE_VERSION_CONFLICT");
    expect(transfer).toContain("IDEMPOTENCY_CONFLICT");
    expect(transfer).toContain("request_care_transfers");
    expect(functionBody("privacy_assignment_guard")).toContain("alias_revoked_at = now()");
    expect(functionBody("privacy_assignment_guard")).toContain("ATOMIC_CARE_TRANSFER_REQUIRED");
  });
  it("requires current period and a separate recipient authorization for coach reads", () => {
    const allows = functionBody("privacy_consent_allows");
    expect(allows).toContain("revoked_at is null");
    expect(allows).toContain("superseded_at is null");
    expect(allows).toContain("h.care_episode_id = p_request.care_episode_id");
    expect(allows).toContain("h.purpose = 'intake'");
    expect(allows).toContain("e.ended_at is null");
    expect(sql).not.toContain("privacy_health_transfer_blocked");
  });
  it("blocks only concrete future or unresolved operations, never any historical session", () => {
    const conflicts = functionBody("privacy_check_transfer_conflicts");
    expect(conflicts).toContain("completed_at is null");
    expect(conflicts).toContain("FUTURE_APPOINTMENTS_REQUIRE_DECISION");
    expect(conflicts).toContain("* interval '1 minute'");
    expect(conflicts).toContain("b.end_at > now()");
    expect(conflicts).not.toMatch(/delete|update/i);
  });
  it("leaves unconfirmed recipient histories untouched and scopes A->B->A by episode", () => {
    expect(sql).not.toMatch(/update public\.request_messages/i);
    expect(sql).not.toMatch(/delete from public\.(anfragen|anfrage_health_data_consents|request_messages)/i);
    const rls = functionBody("privacy_coach_can_read");
    expect(rls).toContain("c.care_episode_id = a.care_episode_id");
    expect(rls).toContain("auth.uid()");
    expect(rls).toContain("c.status = 'open'");
    expect(sql).toContain("revoke all on public.anfragen from public, anon, authenticated");
  });
  it("orders final save and revocation under the same request lock and does not create implicit recipient consent", () => {
    expect(functionBody("privacy_save_intake")).toContain("for update");
    expect(functionBody("privacy_revoke_intake_consent")).toContain("for update");
    expect(functionBody("privacy_save_intake")).toContain("RECIPIENT_CONSENT_REQUIRED");
    expect(functionBody("privacy_grant_intake_consent")).not.toContain("request.assigned_therapist_id");
  });
  it("rechecks the authenticated billing actor, current owner and version inside the mutation lock", () => {
    const save = functionBody("privacy_save_client_invoice");
    const remove = functionBody("privacy_delete_care_session");
    for (const body of [save, remove]) {
      expect(body).toContain("user_id = p_actor_id");
      expect(body).toContain("active = true");
      expect(body).toContain("for update");
      expect(body).toContain("request.assigned_therapist_id is distinct from actor.id");
    }
    expect(save).toContain("p_expected_version <> request.care_version");
    expect(save).toContain("INVALID_INVOICE_SESSIONS");
    expect(save).toContain("invoice.anfrage_id is distinct from request.id");
    expect(save).toContain("owner_id := invoice.therapist_id");
  });
});
