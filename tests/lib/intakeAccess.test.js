import { describe, expect, it, vi } from "vitest";
import { mergeRequestHealth, readRequestHealth } from "../../app/lib/intakeAccess.js";
import { HEALTH_DATA_FIELDS } from "../../app/lib/healthDataConsent.js";

const sensitive = Object.fromEntries(HEALTH_DATA_FIELDS.map((key) => [key, "synthetic-health"]));
const request = { id: "synthetic-case", status: "active", invoice_with_vat: false, ...sensitive };

describe("central sensitive field projection", () => {
  it("strips every sensitive base field after withdrawal while preserving neutral billing/status fields", () => {
    const [result] = mergeRequestHealth([request], [{ id: request.id, __healthAllowed: false }]);
    for (const key of HEALTH_DATA_FIELDS) expect(result).not.toHaveProperty(key);
    expect(result).toEqual({ id: request.id, status: "active", invoice_with_vat: false,
      sensitiveDataAccessRequired: true });
  });

  it("drops the entire stale live-case row if the current owner check no longer authorizes A", () => {
    expect(mergeRequestHealth([request], [])).toEqual([]);
  });

  it("merges only the explicit sensitive allowlist from the RPC", () => {
    const [result] = mergeRequestHealth([request], [{ id: request.id,
      __healthAllowed: true, anliegen: "authorized-synthetic", reply_alias: "not-for-client" }]);
    expect(result.anliegen).toBe("authorized-synthetic");
    expect(result).not.toHaveProperty("diagnose");
    expect(result).not.toHaveProperty("reply_alias");
    expect(result).not.toHaveProperty("__healthAllowed");
    expect(result.sensitiveDataAccessRequired).toBe(false);
  });

  it("does not merge a sensitive payload when the RPC explicitly denies consent", () => {
    const [result] = mergeRequestHealth([request], [{ id: request.id,
      __healthAllowed: false, ...sensitive }]);
    for (const key of HEALTH_DATA_FIELDS) expect(result).not.toHaveProperty(key);
  });

  it("never falls back to a base-table health read if the RPC is missing", async () => {
    const from = vi.fn();
    await expect(readRequestHealth({ from, rpc: async () => ({
      data: null, error: { code: "PGRST202" },
    }) }, [request.id], "synthetic-admin")).rejects.toThrow("HEALTH_DATA_ACCESS_UNAVAILABLE");
    expect(from).not.toHaveBeenCalled();
  });

  it("passes the verified actor and exact request IDs to the protected reader", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await readRequestHealth({ rpc }, [request.id], "synthetic-coach-b");
    expect(rpc).toHaveBeenCalledWith("privacy_read_request_health", {
      p_request_ids: [request.id], p_actor_id: "synthetic-coach-b",
    });
  });
});
