# Fuelify Backend API Contract Changelog

## 2026-03-07 - Sprint 1 backend hardening

### Added
- `GET /api/claims/station/:stationId/summary`
  - Purpose: frontend polling endpoint for station claim verification + risk state.
  - Response shape:
    - `stationId: string`
    - `stationStatus: "UNCLAIMED" | "CLAIMED" | "VERIFIED"`
    - `risk: { status, score, reasons[], evaluatedAt, blockedAt }`
    - `claim: null | { claimId, status, reasonCode, message, decisionConfidence, sourceChecks, retryCount, retryAt, canRetry, slaEta, decidedAt, createdAt, updatedAt }`
    - `requestId: string`
  - Errors:
    - `404` with `code: "STATION_NOT_FOUND"`
    - `400` with `code: "INVALID_OBJECT_ID"` for malformed `stationId`

### Updated
- All responses now include `x-request-id` header (middleware-generated when not supplied by caller).
- Validation and server errors now include `requestId` in JSON body for traceability.
- `POST /api/stations/:stationId/report` malformed ObjectId now returns:
  - `400 { error, code: "INVALID_OBJECT_ID", requestId }`
- `GET /api/stations` now supports viewport mode via:
  - `bbox=west,south,east,north`
  - optional `zoom`
  - response includes `queryMode: "bbox"` when bbox is used.
- Added `GET /api/stations/clusters` for low-zoom aggregation:
  - query: `bbox`, optional `zoom`, `fuel`, `limit`
  - response: `clusters[]`, `totalClusters`, `totalStations`, `stepDegrees`, `truncated`

### Claim authority model update
- `POST /api/auth/claim/verify` now marks station as `CLAIMED` (account ownership verified by OTP).
- Final station verification state (`VERIFIED`) is now driven by `/api/claims` decision outcomes:
  - `APPROVED` => station promoted to `VERIFIED`
  - `REJECTED` / `BLOCKED` / low confidence => station remains `CLAIMED` (if owner attached)
- Dashboard profile/price updates require station status `VERIFIED`.
- Claim endpoints now enforce owner authorization:
  - `POST /api/claims` requires authenticated owner token and ownership of the claimed station.
  - `GET /api/claims/:id/status` requires authenticated owner token tied to the claim (`ADMIN` can access all).
  - `POST /api/claims/:id/retry` requires authenticated owner token tied to the claim (`ADMIN` can access all).
- Automated claim verification scoring now uses stronger source checks:
  - Google Place details match (when `GOOGLE_PLACES_API_KEY` + `station.placeId` available).
  - OSM consistency check using station source/address/name signals.
  - State registration format validation based on station state.
  - Domain mismatch rejection when claimant email domain and website domain diverge.

### Operational behavior
- Added background risk rescoring monitor (enabled by default outside tests):
  - Env controls:
    - `ENABLE_RISK_MONITOR` (`false` disables loop)
    - `RISK_RESCORER_INTERVAL_MINUTES` (default `10`)
    - `RISK_RESCORER_BATCH_SIZE` (default `200`)
    - `RISK_RESCORER_STALE_HOURS` (default `12`)
- Added station cache provider abstraction:
  - `STATION_CACHE_MODE=memory|redis` (default `memory`)
  - `REDIS_URL` required when `STATION_CACHE_MODE=redis`
  - If Redis is unavailable, service falls back to memory cache without failing requests.
- Added async invalidation boundary for station cache:
  - `STATION_CACHE_INVALIDATION_MODE=direct|event` (default `direct`)
  - `event` mode publishes `station.cache.invalidate` domain events consumed by cache invalidation worker.
  - If event publish fails, backend falls back to direct invalidation to preserve consistency.
- Added domain events provider abstraction:
  - `DOMAIN_EVENTS_PROVIDER=memory|redis` (default `memory`)
  - `DOMAIN_EVENTS_CHANNEL` (default `fuelify:domain-events`)
  - `REDIS_URL` used when `DOMAIN_EVENTS_PROVIDER=redis`
  - On Redis failure, domain events degrade to in-process memory events automatically.

