# Sprint Core Journey: Baseline + Verification

## Baseline Commands

Run baseline API latency against a running backend:

```bash
npm run baseline:api -- --base http://127.0.0.1:5000 --iterations 20 --station-id <stationId>
```

Run backend regression:

```bash
npm --prefix fuelify-backend test
```

Run frontend typecheck/build gates:

```bash
npm --prefix fuelify-frontend run lint
npm --prefix fuelify-frontend run build
```

## Core Acceptance Checklist

- Home map (`/`) renders with MapLibre + deck.gl and no Leaflet runtime usage.
- Mobile map controls and station detail bottom sheet are usable at `320px`, `375px`, and `390px`.
- `/search` and `/stations/[state]/[slug]` render without horizontal overflow on narrow viewports.
- Backend responses include `x-request-id` and `x-response-time-ms` headers.
- Stations and cluster endpoints expose `x-station-cache` (`miss|hit|deduped`) for cache diagnostics.
- Latest prices endpoint exposes `x-price-cache` (`miss|hit|deduped`) and remains backward-compatible.

## Notes

- Cache stampede protection is implemented for station viewport cache and latest-price reads.
- Rate-limit responses now include `{ code: "RATE_LIMITED", requestId }` for consistent client handling.
