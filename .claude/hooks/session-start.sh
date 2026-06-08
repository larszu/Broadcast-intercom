#!/bin/bash
# SessionStart hook for Claude Code on the web.
# Installs workspace dependencies so the server/web apps can build and run.
set -euo pipefail

# Only run in the remote (Claude Code on the web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Install all workspace dependencies (idempotent; benefits from container caching).
npm install
