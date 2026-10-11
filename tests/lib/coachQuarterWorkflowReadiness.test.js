import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCoachQuarterWorkflowReadiness,
  resetCoachQuarterWorkflowReadinessCache,
} from "../../app/lib/coachQuarterWorkflowReadiness.js";

function supabaseMock({ tableErrors = {}, rpcResult = { data: "missing", error: null } } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        select(columns) {
          calls.push({ type: "select", table, columns });
          return {
            limit: async () => ({ data: [], error: tableErrors[table] || null }),
          };
        },
        insert: () => { throw new Error("write_not_allowed"); },
        update: () => { throw new Error("write_not_allowed"); },
        delete: () => { throw new Error("write_not_allowed"); },
      };
    },
    rpc: async (name, args) => {
      calls.push({ type: "rpc", name, args });
      return rpcResult;
    },
  };
}

describe("coach quarter workflow readiness probe", () => {
  beforeEach(() => {
    resetCoachQuarterWorkflowReadinessCache();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("reports schema_pending when the release table is missing", async () => {
    const supabase = supabaseMock({
      tableErrors: { coach_quarter_releases: { code: "PGRST205" } },
    });
    expect(await getCoachQuarterWorkflowReadiness(supabase)).toEqual({
      ready: false,
      reason: "schema_pending",
    });
    expect(supabase.calls.some((call) => call.type === "rpc")).toBe(false);
  });

  it("reports schema_pending when new invoice columns are missing", async () => {
    const supabase = supabaseMock({
      tableErrors: { coach_invoices: { code: "42703" } },
    });
    expect((await getCoachQuarterWorkflowReadiness(supabase)).reason).toBe("schema_pending");
  });

  it("reports schema_pending when the link guard function is missing", async () => {
    const supabase = supabaseMock({
      rpcResult: { data: null, error: { code: "PGRST202" } },
    });
    expect(await getCoachQuarterWorkflowReadiness(supabase)).toEqual({
      ready: false,
      reason: "schema_pending",
    });
  });

  it("fails closed for unexpected errors and probe results", async () => {
    expect((await getCoachQuarterWorkflowReadiness(supabaseMock({
      tableErrors: { coach_invoices: { code: "57014" } },
    }))).reason).toBe("check_failed");
    expect((await getCoachQuarterWorkflowReadiness(supabaseMock({
      rpcResult: { data: "unique", error: null },
    }))).ready).toBe(false);
    expect((await getCoachQuarterWorkflowReadiness({
      from() { throw new Error("network"); },
    })).reason).toBe("check_failed");
  });

  it("is ready after all migrations and only reads", async () => {
    const supabase = supabaseMock();
    expect(await getCoachQuarterWorkflowReadiness(supabase)).toEqual({ ready: true, reason: null });
    expect(supabase.calls).toEqual([
      expect.objectContaining({ type: "select", table: "coach_invoices" }),
      expect.objectContaining({ type: "select", table: "coach_quarter_releases" }),
      {
        type: "rpc",
        name: "check_coach_invoice_link",
        args: { p_invoice_id: "00000000-0000-0000-0000-000000000000" },
      },
    ]);
    expect(supabase.calls[0].columns).toContain("sevdesk_creation_candidate_id");
  });

  it("caches only a positive result", async () => {
    const missing = supabaseMock({ tableErrors: { coach_quarter_releases: { code: "42P01" } } });
    await getCoachQuarterWorkflowReadiness(missing);
    await getCoachQuarterWorkflowReadiness(missing);
    expect(missing.calls.filter((call) => call.table === "coach_invoices")).toHaveLength(2);

    const ready = supabaseMock();
    await getCoachQuarterWorkflowReadiness(ready);
    await getCoachQuarterWorkflowReadiness(ready);
    expect(ready.calls).toHaveLength(3);
  });
});
