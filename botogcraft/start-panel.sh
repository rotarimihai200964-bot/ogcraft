#!/usr/bin/env sh
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
[ -d "$ROOT/bot/node_modules" ] || (cd "$ROOT/bot" && npm install)
cd "$ROOT/panel" && node server.js
