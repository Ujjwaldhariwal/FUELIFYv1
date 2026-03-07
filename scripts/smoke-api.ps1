param(
  [string]$ApiBase = "http://localhost:5000"
)

$ErrorActionPreference = 'Stop'

Write-Host "== Fuelify API Smoke Check ==" -ForegroundColor Cyan
Write-Host "Target API: $ApiBase" -ForegroundColor Gray

try {
  $health = Invoke-RestMethod -Method GET -Uri "$ApiBase/health"
  Write-Host "PASS /health -> status=$($health.status)" -ForegroundColor Green
} catch {
  Write-Host "FAIL /health -> $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

try {
  $stations = Invoke-RestMethod -Method GET -Uri "$ApiBase/api/stations?lat=39.96&lng=-82.99&fuel=regular&radius=25&limit=10"
  $count = if ($stations.stations) { $stations.stations.Count } else { 0 }
  Write-Host "PASS /api/stations -> returned=$count total=$($stations.total)" -ForegroundColor Green
} catch {
  Write-Host "FAIL /api/stations -> $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

try {
  $search = Invoke-RestMethod -Method GET -Uri "$ApiBase/api/stations/search?q=marathon&state=OH"
  $count = if ($search.stations) { $search.stations.Count } else { 0 }
  Write-Host "PASS /api/stations/search -> returned=$count" -ForegroundColor Green
} catch {
  Write-Host "FAIL /api/stations/search -> $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host "Smoke checks complete." -ForegroundColor Cyan
exit 0
