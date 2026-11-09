#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .next/standalone/server.js ]; then
  echo "Production build missing. Run 'bun run build' first." >&2
  exit 1
fi
TMP_DIR="$(mktemp -d)"
PORT="${SMOKE_PORT:-3187}"
LOG_FILE="$TMP_DIR/server.log"
cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM
PORT="$PORT" HOSTNAME=127.0.0.1 DB_PATH="$TMP_DIR/attendance.db" ADMIN_PIN=2468 ADMIN_SESSION_SECRET=smoke-admin-secret QR_SECRET=smoke-qr-secret COOKIE_SECURE=false bun .next/standalone/server.js >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
BASE_URL="http://127.0.0.1:$PORT" export BASE_URL
for attempt in $(seq 1 40); do
  if curl -fsS "$BASE_URL/" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then cat "$LOG_FILE"; exit 1; fi
  sleep 1
done
if ! curl -fsS "$BASE_URL/" >/dev/null 2>&1; then cat "$LOG_FILE"; echo "Server did not become ready." >&2; exit 1; fi
bun run scripts/smoke-test.ts
