import fs from "fs";
import fetch from "node-fetch";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Xnm11JnbP8mHpcQ9s2ypxccvSsAykAiXcpnW199_MpM/gviz/tq?tqx=out:csv&gid=988240020";

async function fetchTeam() {
  const res = await fetch(SHEET_URL);
  const csv = await res.text();

  console.log("\n---- CSV FILE RAW PREVIEW ----");
  console.log(csv.split("\n").slice(0, 6).join("\n"));
  console.log("---- END RAW PREVIEW ----\n");

  const rows = csv.split("\n").map((row) =>
    row
      .replace(/\r/g, "")
      .split(",")
      .map((cell) => cell.replace(/(^"|"$)/g, "").trim())
  );

  const header = rows[0];
  console.log("HEADER DETECTED:", header);

  // STOP HIER — wir schreiben noch nichts
}

fetchTeam();
