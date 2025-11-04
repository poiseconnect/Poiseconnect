import fs from "fs";
import fetch from "node-fetch";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Xnm11JnbP8mHpcQ9s2ypxccvSsAykAiXcpnW199_MpM/gviz/tq?tqx=out:csv&gid=988240020";

async function fetchTeam() {
  const res = await fetch(SHEET_URL);
  const csv = await res.text();

  console.log("\n--- RAW CSV (erste 10 Zeilen) ---");
  console.log(csv.split("\n").slice(0, 10).join("\n"));
  console.log("\n--- ENDE ---\n");

  // ✅ Auto-Erkennung des Trennzeichens (, oder ;)
  const separator = csv.includes(";") ? ";" : ",";

  const rows = csv.split("\n").map((r) => r.split(separator));

  // Header → lowercase + Trim
  const header = rows.shift().map((h) =>
    h.replace(/"/g, "").trim().toLowerCase()
  );

  const team = rows
    .filter((r) => r[0] && r[0].trim() !== "") // nur Zeilen mit Name
    .map((cols) => {
      const obj = {};
      header.forEach((key, i) => {
        obj[key] = cols[i]?.replace(/"/g, "").trim() || "";
      });

      return {
        name: obj["name"],
        image: obj["image"],
        tags: obj["tags"]
          ? obj["tags"].split(/[;,]/).map((t) => t.trim())
          : [],
        available:
          obj["available"]?.toLowerCase() === "true" ||
          obj["available"] === "1",
      };
    });

  fs.writeFileSync(
    "./app/data/team.js",
    `export const team = ${JSON.stringify(team, null, 2)};`
  );

  console.log(`✅ team.js erfolgreich aktualisiert (${team.length} Einträge)`);
}

fetchTeam();
