export const NAKSHATRAS = [
  ["Ashwini", "Ketu"],
  ["Bharani", "Venus"],
  ["Krittika", "Sun"],
  ["Rohini", "Moon"],
  ["Mrigashira", "Mars"],
  ["Ardra", "Rahu"],
  ["Punarvasu", "Jupiter"],
  ["Pushya", "Saturn"],
  ["Ashlesha", "Mercury"],
  ["Magha", "Ketu"],
  ["Purva Phalguni", "Venus"],
  ["Uttara Phalguni", "Sun"],
  ["Hasta", "Moon"],
  ["Chitra", "Mars"],
  ["Swati", "Rahu"],
  ["Vishakha", "Jupiter"],
  ["Anuradha", "Saturn"],
  ["Jyeshtha", "Mercury"],
  ["Mula", "Ketu"],
  ["Purva Ashadha", "Venus"],
  ["Uttara Ashadha", "Sun"],
  ["Shravana", "Moon"],
  ["Dhanishta", "Mars"],
  ["Shatabhisha", "Rahu"],
  ["Purva Bhadrapada", "Jupiter"],
  ["Uttara Bhadrapada", "Saturn"],
  ["Revati", "Mercury"],
];

export const RASIS = [
  "Mesha",
  "Vrishabha",
  "Mithuna",
  "Karkata",
  "Simha",
  "Kanya",
  "Tula",
  "Vrischika",
  "Dhanus",
  "Makara",
  "Kumbha",
  "Meena",
];

export const DEGREE = Math.PI / 180;
export const IST_OFFSET_MINUTES = 330;
export const NAKSHATRA_SPAN_DEG = 360 / 27;
export const PADA_SPAN_DEG = NAKSHATRA_SPAN_DEG / 4;
export const RASI_SPAN_DEG = 30;
export const SOLAR_ALTITUDE_DEG = -0.833;

export const DEFAULT_CONFIG = {
  ayanamsha: "lahiri",
  sunriseMethod: "noaa",
  udayadhiConvention: "ghati24",
  precision: {
    display: 2,
    internal: 12,
  },
  rounding: "truncate",
};

export function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

export function degreesToDms(decimalDegrees) {
  const abs = Math.abs(decimalDegrees);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60 * 100) / 100;
  const sign = decimalDegrees < 0 ? "-" : "";
  return { deg, min, sec, sign, string: `${sign}${deg}° ${min}' ${sec.toFixed(0)}"` };
}

export function dmsToDegrees(deg, min = 0, sec = 0) {
  const sign = deg < 0 ? -1 : 1;
  return sign * (Math.abs(deg) + min / 60 + sec / 3600);
}

export function localDateToUtc(localDateTimeIso, timezoneOffsetMinutes) {
  const [datePart, timePart = "00:00"] = localDateTimeIso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hoursStr = "0", minutesStr = "0", secondsStr = "0"] = timePart.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  const seconds = Number(secondsStr);
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes, seconds) - timezoneOffsetMinutes * 60000
  );
}

export function formatLocal(date, timezoneOffsetMinutes = 0) {
  const shifted = new Date(date.getTime() + timezoneOffsetMinutes * 60000);
  return shifted.toISOString().slice(0, 19).replace("T", " ");
}

export function formatTimeHms(date) {
  const h = String(date.getUTCHours()).padStart(2, "0");
  const m = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function formatDateYmd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

export function standardMeridianDeg(timezoneOffsetMinutes) {
  return (timezoneOffsetMinutes / 60) * 15;
}

export function calculateLMT(input) {
  const { localDateTime, longitude, timezoneOffsetMinutes = IST_OFFSET_MINUTES } = input;

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Longitude must be between -180 and 180 degrees");
  }

  const standardMeridian = standardMeridianDeg(timezoneOffsetMinutes);
  const longitudeDiffDeg = longitude - standardMeridian;
  const timeCorrectionMinutes = (longitudeDiffDeg / 15) * 60;
  const timeCorrectionMs = timeCorrectionMinutes * 60000;

  const utcDate = localDateToUtc(localDateTime, timezoneOffsetMinutes);

  if (Number.isNaN(utcDate.getTime())) {
    throw new Error("Birth date and time are invalid");
  }

  const standardTimeMs = utcDate.getTime() + timezoneOffsetMinutes * 60000;
  const lmtDate = new Date(standardTimeMs + timeCorrectionMs);
  const lmtCorrectionFromUtcMs = (longitude / 15) * 3600000;
  const lmtViaUtc = new Date(utcDate.getTime() + lmtCorrectionFromUtcMs);

  return {
    localDateTime,
    longitude,
    longitudeDms: degreesToDms(longitude),
    timezoneOffsetMinutes,
    standardMeridian,
    standardMeridianDms: degreesToDms(standardMeridian),
    longitudeDiffDeg,
    longitudeDiffDms: degreesToDms(longitudeDiffDeg),
    timeCorrectionMinutes,
    timeCorrectionMs,
    utcDate,
    standardTimeDate: new Date(standardTimeMs),
    lmtDate,
    lmtDateViaUtc: lmtViaUtc,
    lmtString: formatTimeHms(lmtDate),
    lmtDateString: formatLocal(lmtDate, 0),
  };
}

