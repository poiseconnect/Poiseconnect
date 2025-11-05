import fs from "fs";
import fetch from "node-fetch";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Xnm11JnbP8mHpcQ9s2ypxccvSsAykAiXcpnW199_MpM/gviz/tq?tqx=out:csv&gid=988240020";

async function fetchTeam() {
  const res = await fetch(SHEET_URL);
  const csv = await res.text();

  // Zeilen aufsplitten, Anführungszeichen entfernen
  const rows = csv.split("\n").map((row) =>
    row
      .replace(/\r/g, "")
      .split(",")
      .map((cell) => cell.replace(/(^"|"$)/g, "").trim())
  );

  const header = rows.shift().map((h) => h.toLowerCase());

  const nameIndex = header.indexOf("name");
  const tagsIndex = header.indexOf("tags");
  const imageIndex = header.indexOf("image");
  const availableIndex = header.indexOf("available");

  const team = rows
    .filter((row) => row[nameIndex] && row[nameIndex] !== "")
    .map((row) => ({
      name: row[nameIndex],
      image: row[imageIndex] || "",
      tags: row[tagsIndex]
        ? row[tagsIndex].split(/;|,/).map((t) => t.trim()).filter(Boolean)
        : [],
      available: row[availableIndex]
        ? row[availableIndex].toLowerCase() === "true"
        : true, // Standard = verfügbar
    }));

  fs.writeFileSync(
    "./app/data/team.js",
    `export const team = ${JSON.stringify(team, null, 2)};`
  );

  console.log(`✅ team.js erfolgreich aktualisiert (${team.length} Profile)`);
}

fetchTeam();
