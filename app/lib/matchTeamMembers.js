import { team } from "../data/team";

export function matchTeamMembers(anliegenText) {
  const lower = anliegenText.toLowerCase();

  const topicKeywords = {
    beziehung: ["beziehung", "partnerschaft", "trennung", "liebe", "affäre"],
    panik: ["angst", "panik", "überforderung", "kontrolle", "attacke"],
    selvstwert: ["selbstwert", "unsicherheit", "scham", "ich bin nicht genug"],
    burnout: ["burnout", "erschöpfung", "müdigkeit", "kraftlos"],
    trauer: ["trauer", "verlust", "tod", "fehlgeburt"],
    beruf: ["job", "arbeit", "karriere", "neuausrichtung", "beruf"],
    trauma: ["trauma", "übergriffe", "belastung"],
    depression: ["depression", "antriebslos", "schlaf", "traurigkeit"],
    stress: ["stress", "überlastung", "reiz", "spannung"],
  };

  const matchedTopics = Object.keys(topicKeywords).filter(topic =>
    topicKeywords[topic].some(word => lower.includes(word))
  );

  // Score berechnen
  const scored = team.map(member => ({
    ...member,
    score: matchedTopics.filter(t => member.tags.includes(t)).length
  }));

  // Sortieren nach Score + Kapazität
  return scored.sort((a, b) => b.score - a.score);
}