export function solarEventUtc(date, latitude, longitude, sunrise = true) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const n = Math.round(julianDay(day) - 2451545.0009 + longitude / 360);
  const approximateTransit = 2451545.0009 - longitude / 360 + n;
  const meanAnomaly = normalizeDegrees(357.5291 + 0.98560028 * (approximateTransit - 2451545));
  const equation =
    meanAnomaly +
    1.9148 * Math.sin(meanAnomaly * DEGREE) +
    0.02 * Math.sin(2 * meanAnomaly * DEGREE) +
    0.0003 * Math.sin(3 * meanAnomaly * DEGREE);
  const eclipticLongitude = normalizeDegrees(equation + 102.9372 + 180);
  const solarTransit =
    approximateTransit +
    0.0053 * Math.sin(meanAnomaly * DEGREE) -
    0.0069 * Math.sin(2 * eclipticLongitude * DEGREE);
  const declination = Math.asin(Math.sin(eclipticLongitude * DEGREE) * Math.sin(23.4397 * DEGREE));
  const hourAngleCos =
    (Math.sin(SOLAR_ALTITUDE_DEG * DEGREE) - Math.sin(latitude * DEGREE) * Math.sin(declination)) /
    (Math.cos(latitude * DEGREE) * Math.cos(declination));

  if (hourAngleCos < -1 || hourAngleCos > 1) {
    throw new Error("Sunrise is undefined at this latitude and date");
  }

  const hourAngle = Math.acos(hourAngleCos) / (2 * Math.PI);
  const eventJd = solarTransit + (sunrise ? -hourAngle : hourAngle);
  return new Date((eventJd - 2440587.5) * 86400000);
}

export function calculateSunrise(date, latitude, longitude, lmtCorrectionFromUtcMs = 0) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("Latitude must be between -90 and 90 degrees");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Longitude must be between -180 and 180 degrees");
  }

  const sunriseUtc = solarEventUtc(date, latitude, longitude, true);
  const sunsetUtc = solarEventUtc(date, latitude, longitude, false);
  const sunriseLmt = new Date(sunriseUtc.getTime() + lmtCorrectionFromUtcMs);
  const sunsetLmt = new Date(sunsetUtc.getTime() + lmtCorrectionFromUtcMs);

  return {
    sunriseUtc,
    sunsetUtc,
    sunriseLmt,
    sunsetLmt,
    sunriseString: formatTimeHms(sunriseLmt),
    sunsetString: formatTimeHms(sunsetLmt),
  };
}

