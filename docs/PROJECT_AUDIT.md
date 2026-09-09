# Project Audit

Snapshot taken at end of Phase 1 core-pipeline build.

## Repository state

- Language: JavaScript (ES Modules) — no TypeScript, no transpile, no framework.
- Frontend: `index.html` + `styles.css` + `script.js` (static, served via any static file server).
- Calculation layer: `js/calculation-engine.js` — pure functions, zero UI dependencies, importable from Node or the browser.
- Test layer: `tests/engine.test.js` — Node built-in test runner (`node --test`), 44 tests across 8 suites.
- CI-like local command: `npm run verify` runs format-check → lint → unit tests → build-check.

## Architecture actually present (vs prior audit)

Prior audit claimed React/Vite/TypeScript — **that was stale placeholder content**. The real architecture is:

```
  ┌──────────────────────────────┐
  │  index.html / script.js      │   UI layer — form, rendering, copy/print/download
  │  styles.css                  │   Presentation — no logic
  └──────────────┬───────────────┘
                 │ calls (import)
  ┌──────────────▼───────────────┐
  │ js/calculation-engine.js     │   PURE calculation pipeline — no DOM
  │  · calculateLMT              │   Section 1
  │  · calculateSunrise          │   Section 2 helper
  │  · calculateUdayadhi         │   Section 2
  │  · calculateLagnaPulli       │   Section 3
  │  · calculateNakshatra        │   Section 4
  │  · calculatePipeline         │   Full chain (1→2→3→4)
  │  · validateInput             │   Input validation (no throw)
  └──────────────────────────────┘
```

The engine is the **product**. The UI is just one consumer of the engine.

## Current functionality — all 4 sections wired end-to-end

### Birth details input
- Date / Birth time / Birthplace / Latitude / Longitude / Timezone (selectable, IST default)
- Advanced config: Ayanamsha, Sunrise method, display precision, validation mode toggle
- Strict numeric range validation, explicit error messaging

### Section 1 — Normal Time → LMT ✅
- Hero: Local Mean Time (HH:MM:SS)
- Metrics: Normal/Standard Time, Date, Place, Longitude, Standard Meridian, LMT
- Calculation Details: time concept legend, standard meridian, longitude diff, time correction, LMT sum — each with its formula

### Section 2 — Udayadhi Nāḻike ✅
- Hero: `{N} Nāḻike {V} Vināḍi`
- Metrics: Sunrise LMT, Birth Time LMT, Sunset LMT, Elapsed, Nāḻike, Vināḍi
- Details: convention box (24-min ghati, 24-s vinadi), sunrise calc, elapsed HH:MM:SS, unit conversion

### Section 3 — Lagna Pulli ✅
- Hero: `{Lagna Pulli} in {Rasi}`
- Metrics: Lagna Pulli (within Rasi), Rasi, Absolute Sidereal Longitude, Tropical Longitude, Ayanamsha, LMST
- Details: geo coords, JD, LMST, Ayanamsha, ascendant tan formula, sidereal reduction, rasi index

### Section 4 — Lagnam Nindra Nakshatra Pada ✅
- Hero: `{Nakshatra} · Pada {N}`
- Metrics: Sidereal Longitude, Nakshatra (+ index 1..27), Nakshatra Lord, Pada (1..4), Position in Nakshatra (DMS / total), Position in Pada
- Details: nakshatra/pada grid, Nakshatra lookup, Pada lookup with both boundary sets

### Final summary + actions ✅
- Dark summary panel at bottom of page lists all key values.
- **[Copy Results]** — plain-text summary to clipboard
- **[Print]** — auto-opens calc-details, hides UI chrome, print CSS applied
- **[Download JSON]** — full pipeline result as JSON (snapshot)

### Validation mode ✅
Toggle in advanced config. When on, renders the full audit trail (14 intermediate items) in a dark grid below the summary.

## What's deliberately *provisional* (must be validated before professional use)

| Item | Current state | Required for production |
|------|--------------|-------------------------|
| Ayanamsha | Linear approx (23.85675 + 0.013968·(Y−2000)) | Swiss Ephemeris / certified Lahiri |
| Ascendant (Lagna) | tan(RAMC, φ, ε) algebraic formula | Iterative ascendant solved against same ephemeris, known reference fixture cross-check |
| Sunrise altitude | −0.833° NOAA default | Confirm Jyotish convention matches upper-limb / refraction choice |
| Timezone handling | Static numeric offset (no DST history) | IANA tz database via `Intl.DateTimeFormat` resolved offsets or `@js-temporal/polyfill` |
| DST transitions | Not tested beyond static offsets | Fixtures for EST/EDT, CET/CEST, etc. |
| Reference fixtures | None yet | At least 5 independently verified test cases with known expected output |

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | `npx serve . -l 5173` |
| `npm run verify` | **CI pipeline** — format-check → lint → test → build-check |
| `npm test` | `node --test tests/engine.test.js` (44 tests) |
| `npm run lint` | Balance braces/parens/brackets + ESM syntax note |
| `npm run format-check` | No tabs, line length, trailing whitespace, trailing newline |
| `npm run build-check` | Required files present + non-empty, engine imports cleanly + all expected exports present |

## Open bugs

None known as of this audit (all 44 tests pass; full verify pipeline is green).

Known design items that are *not bugs*:
- Floating-point half-open boundaries: Nakshatra/Pada index transitions use `Math.floor`. At exactly representable boundaries the side is deterministic; tests now verify both sides of every boundary.
- `calculateUdayadhi` returns `beforeSunrise` flag and clamps total vināḍi to ≥ 0; this matches spec ("birth before sunrise" is an explicit edge case the UI could surface later).

## Next recommended work

1. **Add 3–5 professionally sourced reference fixtures** to `tests/engine.test.js` with independently verified expected outputs.
2. Replace provisional `calculateAyanamsha` and `calculateLagnaPulli` core formulas with values computed from a validated ephemeris (Swiss Ephemeris license permitting).
3. Add IANA timezone resolution for the 10 common timezone presets; add a DST-transition test fixture.
4. Add a first browser E2E test: start dev server, submit form, assert Section 1–4 DOM text.
5. Client data persistence layer (Supabase) only after the four-stage accuracy is signed off.
