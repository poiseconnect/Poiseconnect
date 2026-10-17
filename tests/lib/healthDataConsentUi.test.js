import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useSearchParams } from "next/navigation";
import PageClient from "../../app/page-client.jsx";
import {
  HEALTH_DATA_CONSENT_TEXT,
  HEALTH_DATA_CONSENT_VERSION,
} from "../../app/lib/healthDataConsentShared.js";

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ priority, ...props }) => React.createElement("img", props),
}));

describe("intake welcome screen", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams());
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the existing Poise logo above the complete welcome copy", () => {
    const markup = renderToStaticMarkup(React.createElement(PageClient));

    expect(markup).toContain('src="/IMG_7599.png"');
    expect(markup).toContain('alt="Poise Logo"');
    expect(markup.indexOf('alt="Poise Logo"')).toBeLessThan(markup.indexOf("Willkommen bei Poise"));
    expect(markup).toContain("Schön, dass du da bist.");
    expect(markup).toContain("Manchmal ist es gar nicht so einfach, den ersten Schritt zu machen.");
    expect(markup).toContain("aktuellen Situation, deinen Wünschen und deinen Bedürfnissen.");
    expect(markup).toContain("Es gibt keine richtigen oder falschen Antworten.");
    expect(markup).toContain("Dauer: ungefähr 5–10 Minuten");
    expect(markup).toContain("Fragebogen starten");
    expect(markup).toContain("Im nächsten Schritt erklären wir dir, wie wir deine Angaben vertraulich");
    expect(markup).toContain("Schritt 1 von 14");
    expect(markup).not.toMatch(/<input|<textarea|<select/);
    expect(markup).not.toContain(HEALTH_DATA_CONSENT_TEXT);
    expect(markup).not.toContain("Anfrage senden");
  });

  it.each(["5", "8", "10", "11", "admin"])(
    "keeps the welcome and consent gates ahead of resume=%s",
    (resume) => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ resume }));
      const markup = renderToStaticMarkup(React.createElement(PageClient));

      expect(markup).toContain("Willkommen bei Poise");
      expect(markup).not.toMatch(/<input|<textarea|<select/);
      expect(markup).not.toContain("Zusammenfassung");
    }
  );

  it("advances only the welcome state and offers a return from consent", () => {
    const source = readFileSync("app/page-client.jsx", "utf8");
    const welcomeIndex = source.indexOf("{!welcomeCompleted ? (");
    const consentIndex = source.indexOf("{!healthDataConsentGranted ? (");
    const welcome = source.slice(welcomeIndex, consentIndex);

    expect(welcomeIndex).toBeGreaterThan(-1);
    expect(welcomeIndex).toBeLessThan(consentIndex);
    expect(welcome).toContain("onClick={() => setWelcomeCompleted(true)}");
    expect(welcome).not.toMatch(/fetch\(|setStep\(|setHealthDataConsent/);
    expect(source).toContain("onClick={() => setWelcomeCompleted(false)}");
    expect(source).toContain("[welcomeCompleted, setWelcomeCompleted] = useState(false)");
  });

  it("offsets visible progress without renumbering persisted or resumed questionnaire steps", () => {
    const source = readFileSync("app/page-client.jsx", "utf8");

    expect(source).toContain("!welcomeCompleted ? 0 : !healthDataConsentGranted ? 1 : step + 2");
    expect(source).toContain("<StepIndicator step={displayStep} total={totalSteps} />");
    expect(source).toContain("aria-valuenow={displayStep + 1}");
    expect(source).toContain("draft_current_step: step");
    expect(source).toContain("setStep(coachSelectionStep)");
    expect(source).toContain("setStep(targetStep)");
    expect(source).toContain("{step === 11 && (");
    expect(source).not.toMatch(/localStorage|sessionStorage/);
  });
});

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
