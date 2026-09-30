import { describe, expect, it } from "vitest";
import {
  addProvisionResult,
  buildCoachInvoiceSettingsById,
  calculateControllingSessionCommission,
  createProvisionErrorCounts,
  getProvisionWarnings,
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

  it("keeps Ann's known provision and reports one invalid price separately", () => {
    const settingsById = buildCoachInvoiceSettingsById([
      { therapist_id: "ann", default_vat_rate: 19 },
    ]);
    const summary = {
      provision: 0,
      provision_calculation_incomplete: false,
      provision_errors: createProvisionErrorCounts(),
    };
    const sessions = [
      ...Array.from({ length: 10 }, (_, index) => session(`ann-${index}`, "ann", 150)),
      session("ann-invalid", "ann", null),
    ];

    sessions.forEach((current) => {
      addProvisionResult(
        summary,
        calculateControllingSessionCommission(current, settingsById)
      );
    });

    expect(summary.provision).toBeCloseTo(378.2, 2);
    expect(getProvisionWarnings(summary.provision_errors)).toEqual([
      "1 Sitzung ohne gültigen Preis",
    ]);
  });

  it("keeps Linda's valid mixed-session provision and counts five invalid prices", () => {
    const settingsById = buildCoachInvoiceSettingsById([
      { therapist_id: "linda", default_vat_rate: 19 },
    ]);
    const summary = {
      provision: 0,
      provision_calculation_incomplete: false,
      provision_errors: createProvisionErrorCounts(),
    };
    const sessions = [
      ...Array.from({ length: 12 }, (_, index) => session(`linda-with-${index}`, "linda")),
      ...Array.from({ length: 6 }, (_, index) => ({
        ...session(`linda-without-${index}`, "linda"),
        anfragen: { invoice_with_vat: false },
      })),
      ...Array.from({ length: 5 }, (_, index) => session(`linda-invalid-${index}`, "linda", null)),
    ];

    sessions.forEach((current) => {
      addProvisionResult(
        summary,
        calculateControllingSessionCommission(current, settingsById)
      );
    });

    expect(summary.provision).toBeCloseTo(965.04, 2);
    expect(getProvisionWarnings(summary.provision_errors)).toEqual([
      "5 Sitzungen ohne gültigen Preis",
    ]);
  });

  it("calculates without-VAT sessions without a coach VAT rate", () => {
    const summary = {
      provision: 0,
      provision_calculation_incomplete: false,
      provision_errors: createProvisionErrorCounts(),
    };
    const withoutVat = {
      ...session("without-vat", "coach-without-rate"),
      anfragen: { invoice_with_vat: false },
    };

    addProvisionResult(
      summary,
      calculateControllingSessionCommission(withoutVat, {})
    );

    expect(summary.provision).toBe(60);
    expect(getProvisionWarnings(summary.provision_errors)).toEqual([]);
  });

  it("preserves known provision when only with-VAT sessions lack a rate", () => {
    const summary = {
      provision: 0,
      provision_calculation_incomplete: false,
      provision_errors: createProvisionErrorCounts(),
    };
    const sessions = [
      {
        ...session("known", "coach-without-rate"),
        anfragen: { invoice_with_vat: false },
      },
      session("unknown-1", "coach-without-rate"),
      session("unknown-2", "coach-without-rate"),
      session("unknown-3", "coach-without-rate"),
    ];

    sessions.forEach((current) => {
      addProvisionResult(
        summary,
        calculateControllingSessionCommission(current, {})
      );
    });

    expect(summary.provision).toBe(60);
    expect(getProvisionWarnings(summary.provision_errors)).toEqual([
      "3 Sitzungen: USt-Satz fehlt",
    ]);
  });
});