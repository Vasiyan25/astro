import {
  calculatePipeline,
  formatTimeHms,
  formatLocal,
  julianDay,
  DEFAULT_CONFIG,
  NAKSHATRA_SPAN_DEG,
  PADA_SPAN_DEG,
} from "./js/calculation-engine.js";

const DEG = "\u00B0";
const PRECISION_FALLBACK = 4;
let lastResult = null;
let precision = PRECISION_FALLBACK;

function $(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function fmt(n, digits) {
  const d = Number.isFinite(digits) ? digits : precision;
  if (!Number.isFinite(n)) return String(n);
  return Number(n).toFixed(d);
}

function fmtSigned(n, digits) {
  const s = fmt(n, digits);
  return n >= 0 ? `+${s}` : s;
}

function fmtMsAsClock(ms) {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  const sign = ms < 0 ? "\u2212" : "";
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function metric(label, strong, extra) {
  const extraHtml = extra ? `<em>${extra}</em>` : "";
  return `<div class="metric"><span>${label}</span><strong>${strong}</strong>${extraHtml}</div>`;
}

function calcStep(label, value) {
  return `<div class="calc-step"><span>${label}</span><span>${value}</span></div>`;
}

function sectionHeader(icon, title, subtitle) {
  return `
    <div class="hero-block">
      <div class="hero-icon">${icon}</div>
      <div class="hero-meta">
        <span>${title}</span>
        <strong>${subtitle}</strong>
      </div>
    </div>`;
}

/* ================================================================
 * SECTION 1: NORMAL TIME → LMT
 * ============================================================== */
function renderSection1(input, s1) {
  const dateOnly = s1.localDateTime.slice(0, 10);
  const timeOnly = s1.localDateTime.slice(11) || "";
  const normalTimeStr = `${dateOnly} ${timeOnly || "(from date/time fields)"}`;
  const standardTimeHms = formatTimeHms(s1.standardTimeDate);
  const lmtHms = formatTimeHms(s1.lmtDate);

  const place = input.placeName ? input.placeName : "\u2014";

  const tzHours = Math.floor(Math.abs(input.timezoneOffsetMinutes) / 60);
  const tzMins = Math.abs(input.timezoneOffsetMinutes) % 60;
  const tzSign = input.timezoneOffsetMinutes >= 0 ? "+" : "\u2212";
  const tzLabel = `UTC${tzSign}${String(tzHours).padStart(2, "0")}:${String(tzMins).padStart(2, "0")}`;

  const hero = sectionHeader(
    "\u29D6",
    "Local Mean Time (LMT)",
    lmtHms,
  );

  const grid = `
    <div class="metric-grid">
      ${metric("Normal / Standard Time", standardTimeHms, normalTimeStr)}
      ${metric("Date", dateOnly)}
      ${metric("Place", place, input.latitude + DEG + " lat, " + input.longitude + DEG + " lon")}
      ${metric("Longitude", s1.longitudeDms.string, fmt(s1.longitude, 6) + DEG)}
      ${metric("Standard Meridian", s1.standardMeridianDms.string, fmt(s1.standardMeridian, 6) + DEG + "  (" + tzLabel + ")")}
      ${metric("LMT Result", lmtHms, `Longitude correction: ${fmtSigned(s1.timeCorrectionMinutes, 3)} min`)}
    </div>
  `;

  const details = `
    <h5>Time concepts used</h5>
    <div class="calc-formula">Standard Time (Zone) \u2192 Standard Meridian based (offset from UTC)
Local Mean Time (LMT) \u2192 Actual longitude based
Difference = (Longitude \u2212 Standard Meridian) / 15 hours per degree</div>

    <h5>Inputs</h5>
    ${calcStep("Date & Time", normalTimeStr)}
    ${calcStep("Time zone offset", tzLabel + `  (${input.timezoneOffsetMinutes} minutes from UTC)`)}
    ${calcStep("Local longitude", s1.longitudeDms.string + `  (${fmt(s1.longitude, 6)}${DEG})`)}

    <h5>Step 1 \u2014 Standard meridian</h5>
    <div class="calc-formula">Standard Meridian = UTC_offset_hours \u00D7 15${DEG}
= (${input.timezoneOffsetMinutes} \u00F7 60) \u00D7 15
= ${fmt(s1.standardMeridian, 6)}${DEG}</div>
    ${calcStep("Standard meridian", s1.standardMeridianDms.string)}

    <h5>Step 2 \u2014 Longitude difference</h5>
    <div class="calc-formula">\u0394\u03BB = Local Longitude \u2212 Standard Meridian
= ${fmt(s1.longitude, 6)}${DEG} \u2212 ${fmt(s1.standardMeridian, 6)}${DEG}
= ${fmt(s1.longitudeDiffDeg, 6)}${DEG}</div>
    ${calcStep("Longitude difference", s1.longitudeDiffDms.string + `  (${fmt(s1.longitudeDiffDeg, 6)}${DEG})`)}

    <h5>Step 3 \u2014 Time correction</h5>
    <div class="calc-formula">\u0394t = \u0394\u03BB \u00F7 15\u00B0 per hour
= ${fmt(s1.longitudeDiffDeg, 6)} \u00F7 15 hours
= ${fmt(s1.timeCorrectionMinutes, 5)} minutes
= ${fmtMsAsClock(s1.timeCorrectionMs)}</div>
    ${calcStep("Correction to LMT", fmtSigned(s1.timeCorrectionMinutes, 4) + " minutes  (" + fmtMsAsClock(s1.timeCorrectionMs) + ")")}

    <h5>Step 4 \u2014 Compute LMT</h5>
    <div class="calc-formula">LMT = Standard Time + Time Correction
= ${standardTimeHms} + ${fmtMsAsClock(s1.timeCorrectionMs)}
= ${lmtHms}</div>
    ${calcStep("Standard (zone) time", standardTimeHms)}
    ${calcStep("+ correction", fmtSigned(s1.timeCorrectionMinutes, 4) + " min")}
    ${calcStep("= Local Mean Time", `<strong style="color:var(--green)">${lmtHms}</strong>`)}
    ${calcStep("Equivalent UTC", formatLocal(s1.utcDate, 0).slice(11, 19))}
  `;

  setHtml("sec1-content", hero + grid);
  setHtml("sec1-details-body", details);
}

/* ================================================================
 * SECTION 2: UDAYADHI NĀḻIKE
 * ============================================================== */
function renderSection2(s1, s2) {
  const sunriseHms = formatTimeHms(s2.sunriseLmt);
  const sunsetHms = formatTimeHms(s2.sunsetLmt);
  const birthHms = formatTimeHms(s1.lmtDate);
  const el = s2.elapsedHms;

  const hero = sectionHeader(
    "\u014E",
    "Udayadhi N\u0101\u1E3Bike",
    `${s2.ghati} N\u0101\u1E3Bike ${s2.vinadi} Vin\u0101\u1E0Di`,
  );

  const grid = `
    <div class="metric-grid">
      ${metric("Sunrise (LMT)", sunriseHms)}
      ${metric("Birth Time (LMT)", birthHms)}
      ${metric("Sunset (LMT)", sunsetHms, `Day length: ${fmt(s2.sunsetLmt.getTime() - s2.sunriseLmt.getTime(), 0)} ms`)}
      ${metric("Elapsed from Sunrise", el.string, `${fmt(s2.elapsedMinutes, 4)} min  (${fmt(s2.elapsedSeconds, 3)} s)`)}
      ${metric("N\u0101\u1E3Bike (Ghati)", String(s2.ghati), `1 N\u0101\u1E3Bike = 24 minutes`)}
      ${metric("Vin\u0101\u1E0Di (Vighati)", String(s2.vinadi), `1 Vin\u0101\u1E0Di = 24 seconds`)}
    </div>
  `;

  const details = `
    <h5>Udayadhi convention</h5>
    <div class="calc-formula">1 day (from sunrise to sunrise) = 60 N\u0101\u1E3Bike (Ghati)
1 N\u0101\u1E3Bike = 24 standard minutes
1 Vin\u0101\u1E0Di = 24 standard seconds
Udayadhi = elapsed time since sunrise in these units</div>

    <h5>Step 1 \u2014 Sunrise at location</h5>
    <div class="calc-formula">NOAA solar model, solar altitude \u22120.833${DEG} (refraction + disc)
Sunrise (LMT) = ${sunriseHms}
Sunset  (LMT) = ${sunsetHms}</div>
    ${calcStep("Sunrise (LMT)", sunriseHms)}
    ${calcStep("Birth time used (LMT)", birthHms)}

    <h5>Step 2 \u2014 Elapsed time since sunrise</h5>
    <div class="calc-formula">\u0394T = Birth LMT \u2212 Sunrise LMT
= ${fmt(s2.elapsedMinutes, 6)} minutes
= ${el.string} (HH:MM:SS)</div>
    ${calcStep("Elapsed duration", el.string + `  (\u2248 ${fmt(s2.elapsedMinutes, 4)} minutes)`)}
    ${calcStep("Elapsed seconds", fmt(s2.elapsedSeconds, 3) + " s")}

    <h5>Step 3 \u2014 Convert to N\u0101\u1E3Bike / Vin\u0101\u1E0Di</h5>
    <div class="calc-formula">Total Vin\u0101\u1E0Di = Elapsed_seconds \u00F7 24
= ${fmt(s2.elapsedSeconds, 3)} \u00F7 24
= ${fmt(s2.totalVinadiFromSeconds, 6)} Vin\u0101\u1E0Di

N\u0101\u1E3Bike = floor(Total Vin\u0101\u1E0Di \u00F7 60)
Vin\u0101\u1E0Di = remainder</div>
    ${calcStep("1 N\u0101\u1E3Bike in seconds", "1440 s (= 24 min \u00D7 60)")}
    ${calcStep("1 Vin\u0101\u1E0Di in seconds", "24 s")}
    ${calcStep("Total Vin\u0101\u1E0Di units", fmt(s2.totalVinadiFromSeconds, 6))}
    ${calcStep("= N\u0101\u1E3Bike (Ghati)", `<strong style="color:var(--blue)">${s2.ghati}</strong>`)}
    ${calcStep("= Vin\u0101\u1E0Di (remainder)", `<strong style="color:var(--blue)">${s2.vinadi}</strong>`)}
    ${calcStep("Vighati fractional", String(s2.vighati) + " / 60")}
  `;

  setHtml("sec2-content", hero + grid);
  setHtml("sec2-details-body", details);
}

/* ================================================================
 * SECTION 3: LAGNA PULLI
 * ============================================================== */
function renderSection3(s1, s3) {
  const hero = sectionHeader(
    "\u2648",
    "Lagna R\u0101\u015Bi  \u2022  " + s3.rasiName,
    s3.lagnaPulliString + " in " + s3.rasiName,
  );

  const grid = `
    <div class="metric-grid">
      ${metric("Lagna Pulli (within R\u0101\u015Bi)", s3.lagnaPulliString)}
      ${metric("Lagna R\u0101\u015Bi", s3.rasiName, `R\u0101\u015Bi ${s3.rasiIndex + 1} of 12`)}
      ${metric("Absolute Sidereal Longitude", s3.siderealDms.string, fmt(s3.siderealLongitude, 6) + DEG)}
      ${metric("Tropical Longitude", s3.tropicalDms.string, fmt(s3.tropicalLongitude, 6) + DEG)}
      ${metric("Ayanamsha", s3.ayanamshaDms.string, fmt(s3.ayanamsha, 4) + DEG)}
      ${metric("Local Sidereal Time", fmt(s3.lmstHours, 6) + " h", fmt(s3.lmstDeg, 4) + DEG + " RAMC")}
    </div>
  `;

  const details = `
    <h5>Inputs</h5>
    ${calcStep("Geographic latitude", s3.latitudeDms.string + `  (${fmt(s3.latitude, 6)}${DEG})`)}
    ${calcStep("Geographic longitude", s3.longitudeDms.string + `  (${fmt(s3.longitude, 6)}${DEG})`)}
    ${calcStep("Instant (LMT)", formatTimeHms(s3.lmtDate) + " on " + formatLocal(s3.lmtDate, 0).slice(0, 10))}
    ${calcStep("Julian Day (UT-like)", fmt(s3.jd, 8))}

    <h5>Step 1 \u2014 Local Sidereal Time</h5>
    <div class="calc-formula">GMST\u00B0 = 280.46061837 + 360.98564736629 \u00D7 (JD \u2212 2451545)
LMST\u00B0 = normalize(GMST\u00B0 + Longitude)
LMST_h  = LMST\u00B0 \u00F7 15

LST (hours)  = ${fmt(s3.lmstHours, 8)} h
LST (degrees) = ${fmt(s3.lmstDeg, 6)}${DEG}</div>
    ${calcStep("LST at longitude", fmt(s3.lmstHours, 6) + " hours  = " + fmt(s3.lmstDeg, 4) + DEG)}

    <h5>Step 2 \u2014 Ayanamsha (Lahiri linear provisional)</h5>
    <div class="calc-formula">Ayanamsha \u2248 23.85675 + 0.013968 \u00D7 (year \u2212 2000)
= ${fmt(s3.ayanamsha, 6)}${DEG}
Note: replace with validated Lahiri before production use.</div>
    ${calcStep("Ayanamsha applied", s3.ayanamshaDms.string + `  (${fmt(s3.ayanamsha, 4)}${DEG})`)}

    <h5>Step 3 \u2014 Ascendant longitude (tropical)</h5>
    <div class="calc-formula">\u03B5 = 23.4397${DEG} (obliquity)
tan(ASC) = [cos(RAMC) + tan(\u03C6) \u00B7 tan(\u03B5) \u00B7 sin(RAMC)]
            \u00F7 [\u2212sin(RAMC) + tan(\u03C6) \u00B7 tan(\u03B5) \u00B7 cos(RAMC)]
where \u03C6 = observer latitude, RAMC = LST in degrees

Tropical ASC = ${fmt(s3.tropicalLongitude, 8)}${DEG}</div>
    ${calcStep("Tropical ascendant", s3.tropicalDms.string + `  (${fmt(s3.tropicalLongitude, 6)}${DEG})`)}

    <h5>Step 4 \u2014 Reduce to sidereal & find R\u0101\u015Bi</h5>
    <div class="calc-formula">Sidereal ASC = Tropical ASC \u2212 Ayanamsha
= ${fmt(s3.tropicalLongitude, 6)}${DEG} \u2212 ${fmt(s3.ayanamsha, 6)}${DEG}
= ${fmt(s3.siderealLongitude, 8)}${DEG}

R\u0101\u015Bi index = floor(Sidereal ASC / 30${DEG})
Lagna Pulli  = Sidereal ASC mod 30${DEG}</div>
    ${calcStep("Sidereal longitude", s3.siderealDms.string + `  (${fmt(s3.siderealLongitude, 6)}${DEG})`)}
    ${calcStep("R\u0101\u015Bi (house)", s3.rasiName + `  (index ${s3.rasiIndex + 1}/12)`)}
    ${calcStep("Lagna Pulli \u2192 within r\u0101\u015Bi", `<strong style="color:var(--purple)">${s3.lagnaPulliString}</strong>`)}
  `;

  setHtml("sec3-content", hero + grid);
  setHtml("sec3-details-body", details);
}

/* ================================================================
 * SECTION 4: LAGNAM NINDRA NAKSHATRA PADA
 * ============================================================== */
function renderSection4(s4) {
  const hero = sectionHeader(
    "\u272F",
    s4.nakshatraName + "  \u2022  Pada " + s4.pada,
    s4.nakshatraLord + " \u00B7 Lord",
  );

  const grid = `
    <div class="metric-grid">
      ${metric("Lagna (Sidereal Longitude)", s4.siderealDms.string, fmt(s4.siderealLongitude, 8) + DEG)}
      ${metric("Nakshatra", s4.nakshatraName, `#${s4.nakshatraIndex + 1} of 27`)}
      ${metric("Nakshatra Lord", s4.nakshatraLord)}
      ${metric("Pada", String(s4.pada), `Pada ${s4.pada}/4 of ${s4.nakshatraName}`)}
      ${metric("Position within Nakshatra", s4.positionInNakshatraDms.string, fmt(s4.positionInNakshatra, 6) + DEG + " / " + fmt(NAKSHATRA_SPAN_DEG, 6) + DEG)}
      ${metric("Position within Pada", s4.positionInPadaDms.string, fmt(s4.positionInPada, 6) + DEG + " / " + fmt(PADA_SPAN_DEG, 6) + DEG)}
    </div>
  `;

  const details = `
    <h5>Nakshatra / Pada grid</h5>
    <div class="calc-formula">27 Nakshatras \u00D7 4 Pada each = 108 Pada total
1 Nakshatra span = 360 / 27 = 13${DEG}20'00"
1 Pada span      = 13${DEG}20' / 4 = 3${DEG}20'00"</div>

    <h5>Step 1 \u2014 Locate sidereal longitude</h5>
    ${calcStep("Sidereal lagna longitude", s4.siderealDms.string + `  (${fmt(s4.siderealLongitude, 8)}${DEG})`)}

    <h5>Step 2 \u2014 Find Nakshatra</h5>
    <div class="calc-formula">Index = floor(L / 13.3333333${DEG})
= floor(${fmt(s4.siderealLongitude, 6)} / ${fmt(NAKSHATRA_SPAN_DEG, 8)})
= ${s4.nakshatraIndex}  \u2192 ${s4.nakshatraName}</div>
    ${calcStep("Nakshatra start", s4.nakshatraStartDms.string + `  (${fmt(s4.nakshatraStart, 6)}${DEG})`)}
    ${calcStep("Nakshatra end", s4.nakshatraEndDms.string + `  (${fmt(s4.nakshatraEnd, 6)}${DEG})`)}
    ${calcStep("Position in nakshatra", s4.positionInNakshatraDms.string + `  (${fmt(s4.positionInNakshatra, 6)}${DEG})`)}

    <h5>Step 3 \u2014 Find Pada within Nakshatra</h5>
    <div class="calc-formula">Pada sub-index = floor( Position_in_Nakshatra / 3.3333333${DEG} )
Pada = sub-index + 1

= floor(${fmt(s4.positionInNakshatra, 6)} / ${fmt(PADA_SPAN_DEG, 8)}) + 1
= Pada ${s4.pada}</div>
    ${calcStep("Pada start", s4.padaStartDms.string + `  (${fmt(s4.padaStart, 6)}${DEG})`)}
    ${calcStep("Pada end", s4.padaEndDms.string + `  (${fmt(s4.padaEnd, 6)}${DEG})`)}
    ${calcStep("Position in pada", s4.positionInPadaDms.string + `  (${fmt(s4.positionInPada, 6)}${DEG})`)}

    <h5>Final</h5>
    ${calcStep("Nakshatra", `<strong style="color:var(--orange)">${s4.nakshatraName}</strong>  (lord: ${s4.nakshatraLord})`)}
    ${calcStep("Pada", `<strong style="color:var(--orange)">${s4.pada}</strong>`)}
  `;

  setHtml("sec4-content", hero + grid);
  setHtml("sec4-details-body", details);
}

/* ================================================================
 * SUMMARY & AUDIT
 * ============================================================== */
function renderSummary(summary) {
  const rows = [
    ["Normal Time", summary.normalTimeString + "  (" + summary.normalTime.slice(0, 10) + ")"],
    ["LMT", summary.lmtString],
    ["Udayadhi N\u0101\u1E3Bike", summary.udayadhiString],
    ["Lagna Pulli", summary.lagnaPulliString + "  \u2261 " + summary.absoluteLongitudeString],
    ["Lagna R\u0101\u015Bi", summary.lagnaRasi],
    ["Nakshatra", summary.nakshatra],
    ["Nakshatra Lord", summary.nakshatraLord],
    ["Pada", String(summary.pada)],
  ];
  const html = rows.map(([k, v]) => `<div class="summary-item"><span>${k}</span><strong>${v}</strong></div>`).join("");
  setHtml("summary-grid", html);
  $("summary-panel").hidden = false;
}

function renderAudit(input, s1, s2, s3, s4) {
  const rows = [
    ["Input local", `${input.localDateTime} @ ${input.latitude},${input.longitude}`],
    ["UTC", formatLocal(s1.utcDate, 0).slice(0, 19)],
    ["LMT", s1.lmtDateString],
    ["Sunrise (LMT)", formatTimeHms(s2.sunriseLmt)],
    ["Elapsed", `${s2.elapsedHms.string} (${fmt(s2.elapsedMinutes, 3)} min)`],
    ["Udayadhi", `${s2.ghati} N / ${s2.vinadi} V`],
    ["LMST (h)", fmt(s3.lmstHours, 6) + " h"],
    ["Ayanamsha", fmt(s3.ayanamsha, 4) + DEG],
    ["Lagna tropical", fmt(s3.tropicalLongitude, 6) + DEG],
    ["Lagna sidereal", fmt(s3.siderealLongitude, 6) + DEG + " \u2192 " + s3.rasiName],
    ["Lagna pulli", s3.lagnaPulliString],
    ["Nakshatra", s4.nakshatraName],
    ["Nakshatra lord", s4.nakshatraLord],
    ["Pada", String(s4.pada)],
  ];
  const html = rows
    .map(([k, v]) => `<div class="audit-item"><span>${k}</span><strong>${v}</strong></div>`)
    .join("");
  setHtml("audit-grid", html);
}

/* ================================================================
 * COPY / PRINT / DOWNLOAD
 * ============================================================== */
function buildResultText(result) {
  const { input, summary, section1: s1, section2: s2, section3: s3, section4: s4 } = result;
  const lines = [];
  lines.push("=========================================");
  lines.push("JYOTHISHA CALCULATION SUMMARY");
  lines.push("=========================================");
  lines.push("");
  lines.push("INPUT");
  lines.push(`  Date: ${input.localDateTime.slice(0, 10)}`);
  lines.push(`  Time: ${input.localDateTime.slice(11) || "00:00"}`);
  if (input.placeName) lines.push(`  Place: ${input.placeName}`);
  lines.push(`  Latitude: ${fmt(input.latitude, 6)}${DEG}`);
  lines.push(`  Longitude: ${fmt(input.longitude, 6)}${DEG}`);
  const tzH = Math.floor(Math.abs(input.timezoneOffsetMinutes) / 60);
  const tzM = Math.abs(input.timezoneOffsetMinutes) % 60;
  const tzS = input.timezoneOffsetMinutes >= 0 ? "+" : "-";
  lines.push(`  Time zone: UTC${tzS}${String(tzH).padStart(2, "0")}:${String(tzM).padStart(2, "0")}`);
  lines.push("");
  lines.push("1. NORMAL TIME -> LMT");
  lines.push(`  Normal Time: ${summary.normalTimeString}`);
  lines.push(`  LMT: ${summary.lmtString}`);
  lines.push(`  Standard Meridian: ${fmt(s1.standardMeridian, 4)}${DEG}`);
  lines.push(`  Longitude correction: ${fmtSigned(s1.timeCorrectionMinutes, 4)} min`);
  lines.push("");
  lines.push("2. UDAYADHI NALIGE");
  lines.push(`  Sunrise (LMT): ${formatTimeHms(s2.sunriseLmt)}`);
  lines.push(`  Elapsed: ${s2.elapsedHms.string}`);
  lines.push(`  ${summary.udayadhiString}`);
  lines.push("");
  lines.push("3. LAGNA PULLI");
  lines.push(`  Rasi: ${s3.rasiName}`);
  lines.push(`  Lagna Pulli: ${s3.lagnaPulliString}`);
  lines.push(`  Absolute: ${s3.siderealDms.string}`);
  lines.push(`  Ayanamsha: ${fmt(s3.ayanamsha, 4)}${DEG}`);
  lines.push("");
  lines.push("4. LAGNAM NINDRA NAKSHATRA PADA");
  lines.push(`  Nakshatra: ${s4.nakshatraName}`);
  lines.push(`  Nakshatra Lord: ${s4.nakshatraLord}`);
  lines.push(`  Pada: ${s4.pada}`);
  lines.push(`  Position in nakshatra: ${fmt(s4.positionInNakshatra, 4)}${DEG}`);
  lines.push("");
  lines.push("=========================================");
  return lines.join("\n");
}

async function copyResultText() {
  if (!lastResult) return;
  const text = buildResultText(lastResult);
  try {
    await navigator.clipboard.writeText(text);
    flashButton("btn-copy", "Copied!");
  } catch {
    flashButton("btn-copy", "Clipboard unavailable");
  }
}

function printResult() {
  // Open all calc-details before printing so they show up in print styles
  document.querySelectorAll(".calc-details").forEach((d) => (d.open = true));
  setTimeout(() => {
    window.print();
  }, 120);
}

function downloadJson() {
  if (!lastResult) return;
  const serializable = {
    generatedAt: new Date().toISOString(),
    input: {
      ...lastResult.input,
      localDateTime: lastResult.input.localDateTime,
    },
    summary: lastResult.summary,
    section1: {
      ...lastResult.section1,
      utcDate: lastResult.section1.utcDate.toISOString(),
      standardTimeDate: lastResult.section1.standardTimeDate.toISOString(),
      lmtDate: lastResult.section1.lmtDate.toISOString(),
      lmtDateViaUtc: lastResult.section1.lmtDateViaUtc.toISOString(),
    },
    section2: {
      ...lastResult.section2,
      sunriseUtc: lastResult.section2.sunriseUtc.toISOString(),
      sunsetUtc: lastResult.section2.sunsetUtc.toISOString(),
      sunriseLmt: lastResult.section2.sunriseLmt.toISOString(),
      sunsetLmt: lastResult.section2.sunsetLmt.toISOString(),
    },
    section3: {
      ...lastResult.section3,
      lmtDate: lastResult.section3.lmtDate.toISOString(),
    },
    section4: lastResult.section4,
  };
  const blob = new Blob([JSON.stringify(serializable, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = (lastResult.input.localDateTime || "").replace(/[^0-9]/g, "") || "result";
  a.download = `jyothisha-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  flashButton("btn-download", "Downloaded");
}

function flashButton(id, text) {
  const b = $(id);
  if (!b) return;
  const orig = b.innerHTML;
  b.textContent = text;
  b.style.opacity = "0.9";
  setTimeout(() => {
    b.innerHTML = orig;
    b.style.opacity = "";
  }, 1400);
}

function showError(message) {
  const el = $("error-message");
  el.textContent = message;
  el.hidden = false;
}
function clearError() {
  $("error-message").hidden = true;
}

/* ================================================================
 * FORM HANDLING
 * ============================================================== */
 function pad2(value) {
  return String(value).padStart(2, "0");
}

function collectBirthTime24h() {
  const hour12 = Number($("input-time-hour").value);
  const minute = Number($("input-time-minute").value);
  const second = Number($("input-time-second").value);
  const ampm = $("input-time-ampm").value;

  if (!Number.isFinite(hour12) || hour12 < 1 || hour12 > 12) {
    throw new Error("Birth Time hour must be between 1 and 12.");
  }
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) {
    throw new Error("Birth Time minute must be between 0 and 59.");
  }
  if (!Number.isFinite(second) || second < 0 || second > 59) {
    throw new Error("Birth Time second must be between 0 and 59.");
  }
  if (ampm !== "AM" && ampm !== "PM") {
    throw new Error("Birth Time must specify AM or PM.");
  }

  let hour24 = hour12 % 12;
  if (ampm === "PM") hour24 += 12;

  return `${pad2(hour24)}:${pad2(minute)}:${pad2(second)}`;
}

function collectForm() {
  const date = $("input-date").value;
  const time = collectBirthTime24h();
  const localDateTime = `${date}T${time}`;
  const place = $("input-place").value.trim();
  const timezoneOffsetMinutes = Number($("input-timezone").value);
  const latitude = Number($("input-latitude").value);
  const longitude = Number($("input-longitude").value);

  precision = Number($("config-precision").value) || PRECISION_FALLBACK;

  return {
    localDateTime,
    placeName: place || null,
    timezoneOffsetMinutes,
    latitude,
    longitude,
    config: {
      ...DEFAULT_CONFIG,
      ayanamsha: $("config-ayanamsha").value,
      sunriseMethod: $("config-sunrise").value,
      precision: { display: precision, internal: 12 },
    },
  };
}

function resetForm() {
  $("input-date").value = "1990-01-01";
  $("input-time-hour").value = "12";
  $("input-time-minute").value = "0";
  $("input-time-second").value = "0";
  $("input-time-ampm").value = "PM";
  $("input-place").value = "Bengaluru";
  $("input-timezone").value = "330";
  $("input-latitude").value = "12.9716";
  $("input-longitude").value = "77.5946";
  $("config-ayanamsha").value = "lahiri";
  $("config-sunrise").value = "noaa";
  $("config-precision").value = "4";
  $("config-validation").value = "off";
  clearError();
}

function handleFormSubmit(e) {
  e.preventDefault();
  clearError();

  try {
    const input = collectForm();
    const result = calculatePipeline(input);
    lastResult = result;

    renderSection1(result.input, result.section1);
    renderSection2(result.section1, result.section2);
    renderSection3(result.section1, result.section3);
    renderSection4(result.section4);
    renderSummary(result.summary);

    const validationMode = $("config-validation").value === "on";
    if (validationMode) {
      renderAudit(result.input, result.section1, result.section2, result.section3, result.section4);
      $("audit-section").hidden = false;
      $("audit-meta").textContent =
        `${result.input.config.ayanamsha} ayanamsha \u00B7 ${result.input.config.sunriseMethod} sunrise \u00B7 internal float`;
    } else {
      $("audit-section").hidden = true;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    showError("Calculation error: " + msg);
  }
}

/* ================================================================
 * BOOTSTRAP
 * ============================================================== */
function init() {
  $("birth-form").addEventListener("submit", handleFormSubmit);
  $("btn-reset").addEventListener("click", resetForm);
  $("btn-copy").addEventListener("click", copyResultText);
  $("btn-print").addEventListener("click", printResult);
  $("btn-download").addEventListener("click", downloadJson);

  // Auto-calculate on first load so sections aren't empty (convenience)
  window.setTimeout(() => {
    handleFormSubmit({ preventDefault() {} });
  }, 50);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { buildResultText };
