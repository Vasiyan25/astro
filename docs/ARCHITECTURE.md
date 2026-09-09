# Architecture

The architecture keeps the calculation engine — the core intellectual product — entirely separate from the UI. The UI is a thin rendering layer. This separation means the same engine can later power:

- the static website (today)
- an API server (Node)
- a PDF report generator
- a mobile build
- an astrologer-desktop CLI tool
- Supabase edge functions

## Layered architecture

```
  ╔════════════════════════════════════════════════════╗
  ║  Presentation (frontend)                          ║
  ║                                                    ║
  ║    index.html  →  DOM skeleton / section cards     ║
  ║    styles.css  →  tokens, layout, print styles     ║
  ║    script.js   →  form, rendering, copy/print/DL   ║
  ╚═════════════════════╤══════════════════════════════╝
                        │ import (ES Module)
                        ▼
  ╔════════════════════════════════════════════════════╗
  ║  Application / calculation service                 ║
  ║                                                    ║
  ║  calculatePipeline(rawInput)                       ║
  ║    ├─ validateInput(input)                         ║
  ║    ├─ calculateLMT         (Section 1)             ║
  ║    ├─ calculateSunrise                             ║
  ║    ├─ calculateUdayadhi     (Section 2)            ║
  ║    ├─ calculateLagnaPulli   (Section 3)            ║
  ║    └─ calculateNakshatra    (Section 4)            ║
  ║                                                    ║
  ║  Public contract: pure functions only.             ║
  ║  No DOM. No React. No I/O. No global state.       ║
  ╚═════════════════════╤══════════════════════════════╝
                        │ math helpers
                        ▼
  ╔════════════════════════════════════════════════════╗
  ║  Astronomical / ephemeris engine                   ║
  ║                                                    ║
  ║  Today:    Inline — GMST, NOAA solar events,       ║
  ║            tan-ascendant formula, simple Lahiri    ║
  ║                                                            ║
  ║  Future:   Swiss Ephemeris (if license permits)    ║
  ║            or other validated ephemeris            ║
  ╚════════════════════════════════════════════════════╝
```

## Data-flow contract (front → back)

All UI input is collected once into a single plain object:

```js
{
  localDateTime:          "YYYY-MM-DDTHH:MM:SS",
  placeName:              "Bengaluru" | null,
  timezoneOffsetMinutes:  number,     // signed minutes
  latitude:               number,     // decimal, -90..90
  longitude:              number,     // decimal, -180..180
  config: {
    ayanamsha:            "lahiri" | "raman" | "krishnamurti",
    sunriseMethod:        "noaa" | "upper-limb",
    precision:            { display: 2|4|6, internal: 12 },
  }
}
```

This object is passed **by value** to `calculatePipeline`. The function returns a single result:

```js
{ input, section1, section2, section3, section4, summary }
```

No callbacks, no events, no promises, no subscriptions. This makes the pipeline trivially testable in Node or the browser.

## Precision & rounding contract

- All intermediate values inside `section1 → section2 → section3 → section4` are kept as `number` (IEEE 754 double).
- Rounding to a display precision happens **only inside `script.js`** rendering helpers (`fmt`, `fmtSigned`, DMS strings).
- Therefore: `section3.siderealLongitude` is always the raw input to `calculateNakshatra(...)`; there is no "rounded Section 3 output" fed to Section 4.

This contract is validated by test:

```
pipeline output: Section 3 sidereal longitude === Section 4 sidereal longitude
```

## Why no framework

The UI is deliberately tiny: a form, 8 innerHTML renders, 6 button handlers. Adding a framework would add:

- a build step
- bundle tooling
- more moving parts for a QA/deployment/validation pipeline
- more ways for rendering to diverge from the engine's numbers

For the MVP size the cost of a framework exceeds the benefit. The engine is fully framework-agnostic; a React/Next frontend can import `js/calculation-engine.js` without changes.

## Adding new modules later

Future modules (Panchanga, Kundali, divisional charts, Dasha, PDF) **must not** inline formulas in the UI. They must:

1. add pure functions in `js/calculation-engine.js` or a sibling module
2. export a named public function
3. add unit tests in `tests/` with the same node:test runner
4. only then wire into `script.js` for rendering

This preserves the invariant that the calculation is **the product**, not the UI.
