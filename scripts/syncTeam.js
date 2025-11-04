import fs from "fs";
import https from "https";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1Xnm11JnbP8mHpcQ9s2ypxccvSsAykAiXcpnW199_MpM/export?format=csv&gid=988240020";

// Hilfsfunktion: Tags sauber in camelCase
const normalizeTag = (tag) =>
  tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, "_");

https.get(CSV_URL, (res) => {
  let data = "";

  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    const rows = data.split("\n").map(r => r.split(/[,;]+/));
    const headers = rows.shift().map((h) => h.trim().toLowerCase());

    const nameIndex = headers.indexOf("name");
    const imageIndex = headers.indexOf("image");
    const availableIndex = headers.indexOf("available");

    // Alle anderen Spalten werden als Tags interpretiert
    const tagColumns = headers
      .map((header, i) => ({ header, i }))
      .filter(
        (col) =>
          col.header !== "name" &&
          col.header !== "image" &&
          col.header !== "available"
      );

    const team = rows
      .filter((row) => row[nameIndex])
      .map((row) => {
        const name = row[nameIndex].trim();
        const image = row[imageIndex]?.trim();
        const available =
          row[availableIndex]?.trim().toLowerCase() === "true";

        const tags = tagColumns
          .map((col) => row[col.i]?.trim())
          .filter((val) => val && val.length > 0)
          .map((val) => normalizeTag(val));

        return { name, image, tags, available };
      });

    fs.writeFileSync(
      "./app/data/team.js",
      `export const team = ${JSON.stringify(team, null, 2)};`
    );

    console.log("✅ Teamdaten erfolgreich aktualisiert.");
  });
});
