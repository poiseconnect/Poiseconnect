import { team } from "../data/team";

export function matchTeamMembers(detectedTags) {
  return [...team]
    .map(member => {
      // Score = Anzahl der übereinstimmenden Tags
      const score = member.tags.filter(t => detectedTags.includes(t)).length;

      return {
        ...member,
        score
      };
    })
    // Sortieren: bestes Matching zuerst
    .sort((a, b) => b.score - a.score);
}
