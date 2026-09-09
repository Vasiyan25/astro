# Calculation Specification

This document specifies the exact formulas, conventions, and precision rules used by every stage of the four-step pipeline. For any discrepant reference output, compare to the formulas below *first* before changing code.

## Global rules

- East longitudes positive. Latitudes North positive.
- Timezone offsets are **signed minutes**: negative for west of UTC (America), positive for east of UTC (Asia/Europe).
- All internal math is IEEE 754 double precision.
- Display rounding is applied only at the UI boundary; functions in `calculation-engine.js` do not round for you.
- Angular intervals are half-open `[start, end)`; integer selection is done with `Math.floor`.

## 1. Normal Time → LMT

### Definitions

- **Standard / Zone Time**: wall-clock time given by the user's civil time zone. Matches the zone's standard meridian (`UTC_offset_hours × 15°`), *not* the actual longitude of birth.
- **Local Mean Time (LMT)**: mean solar clock at the actual birth longitude. 1° difference = 4 minutes of clock time.
- **UTC**: reference timescale only; used to convert between zone clocks safely.

### Formulas

```
standard_meridian_deg    = timezone_offset_minutes ÷ 60 × 15
delta_lambda_deg         = longitude - standard_meridian_deg
delta_t_minutes          = delta_lambda_deg ÷ 15 × 60        (1° = 4 min)
standard_time_ms_since_epoch
    = local_civil_time_ms_since_utc_epoch_plus_offset
LMT_ms                   = standard_time_ms + delta_t_minutes × 60000
```

Same result via UTC (these must agree — there is an internal assertion test):

```
UTC_ms                   = local_civil_time_ms - timezone_offset_minutes × 60000
LMT_ms_alt               = UTC_ms + (longitude / 15) × 3600000
```

This is Section 1 output: `standardTimeDate`, `lmtDate`, `standardMeridianDms`, `longitudeDiffDms`, `timeCorrectionMinutes`.

## 2. Udayadhi Nāḻike

### Sunrise / sunset model

- NOAA low-precision solar altitude model.
- Altitude threshold `h = −0.833°` (standard setting: accounts for mean atmospheric refraction + solar semi-diameter at limb contact).
- Julian-day time-base is the UTC day corresponding to the **LMT** instant (Section 1 output) of the local date line.

### Ghati / Vināḍi convention

- 1 traditional day = sunrise → next sunrise = **60 Nāḻike (Ghati)**.
- 1 Nāḻike = **24 standard minutes** (= 1/60 of a mean 24h day).
- 1 Vināḍi = **24 standard seconds** (= 1/60 of a Nāḻike).
- Fractional remainder after Vināḍi is reported as vighati/60.

### Formula

```
elapsed_ms          = birth_LMT_ms - sunrise_LMT_ms
elapsed_seconds     = elapsed_ms / 1000
total_vinadi_units  = max(0, elapsed_seconds / 24)
ghati               = floor(total_vinadi_units / 60)
vinadi              = floor(total_vinadi_units mod 60)
vighati             = floor(frac(total_vinadi_units) × 60)
beforeSunrise       = elapsed_ms < 0
```

If `beforeSunrise` the engine clamps total vināḍi to 0 for display; downstream consumers can choose to subtract from *previous* sunrise instead.

## 3. Lagna Pulli

### Julian Day

```
JD = date_ms_since_unix_epoch / 86400000 + 2440587.5
```

### Greenwich Mean Sidereal Time, in degrees

Standard Meeus polynomial, evaluated at JD:

```
GMST_deg = normalize_0_360( 280.46061837 + 360.98564736629 × (JD − 2451545) )
LMST_deg = normalize_0_360( GMST_deg + longitude )
LMST_h   = LMST_deg / 15
RAMC_rad = LMST_deg × π/180
```

### Obliquity of ecliptic (fixed approximation)

```
ε = 23.4397°
```

### Ascendant longitude, tropical

Given observer latitude φ:

```
tan(ASC_tropical_rad) =
    [cos(RAMC) + tan φ · tan ε · sin(RAMC)]
  ÷ [−sin(RAMC) + tan φ · tan ε · cos(RAMC)]
```

