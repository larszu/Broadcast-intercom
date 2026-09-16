# Broadcast Intercom — lokal starten (Windows)
#
# ─── WAS GEMELDET WURDE (Nutzer, 2026-09-15) ────────────────────────────────
#
#   „intercom und kamerapult muss auch lokal laufen im av planner."
#
# ─── WAS FEHLTE: `npm install` ──────────────────────────────────────────────
#
# GEMESSEN am 2026-09-15 an einem frischen Klon dieses Repos, mit genau dem
# Befehl, den der Start-Knopf der Suite absetzte:
#
#     > broadcast-intercom@0.1.0 dev
#     > concurrently -n server,web -c green,blue "npm:dev:server" "npm:dev:web"
#     sh: 1: concurrently: not found
#     EXIT=127
#
# `concurrently` liegt in `node_modules/.bin`. Wer das Repo frisch klont und
# auf „Lokal starten" drueckt, bekommt diese Zeile und sonst nichts — der
# Knopf sagt „gestartet" und es laeuft nichts. `dev.sh` fing das seit dem
# 2026-09-09 ab, dieses Skript hier nicht: es setzte `node_modules` voraus,
# ohne es zu pruefen.
#
# Ein Starter, der die Abhaengigkeiten voraussetzt, ist kein Starter, sondern
# eine Abkuerzung fuer Leute, die ihn nicht brauchen.
#
#     .\dev.ps1              Server + Oberflaeche mit simulierten Beltpacks
#     .\dev.ps1 -NoMock      ohne Simulation (echte Geraete im Netz)
#     .\dev.ps1 -Server      nur der Server (headless, fuer Companion/Tests)
param(
    [switch]$Mock,
    [switch]$NoMock,
    [switch]$Server
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$node20 = "$env:APPDATA\fnm\node-versions\v20.20.2\installation"
if (Test-Path $node20) {
    $env:PATH = $node20 + ";" + $env:PATH
    Write-Host "Node $(node --version) via fnm" -ForegroundColor Green
} else {
    Write-Host "Node $(node --version) (fnm v20 not found, using system Node)" -ForegroundColor Yellow
}

# Die Node-Fassung wird GEPRUEFT und nicht angenommen — genau wie in `dev.sh`.
# Unter 20 laeuft der Server nicht, und der Abbruch kaeme sonst irgendwo
# mitten im Bundling, also mit einer Meldung ueber eine Syntax statt ueber
# die Fassung.
$haupt = [int](node -p "process.versions.node.split('.')[0]")
if ($haupt -lt 20) {
    Write-Error "Node $(node --version) ist zu alt — 20+ wird gebraucht."
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "[intercom] npm install ..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($Server) {
    Write-Host "[intercom] npm run dev:server" -ForegroundColor Cyan
    npm run dev:server
} elseif ($NoMock) {
    Write-Host "[intercom] npm run dev" -ForegroundColor Cyan
    npm run dev
} else {
    Write-Host "[intercom] npm run dev:mock" -ForegroundColor Cyan
    npm run dev:mock
}
