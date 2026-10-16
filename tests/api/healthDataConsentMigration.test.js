import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("health-data consent migration", () => {
  it("is additive and does not default, backfill, or delete existing request data", () => {
    const sql = readFileSync(
      "supabase/migrations/20261017000000_anfrage_health_data_consent.sql",
      "utf8"
    );

    expect(sql).toContain("create table public.anfrage_health_data_consents");
    expect(sql).toContain("request_id uuid");
    expect(sql).toContain("token_hash text not null unique");
    expect(sql).toContain("text_version text not null");
    expect(sql).toContain("granted_at timestamptz not null default now()");
    expect(sql).toContain("revoked_at timestamptz");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("to service_role");
    expect(sql).not.toMatch(/alter table public\.anfragen/i);
    expect(sql).not.toMatch(/\b(update|delete|insert)\s+into\s+public\.anfragen\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
  });
});
