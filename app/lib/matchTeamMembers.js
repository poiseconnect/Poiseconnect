// app/lib/matchTeamMembers.js

export function matchTeamMembers(anliegenText = "", team = []) {
  if (!anliegenText.trim()) return team;

  const text = anliegenText.toLowerCase();

  return team
    .map((member) => {
      let score = 0;

      // 1️⃣ THEMEN-GEWICHTUNG (stark)
      if (member.themes) {
        Object.entries(member.themes).forEach(([theme, weight]) => {
          const themeKey = theme.replace("_", " ");
          if (text.includes(themeKey) || text.includes(theme)) {
            score += weight * 5; // Hauptgewicht
          }
        });
      }

      // 2️⃣ KEYWORDS (sehr präzise)
      if (Array.isArray(member.keywords)) {
        member.keywords.forEach((kw) => {
          if (text.includes(kw.toLowerCase())) {
            score += 3;
          }
        });
      }

      // 3️⃣ QUALIFIKATION (sanfter Boost, kein Override)
      if (member.qualificationLevel) {
        score += member.qualificationLevel * 0.5;
      }

      return {
        ...member,
        _score: score,
      };
    })
    // Nur sinnvolle Matches behalten
    .filter((m) => m._score > 0)
    // Beste zuerst
    .sort((a, b) => b._score - a._score);
}
