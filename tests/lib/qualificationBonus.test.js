import { describe, expect, it } from "vitest";
import {
  calculateThemeScore,
  getQualificationBonus,
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

describe("matching integration", () => {
  it("matchTeamMembers and the active page-client path share the same qualification direction", () => {
    expect(getQualificationBonus(1)).toBeGreaterThan(getQualificationBonus(5));
    expect(getQualificationBonus(1)).toBe(2.0);
  });
});