export function calculateUdayadhi(sunriseLmt, birthLmt) {
  const elapsedMs = birthLmt.getTime() - sunriseLmt.getTime();
  const elapsedMinutes = elapsedMs / 60000;
  const elapsedSeconds = elapsedMs / 1000;

  const GHATI_MINUTES = 24;
  const VINADI_SECONDS = 24;
  const GHATI_SECONDS = GHATI_MINUTES * 60;

  const totalVinadiFromSeconds = Math.max(0, elapsedSeconds / VINADI_SECONDS);
  const ghati = Math.floor(totalVinadiFromSeconds / 60);
  const vinadiRemainder = totalVinadiFromSeconds - ghati * 60;
  const vinadi = Math.floor(vinadiRemainder);
  const vighatiFraction = vinadiRemainder - vinadi;
  const vighati = Math.floor(vighatiFraction * 60);

  const totalGhatiFloat = Math.max(0, elapsedMinutes / GHATI_MINUTES);

  const elapsedHmsDate = new Date(Math.max(0, elapsedMs));
  const elapsedHms = {
    hours: Math.floor(elapsedMinutes / 60),
    minutes: Math.floor(elapsedMinutes % 60),
    seconds: Math.floor((elapsedMs / 1000) % 60),
    string:
      String(Math.floor(elapsedMinutes / 60)).padStart(2, "0") +
      ":" +
      String(Math.floor(elapsedMinutes % 60)).padStart(2, "0") +
      ":" +
      String(Math.floor((elapsedMs / 1000) % 60)).padStart(2, "0"),
  };

  return {
    sunriseLmt,
    birthLmt,
    elapsedMs,
    elapsedMinutes,
    elapsedSeconds,
    elapsedHms,
    totalGhatiFloat,
    ghati,
    vinadi,
    vighati,
    totalVinadiFromSeconds,
    ghatiMinutes: GHATI_MINUTES,
    vinadiSeconds: VINADI_SECONDS,
    ghatiSeconds: GHATI_SECONDS,
    beforeSunrise: elapsedMs < 0,
  };
}

export function calculateGmstHours(jd) {
  return normalizeDegrees(280.46061837 + 360.98564736629 * (jd - 2451545)) / 15;
}

export function calculateLmstHours(jd, longitude) {
  return normalizeDegrees(280.46061837 + 360.98564736629 * (jd - 2451545) + longitude) / 15;
}

export function calculateAyanamsha(year) {
  return 23.85675 + 0.013968 * (year - 2000);
}

export function calculateLagnaPulli(input) {
  const { lmtDate, latitude, longitude, config = DEFAULT_CONFIG } = input;

  const jd = julianDay(lmtDate);
  const lmstHours = calculateLmstHours(jd, longitude);
  const lmstDeg = lmstHours * 15;
  const year = lmtDate.getUTCFullYear();
  const ayanamsha = calculateAyanamsha(year);

  const ascCos = Math.cos(latitude * DEGREE);
  const ascSin = Math.sin(latitude * DEGREE);
  const tanLat = ascSin / Math.max(1e-12, ascCos);
  const obliquityRad = 23.4397 * DEGREE;
  const ramcRad = lmstDeg * DEGREE;

  const tanAsc =
    (Math.cos(ramcRad) + Math.tan(obliquityRad) * tanLat * Math.sin(ramcRad)) /
    Math.max(1e-12, -Math.sin(ramcRad) + Math.tan(obliquityRad) * tanLat * Math.cos(ramcRad));
  let tropicalLongitude = Math.atan(tanAsc) / DEGREE;

  if (-Math.sin(ramcRad) + Math.tan(obliquityRad) * tanLat * Math.cos(ramcRad) < 0) {
    tropicalLongitude += 180;
  }
  tropicalLongitude = normalizeDegrees(tropicalLongitude);

  const siderealLongitude = normalizeDegrees(tropicalLongitude - ayanamsha);
  const rasiIndex = Math.floor(siderealLongitude / RASI_SPAN_DEG);
  const rasiName = RASIS[Math.min(11, Math.max(0, rasiIndex))];
  const rasiLongitude = siderealLongitude - rasiIndex * RASI_SPAN_DEG;
  const rasiLongitudeDms = degreesToDms(rasiLongitude);
  const absoluteDms = degreesToDms(siderealLongitude);
  const tropicalDms = degreesToDms(tropicalLongitude);

  return {
    lmtDate,
    latitude,
    latitudeDms: degreesToDms(latitude),
    longitude,
    longitudeDms: degreesToDms(longitude),
    jd,
    lmstHours,
    lmstDeg,
    ayanamsha,
    ayanamshaDms: degreesToDms(ayanamsha),
    tropicalLongitude,
    tropicalDms,
    siderealLongitude,
    siderealDms: absoluteDms,
    absoluteLongitudeDms: absoluteDms,
    rasiIndex,
    rasiName,
    rasiLongitude,
    rasiLongitudeDms,
    lagnaPulliString: rasiLongitudeDms.string,
    config,
  };
}

