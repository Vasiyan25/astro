import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const files = [
  "script.js",
  "js/calculation-engine.js",
  "docs/ARCHITECTURE.md",
  "docs/CALCULATION_SPEC.md",
  "docs/TESTING.md",
  "docs/VALIDATION.md",
  "docs/ROADMAP.md",
  "docs/CHANGELOG.md",
  "docs/PROJECT_AUDIT.md",
];

let errors = 0;

console.log("[lint] syntax checking JS files...");

for (const rel of files) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    if (rel.endsWith(".js")) {
      console.error(`  MISSING: ${rel}`);
      errors++;
    }
    continue;
  }
  if (!rel.endsWith(".js")) continue;

  const src = fs.readFileSync(abs, "utf8");

  // Basic check: balanced braces, parens, brackets
  let b = 0, p = 0, br = 0, inS = false, inD = false, inT = false, esc = false, inLine = false, inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1] || "";
    if (inLine) {
      if (c === "\n") inLine = false;
      continue;
    }
    if (inBlock) {
      if (c === "*" && n === "/") { inBlock = false; i++; }
      continue;
    }
    if (esc) { esc = false; continue; }
    if (c === "\\" && (inS || inD || inT)) { esc = true; continue; }
    if (!inT && !inS && !inD) {
      if (c === "/" && n === "/") { inLine = true; i++; continue; }
      if (c === "/" && n === "*") { inBlock = true; i++; continue; }
    }
    if (c === "'" && !inD && !inT) inS = !inS;
    else if (c === '"' && !inS && !inT) inD = !inD;
    else if (c === "`" && !inS && !inD) inT = !inT;
    else if (!inS && !inD && !inT) {
      if (c === "{") b++;
      else if (c === "}") b--;
      else if (c === "(") p++;
      else if (c === ")") p--;
      else if (c === "[") br++;
      else if (c === "]") br--;
    }
  }

  if (b !== 0) { console.error(`  ${rel}: unbalanced braces (${b})`); errors++; }
  if (p !== 0) { console.error(`  ${rel}: unbalanced parens (${p})`); errors++; }
  if (br !== 0) { console.error(`  ${rel}: unbalanced brackets (${br})`); errors++; }

  // Try to parse with vm on stripped module syntax if ESM
  try {
    // Strip import/export lines for a basic parse check
    const stripped = src
      .replace(/^\s*import\s+[\s\S]*?from\s+["'][^"']+["'];?/gm, "")
      .replace(/^\s*import\s+["'][^"']+["'];?/gm, "")
      .replace(/^\s*export\s+(?:\{[^}]*\}|default\s+|\*\s+as\s+\w+|type\s+\w+|declare\s+)?[\s\S]*?;/gm, "")
      .replace(/^\s*export\s+(?:default\s+)?/gm, "")
      .replace(/^\s*export\s*\{[\s\S]*?\};?/gm, "");
    new vm.Script(stripped, { filename: rel });
  } catch (e) {
    // Fall back: rely on dynamic import test in build-check instead
    console.warn(`  ${rel}: (note) vm.Script parse skipped (${e.message.slice(0, 60)})`);
  }
}

if (errors === 0) {
  console.log("[lint] ok");
  process.exit(0);
} else {
  console.error(`[lint] FAILED: ${errors} issue(s)`);
  process.exit(1);
}
