<#
.SYNOPSIS
  Reasonix Anki - Tabbit Browser UI smoke test (real-browser regression)

.DESCRIPTION
  Opens the local dev server (localhost:1420) via Tabbit Browser (tabbit-cli)
  and verifies: connection state -> Today view -> Browse view -> Stats view,
  collecting pageerror / console.error throughout. Prints a JSON summary.
  Smoke logic lives in scripts/tabbit-smoke.js (Node realm, persistent task).

  NOTE: This file is intentionally ASCII-only so it parses under Windows
  PowerShell 5.1 without a UTF-8 BOM. Chinese strings live in the JS side.

  Prerequisites (checked, not auto-fixed):
    1. Tabbit Browser >= 1.9.0 installed and tabbit-cli Runtime running
       (restart Tabbit Browser once if the Runtime is down)
    2. Anki running (AnkiConnect :8765 reachable; the script also asserts the
       disconnected guide screen when Anki is down)
    3. dev server running (npm run dev); the script tries to start it if absent

  Usage:
    pwsh -File .\scripts\tabbit-smoke.ps1
    pwsh -File .\scripts\tabbit-smoke.ps1 -Task my-smoke -SkipDevCheck
#>
param(
  [string]$Task = "ui-smoke",
  [switch]$SkipDevCheck
)

$ErrorActionPreference = "Stop"
# UTF-8 for the pipe into tabbit-cli: the JS contains Chinese button names and
# Windows PowerShell 5.1 defaults $OutputEncoding to ASCII which would corrupt them.
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$cli = "$env:LOCALAPPDATA\Tabbit\LocalAgent\bin\tabbit-cli.exe"
$smokeJsPath = Join-Path $PSScriptRoot "tabbit-smoke.js"

if (-not (Test-Path $cli)) {
  Write-Error "tabbit-cli not found: $cli - install Tabbit Browser >= 1.9.0"
}
if (-not (Test-Path $smokeJsPath)) {
  Write-Error "smoke script missing: $smokeJsPath"
}

function Invoke-TabbitNode([string]$Js) {
  $raw = $Js | & $cli nodejs --task $Task 2>$null
  if ($LASTEXITCODE -ne 0) { throw "tabbit-cli failed (exit $LASTEXITCODE): $raw" }
  $json = $raw | ConvertFrom-Json
  if ($json.receipt.status -ne "succeeded") {
    throw "tabbit-cli execution failed: $($json.receipt.error)"
  }
  return $json.receipt.result.value
}

function Test-Port([int]$Port) {
  # HTTP probe: Vite listens on IPv6 ::1 (raw sockets in the sandbox cannot use
  # the IPv6 address family), AnkiConnect listens on IPv4 127.0.0.1 - the HTTP
  # stack covers both. Non-2xx (e.g. AnkiConnect GET 405) still counts as up:
  # an exception carrying an HTTP response means the port is reachable.
  try {
    $null = Invoke-WebRequest -Uri "http://localhost:$Port" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    return $true
  } catch {
    return $null -ne $_.Exception.Response
  }
}

# --- preflight ---
if (-not $SkipDevCheck) {
  $devUp = Test-Port 1420
  if (-not $devUp) {
    Write-Warning "dev server (:1420) not running, trying to start npm run dev ..."
    $job = Start-Job -ScriptBlock { Set-Location $PSScriptRoot\..; npm run dev }
    for ($i = 0; $i -lt 12; $i++) {
      Start-Sleep -Seconds 1
      if (Test-Port 1420) { $devUp = $true; break }
    }
    if (-not $devUp) { Write-Error "dev server failed to start - run npm run dev manually" }
  }
}
$ankiUp = Test-Port 8765
Write-Host "preflight: AnkiConnect :8765 = $ankiUp (down => disconnected guide expected)"

# --- smoke body ---
# -Encoding UTF8: an un-BOM'd UTF-8 JS file read under 5.1's default ANSI would
# corrupt Chinese chars and break JS syntax.
$smokeJs = Get-Content -Raw -Encoding UTF8 -Path $smokeJsPath
$result = Invoke-TabbitNode $smokeJs
Write-Host "--- smoke result ---"
$result | ConvertTo-Json -Depth 5

# --- teardown: close task space + assert ---
& $cli finish --task $Task 2>$null | Out-Null
if ($result.errors.Count -gt 0) {
  Write-Warning "detected $($result.errors.Count) console errors:"
  $result.errors | ForEach-Object { Write-Host "  $_" }
  exit 1
}
if ($result.connection -eq "connected" -and (-not $result.browse.hasDeckTree -or -not $result.stats.hasSummary)) {
  Write-Error "smoke assertions failed - see JSON above"
}
Write-Host "smoke passed (connection=$($result.connection))"
