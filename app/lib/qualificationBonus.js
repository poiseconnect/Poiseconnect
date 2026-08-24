export const QUALIFICATION_BONUS_BY_LEVEL = {
  1: 2.0,
  2: 1.5,
  3: 1.0,
  4: 0.5,
  5: 0.0,
};

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
}) {
  const selectedThemeScore = calculateThemeScore(selectedThemes, themeScores);
  const themeScore = selectedThemeScore + roleBonus;
  const qualificationBonus = getQualificationBonus(qualificationLevel);
  const finalScore = themeScore + qualificationBonus;

  return {
    themeScore,
    qualificationBonus,
    finalScore,
    isVisible:
      selectedThemes.length === 0 || hasPositiveThemeMatch(selectedThemes, themeScores),
  };
}
