import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261028010000_privacy_delete_request.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("privacy deletion migration contract", () => {
  it("uses one transaction, preserves explicit references and grants execution only to the server role", () => {
    expect(migration.trimStart().startsWith("-- prepared only")).toBe(true);
    expect(migration).toContain("begin;");
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain("revoke all on function public.privacy_delete_request(uuid, uuid) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.privacy_delete_request(uuid, uuid) to service_role");
    expect(migration).not.toMatch(/on delete\s+cascade/);
  });

  it("blocks protected data categories and never deletes finance, messaging or appointment rows", () => {
    for (const table of [
      "anfrage_health_data_consents",
      "request_care_assignments",
      "request_care_transfers",
      "request_health_authorizations",
      "request_care_operations",
      "request_conversations",
      "request_messages",
      "anfragen_reengagement_log",
      "client_link_recovery_queue",
      "sessions",
      "invoices",
      "blocked_slots",
      "appointment_proposals",
    ]) {
      expect(migration).toContain(`from public.${table}`);
    }
    for (const table of ["sessions", "invoices", "blocked_slots", "appointment_proposals",
      "request_messages", "request_conversations", "request_care_assignments",
      "request_care_transfers", "request_health_authorizations", "request_care_operations",
      "anfragen_reengagement_log", "client_link_recovery_queue"]) {
      expect(migration).not.toMatch(new RegExp(`delete\\s+from\\s+public\\.${table}\\b`));
    }
  });

  it("serializes request deletion against recovery queue creation and deletes only bound challenges", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("for key share");
    expect(migration).toContain("before insert or update of request_id on public.client_link_recovery_queue");
    expect(migration).toContain("raise exception 'invalid_request_id'");
    expect(migration).toContain("else true");
    expect(migration).toContain("delete from public.client_link_recovery where request_id = request.id");
    expect(migration).toContain("delete from public.anfragen where id = request.id");
  });
});
