import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  calculateThemeScore,
  getQualificationBonus,
  getQualificationWeight,
  getWeightedQualificationBonus,
  hasPositiveThemeMatch,
  calculateFinalCoachScore,
} from "../../app/lib/qualificationBonus.js";

describe("getQualificationBonus", () => {
  it("qualificationLevel 1 -> Bonus 2.0", () => {
    expect(getQualificationBonus(1)).toBe(2.0);
  });

  it("qualificationLevel 2 -> Bonus 1.5", () => {
    expect(getQualificationBonus(2)).toBe(1.5);
  });

  it("qualificationLevel 3 -> Bonus 1.0", () => {
    expect(getQualificationBonus(3)).toBe(1.0);
  });

  it("qualificationLevel 4 -> Bonus 0.5", () => {
    expect(getQualificationBonus(4)).toBe(0.5);
  });

  it("qualificationLevel 5 -> Bonus 0", () => {
    expect(getQualificationBonus(5)).toBe(0);
  });

  it("ungültige qualificationLevel Werte liefern 0 Bonus", () => {
    expect(getQualificationBonus(0)).toBe(0);
    expect(getQualificationBonus(6)).toBe(0);
    expect(getQualificationBonus(null)).toBe(0);
    expect(getQualificationBonus(undefined)).toBe(0);
    expect(getQualificationBonus("3")).toBe(0);
    expect(getQualificationBonus(Number.NaN)).toBe(0);
  });
});

describe("theme scoring", () => {
  it("Themenwert 5 > Themenwert 2", () => {
    expect(calculateThemeScore(["stress"], { stress: 5 })).toBe(5);
    expect(calculateThemeScore(["stress"], { stress: 2 })).toBe(2);
    expect(calculateThemeScore(["stress"], { stress: 5 })).toBeGreaterThan(
      calculateThemeScore(["stress"], { stress: 2 })
    );
  });

  it("Coach ohne Themenmatch bleibt nicht sichtbar bei ausgewähltem Thema", () => {
    const selectedThemes = ["stress"];
    const coachThemeScores = { angst: 0 };
    expect(hasPositiveThemeMatch(selectedThemes, coachThemeScores)).toBe(false);
    expect(
      calculateFinalCoachScore({
        selectedThemes,
        themeScores: coachThemeScores,
        roleBonus: 0,
        qualificationLevel: 1,
      }).isVisible
    ).toBe(false);
  });

  it("Coach mit Themenmatch und Level 1 ist besser als identischer Coach mit Level 5", () => {
    const coach1 = calculateFinalCoachScore({
      selectedThemes: ["stress"],
      themeScores: { stress: 5 },
      roleBonus: 0,
      qualificationLevel: 1,
    });
    const coach2 = calculateFinalCoachScore({
      selectedThemes: ["stress"],
      themeScores: { stress: 5 },
      roleBonus: 0,
      qualificationLevel: 5,
    });

    expect(coach1.finalScore).toBeGreaterThan(coach2.finalScore);
  });

  it("deutlich höherer Themenmatch kann weiterhin vor besserer Qualification liegen", () => {
    const higherThemeMatch = calculateFinalCoachScore({
      selectedThemes: ["stress"],
      themeScores: { stress: 8 },
      roleBonus: 0,
      qualificationLevel: 5,
    });
    const betterQualification = calculateFinalCoachScore({
      selectedThemes: ["stress"],
      themeScores: { stress: 5 },
      roleBonus: 0,
      qualificationLevel: 1,
    });

    expect(higherThemeMatch.finalScore).toBeGreaterThan(betterQualification.finalScore);
  });
});

