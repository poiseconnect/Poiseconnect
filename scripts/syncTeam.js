import fs from "fs";
import fetch from "node-fetch";

const SHEET_ID = "1Xnm11JnbP8mHpcQ9s2ypxccvSsAykAiXcpnW199_MpM"; // deine Sheet-ID
const SHEET_NAME = "poise_team_profiles"; // wichtig: EXAKT wie in Sheets
const OUTPUT_FILE = "./app/data/team.js"; // wohin geschrieben wird

async function run() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;

  const res = await fetch(url);
  const csv = await res.text();

  console.log("\n------ RAW CSV START ------\n");
  console.log(csv);
  console.log("\n------ RAW CSV END ------\n");

  const rows = csv.trim().split("\n").map(r => r.split(","));
  const header = rows.shift().map(h => h.trim().toLowerCase());

  const members = rows.map(cols => {
    const obj = {};
    header.forEach((h, i) => obj[h] = cols[i]?.trim() || "");

    return {
      name: obj.name,
      image: obj.image,
      tags: obj.tags ? obj.tags.split(";").map(t => t.trim()) : [],
      available: obj.available === "TRUE" || obj.available === "true"
    };
  });

  const finalJs = `export const team = ${JSON.stringify(members, null, 2)};\n`;

  fs.writeFileSync(OUTPUT_FILE, finalJs);

  console.log("✅ Teamdaten erfolgreich aktualisiert.");
}

run();
