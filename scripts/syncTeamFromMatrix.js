/* scripts/syncTeamFromMatrix.js
 * Liest Farbstufen aus der Matrix (Google Sheet) und erzeugt app/data/team.js
 * Voraussetzung: GOOGLE_SHEETS_API_KEY in Vercel/Repo-Env
 */

import fs from "fs";
import path from "path";
import fetch from "node-fetch";

// === KONFIG ===
const SHEET_ID = process.env.POISE_SHEET_ID || "1Xnm11JnbP8mHpcQ9s2ypxccvSsAykAiXcpnW199_MpM"; // deine ID
const PROFILES_SHEET = "poise_team_profiles"; // Stammdaten (Name, image, available …)
const MATRIX_SHEET = "Matrix"; // Blatt mit farbigen Blöcken
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;

// Themen & Blöcke (Koordinaten 1-basiert, inkl. beider Grenzen).
// Passe die Bereiche 1x an dein Matrix-Layout an.
const TOPIC_BLOCKS = [
  { tag: "beziehung",      title: "BEZIEHUNG/PARTNERSCHAFT", range: { r1: 2,  c1: 2,  r2: 8,  c2: 16 } },
  { tag: "panik",          title: "ANGST/PANIKATTACKEN",     range: { r1: 2,  c1: 17, r2: 8,  c2: 31 } },
  { tag: "selbstwert",     title: "SELBSTWERT",              range: { r1: 2,  c1: 32, r2: 8,  c2: 46 } },
  { tag: "stress",         title: "STRESS",                  range: { r1: 2,  c1: 47, r2: 8,  c2: 61 } },
  { tag: "burnout",        title: "BURNOUT",                 range: { r1: 9,  c1: 2,  r2: 15, c2: 31 } },
  { tag: "depressiv",      title: "DEPRESSIVE VERSTIMMUNG",  range: { r1: 9,  c1: 32, r2: 15, c2: 61 } },
  { tag: "essen",          title: "EMOTIONALES ESSEN",       range: { r1: 16, c1: 32, r2: 22, c2: 61 } },
  { tag: "beruf",          title: "BERUF/ZIELE/ORIENTIERUNG",range: { r1: 16, c1: 2,  r2: 22, c2: 31 } },
  { tag: "krankheit",      title: "KRANKHEIT/PSYCHOSOMATIK", range: { r1: 23, c1: 47, r2: 29, c2: 61 } },
  { tag: "trauer",         title: "TRAUER",                  range: { r1: 23, c1: 2,  r2: 29, c2: 16 } },
  { tag: "sexualitaet",    title: "SEXUALITÄT",              range: { r1: 23, c1: 17, r2: 29, c2: 31 } },
  { tag: "angehoerige",    title: "ANGEHÖRIGE",              range: { r1: 23, c1: 32, r2: 29, c2: 46 } },
];

// Heuristik: Wir werten GRÜN-Töne nach Helligkeit (V) als 1/2/3, Weiß = 0
function colorToScore(bg) {
  if (!bg) return 0;
  const r = (bg.red ?? 1), g = (bg.green ?? 1), b = (bg.blue ?? 1); // 0–1
  // Weiß?
  if (r > 0.98 && g > 0.98 && b > 0.98) return 0;

  // HSV-V (Brightness)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max;
  const s = max === 0 ? 0 : (max - min) / max;

  // Gründominanz?
  const isGreenish = (g >= r && g >= b) && s >= 0.15;

  // Hell/Mittel/Dunkel nach Helligkeit
  if (isGreenish) {
    if (v <= 0.55) return 3; // dunkelgrün
    if (v <= 0.8)  return 2; // mittelgrün
    return 1;               // hellgrün
  }

  // Nicht grün? Falls farbig: gib eine 1, sonst 0
  return s > 0.05 ? 1 : 0;
}

