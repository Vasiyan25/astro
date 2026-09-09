# API Specification

There is no network API in the current MVP. The calculation service contract is the `CalculationInput` and `CalculationResult` types exported from `src/calculation/engine.ts`.

A future API should validate date/time, timezone identifier or offset, latitude, longitude, and calculation configuration at its boundary, then return structured results without exposing internal stack traces.
