import fs from "fs";
import fetch from "node-fetch";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Xnm11JnbP8mHpcQ9s2ypxccvSsAykAiXcpnW199_MpM/gviz/tq?tqx=out:csv&gid=988240020";

async function fetchTeam() {
  const res = await fetch(SHEET_URL);
  const csv = await res.text();

  const rows = csv.split("\n").map((r) => r.split(","));

  const header = rows.shift().map((h) => h.trim().toLowerCase());

  const team = rows
    .filter((r) => r[0]) // nur Zeilen mit Name
    .map((cols) => {
      const obj = {};
      header.forEach((key, i) => {
        obj[key] = cols[i] ? cols[i].trim() : "";
      });

      return {
        name: obj.name,
        image: obj.image,
        tags: obj.tags.split(";").map((t) => t.trim()).filter(Boolean),
        available: obj.available.toLowerCase() === "true",
      };
    });

  fs.writeFileSync("./lib/team.js", `export const team = ${JSON.stringify(team, null, 2)};`);
  console.log("✅ team.js erfolgreich aktualisiert (" + team.length + " Einträge)");
}

fetchTeam();
