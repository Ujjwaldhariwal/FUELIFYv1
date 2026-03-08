# Fuelify Local Integration Runbook

This runbook is for running both repos locally and validating the core backend/frontend wiring.

## 1. Current Workspace Status

- `fuelify-backend` is implemented and installs successfully.
- `fuelify-frontend` is implemented and passes `next build`.
- Local startup currently requires a reachable MongoDB URI.

## 2. Prerequisites

- Node.js 20+ (22 is fine)
- npm 10+
- MongoDB reachable from `fuelify-backend/.env` (`MONGODB_URI`)

## 3. Environment Files

Already created:

- `fuelify-backend/.env`
- `fuelify-frontend/.env.local`

Update these before running in non-dev environments.

## 4. Install Dependencies

```powershell
cd fuelify-backend
npm install

cd ..\fuelify-frontend
npm install
```

## 5. Start Services

Open two terminals.

Terminal A:

```powershell
cd fuelify-backend
npm run dev
```

Terminal B:

```powershell
cd fuelify-frontend
npm run dev
```

## 6. Fast Checks

### 6.1 Prereq Check

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-prereqs.ps1
```

### 6.2 API Smoke Check

Run after backend is up:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-api.ps1
```

This validates:

- `GET /health`
- `GET /api/stations?lat=39.96&lng=-82.99&fuel=regular&radius=25&limit=10`
- `GET /api/stations/search?q=marathon&state=OH`

### 6.3 E2E Smoke Check (Fixture + Auth + Price Update)

Run after backend is up:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-e2e.ps1
```

This script:

- Seeds one verified station owner fixture in MongoDB
- Logs in via `/api/auth/login`
- Updates prices via `/api/dashboard/prices`
- Verifies `/api/dashboard/price-history` and `/api/stations/:slug`

Fixture account seeded by script:

- Email: `owner+dev@fuelify.local`
- Password: `DevPass123!`

### 6.4 Backend Integration Test Suite

```powershell
cd fuelify-backend
npm run test:integration
```

From workspace root:

```powershell
npm run test:backend:integration
```

The suite runs against:

- `TEST_MONGODB_URI` (if provided), otherwise
- `MONGODB_URI` from backend env, otherwise
- `mongodb-memory-server` fallback

All test writes happen in DB name: `fuelify_integration_tests`.

## 7. Manual Flow Validation

1. Open `http://localhost:3000`.
2. Confirm map UI and station list render.
3. Open `/search` and run a query.
4. Open `/claim` and verify unclaimed station list behavior.
5. Open `/login`, authenticate owner account, confirm redirect to `/dashboard`.
6. Update prices from dashboard and verify backend accepts updates.

## 8. Known Local Blocker

If MongoDB is not running, backend startup fails with:

`[MongoDB] Connection failed: connect ECONNREFUSED 127.0.0.1:27017`

Fix by:

- Starting local MongoDB on `127.0.0.1:27017`, or
- Pointing `MONGODB_URI` in `fuelify-backend/.env` to a reachable MongoDB instance.

If using MongoDB Atlas, credentials must be valid for the target cluster/user.  
The prereq script now validates real connectivity/auth and will fail with:

`MONGODB_URI connectivity/auth check failed.`

## 9. Dev Bypass Fixtures (Claim + Owner UI Testing)

Use this only for local/dev test runs.

1. Enable OTP bypass in `fuelify-backend/.env`:

```env
OTP_BYPASS_ENABLED=true
OTP_BYPASS_CODE=123456
```

2. Seed deterministic fixture data:

```powershell
cd fuelify-backend
npm run seed:dev:bypass
```

3. Test accounts/IDs:

- Claim test stationId: `000000000000000000000101` (`UNCLAIMED`)
- Claim test phone: `+15550002222`
- Claim OTP: `123456` (or value from `OTP_BYPASS_CODE`)
- Owner stationId: `000000000000000000000102` (`CLAIMED`)
- Owner login email: `owner+dev@fuelify.local`
- Owner login password: `DevPass123!`

## 10. Beta Data Bootstrap (for Manual QA)

This prepares data quality and station pricing so map/search/claim flows are testable with realistic records.

Dry run first:

```powershell
cd fuelify-backend
npm run seed:beta:dry
```

Execute:

```powershell
cd fuelify-backend
npm run seed:beta
```

Optional flags:

- `--state=OH` (default)
- `--skip-autofix` (only seed prices)
- `--skip-prices` (only address autofix)
- `--skip-reverse-geocode` (autofix only from Google Place details)
- `--force-prices` (reseed prices even if present)
- `--autofix-limit=250`
- `--price-limit=2000`

Example:

```powershell
node src/scripts/prepareBetaData.js --execute --state=OH --force-prices
```
