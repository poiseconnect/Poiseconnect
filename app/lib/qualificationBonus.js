export const QUALIFICATION_BONUS_BY_LEVEL = {
  1: 2.0,
  2: 1.5,
  3: 1.0,
  4: 0.5,
  5: 0.0,
};

export const QUALIFICATION_SEVERITY_WEIGHT = {
  niedrig: 0.5,
  mittel: 1.0,
  hoch: 1.5,
  "sehr hoch": 2.0,
};

function normalizeSeverity(value) {
  if (typeof value !== "string") {
    return "mittel";
  }

  const normalized = value.trim().toLowerCase();
  return normalized in QUALIFICATION_SEVERITY_WEIGHT ? normalized : "mittel";
}

function normalizeDiagnosis(value) {
  if (typeof value !== "string") {
    return "nein";
  }

  return value.trim().toLowerCase() === "ja" ? "ja" : "nein";
}

export function getQualificationWeight({ leidensdruck, diagnose } = {}) {
  const severityWeight = QUALIFICATION_SEVERITY_WEIGHT[normalizeSeverity(leidensdruck)] ?? 1.0;
  const diagnosisWeight = normalizeDiagnosis(diagnose) === "ja" ? 0.5 : 0;

  return severityWeight + diagnosisWeight;
}

export function getWeightedQualificationBonus({
  qualificationLevel,
  leidensdruck,
  diagnose,
} = {}) {
  const baseBonus = getQualificationBonus(qualificationLevel);
  const weight = getQualificationWeight({ leidensdruck, diagnose });

  return baseBonus * weight;
}

export function getQualificationBonus(level) {
  if (typeof level !== "number" || !Number.isFinite(level)) {
    return 0;
  }

  if (level < 1 || level > 5) {
    return 0;
  }

  return QUALIFICATION_BONUS_BY_LEVEL[level] ?? 0;
}

export function calculateThemeScore(selectedThemes = [], themeScores = {}) {
  if (!Array.isArray(selectedThemes) || selectedThemes.length === 0) {
    return 0;
  }

  return selectedThemes.reduce((sum, themeKey) => {
    const value = Number(themeScores?.[themeKey] ?? 0) || 0;
    return sum + value;
  }, 0);
}

export function hasPositiveThemeMatch(selectedThemes = [], themeScores = {}) {
  if (!Array.isArray(selectedThemes) || selectedThemes.length === 0) {
    return true;
  }

  return selectedThemes.some((themeKey) => {
    const value = Number(themeScores?.[themeKey] ?? 0) || 0;
    return value > 0;
  });
}

export function calculateFinalCoachScore({
  selectedThemes = [],
  themeScores = {},
  roleBonus = 0,
  qualificationLevel,
  leidensdruck,
  diagnose,
}) {
  const selectedThemeScore = calculateThemeScore(selectedThemes, themeScores);
  const themeScore = selectedThemeScore + roleBonus;
  const qualificationBonus = getWeightedQualificationBonus({
    qualificationLevel,
    leidensdruck,
    diagnose,
  });
  const finalScore = themeScore + qualificationBonus;

  return {
    themeScore,
    qualificationBonus,
    finalScore,
    isVisible:
      selectedThemes.length === 0 || hasPositiveThemeMatch(selectedThemes, themeScores),
  };
}
