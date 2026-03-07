$ErrorActionPreference = 'Stop'

function Test-TcpPort {
  param(
    [Parameter(Mandatory = $true)][string]$HostName,
    [Parameter(Mandatory = $true)][int]$Port,
    [int]$TimeoutMs = 1000
  )

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect($HostName, $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
    return ($ok -and $client.Connected)
  } finally {
    $client.Close()
  }
}

Write-Host "== Fuelify Prereq Check ==" -ForegroundColor Cyan

$failures = @()

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $failures += "Node.js not found in PATH." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { $failures += "npm not found in PATH." }

if (-not (Test-Path "fuelify-backend/.env")) { $failures += "Missing fuelify-backend/.env" }
if (-not (Test-Path "fuelify-frontend/.env.local")) { $failures += "Missing fuelify-frontend/.env.local" }

$mongoUri = $null
if (Test-Path "fuelify-backend/.env") {
  $mongoLine = Get-Content "fuelify-backend/.env" | Where-Object { $_ -match '^MONGODB_URI=' } | Select-Object -First 1
  if ($mongoLine) {
    $mongoUri = $mongoLine.Substring("MONGODB_URI=".Length).Trim()
  }
}

if (-not $mongoUri) {
  $failures += "MONGODB_URI is missing in fuelify-backend/.env"
} elseif ($mongoUri -match '^mongodb://(127\.0\.0\.1|localhost)') {
  $mongoOpen = Test-TcpPort -HostName "127.0.0.1" -Port 27017
  if (-not $mongoOpen) { $failures += "MongoDB port 27017 is not reachable on localhost." }
} else {
  Write-Host "INFO: Remote MONGODB_URI detected, skipping localhost:27017 port check." -ForegroundColor Yellow
}

if ((Test-Path "fuelify-backend/node_modules/mongoose") -and (Test-Path "fuelify-backend/.env")) {
  Push-Location "fuelify-backend"
  try {
    $null = node -e "require('dotenv').config();const m=require('mongoose');m.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:8000}).then(()=>m.disconnect()).then(()=>process.exit(0)).catch(()=>process.exit(1));"
    if ($LASTEXITCODE -ne 0) {
      $failures += "MONGODB_URI connectivity/auth check failed."
    }
  } finally {
    Pop-Location
  }
} elseif (-not (Test-Path "fuelify-backend/node_modules/mongoose")) {
  $failures += "fuelify-backend dependencies are not installed (mongoose missing)."
}

if ($failures.Count -eq 0) {
  Write-Host "PASS: all prerequisites look good." -ForegroundColor Green
  exit 0
}

Write-Host "FAIL: prerequisites missing:" -ForegroundColor Red
foreach ($f in $failures) { Write-Host " - $f" -ForegroundColor Red }
exit 1
