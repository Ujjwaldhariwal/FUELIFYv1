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
