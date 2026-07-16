import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const OUTPUT_DIR = path.join(ROOT, "docs", "generated");

const CODE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
]);

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "node_modules",
  ".vercel",
  "out",
  "dist",
  "build",
  "coverage",
]);

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, {
    recursive: true,
  });
}

function walkDirectory(directoryPath) {
  const files = [];

  for (const entry of fs.readdirSync(directoryPath, {
    withFileTypes: true,
  })) {
    if (
      entry.isDirectory() &&
      IGNORED_DIRECTORIES.has(entry.name)
    ) {
      continue;
    }

    const fullPath = path.join(
      directoryPath,
      entry.name
    );

    if (entry.isDirectory()) {
      files.push(...walkDirectory(fullPath));
      continue;
    }

    if (
      entry.isFile() &&
      CODE_EXTENSIONS.has(
        path.extname(entry.name)
      )
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function toRelativePath(filePath) {
  return path
    .relative(ROOT, filePath)
    .replaceAll(path.sep, "/");
}

function uniqueSorted(values) {
  return [...new Set(values)]
    .filter(Boolean)
    .sort((a, b) =>
      a.localeCompare(b, "de")
    );
}

function extractMatches(content, regex, group = 1) {
  const matches = [];

  for (const match of content.matchAll(regex)) {
    if (match[group]) {
      matches.push(match[group]);
    }
  }

  return uniqueSorted(matches);
}

function analyzeFile(filePath) {
  const relativePath = toRelativePath(filePath);
  const content = fs.readFileSync(
    filePath,
    "utf8"
  );

  const supabaseTables = extractMatches(
    content,
    /\.from\(\s*["'`]([^"'`]+)["'`]\s*\)/g
  );

  const apiFetches = extractMatches(
    content,
    /fetch\(\s*["'`]([^"'`]+)["'`]/g
  );

  const resendSubjects = extractMatches(
    content,
    /subject\s*:\s*["'`]([^"'`]+)["'`]/g
  );

  const googleCalendarMethods =
    extractMatches(
      content,
      /calendar\.events\.(insert|patch|delete|get|list|update)\s*\(/g
    );

  const statusValues = extractMatches(
    content,
    /status\s*:\s*["'`]([^"'`]+)["'`]/g
  );

  const matchStateValues =
    extractMatches(
      content,
      /match_state\s*:\s*["'`]([^"'`]+)["'`]/g
    );

  const environmentVariables =
    extractMatches(
      content,
      /process\.env\.([A-Z0-9_]+)/g
    );

  const routeMethods = extractMatches(
    content,
    /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g
  );

  const isApiRoute =
    relativePath.startsWith("app/api/") &&
    /\/route\.(js|jsx|ts|tsx)$/.test(
      relativePath
    );

  return {
    path: relativePath,
    isApiRoute,
    routeMethods,
    supabaseTables,
    apiFetches,
    resendSubjects,
    googleCalendarMethods,
    statusValues,
    matchStateValues,
    environmentVariables,
  };
}

function buildApiMap(files) {
  const routes = files.filter(
    (file) => file.isApiRoute
  );

  const lines = [
    "# Automatisch erzeugte API-Landkarte",
    "",
    "> Diese Datei wird durch `scripts/generate-project-map.mjs` erzeugt.",
    "> Nicht manuell bearbeiten.",
    "",
    `Erzeugt am: ${new Date().toISOString()}`,
    "",
  ];

  for (const route of routes) {
    lines.push(`## \`${route.path}\``);
    lines.push("");

    lines.push(
      `- Methoden: ${
        route.routeMethods.length
          ? route.routeMethods
              .map((method) => `\`${method}\``)
              .join(", ")
          : "nicht automatisch erkannt"
      }`
    );

    lines.push(
      `- Supabase-Tabellen: ${
        route.supabaseTables.length
          ? route.supabaseTables
              .map((table) => `\`${table}\``)
              .join(", ")
          : "keine erkannt"
      }`
    );

    lines.push(
      `- Google Calendar: ${
        route.googleCalendarMethods.length
          ? route.googleCalendarMethods
              .map(
                (method) =>
                  `\`events.${method}\``
              )
              .join(", ")
          : "keine Nutzung erkannt"
      }`
    );

    lines.push(
      `- Mail-Betreffzeilen: ${
        route.resendSubjects.length
          ? route.resendSubjects
              .map(
                (subject) =>
                  `\`${subject}\``
              )
              .join(", ")
          : "keine erkannt"
      }`
    );

    lines.push("");
  }

  return lines.join("\n");
}

function buildDatabaseUsage(files) {
  const tableMap = new Map();

  for (const file of files) {
    for (const table of file.supabaseTables) {
      if (!tableMap.has(table)) {
        tableMap.set(table, []);
      }

      tableMap.get(table).push(file.path);
    }
  }

  const lines = [
    "# Automatisch erzeugte Datenbanknutzung",
    "",
    "> Diese Datei wird durch `scripts/generate-project-map.mjs` erzeugt.",
    "> Nicht manuell bearbeiten.",
    "",
    `Erzeugt am: ${new Date().toISOString()}`,
    "",
  ];

  for (const table of uniqueSorted(
    [...tableMap.keys()]
  )) {
    lines.push(`## \`${table}\``);
    lines.push("");

    for (const file of uniqueSorted(
      tableMap.get(table)
    )) {
      lines.push(`- \`${file}\``);
    }

    lines.push("");
  }

  return lines.join("\n");
}

function buildEmailMap(files) {
  const emailFiles = files.filter(
    (file) =>
      file.resendSubjects.length > 0 ||
      file.apiFetches.some((url) =>
        url.includes(
          "api.resend.com/emails"
        )
      )
  );

  const lines = [
    "# Automatisch erzeugte E-Mail-Landkarte",
    "",
    "> Diese Datei wird durch `scripts/generate-project-map.mjs` erzeugt.",
    "> Nicht manuell bearbeiten.",
    "",
    `Erzeugt am: ${new Date().toISOString()}`,
    "",
  ];

  for (const file of emailFiles) {
    lines.push(`## \`${file.path}\``);
    lines.push("");

    lines.push(
      `- Betreffzeilen: ${
        file.resendSubjects.length
          ? file.resendSubjects
              .map(
                (subject) =>
                  `\`${subject}\``
              )
              .join(", ")
          : "dynamisch oder nicht automatisch erkannt"
      }`
    );

    lines.push("");
  }

  return lines.join("\n");
}

function buildCalendarMap(files) {
  const calendarFiles = files.filter(
    (file) =>
      file.googleCalendarMethods.length > 0
  );

  const lines = [
    "# Automatisch erzeugte Kalender-Landkarte",
    "",
    "> Diese Datei wird durch `scripts/generate-project-map.mjs` erzeugt.",
    "> Nicht manuell bearbeiten.",
    "",
    `Erzeugt am: ${new Date().toISOString()}`,
    "",
  ];

  for (const file of calendarFiles) {
    lines.push(`## \`${file.path}\``);
    lines.push("");

    lines.push(
      `- Aufrufe: ${file.googleCalendarMethods
        .map(
          (method) =>
            `\`calendar.events.${method}\``
        )
        .join(", ")}`
    );

    lines.push(
      `- Tabellen: ${
        file.supabaseTables.length
          ? file.supabaseTables
              .map((table) => `\`${table}\``)
              .join(", ")
          : "keine erkannt"
      }`
    );

    lines.push("");
  }

  return lines.join("\n");
}

function buildStatusMap(files) {
  const relevantFiles = files.filter(
    (file) =>
      file.statusValues.length > 0 ||
      file.matchStateValues.length > 0
  );

  const lines = [
    "# Automatisch erzeugte Status-Landkarte",
    "",
    "> Diese Datei wird durch `scripts/generate-project-map.mjs` erzeugt.",
    "> Nicht manuell bearbeiten.",
    "",
    `Erzeugt am: ${new Date().toISOString()}`,
    "",
  ];

  for (const file of relevantFiles) {
    lines.push(`## \`${file.path}\``);
    lines.push("");

    lines.push(
      `- Statuswerte: ${
        file.statusValues.length
          ? file.statusValues
              .map((value) => `\`${value}\``)
              .join(", ")
          : "keine erkannt"
      }`
    );

    lines.push(
      `- Match-State-Werte: ${
        file.matchStateValues.length
          ? file.matchStateValues
              .map((value) => `\`${value}\``)
              .join(", ")
          : "keine erkannt"
      }`
    );

    lines.push("");
  }

  return lines.join("\n");
}

function writeGeneratedFile(
  filename,
  content
) {
  const outputPath = path.join(
    OUTPUT_DIR,
    filename
  );

  fs.writeFileSync(
    outputPath,
    `${content.trim()}\n`,
    "utf8"
  );

  console.log(
    `✅ ${toRelativePath(outputPath)}`
  );
}

function main() {
  ensureDirectory(OUTPUT_DIR);

  const codeFiles = walkDirectory(ROOT);
  const analyzedFiles = codeFiles.map(
    analyzeFile
  );

  writeGeneratedFile(
    "api-map.md",
    buildApiMap(analyzedFiles)
  );

  writeGeneratedFile(
    "database-usage.md",
    buildDatabaseUsage(analyzedFiles)
  );

  writeGeneratedFile(
    "email-map.md",
    buildEmailMap(analyzedFiles)
  );

  writeGeneratedFile(
    "calendar-map.md",
    buildCalendarMap(analyzedFiles)
  );

  writeGeneratedFile(
    "status-map.md",
    buildStatusMap(analyzedFiles)
  );

  console.log("");
  console.log(
    `Analysierte Dateien: ${analyzedFiles.length}`
  );
}

main();