import fs from "fs";
import fetch from "node-fetch";

const SHEET_ID = "1Xnm11JnbP8mHpcQ9s2ypxccvSsAykAiXcpnW199_MpM";
const GID = "0"; // Tabelle1 = erste Seite

const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

async function syncTeam() {
  console.log("⏳ Lade Daten aus Google Sheet...");

  const res = await fetch(CSV_URL);
  const csv = await res.text();

  console.log("\n---- CSV PREVIEW ----");
  console.log(csv.split("\n").slice(0, 6).join("\n"));
  console.log("---- END PREVIEW ----\n");

  const rows = csv.split("\n").map(r => r.split(","));
  const header = rows.shift().map(h => h.trim().toLowerCase());

  const nameIndex = header.indexOf("name");
  const tagsIndex = header.indexOf("tags");
  const imageIndex = header.indexOf("image");
  const availableIndex = header.indexOf("available");

  const team = rows
    .filter(r => r[nameIndex])
    .map(r => ({
      name: r[nameIndex].replace(/"/g, "").trim(),
      image: r[imageIndex]?.replace(/"/g, "").trim() || "",
      tags: r[tagsIndex] ? r[tagsIndex].replace(/"/g, "").split(";").map(t => t.trim().toLowerCase()) : [],
      available: !(r[availableIndex] && r[availableIndex].toLowerCase().includes("voll")),
    }));

  const output = `export const team = ${JSON.stringify(team, null, 2)};\n`;
  fs.writeFileSync("./app/data/team.js", output);

  console.log("✅ team.js erfolgreich aktualisiert.");
}

syncTeam();
