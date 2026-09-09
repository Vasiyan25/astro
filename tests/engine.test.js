import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeDegrees,
  degreesToDms,
  dmsToDegrees,
  standardMeridianDeg,
  calculateLMT,
  calculateSunrise,
  calculateUdayadhi,
  calculateGmstHours,
  calculateLmstHours,
  calculateAyanamsha,
  calculateLagnaPulli,
  calculateNakshatra,
  validateInput,
  calculatePipeline,
  IST_OFFSET_MINUTES,
  NAKSHATRA_SPAN_DEG,
  PADA_SPAN_DEG,
  RASIS,
  NAKSHATRAS,
  julianDay,
} from "../js/calculation-engine.js";

const EPS = 1e-6;

function approx(actual, expected, eps, msg) {
  const ok = Math.abs(actual - expected) < eps;
  if (!ok) {
    console.error(`  FAIL ${msg || ""}: got ${actual}, expected ~${expected}, diff=${actual - expected}`);
  }
  assert.ok(ok, `${msg || ""}: ${actual} !== ~${expected}`);
}

describe("UTILS", () => {
  it("normalizeDegrees wraps negative angles correctly", () => {
    approx(normalizeDegrees(-1), 359, EPS);
    approx(normalizeDegrees(-361), 359, EPS);
    approx(normalizeDegrees(360), 0, EPS);
    approx(normalizeDegrees(720.5), 0.5, EPS);
    approx(normalizeDegrees(0), 0, EPS);
    approx(normalizeDegrees(180), 180, EPS);
  });

  it("degreesToDms converts decimal degrees", () => {
    const d1 = degreesToDms(77.5946);
    approx(d1.deg, 77, 0.0001);
    approx(d1.min, 35, 1);
    assert.match(d1.string, /^77\u00B0 \d+'/);

    const d2 = degreesToDms(82.5);
    approx(d2.deg, 82, 0.0001);
    approx(d2.min, 30, 0.0001);
  });

  it("dmsToDegrees converts DMS back to decimal", () => {
    approx(dmsToDegrees(77, 35, 40.56), 77.5946, 0.0001);
    approx(dmsToDegrees(82, 30, 0), 82.5, EPS);
  });

  it("standardMeridianDeg matches IST", () => {
    approx(standardMeridianDeg(IST_OFFSET_MINUTES), 82.5, EPS);
    approx(standardMeridianDeg(0), 0, EPS);
    approx(standardMeridianDeg(-300), -75, EPS);
  });
});

describe("SECTION 1: calculateLMT — Normal Time to LMT", () => {
  it("IST + Bengaluru longitude: subtracts ~4:56:48 from IST", () => {
    const r = calculateLMT({
      localDateTime: "1990-01-01T12:00:00",
      longitude: 77.5946,
      timezoneOffsetMinutes: IST_OFFSET_MINUTES,
    });

    // Standard meridian for IST = 82.5°. Longitude = 77.5946° E
    // Δλ = 77.5946 - 82.5 = -4.9054°
    // Δt = -4.9054 / 15 hours = -19.6216 minutes
    approx(r.longitudeDiffDeg, 77.5946 - 82.5, 1e-4);
    approx(r.timeCorrectionMinutes, (77.5946 - 82.5) * 4, 1e-3); // 4 min per degree

    // So LMT for 12:00 IST should be around 11:40:22 AM
    const h = r.lmtDate.getUTCHours();
    const m = r.lmtDate.getUTCMinutes();
    approx(h, 11, 0.5, "LMT hour");
    approx(m, 40, 2, "LMT minutes");

    // Two computation paths must agree
    approx(r.lmtDate.getTime(), r.lmtDateViaUtc.getTime(), 0.001, "LMT via two methods");
  });

  it("negative time zone (EST) + west longitude works", () => {
    const r = calculateLMT({
      localDateTime: "2020-06-15T10:00:00",
      longitude: -74.006, // NYC
      timezoneOffsetMinutes: -240, // EDT UTC-4
    });
    approx(r.standardMeridian, -60, EPS);
    // Diff = -74.006 - (-60) = -14.006°, correction negative
    assert.ok(r.timeCorrectionMinutes < 0, "correction should be negative for longitudes W of std meridian");
  });

  it("longitude exactly on standard meridian → zero correction", () => {
    const r = calculateLMT({
      localDateTime: "2000-03-20T06:00:00",
      longitude: 82.5, // exactly IST standard meridian
      timezoneOffsetMinutes: IST_OFFSET_MINUTES,
    });
    approx(r.longitudeDiffDeg, 0, 1e-9);
    approx(r.timeCorrectionMinutes, 0, 1e-9);
  });

  it("invalid longitude throws", () => {
    assert.throws(() =>
      calculateLMT({ localDateTime: "2000-01-01T00:00:00", longitude: 200, timezoneOffsetMinutes: 0 })
    );
  });

  it("invalid datetime string throws", () => {
    assert.throws(() =>
      calculateLMT({ localDateTime: "not-a-date", longitude: 0, timezoneOffsetMinutes: 0 })
    );
  });
});

describe("SECTION 2: Sunrise + Udayadhi", () => {
  it("sunrise near equator on equinox ~06:00 LMT", () => {
    const date = new Date(Date.UTC(2023, 2, 21, 0, 0, 0)); // March 21
    const lat = 0;
    const lon = 0;
    const s = calculateSunrise(date, lat, lon, 0);

    const h = s.sunriseLmt.getUTCHours();
    const m = s.sunriseLmt.getUTCMinutes();
    // Rough validation: equator equinox sunrise between 5:30 and 6:30
    assert.ok(h === 5 || h === 6, `unexpected sunrise hour: ${h}`);
    assert.ok(s.sunsetLmt.getTime() > s.sunriseLmt.getTime(), "sunset after sunrise");
  });

  it("calculateUdayadhi birth exactly at sunrise → 0", () => {
    const sunrise = new Date(Date.UTC(2023, 2, 21, 6, 0, 0));
    const birth = new Date(sunrise.getTime());
    const u = calculateUdayadhi(sunrise, birth);
    approx(u.elapsedMinutes, 0, 1e-6);
    assert.equal(u.ghati, 0, "ghati at sunrise");
    assert.equal(u.vinadi, 0, "vinadi at sunrise");
  });

  it("calculateUdayadhi birth 6h after sunrise → 15 Nāḻike (6h = 360m / 24 = 15)", () => {
    const sunrise = new Date(Date.UTC(2023, 2, 21, 6, 0, 0));
    const birth = new Date(sunrise.getTime() + 6 * 3600 * 1000);
    const u = calculateUdayadhi(sunrise, birth);
    approx(u.elapsedMinutes, 360, 0.01);
    assert.equal(u.ghati, 15, "6h should equal 15 ghati");
    assert.ok(u.vinadi === 0 || u.vinadi === 1 || Math.abs(u.vinadi) < 5, "vinadi near zero");
    approx(u.totalGhatiFloat, 15, 0.01);
  });

  it("calculateUdayadhi birth before sunrise → beforeSunrise flag + zero clipped", () => {
    const sunrise = new Date(Date.UTC(2023, 2, 21, 6, 0, 0));
    const birth = new Date(sunrise.getTime() - 30 * 60000); // 30 min before
    const u = calculateUdayadhi(sunrise, birth);
    assert.equal(u.beforeSunrise, true);
    assert.ok(u.ghati === 0, "ghati should be zero clipped");
  });

  it("full day 24h from sunrise → 60 Nāḻike = 0 after mod", () => {
    const sunrise = new Date(Date.UTC(2023, 2, 21, 6, 0, 0));
    const birth = new Date(sunrise.getTime() + 24 * 3600 * 1000);
    const u = calculateUdayadhi(sunrise, birth);
    approx(u.elapsedMinutes, 1440, 0.01);
    approx(u.ghati, 60, 1);
  });
});

describe("SECTION 3: Sidereal time + Ayanamsha + Lagna Pulli", () => {
  it("calculateGmstHours produces hours in [0,24)", () => {
    const jd = 2451545.0; // J2000 epoch
    const gmst = calculateGmstHours(jd);
    // At J2000 (noon Jan 1 2000 TD), GMST at 0h UT Jan 1 2000 is ~18:40:31
    approx(gmst, 18.6833, 0.5);
    assert.ok(gmst >= 0 && gmst < 24);
  });

  it("calculateLmstHours increases with east longitude", () => {
    const jd = 2451545.0;
    const a = calculateLmstHours(jd, 0);
    const b = calculateLmstHours(jd, 15); // +1 hour
    approx(b - a, 1, 0.001);
  });

  it("calculateAyanamsha year 2000 baseline", () => {
    approx(calculateAyanamsha(2000), 23.85675, 1e-6);
    approx(calculateAyanamsha(2025), 23.85675 + 0.013968 * 25, 1e-6);
  });

  it("calculateLagnaPulli returns value in [0,360) and valid rasi", () => {
    const lmtDate = new Date(Date.UTC(2023, 2, 21, 10, 30, 0));
    const r = calculateLagnaPulli({
      lmtDate,
      latitude: 12.9716,
      longitude: 77.5946,
    });
    assert.ok(r.siderealLongitude >= 0 && r.siderealLongitude < 360, "sidereal lon in range");
    assert.ok(r.rasiIndex >= 0 && r.rasiIndex <= 11, "valid rasi index");
    assert.equal(r.rasiName, RASIS[r.rasiIndex]);
    approx(r.rasiLongitude, r.siderealLongitude - r.rasiIndex * 30, 1e-9);
  });

  it("calculateLagnaPulli equator differs from high lat (no crash)", () => {
    const lmtDate = new Date(Date.UTC(2023, 2, 21, 10, 30, 0));
    const a = calculateLagnaPulli({ lmtDate, latitude: 0, longitude: 0 });
    const b = calculateLagnaPulli({ lmtDate, latitude: 60, longitude: 0 });
    assert.notEqual(a.siderealLongitude.toFixed(3), b.siderealLongitude.toFixed(3));
  });
});

describe("SECTION 4: Nakshatra + Pada", () => {
  it("NAKSHATRA_SPAN_DEG = 13°20' exactly", () => {
    approx(NAKSHATRA_SPAN_DEG * 27, 360, 1e-9);
    approx(PADA_SPAN_DEG * 4, NAKSHATRA_SPAN_DEG, 1e-9);
  });

  it("longitude 0° → Ashwini, Pada 1", () => {
    const r = calculateNakshatra(0);
    assert.equal(r.nakshatraName, "Ashwini");
    assert.equal(r.nakshatraLord, "Ketu");
    assert.equal(r.pada, 1);
    approx(r.positionInNakshatra, 0, 1e-9);
  });

  it("exact nakshatra boundary: just below 13°20' → Ashwini Pada 4, at/above → Bharani", () => {
    // Half-open intervals: [start, end)
    // Floating-point aware: step a tiny epsilon over each side of the boundary
    const eps = 1e-9;
    const bound = NAKSHATRA_SPAN_DEG;
    const rBelow = calculateNakshatra(bound - eps);
    const rAbove = calculateNakshatra(bound + eps);
    assert.equal(rBelow.nakshatraName, "Ashwini", "just below boundary still Ashwini");
    assert.equal(rBelow.pada, 4);
    assert.equal(rAbove.nakshatraName, "Bharani", "just above boundary switches to Bharani");
    assert.equal(rAbove.pada, 1);
    approx(rAbove.positionInNakshatra, 0, 1e-3);
  });

  it("Pada boundary: just below 3°20' within Ashwini → Pada 1, just above → Pada 2", () => {
    const eps = 1e-9;
    const bound = PADA_SPAN_DEG;
    const rBelow = calculateNakshatra(bound - eps);
    const rAbove = calculateNakshatra(bound + eps);
    assert.equal(rBelow.pada, 1, "just below pada boundary still Pada 1");
    assert.equal(rAbove.pada, 2, "just above pada boundary is Pada 2");
    approx(rAbove.positionInPada, 0, 1e-3);
  });

  it("last pada of Revati just below 360 → Revati Pada 4", () => {
    const r = calculateNakshatra(360 - 1e-6);
    assert.equal(r.nakshatraName, "Revati");
    assert.equal(r.pada, 4);
    assert.equal(r.nakshatraLord, "Mercury");
  });

  it("NAKSHATRAS list has 27 entries and RASIS has 12", () => {
    assert.equal(NAKSHATRAS.length, 27);
    assert.equal(RASIS.length, 12);
  });

  it("Rasi boundary near 30°: maps into Nakshatra #3 (Krittika) correctly", () => {
    // 30° decimal degrees. Nakshatra boundaries are at 0, 13°20', 26°40', 40°...
    // 30° falls in 3rd nakshatra = Krittika (index 2).
    // Due to 360/27 float drift: 30 / (360/27) = 2.2499999999999996 → floor = 2 (Krittika).
    // Position in Krittika = 30 - 2*(360/27) ≈ 3.3333° which is at the Pada 1 → Pada 2
    // boundary (1 pada = 360/108 ≈ 3.3333°). Use epsilon-aware split:
    const eps = 1e-9;
    const rLo = calculateNakshatra(30.0 - eps);
    const rHi = calculateNakshatra(30.0 + eps);
    assert.equal(rLo.nakshatraIndex, 2);
    assert.equal(rLo.nakshatraName, "Krittika");
    assert.equal(rHi.nakshatraIndex, 2);
    assert.equal(rHi.nakshatraName, "Krittika");
    // Pada: below boundary → Pada 1, above → Pada 2
    const padaSpan = NAKSHATRA_SPAN_DEG / 4;
    const switchover = 2 * NAKSHATRA_SPAN_DEG + padaSpan; // ≈ 30.0
    const rBelow = calculateNakshatra(switchover - eps);
    const rAbove = calculateNakshatra(switchover + eps);
    assert.equal(rBelow.pada, 1);
    assert.equal(rAbove.pada, 2);
  });
});

describe("VALIDATION", () => {
  it("validateInput rejects bad latitude", () => {
    const r = validateInput({ localDateTime: "2000-01-01T00:00:00", latitude: 95, longitude: 0 });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => /latitude/i.test(e)));
  });

  it("validateInput rejects bad longitude", () => {
    const r = validateInput({ localDateTime: "2000-01-01T00:00:00", latitude: 0, longitude: 200 });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => /longitude/i.test(e)));
  });

  it("validateInput rejects missing date", () => {
    const r = validateInput({ latitude: 0, longitude: 0 });
    assert.equal(r.valid, false);
  });

  it("validateInput accepts normal values", () => {
    const r = validateInput({
      localDateTime: "2000-01-01T12:00:00",
      latitude: 12.9,
      longitude: 77.5,
      timezoneOffsetMinutes: 330,
    });
    assert.equal(r.valid, true);
    assert.equal(r.errors.length, 0);
  });
});

