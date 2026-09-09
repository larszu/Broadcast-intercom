#!/usr/bin/env bash
# Broadcast Intercom — lokal starten (Linux / macOS)
#
# ─── WAS GEMELDET WURDE (Nutzer, 2026-09-09) ────────────────────────────────
#
#   „Ebenso intercom [muss man lokal starten koennen]."
#
# ─── WAS ES VORHER GAB ──────────────────────────────────────────────────────
#
# Fachlich lief es schon: `npm run dev:mock` startet Server und Oberflaeche
# mit simulierten Beltpacks, ganz ohne Hardware. Was fehlte, war der Weg
# dorthin fuer alle ausser Windows — `dev.ps1` ist PowerShell, und die
# Anleitung im README beginnt mit `winget`. Auf einem Mac oder unter Linux
# musste man sich die Befehle aus dem Fliesstext zusammensuchen.
#
# Das Gegenstueck zu `dev.ps1`, Schalter fuer Schalter:
#
#     ./dev.sh              Server + Oberflaeche mit simulierten Beltpacks
#     ./dev.sh --no-mock    ohne Simulation (echte Geraete im Netz)
#     ./dev.sh --server     nur der Server (headless, fuer Companion/Tests)

set -euo pipefail
cd "$(dirname "$0")"

ZIEL="dev:mock"
for arg in "$@"; do
  case "$arg" in
    --no-mock) ZIEL="dev" ;;
    --server)  ZIEL="dev:server" ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "Unbekannter Schalter: $arg" >&2; exit 2 ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "Node ist nicht installiert. Node 20+ wird gebraucht." >&2
  echo "  macOS:  brew install fnm && fnm install 20 && fnm use 20" >&2
  echo "  Linux:  https://github.com/Schniz/fnm#installation" >&2
  exit 1
fi

# Die Node-Fassung wird GEPRUEFT und nicht angenommen. Unter 20 laeuft der
# Server nicht, und der Abbruch kaeme sonst irgendwo mitten im Bundling —
# also mit einer Meldung ueber eine Syntax statt ueber die Fassung.
HAUPT="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$HAUPT" -lt 20 ]; then
  echo "Node $(node --version) ist zu alt — 20+ wird gebraucht." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[intercom] npm install ..."
  npm install
fi

echo "[intercom] npm run $ZIEL"
exec npm run "$ZIEL"
