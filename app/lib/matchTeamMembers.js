// app/lib/matchTeamMembers.js
import { team } from "../data/team";
import { detectTags } from "./detectTags";

export function matchTeamMembersFromText(anliegenText) {
  const detected = detectTags(anliegenText); // ["burnout","beziehung", ...]
  return scoreAndSort(team, detected);
}

export function scoreAndSort(teamArr, tags) {
  // gewichtete Summe aus tagsWeighted
  return [...teamArr].map(m => {
    let score = 0;
    for (const t of (m.tagsWeighted || [])) {
      if (tags.includes(t.tag)) score += t.score; // 1/2/3
    }
    // leichte Bonuspunkte für Verfügbarkeit
    if (m.available) score += 0.3;
    return { ...m, matchScore: score };
  }).sort((a, b) => b.matchScore - a.matchScore);
}
