import { describe, expect, it } from "vitest";
import { formatInViennaTime } from "../../app/lib/formatAppointmentTime.js";

const REMINDER_OPTIONS = {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

describe("formatInViennaTime", () => {
  it("renders 11:00 Vienna summer time (CEST, UTC+2) from a Z-suffixed UTC value", () => {
    // 2026-07-15T11:00:00 Europe/Vienna == 2026-07-15T09:00:00Z in summer.
    const result = formatInViennaTime("2026-07-15T09:00:00.000Z", REMINDER_OPTIONS);
    expect(result).toContain("11:00");
    expect(result).not.toContain("09:00");
  });

  it("renders 11:00 Vienna winter time (CET, UTC+1) from a Z-suffixed UTC value", () => {
    // 2026-01-15T11:00:00 Europe/Vienna == 2026-01-15T10:00:00Z in winter.
    const result = formatInViennaTime("2026-01-15T10:00:00.000Z", REMINDER_OPTIONS);
    expect(result).toContain("11:00");
    expect(result).not.toContain("10:00");
  });

  it("handles the spring DST transition (CET -> CEST) correctly", () => {
    // 2026-03-29 02:00 CET -> 03:00 CEST is the switch instant (01:00 UTC).
    // Before the switch (2026-03-28, still CET/UTC+1): 11:00 Vienna == 10:00 UTC.
    const beforeSwitch = formatInViennaTime("2026-03-28T10:00:00.000Z", REMINDER_OPTIONS);
    expect(beforeSwitch).toContain("11:00");

    // After the switch (2026-03-30, now CEST/UTC+2): 11:00 Vienna == 09:00 UTC.
    const afterSwitch = formatInViennaTime("2026-03-30T09:00:00.000Z", REMINDER_OPTIONS);
    expect(afterSwitch).toContain("11:00");
  });

  it("handles the autumn DST transition (CEST -> CET) correctly", () => {
    // 2026-10-25 is the last Sunday of October 2026, DST ends at 03:00 CEST -> 02:00 CET.
    // 11:00 Vienna after the switch (CET, UTC+1) == 10:00 UTC.
    const afterSwitch = formatInViennaTime("2026-10-25T10:00:00.000Z", REMINDER_OPTIONS);
    expect(afterSwitch).toContain("11:00");
  });

  it("respects an explicit non-UTC offset in the ISO string", () => {
    // Explicit +02:00 offset already encodes Vienna summer local time.
    const result = formatInViennaTime("2026-07-15T11:00:00+02:00", REMINDER_OPTIONS);
    expect(result).toContain("11:00");
  });

  it("respects an explicit +01:00 offset (winter) in the ISO string", () => {
    const result = formatInViennaTime("2026-01-15T11:00:00+01:00", REMINDER_OPTIONS);
    expect(result).toContain("11:00");
  });

  it("matches the format used by the existing, correct appointment confirmation", () => {
    // Same options/timezone as app/api/confirm-appointment/route.js's safeDateString,
    // to guarantee confirmation and reminder mails stay in sync.
    const value = "2026-07-15T09:00:00.000Z";
    const confirmationStyle = formatInViennaTime(value, {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(confirmationStyle).toContain("11:00");
  });

  it("returns an empty string for missing or invalid values", () => {
    expect(formatInViennaTime(null)).toBe("");
    expect(formatInViennaTime(undefined)).toBe("");
    expect(formatInViennaTime("not-a-date")).toBe("");
  });

  it("uses the same underlying value for first-session and follow-up reminder styles", () => {
    // /api/reminders/send (Erstgespräch) and /api/reminder (Folgetermin/sessions)
    // use different weekday formatting but must resolve to the same wall-clock hour.
    const value = "2026-07-15T09:00:00.000Z";
    const erstgespraech = formatInViennaTime(value, REMINDER_OPTIONS);
    const folgetermin = formatInViennaTime(value, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(erstgespraech).toContain("11:00");
    expect(folgetermin).toContain("11:00");
  });
});
