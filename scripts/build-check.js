import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const REQUIRED = [
  "index.html",
  "styles.css",
  "script.js",
  "package.json",
  "js/calculation-engine.js",
  "public/favicon.svg",
  "public/icons.svg",
  "docs/ARCHITECTURE.md",
  "docs/CALCULATION_SPEC.md",
  "docs/TESTING.md",
  "docs/VALIDATION.md",
  "docs/ROADMAP.md",
  "docs/CHANGELOG.md",
  "docs/PROJECT_AUDIT.md",
];

let missing = 0;

console.log("[build-check] verifying required project files...");

for (const rel of REQUIRED) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`  MISSING: ${rel}`);
    missing++;
    continue;
  }
  const stat = fs.statSync(abs);
  if (stat.size === 0) {
    console.error(`  EMPTY: ${rel}`);
    missing++;
  }
}

// Verify calculation-engine exports critical API by attempting dynamic import
console.log("[build-check] verifying calculation engine module...");
try {
  const enginePath = path.join(root, "js", "calculation-engine.js");
  const engineUrl = pathToFileURL(enginePath).href + "?v=" + Date.now();
  const mod = await import(engineUrl);
  const expected = [
    "calculateLMT",
    "calculateSunrise",
    "calculateUdayadhi",
    "calculateLagnaPulli",
    "calculateNakshatra",
    "calculatePipeline",
    "validateInput",
    "normalizeDegrees",
  ];
  for (const fn of expected) {
    if (typeof mod[fn] !== "function") {
      console.error(`  engine: missing export "${fn}"`);
      missing++;
    }
  }
} catch (e) {
  console.error(`  engine: module import failed: ${e.message}`);
  missing++;
}

if (missing === 0) {
  console.log("[build-check] ok");
  process.exit(0);
} else {
  console.error(`[build-check] FAILED: ${missing} issue(s)`);
  process.exit(1);
}
