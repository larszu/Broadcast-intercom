# Broadcast Intercom — Starter Script
# Setzt Node 20 (via fnm) und startet Server + Web im Mock-Mode
param(
    [switch]$Mock,
    [switch]$NoMock
)

$node20 = "$env:APPDATA\fnm\node-versions\v20.20.2\installation"
if (Test-Path $node20) {
    $env:PATH = $node20 + ";" + $env:PATH
    Write-Host "Node $(node --version) via fnm" -ForegroundColor Green
} else {
    Write-Host "Node $(node --version) (fnm v20 not found, using system Node)" -ForegroundColor Yellow
}

Set-Location $PSScriptRoot

if ($NoMock) {
    npm run dev
} else {
    npm run dev:mock
}
