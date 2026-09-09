import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const JS_FILES = ["script.js", "js/calculation-engine.js"];
const CSS_FILES = ["styles.css"];
const HTML_FILES = ["index.html"];
const MAX_LINE_LEN = 200;
let warnings = 0;

function checkFile(rel, opts = {}) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return;
  const src = fs.readFileSync(abs, "utf8");
  const lines = src.split(/\r?\n/);
  if (opts.trailingNewline !== false && src.length > 0 && !src.endsWith("\n")) {
    console.warn(`  ${rel}: missing trailing newline`);
    warnings++;
  }
  if (/[ \t]$/.test(src.replace(/\r?\n/g, "\n").split("\n").slice(0, -1).join("\n"))) {
    console.warn(`  ${rel}: trailing whitespace on some line(s)`);
    warnings++;
  }
  lines.forEach((l, i) => {
    if (l.length > MAX_LINE_LEN) {
      console.warn(`  ${rel}:${i + 1}: line too long (${l.length} > ${MAX_LINE_LEN})`);
      warnings++;
    }
    if (/\t/.test(l) && opts.tabs === false) {
      console.warn(`  ${rel}:${i + 1}: tab character found`);
      warnings++;
    }
  });
}

console.log("[format-check] scanning JS/CSS/HTML...");
JS_FILES.forEach((f) => checkFile(f, { tabs: false }));
CSS_FILES.forEach((f) => checkFile(f, { tabs: false }));
HTML_FILES.forEach((f) => checkFile(f, { tabs: false, maxLine: 300 }));

if (warnings === 0) {
  console.log("[format-check] ok");
  process.exit(0);
} else {
  console.error(`[format-check] FAILED: ${warnings} warning(s)`);
  process.exit(1);
}
