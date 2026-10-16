import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  HEALTH_DATA_CONSENT_TEXT,
  HEALTH_DATA_CONSENT_VERSION,
} from "../../app/lib/healthDataConsentShared.js";

describe("health-data consent form gate", () => {
  it("uses a separate, versioned consent and a privacy-policy link", () => {
    const source = readFileSync("app/page-client.jsx", "utf8");

    expect(HEALTH_DATA_CONSENT_VERSION).toBe("2026-10-16-v1");
    expect(HEALTH_DATA_CONSENT_TEXT).toContain("Ich willige ausdrücklich ein");
    expect(source).toContain("healthDataConsentGranted");
    expect(source).toContain("checked={healthDataConsentGranted}");
    expect(source).toContain("https://mypoise.de/privacy-policy/");
    expect(source).toContain('fetch("/api/intake-consent"');
  });

  it("gates the entire step flow before health-related fields can be entered", () => {
    const source = readFileSync("app/page-client.jsx", "utf8");
    const gateIndex = source.indexOf("{!healthDataConsentGranted ? (");
    const firstSensitiveFieldIndex = source.indexOf('placeholder="Beschreibe dein Anliegen');
    const closeGateIndex = source.lastIndexOf("</>");

    expect(gateIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeLessThan(firstSensitiveFieldIndex);
    expect(closeGateIndex).toBeGreaterThan(firstSensitiveFieldIndex);
    expect(source).not.toMatch(/localStorage|sessionStorage/);
  });

  it("includes the server-issued consent ticket in draft and final submit requests", () => {
    const source = readFileSync("app/page-client.jsx", "utf8");
    expect(source.match(/intakeConsentToken: healthDataConsentToken/g)).toHaveLength(2);
    expect(source).toContain("onClick={revokeHealthDataConsent}");
    expect(source).toContain('action: "revoke"');
  });
});
