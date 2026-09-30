import { describe, expect, it } from "vitest";
import {
  buildCoachInvoiceSettingsById,
  calculateControllingSessionCommission,
} from "../../app/lib/controllingBilling.js";

function session(id, therapistId, price = 200) {
  return {
    id,
    therapist_id: therapistId,
    price,
    anfragen: { invoice_with_vat: true },
  };
}

describe("controlling coach invoice settings", () => {
  it("maps a freshly loaded 19 percent rate by therapist_id", () => {
    const settingsById = buildCoachInvoiceSettingsById([
      { therapist_id: "coach-a", default_vat_rate: 19 },
    ]);

    expect(
      calculateControllingSessionCommission(
        session("session-a", "coach-a"),
        settingsById
      ).commissionNet
    ).toBe(50.42);
  });

  it("uses each coach's own rate when multiple coaches are shown", () => {
    const settingsById = buildCoachInvoiceSettingsById([
      { therapist_id: "coach-a", default_vat_rate: 19 },
      { therapist_id: "coach-b", default_vat_rate: 20 },
    ]);

    expect(
      calculateControllingSessionCommission(
        session("session-a", "coach-a"),
        settingsById
      ).commissionNet
    ).toBe(50.42);
    expect(
      calculateControllingSessionCommission(
        session("session-b", "coach-b"),
        settingsById
      ).commissionNet
    ).toBe(50);
  });

  it("reports a missing rate instead of falling back to a global setting", () => {
    const result = calculateControllingSessionCommission(
      session("session-a", "coach-without-settings"),
      { "another-coach": { default_vat_rate: 20 } }
    );

    expect(result.error).toBe("coach_vat_rate_missing");
  });

  it("calculates Sophie's 36 sessions using her stored 19 percent rate", () => {
    const settingsById = buildCoachInvoiceSettingsById([
      { therapist_id: "sophie", default_vat_rate: 19 },
    ]);
    const total = Array.from({ length: 36 }, (_, index) =>
      session(`sophie-${index}`, "sophie")
    ).reduce(
      (sum, current) =>
        sum + calculateControllingSessionCommission(current, settingsById).commissionNet,
      0
    );

    expect(total).toBeCloseTo(1815.12, 2);
  });
});