export function calculateNakshatra(siderealLongitude) {
  const longitude = normalizeDegrees(siderealLongitude);
  const nakshatraIndex = Math.min(26, Math.floor(longitude / NAKSHATRA_SPAN_DEG));
  const nakshatraStart = nakshatraIndex * NAKSHATRA_SPAN_DEG;
  const nakshatraEnd = nakshatraStart + NAKSHATRA_SPAN_DEG;
  const positionInNakshatra = longitude - nakshatraStart;

  const padaIndex = Math.min(3, Math.floor(positionInNakshatra / PADA_SPAN_DEG));
  const pada = padaIndex + 1;
  const padaStart = nakshatraStart + padaIndex * PADA_SPAN_DEG;
  const padaEnd = padaStart + PADA_SPAN_DEG;
  const positionInPada = longitude - padaStart;

  return {
    siderealLongitude: longitude,
    siderealDms: degreesToDms(longitude),
    nakshatraIndex,
    nakshatraName: NAKSHATRAS[nakshatraIndex][0],
    nakshatraLord: NAKSHATRAS[nakshatraIndex][1],
    nakshatraStart,
    nakshatraStartDms: degreesToDms(nakshatraStart),
    nakshatraEnd,
    nakshatraEndDms: degreesToDms(nakshatraEnd),
    positionInNakshatra,
    positionInNakshatraDms: degreesToDms(positionInNakshatra),
    pada,
    padaIndex,
    padaStart,
    padaStartDms: degreesToDms(padaStart),
    padaEnd,
    padaEndDms: degreesToDms(padaEnd),
    positionInPada,
    positionInPadaDms: degreesToDms(positionInPada),
  };
}

export function validateInput(input) {
  const errors = [];

  if (!input.localDateTime || typeof input.localDateTime !== "string") {
    errors.push("Date and time are required");
  } else {
    const d = localDateToUtc(input.localDateTime, 0);
    if (Number.isNaN(d.getTime())) errors.push("Invalid date/time format");
  }

  const tz = input.timezoneOffsetMinutes ?? IST_OFFSET_MINUTES;
  if (!Number.isFinite(tz) || tz < -720 || tz > 840) {
    errors.push("Time zone offset must be between -720 and +840 minutes");
  }

  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    errors.push("Latitude must be between -90 and 90 degrees");
  }

  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    errors.push("Longitude must be between -180 and 180 degrees");
  }

  return { valid: errors.length === 0, errors };
}

export function calculatePipeline(rawInput) {
  const input = {
    ...rawInput,
    timezoneOffsetMinutes: rawInput.timezoneOffsetMinutes ?? IST_OFFSET_MINUTES,
    config: { ...DEFAULT_CONFIG, ...(rawInput.config || {}) },
  };

  const validation = validateInput(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const lmt = calculateLMT(input);
  const lmtCorrectionFromUtcMs = (input.longitude / 15) * 3600000;

  const sunrise = calculateSunrise(lmt.lmtDate, input.latitude, input.longitude, lmtCorrectionFromUtcMs);
  const udayadhi = calculateUdayadhi(sunrise.sunriseLmt, lmt.lmtDate);

  const lagnaPulli = calculateLagnaPulli({
    lmtDate: lmt.lmtDate,
    latitude: input.latitude,
    longitude: input.longitude,
    config: input.config,
  });

  const nakshatraPada = calculateNakshatra(lagnaPulli.siderealLongitude);

  return {
    input: {
      ...input,
      placeName: input.placeName || null,
    },
    section1: lmt,
    section2: {
      ...sunrise,
      ...udayadhi,
    },
    section3: lagnaPulli,
    section4: nakshatraPada,
    summary: {
      normalTime: lmt.localDateTime,
      normalTimeString: formatLocal(lmt.standardTimeDate, 0).slice(11, 19),
      lmtString: lmt.lmtString,
      udayadhiString: `${udayadhi.ghati} Nāḻike ${udayadhi.vinadi} Vinadi`,
      lagnaPulliString: lagnaPulli.lagnaPulliString,
      absoluteLongitudeString: lagnaPulli.absoluteLongitudeDms.string,
      lagnaRasi: lagnaPulli.rasiName,
      nakshatra: nakshatraPada.nakshatraName,
      nakshatraLord: nakshatraPada.nakshatraLord,
      pada: nakshatraPada.pada,
    },
  };
}

export { calculatePipeline as calculate };
