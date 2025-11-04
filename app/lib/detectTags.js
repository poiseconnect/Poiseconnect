// lib/detectTags.js

export function detectTags(anliegenText) {
  if (!anliegenText) return [];

  const text = anliegenText.toLowerCase();

  const tagMap = {
    beziehung: ["beziehung", "partnerschaft", "trennung", "affäre", "liebeskummer", "eifersucht"],
    panik: ["panik", "angst", "attacken", "überforderung", "kontrolle"],
    selbstwert: ["selbstwert", "unsicherheit", "scham", "wertlos", "nicht gut genug"],
    burnout: ["burnout", "erschöpfung", "ausgebrannt", "müdigkeit", "energie", "stress"],
    trauer: ["trauer", "verlust", "tod", "fehlgeburt"],
    beruf: ["job", "arbeit", "karriere", "beruf", "kündigung", "leitung", "rolle", "wechsel"],
    trauma: ["trauma", "missbrauch", "gewalt", "übergriff", "belastung"],
    depression: ["depression", "antriebslos", "traurig", "hoffnungslos", "niedergeschlagen"],
    stress: ["stress", "überlastet", "reizbar", "spannung"],
    essverhalten: ["essen", "essstörung", "kontrolle essen", "fressanfälle"],
    psychosomatik: ["körper", "schmerz", "bauch", "rücken", "unruhe", "keine diagnose"],
  };

  return Object.keys(tagMap).filter(tag =>
    tagMap[tag].some(keyword => text.includes(keyword))
  );
}
