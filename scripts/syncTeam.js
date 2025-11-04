import fs from "fs";
import https from "https";

const CSV_URL = "https://docs.google.com/spreadsheets/d/1Xnm11JnbP8mHpcQ9s2ypxccvSsAykAiXcpnW199_MpM/export?format=csv&gid=988240020";

function camelizeTag(tag) {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
}

https.get(CSV_URL, (res) => {
  let data = "";

  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    const rows = data.split("\n").map(r => r.split(","));
    const headers = rows.shift().map(h => h.trim().toLowerCase());

    const nameIndex = headers.indexOf("name");
    const imageIndex = headers.indexOf("image");
    const availableIndex = headers.indexOf("available");

    // Alle restlichen Spalten = Tags
    const tagIndices = headers
      .map((h, i) => ({ h, i }))
      .filter(col => col.h !== "name" && col.h !== "image" && col.h !== "available");

    const team = rows.map(row => {
      const name = row[nameIndex]?.trim();
      const image = row[imageIndex]?.trim();

      const tags = tagIndices
        .filter(col => row[col.i]?.trim()?.length > 0)
        .map(col => camelizeTag(row[col.i]));

      const available = row[availableIndex]?.trim()?.toLowerCase() === "true";

      return { name, image, tags, available };
    });

    fs.writeFileSync("./app/data/team.js", `export const team = ${JSON.stringify(team, null, 2)};`);
    console.log("✅ Teamdaten aktualisiert.");
  });
});