describe("END-TO-END PIPELINE", () => {
  const BLR = {
    localDateTime: "1990-01-01T12:00:00",
    placeName: "Bengaluru",
    timezoneOffsetMinutes: IST_OFFSET_MINUTES,
    latitude: 12.9716,
    longitude: 77.5946,
  };

  it("pipeline runs and returns all 4 sections + summary", () => {
    const r = calculatePipeline(BLR);
    assert.ok(r.section1, "section1 missing");
    assert.ok(r.section2, "section2 missing");
    assert.ok(r.section3, "section3 missing");
    assert.ok(r.section4, "section4 missing");
    assert.ok(r.summary, "summary missing");

    // LMT must differ from IST for Bengaluru (west of standard meridian)
    assert.notEqual(formatUTC(r.section1.standardTimeDate), formatUTC(r.section1.lmtDate));

    // Sunrise < Sunset
    assert.ok(r.section2.sunsetLmt.getTime() > r.section2.sunriseLmt.getTime(), "sunset after sunrise");

    // Lagna rasi is valid
    assert.ok(RASIS.includes(r.section3.rasiName));

    // Nakshatra valid
    assert.ok(NAKSHATRAS.map((n) => n[0]).includes(r.section4.nakshatraName));

    // Pada 1..4
    assert.ok(r.section4.pada >= 1 && r.section4.pada <= 4);

    // Summary fields populated
    assert.ok(r.summary.lmtString);
    assert.ok(r.summary.udayadhiString);
    assert.ok(r.summary.lagnaPulliString);
    assert.ok(r.summary.nakshatra);
  });

  it("pipeline output: Section 2 receives exact LMT date from Section 1", () => {
    const r = calculatePipeline(BLR);
    assert.equal(r.section2.birthLmt.getTime(), r.section1.lmtDate.getTime(), "birth LMT passed through");
  });

  it("pipeline output: Section 3 receives exact sidereal lon consumed by Section 4", () => {
    const r = calculatePipeline(BLR);
    approx(r.section4.siderealLongitude, r.section3.siderealLongitude, 1e-9, "s3 vs s4 sidereal match");
  });

  it("midnight birth does not crash", () => {
    const r = calculatePipeline({
      ...BLR,
      localDateTime: "1990-01-01T00:00:00",
    });
    assert.ok(r.summary.lmtString);
  });

  it("noon birth works", () => {
    const r = calculatePipeline({ ...BLR, localDateTime: "1990-01-01T12:00:00" });
    assert.ok(r.summary.lmtString);
  });

  it("leap year Feb 29 works", () => {
    const r = calculatePipeline({ ...BLR, localDateTime: "2020-02-29T08:30:00" });
    assert.ok(r.summary.lmtString);
  });

  it("year boundary Dec 31→Jan 1 works", () => {
    const a = calculatePipeline({ ...BLR, localDateTime: "2020-12-31T23:59:59" });
    const b = calculatePipeline({ ...BLR, localDateTime: "2021-01-01T00:00:00" });
    assert.ok(a.summary.lmtString && b.summary.lmtString);
  });

  it("different timezone (JST + Tokyo lon) works", () => {
    const r = calculatePipeline({
      localDateTime: "2000-07-07T15:00:00",
      placeName: "Tokyo",
      timezoneOffsetMinutes: 540,
      latitude: 35.6762,
      longitude: 139.6503,
    });
    // Tokyo lon 139.65°, std meridian 135° → diff +4.65° → correction +18.6 min
    assert.ok(r.section1.timeCorrectionMinutes > 0, "east of std meridian");
    assert.ok(r.summary.lmtString);
  });

  it("equator works (special ascendant geometry)", () => {
    const r = calculatePipeline({
      localDateTime: "2023-03-21T12:00:00",
      placeName: "Quito",
      timezoneOffsetMinutes: -300,
      latitude: -0.1807,
      longitude: -78.4678,
    });
    assert.ok(r.summary.lagnaPulliString);
  });

  it("invalid latitude throws meaningful error", () => {
    assert.throws(() => calculatePipeline({ ...BLR, latitude: 100 }), /latitude/i);
  });

  it("pipeline reproducibility — same input = same output", () => {
    const a = calculatePipeline(BLR);
    const b = calculatePipeline(BLR);
    approx(a.section3.siderealLongitude, b.section3.siderealLongitude, 1e-12);
    assert.equal(a.section4.nakshatraName, b.section4.nakshatraName);
    assert.equal(a.section4.pada, b.section4.pada);
  });
});

describe("EDGE CASES & BOUNDARIES", () => {
  it("exact pada boundary: position in pada = 0", () => {
    const r = calculateNakshatra(NAKSHATRA_SPAN_DEG + PADA_SPAN_DEG);
    approx(r.positionInPada, 0, 1e-9);
    assert.equal(r.pada, 2);
  });

  it("just before pada boundary: position in pada close to 3°20'", () => {
    const eps = 1e-6;
    const r = calculateNakshatra(NAKSHATRA_SPAN_DEG + PADA_SPAN_DEG - eps);
    assert.equal(r.pada, 1);
    assert.ok(r.positionInPada > PADA_SPAN_DEG - 1e-3);
  });

  it("longitude ±180 equivalent via normalize", () => {
    const a = calculateNakshatra(179.999);
    const b = calculateNakshatra(-180.001);
    // They should map to very close positions (within rounding)
    assert.equal(a.nakshatraIndex, b.nakshatraIndex);
  });
});

/* helpers */
function formatUTC(d) {
  return d.toISOString().slice(11, 19);
}
