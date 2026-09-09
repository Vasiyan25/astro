# Troubleshooting

## Tests do not start

Run `npm install`, then `npm test`.

## Sunrise is undefined

The current solar model intentionally raises an error when the requested latitude/date has no sunrise or sunset. A production ephemeris and explicit polar-day policy are required.

## Results differ from reference software

Check timezone offset, longitude sign, ayanamsha, sunrise convention, and house/Lagna convention before changing expected values. Record the comparison in `docs/VALIDATION.md`.