describe("severity-weighted qualification", () => {
  it("verwendet die existierende Leidensdruck-Skala mit neutralem Fallback", () => {
    expect(getQualificationWeight({ leidensdruck: "niedrig", diagnose: "nein" })).toBe(0.5);
    expect(getQualificationWeight({ leidensdruck: "mittel", diagnose: "nein" })).toBe(1.0);
    expect(getQualificationWeight({ leidensdruck: "hoch", diagnose: "nein" })).toBe(1.5);
    expect(getQualificationWeight({ leidensdruck: "sehr hoch", diagnose: "nein" })).toBe(2.0);
    expect(getQualificationWeight({ leidensdruck: null, diagnose: "nein" })).toBe(1.0);
    expect(getQualificationWeight({ leidensdruck: undefined, diagnose: null })).toBe(1.0);
  });

  it("diagnose=ja erhöht den Qualification-Multiplikator zusätzlich", () => {
    expect(getQualificationWeight({ leidensdruck: "niedrig", diagnose: "Ja" })).toBe(1.0);
    expect(getQualificationWeight({ leidensdruck: "mittel", diagnose: "ja" })).toBe(1.5);
    expect(getQualificationWeight({ leidensdruck: "hoch", diagnose: "Ja" })).toBe(2.0);
    expect(getQualificationWeight({ leidensdruck: "sehr hoch", diagnose: "ja" })).toBe(2.5);
    expect(getQualificationWeight({ leidensdruck: "mittel", diagnose: "nein" })).toBe(1.0);
    expect(getQualificationWeight({ leidensdruck: "mittel", diagnose: null })).toBe(1.0);
  });

  it("weighted bonus bleibt auf der bestehenden Basis und darf keinen Themenlosen Match erzeugen", () => {
    const lowSeverity = getWeightedQualificationBonus({
      qualificationLevel: 1,
      leidensdruck: "niedrig",
      diagnose: "nein",
    });
    const highSeverity = getWeightedQualificationBonus({
      qualificationLevel: 1,
      leidensdruck: "sehr hoch",
      diagnose: "ja",
    });

    expect(lowSeverity).toBe(1.0);
    expect(highSeverity).toBe(5.0);
    expect(highSeverity).toBeGreaterThan(lowSeverity);

    const noThemeCoach = calculateFinalCoachScore({
      selectedThemes: ["stress"],
      themeScores: { angst: 0 },
      roleBonus: 0,
      qualificationLevel: 1,
      leidensdruck: "sehr hoch",
      diagnose: "ja",
    });

    expect(noThemeCoach.isVisible).toBe(false);
  });

  it("wendet die neuen Dependencies für Leidensdruck und Diagnose im aktiven useMemo an", () => {
    const pageClientSource = readFileSync(
      new URL("../../app/page-client.jsx", import.meta.url),
      "utf8"
    );

    expect(pageClientSource).toMatch(
      /form\.themen,\s*form\.leidensdruck,\s*form\.diagnose,/
    );
  });

  it("behandelt leere und unbekannte Leidensdruckwerte neutral", () => {
    expect(getQualificationWeight({ leidensdruck: "", diagnose: "nein" })).toBe(1.0);
    expect(getQualificationWeight({ leidensdruck: "unbekannt", diagnose: "nein" })).toBe(1.0);
  });

  it("Themenpassung bleibt der Sichtbarkeitsfilter, auch wenn Qualification dynamisch steigt", () => {
    const matchingCoach = calculateFinalCoachScore({
      selectedThemes: ["stress"],
      themeScores: { stress: 7 },
      roleBonus: 0,
      qualificationLevel: 5,
      leidensdruck: "niedrig",
      diagnose: "nein",
    });
    const severeCoach = calculateFinalCoachScore({
      selectedThemes: ["stress"],
      themeScores: { stress: 5 },
      roleBonus: 0,
      qualificationLevel: 1,
      leidensdruck: "sehr hoch",
      diagnose: "ja",
    });

    expect(matchingCoach.isVisible).toBe(true);
    expect(severeCoach.isVisible).toBe(true);
    expect(matchingCoach.themeScore).toBeGreaterThan(severeCoach.themeScore);
  });

  it("bei hohem Leidensdruck verschiebt sich der Ranking stärker zugunsten höherer Qualifikation", () => {
    const mildCase = calculateFinalCoachScore({
      selectedThemes: ["stress"],
      themeScores: { stress: 5 },
      roleBonus: 0,
      qualificationLevel: 1,
      leidensdruck: "mittel",
      diagnose: "nein",
    });
    const severeCase = calculateFinalCoachScore({
      selectedThemes: ["stress"],
      themeScores: { stress: 5 },
      roleBonus: 0,
      qualificationLevel: 1,
      leidensdruck: "sehr hoch",
      diagnose: "ja",
    });

    expect(severeCase.finalScore).toBeGreaterThan(mildCase.finalScore);
  });
});

describe("matching integration", () => {
  it("matchTeamMembers and the active page-client path share the same qualification direction", () => {
    expect(getQualificationBonus(1)).toBeGreaterThan(getQualificationBonus(5));
    expect(getQualificationBonus(1)).toBe(2.0);
  });
});
