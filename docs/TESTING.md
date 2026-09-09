# Testing

## Quick commands

```bash
npm test                       # Run all 44 unit + integration tests (node --test)
npm run verify                 # Full CI pipeline: format-check → lint → test → build-check
```

The first line is the command to run during normal development. `verify` is the gate: a PR or commit that fails `npm run verify` must not ship.

## Test layout

All tests are in `tests/engine.test.js`. They use Node's built-in test runner (`node:test` + `node:assert/strict`). No external test dependencies are required, so `npm install` is not needed to run the test suite.

### Coverage map

| Test suite | What it covers | Count |
|-----------|----------------|-------|
| UTILS | `normalizeDegrees`, DMS↔decimal, `standardMeridianDeg` | 4 |
| SECTION 1 LMT | IST+BLR longitude correction, EST, meridian match, invalid input, bad date | 5 |
| SECTION 2 UDAYADHI | Equinox sunrise, exactly-at sunrise, 6h after, before-sunrise flag, 24h full cycle | 5 |
| SECTION 3 LAGNA | GMST range, LMST longitude sensitivity, Ayanamsha baseline, rasi valid, equator vs high lat | 5 |
| SECTION 4 NAKSHATRA | Spans sum correctly, 0°→Ashwini 1, nakshatra boundary (both sides), pada boundary, last pada, list sizes, rasi boundary at 30° | 7 |
| VALIDATION | Bad lat, bad lon, missing date, happy-path accept | 4 |
| END-TO-END PIPELINE | Full pipeline types & section wiring, data flow S1→S2→S3→S4, midnight/noon/leap/year-boundary, timezones, equator, invalid lat, reproducibility | 11 |
| EDGE CASES | Exact pada position = 0, near-boundary from below, ±180 normalize | 3 |
| **TOTAL** | | **44** |

## Assertion style

- **Approx float equality** — always use `approx(actual, expected, eps, msg?)` helper in the test file. Do not `assert.equal` for any value computed via trig or float division.
- **Exact integer equality** — Nāḻike, vināḍi, pada indices, rasi indices: `assert.equal`.
- **Boundary semantics** — test `boundary - ε` and `boundary + ε` separately. Do not test the exact float boundary unless you also verify it is exactly representable (it usually isn't).

## Reference fixtures: when to add them

Once independently verified values from a Jyotish tool are available:

1. Add a `REFERENCE #NNN` block at the bottom of `tests/engine.test.js` describing input and expected output.
2. Make tolerance explicit: LMT tolerance ±30s, sunrise ±60s, Lagna ±0.5°, pada exact.
3. If the diff exceeds tolerance, *investigate the root cause* (wrong standard meridian? ayanamsha choice? sunrise convention? DST?); do **not** hard-code a fudge factor in the engine to make the test pass.

Reference fixtures should be added to the existing END-TO-END PIPELINE suite or (once ≥3 exist) a new `REFERENCE FIXTURES` suite.

## Adding a new module

Every new calculation module must:

1. Live in a pure function in `js/calculation-engine.js` or a sibling.
2. Export a named symbol so `build-check` can enforce its presence.
3. Have positive tests, error-path tests, boundary tests, and at least one full-pipeline integration test if it uses data from Sections 1–4.
4. Add an entry to `docs/CALCULATION_SPEC.md` with the exact formula.