## 2026-03-08 - Sprint 4 price staleness system

## [POST] /api/prices
### Request
Body/Params: `{ stationId: string — MongoDB ObjectId of station, fuelType: "petrol"|"diesel"|"premium"|"cng"|"ev" — reported fuel, price: number — reported price (0 < price <= 999.99) }`

### Response 200
`{ reportId: string — created PriceReport id, stationId: string — station id, fuelType: string — submitted fuel type, price: number — stored normalized price, reportedAt: string — ISO timestamp }`

### Errors
| Status | Code | Condition |
| --- | --- | --- |
| 400 | `INVALID_STATION_ID` | `stationId` is missing or malformed |
| 400 | `INVALID_FUEL_TYPE` | `fuelType` is outside supported enum |
| 400 | `INVALID_PRICE` | `price` is missing, non-numeric, non-positive, or > 999.99 |
| 404 | `STATION_NOT_FOUND` | station does not exist |
| 429 | `RATE_LIMITED` | IP exceeds `priceLimiter` (5 requests / 10 minutes) |

## [POST] /api/prices/:reportId/confirm
### Request
Body/Params: `{ reportId: string — PriceReport ObjectId path param, fingerprint: string — client fingerprint (required, max 64 chars) }`

### Response 200
`{ confirmCount: number — current total confirmations after idempotent update }`

### Errors
| Status | Code | Condition |
| --- | --- | --- |
| 400 | `INVALID_REPORT_ID` | `reportId` is malformed |
| 400 | `INVALID_FINGERPRINT` | `fingerprint` missing/blank or > 64 chars |
| 404 | `REPORT_NOT_FOUND` | target price report not found |
| 409 | `CONFIRM_CAP_REACHED` | report already at confirm cap (`50`) |
| 429 | `RATE_LIMITED` | IP exceeds `confirmLimiter` (10 requests / 10 minutes) |

## [GET] /api/prices/:stationId/latest
### Request
Body/Params: `{ stationId: string — MongoDB ObjectId path param }`

### Response 200
`{ stationId: string — station id, prices: { petrol: { price, reportedAt, isStale, confirmCount } | null, diesel: { price, reportedAt, isStale, confirmCount } | null, premium: { price, reportedAt, isStale, confirmCount } | null, cng: { price, reportedAt, isStale, confirmCount } | null, ev: { price, reportedAt, isStale, confirmCount } | null } }`

### Errors
| Status | Code | Condition |
| --- | --- | --- |
| 400 | `INVALID_STATION_ID` | `stationId` is malformed |
| 404 | `STATION_NOT_FOUND` | station does not exist |

## 2026-03-08 - Sprint 6 data quality automation

### Added
- `GET /api/admin/stations/incomplete/summary`
  - Purpose: provide quick data-quality health metrics for admin dashboards.
  - Response shape:
    - `totalStations: number`
    - `incompleteTotal: number`
    - `incompleteRatePct: number`
    - `withPlaceId: number`
    - `withoutPlaceId: number`
    - `byStatus: Array<{ status: string, count: number }>`
    - `byDataSource: Array<{ source: string, count: number }>`

- `POST /api/admin/stations/incomplete/autofix`
  - Purpose: auto-repair incomplete station addresses using Google Place details.
  - Request body:
    - `dryRun?: boolean` (default `true`)
    - `limit?: number` (max `500`, default `200`)
    - `state?: string` (optional 2-letter state filter)
    - `onlyWithPlaceId?: boolean` (default `true`)
  - Response shape:
    - `mode: "DRY_RUN" | "EXECUTE"`
    - `totalCandidates: number`
    - `scanned: number`
    - `fixed: number`
    - `skippedNoPlaceId: number`
    - `skippedNoDetails: number`
    - `skippedNoAddress: number`
    - `errors: number`
    - `remainingIncomplete: number`
    - `sample: Array<{ stationId: string, name: string, previousAddress?: object, nextAddress: object }>`

### Errors
| Status | Code | Condition |
| --- | --- | --- |
| 503 | `N/A` | `GOOGLE_PLACES_API_KEY` missing for execute mode |