- Use `atan2`-equivalent: after taking `Math.atan`, check the sign of the **denominator**. If negative, add 180° to the result.
- `ASC_tropical_deg = normalize_0_360(atan(...))` after quadrant correction.

### Ayanamsha (provisional)

```
ayanamsha_deg ≈ 23.85675 + 0.013968 × (year − 2000)
```

This is a **provisional linear Lahiri-style approximation**. Do not use for professional predictions. Replace with a validated ephemeris before production.

### Lagna reduction to sidereal, Rāśi, Pulli

```
ASC_sidereal_deg     = normalize_0_360(ASC_tropical_deg − ayanamsha_deg)
rasi_index_0based    = floor(ASC_sidereal_deg ÷ 30°)       → Rāśi name from RASIS[]
lagna_pulli_deg      = ASC_sidereal_deg − rasi_index × 30° →  DMS for display
```

`lagna_pulli_deg` is always in `[0, 30°)`.

## 4. Lagnam Nindra Nakshatra Pada

### Nakshatra grid

```
27 nakshatra × 4 pada   = 108 pada (total)
nakshatra_span_deg      = 360 / 27 = 13°20′
pada_span_deg           = nakshatra_span / 4 = 3°20′
```

### Nakshatra assignment

Given `L_sidereal` in `[0, 360)`:

```
nakshatra_index_0based = floor(L_sidereal / nakshatra_span_deg)      → clamped to [0, 26]
nakshatra_name, lord   = NAKSHATRAS[nakshatra_index]
nakshatra_start        = nakshatra_index × nakshatra_span_deg
nakshatra_end          = nakshatra_start + nakshatra_span_deg
position_in_nakshatra  = L_sidereal − nakshatra_start
```

### Pada assignment

Within one nakshatra:

```
pada_index_0based = floor( position_in_nakshatra / pada_span_deg )    → clamped to [0, 3]
pada = pada_index_0based + 1
pada_start = nakshatra_start + pada_index × pada_span_deg
pada_end   = pada_start + pada_span_deg
position_in_pada = L_sidereal − pada_start
```

### Boundary rules

Boundaries at exactly `n × nakshatra_span_deg` and `n × nakshatra_span_deg + m × pada_span_deg` belong to the *later* segment (half-open `[start, end)` with `Math.floor`). Floating-point tests check both `boundary − ε` and `boundary + ε`.

## Precision & display formatting

- DMS formatting in the UI truncates to whole seconds; the underlying degrees value is NOT truncated before feeding the next section.
- `degreesToDms` truncates the DMS parts but returns alongside the raw decimal degrees (`deg`, `min`, `sec`, `string`).
- Section 4 must receive the **raw sidereal** from Section 3; never the formatted Lagna Pulli string.

## Edge cases (explicitly covered in tests)

- Birth before, exactly at, and after sunrise (Udayadhi).
- Midnight, noon, leap year Feb 29, year boundary Dec 31→Jan 1.
- Nakshatra boundary, Pada boundary, Rāśi boundary (30° intervals).
- Equator latitudes, high latitudes (ascendant sensitivity to tan φ).
- Negative time zones (EST), fractional time zones (NPT +05:45), extreme east (JST).
- Invalid coordinates, missing date, invalid date strings.
- `longitude ± 180°` equivalence via `normalizeDegrees`.

## Known approximations and risks

| Item | Accuracy / caveat | Mitigation |
|------|-------------------|------------|
| Ayanamsha | Linear estimate, not certified Lahiri | Validate against reference ephemerides; plugin system |
| Ascendant | Algebraic single-shot, not iterative over true obliquity-of-date | Iterative solver in v1.1 + fixture check |
| Sunrise | NOAA low precision, one iteration | Sun position routine from validated ephemeris |
| ε obliquity | J2000 fixed 23.4397° | Use IAU precession for dates far from 2000 |
| Time zones | Static numeric offset only | Plug in IANA tzdb via Temporal polyfill |
