// app/lib/matchTeamMembers.js

export function matchTeamMembers(anliegenText = "", team = []) {
  const text = anliegenText.toLowerCase().trim();

  return team
    .map((member) => {
      let score = 0;

      // 1️⃣ THEMEN (stark gewichtet)
      if (member.themes && text) {
        Object.entries(member.themes).forEach(([theme, weight]) => {
          const themeKey = theme.replace("_", " ").toLowerCase();
          if (text.includes(themeKey) || text.includes(theme.toLowerCase())) {
            score += weight * 5;
          }
        });
      }

      // 2️⃣ KEYWORDS (präzise)
      if (Array.isArray(member.keywords) && text) {
        member.keywords.forEach((kw) => {
          if (text.includes(kw.toLowerCase())) {
            score += 3;
          }
        });
      }

      // 3️⃣ QUALIFIKATION (sanfter Bonus)
      if (typeof member.qualificationLevel === "number") {
        score += member.qualificationLevel * 0.5;
      }

      return {
        ...member,
        matchScore: score,   // 🔑 bewusst umbenannt (kein _private Feld)
      };
    })
    // 🔥 WICHTIG: NICHT filtern – ALLE bleiben drin
    .sort((a, b) => b.matchScore - a.matchScore);
}