async function fetchSheetRangeWithColors(sheetName) {
  // includeGridData=true liefert die cellFormat.backgroundColor
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?includeGridData=true&ranges=${encodeURIComponent(sheetName)}&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API Fehler: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchProfiles() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(PROFILES_SHEET)}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Profiles API Fehler: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const rows = data.values || [];
  const header = rows[0] || [];
  const idx = (k) => header.indexOf(k);

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = r[idx("Name")] || "";
    if (!name) continue;
    out.push({
      name,
      role: r[idx("Rolle / Titel")] || "",
      short: r[idx("Kurzbeschreibung")] || "",
      image: r[idx("image")] || "",
      available: (r[idx("available")] || "").toString().trim().toLowerCase() === "true",
      onlineOrOnsite: r[idx("Online / Vor Ort")] || "",
      calendarId: r[idx("Kalender-ID")] || "",
    });
  }
  return out;
}

function addScore(map, name, tag, score) {
  if (!name || score <= 0) return;
  const key = name.trim();
  if (!map[key]) map[key] = {};
  map[key][tag] = Math.max(map[key][tag] || 0, score);
}

function extractTagScoresFromMatrix(matrixSheetJson) {
  const sheet = (matrixSheetJson.sheets || []).find(s => s.properties.title === MATRIX_SHEET);
  if (!sheet) throw new Error(`Blatt "${MATRIX_SHEET}" nicht gefunden`);
  const grid = sheet.data?.[0]?.rowData || [];
  // rowData[row].values[col].formattedValue + .effectiveFormat.backgroundColor

  const scoresPerName = {}; // { "Anna": { beziehung:2, burnout:3, ... } }

  for (const block of TOPIC_BLOCKS) {
    const { r1, c1, r2, c2 } = block.range;
    for (let r = r1 - 1; r <= r2 - 1; r++) {
      const row = grid[r]?.values || [];
      for (let c = c1 - 1; c <= c2 - 1; c++) {
        const cell = row[c] || {};
        const name = (cell.formattedValue || "").trim();
        if (!name) continue;
        const bg = cell.effectiveFormat?.backgroundColor;
        const score = colorToScore(bg);
        addScore(scoresPerName, name, block.tag, score);
      }
    }
  }
  return scoresPerName;
}

function buildTeamArray(profiles, tagScores) {
  // Mergen: Profile + Scores → team[]
  return profiles.map(p => {
    const tagMap = tagScores[p.name] || {};
    const tagsWeighted = Object.entries(tagMap)
      .filter(([, s]) => s > 0)
      .map(([tag, s]) => ({ tag, score: s }));

    // Für dein Frontend brauchst du oft auch flache Tags:
    const tags = tagsWeighted.sort((a,b)=>b.score-a.score).map(t => t.tag);

    return {
      name: p.name,
      role: p.role,
      short: p.short,
      image: p.image,
      available: p.available,
      onlineOrOnsite: p.onlineOrOnsite,
      calendarId: p.calendarId,
      tags,               // ["burnout","beziehung", …]
      tagsWeighted,       // [{tag:"burnout",score:3}, …]
    };
  });
}

async function main() {
  if (!API_KEY) {
    console.error("❌ GOOGLE_SHEETS_API_KEY fehlt.");
    process.exit(1);
  }
  try {
    const [profiles, matrixJson] = await Promise.all([
      fetchProfiles(),
      fetchSheetRangeWithColors(MATRIX_SHEET),
    ]);

    const tagScores = extractTagScoresFromMatrix(matrixJson);
    const team = buildTeamArray(profiles, tagScores);

    const outPath = path.join(process.cwd(), "app", "data", "team.js");
    const js = `// AUTO-GENERATED. Nicht manuell bearbeiten.
// Stand: ${new Date().toISOString()}
export const team = ${JSON.stringify(team, null, 2)};
`;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, js, "utf8");
    console.log("✅ team.js erfolgreich erzeugt:", outPath);
  } catch (err) {
    console.error("❌ Sync fehlgeschlagen:", err.message);
    process.exit(1);
  }
}

main();
