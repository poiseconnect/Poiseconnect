import { teamData } from "../teamData";

export function matchTeamMembers(anliegenText = "") {
  const lower = anliegenText.toLowerCase();

  const topicKeywords = {
    beziehung: ["beziehung", "partnerschaft", "trennung", "liebe", "affäre", "freundschaft"],
    panik: ["angst", "panik", "attacke", "überforderung", "kontrolle", "stress"],
    selbstwert: ["selbstwert", "unsicherheit", "scham", "ich bin nicht genug", "zweifel"],
    burnout: ["burnout", "erschöpfung", "müdigkeit", "kraftlos", "überlastung"],
    trauer: ["trauer", "verlust", "tod", "fehlgeburt"],
    beruf: ["job", "arbeit", "karriere", "beruf", "kündigung", "neuanfang"],
    trauma: ["trauma", "übergrif", "ptbs", "belastung"],
    depression: ["depression", "niedergeschlagen", "antriebslos", "traurig"],
    stress: ["stress", "reiz", "spannung", "belastung"],
  };

  const matchedTopics = Object.keys(topicKeywords).filter(topic =>
    topicKeywords[topic].some(word => lower.includes(word))
  );

  // Score berechnen
  const scored = teamData.map(member => ({
    ...member,
    score: matchedTopics.filter(t => member.tags.includes(t)).length,
  }));

  // Sortierung: Höchster Score → oben
  return scored.sort((a, b) => b.score - a.score);
}
