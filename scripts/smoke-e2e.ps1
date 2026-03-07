param(
  [string]$ApiBase = "http://localhost:5000"
)

$ErrorActionPreference = 'Stop'

Write-Host "== Fuelify E2E Smoke ==" -ForegroundColor Cyan
Write-Host "Target API: $ApiBase" -ForegroundColor Gray

Write-Host "Seeding dev fixture..." -ForegroundColor Gray
$fixtureJson = node .\scripts\seed-dev-fixture.js
if ($LASTEXITCODE -ne 0) {
  Write-Host "FAIL fixture seeding" -ForegroundColor Red
  exit 1
}

$fixture = $fixtureJson | ConvertFrom-Json
Write-Host "Fixture station slug: $($fixture.slug)" -ForegroundColor Gray

try {
  $health = Invoke-RestMethod -Method GET -Uri "$ApiBase/health"
  if ($health.status -ne 'ok') { throw "Unexpected health status" }
  Write-Host "PASS /health" -ForegroundColor Green
} catch {
  Write-Host "FAIL /health -> $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

try {
  $stations = Invoke-RestMethod -Method GET -Uri "$ApiBase/api/stations?lat=39.9612&lng=-82.9988&fuel=regular&radius=25&limit=10"
  $count = if ($stations.stations) { $stations.stations.Count } else { 0 }
  Write-Host "PASS /api/stations -> returned=$count total=$($stations.total)" -ForegroundColor Green
  if ($count -lt 1) { throw "Expected at least one station from fixture." }
} catch {
  Write-Host "FAIL /api/stations -> $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

$token = $null
try {
  $loginBody = @{
    identifier = $fixture.ownerEmail
    password   = $fixture.ownerPassword
  } | ConvertTo-Json

  $login = Invoke-RestMethod -Method POST -Uri "$ApiBase/api/auth/login" -ContentType "application/json" -Body $loginBody
  $token = $login.token
  if (-not $token) { throw "Missing JWT token in login response." }
  Write-Host "PASS /api/auth/login" -ForegroundColor Green
} catch {
  Write-Host "FAIL /api/auth/login -> $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

try {
  $priceBody = @{
    regular = 3.111
    midgrade = 3.555
  } | ConvertTo-Json

  $headers = @{ Authorization = "Bearer $token" }
  $priceResp = Invoke-RestMethod -Method POST -Uri "$ApiBase/api/dashboard/prices" -Headers $headers -ContentType "application/json" -Body $priceBody
  if (-not $priceResp.success) { throw "Expected success=true from price update." }
  Write-Host "PASS /api/dashboard/prices" -ForegroundColor Green
} catch {
  Write-Host "FAIL /api/dashboard/prices -> $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

try {
  $headers = @{ Authorization = "Bearer $token" }
  $history = Invoke-RestMethod -Method GET -Uri "$ApiBase/api/dashboard/price-history" -Headers $headers
  $count = if ($history.history) { $history.history.Count } else { 0 }
  Write-Host "PASS /api/dashboard/price-history -> returned=$count" -ForegroundColor Green
} catch {
  Write-Host "FAIL /api/dashboard/price-history -> $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

try {
  $slugResp = Invoke-RestMethod -Method GET -Uri "$ApiBase/api/stations/$($fixture.slug)"
  if (-not $slugResp.station) { throw "Missing station in slug response." }
  Write-Host "PASS /api/stations/:slug" -ForegroundColor Green
} catch {
  Write-Host "FAIL /api/stations/:slug -> $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host "E2E smoke checks complete." -ForegroundColor Cyan
exit 0

