import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261028020000_sessions_insert_lockdown.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("standalone session INSERT lockdown", () => {
  it("removes the confirmed permissive policy in one transaction", () => {
    expect(migration).toContain("begin;");
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain('drop policy if exists "allow inserts from api" on public.sessions');
    expect(migration).not.toMatch(/create\s+policy|disable\s+row\s+level\s+security/);
  });

  it("revokes only browser INSERT table and column privileges", () => {
    expect(migration).toContain("revoke insert on table public.sessions from public, anon, authenticated");
    expect(migration).toContain("revoke insert (%i) on table public.sessions from public, anon, authenticated");
    expect(migration).toContain("pg_catalog.pg_attribute");
    expect(migration).toContain("and attnum > 0 and not attisdropped");
    expect(migration).not.toMatch(/revoke\s+(all|select|update|delete)|\bgrant\b/);
    expect(migration).not.toMatch(/\bservice_role\b|\bpostgres\b/);
  });

  it("does not mutate rows, add RPCs, or touch other tables", () => {
    expect(migration).not.toMatch(/\b(insert\s+into|update\s+public|delete\s+from|truncate|create\s+function)\b/);
    expect(migration).not.toMatch(/public\.(anfragen|invoices|blocked_slots|appointment_proposals)\b/);
  });
});
