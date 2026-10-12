#!/bin/sh
# Runs the Maestro flows on the booted iOS Simulator (see e2e/README.md for what must be running).
# Extra arguments go to `maestro test`, e.g. one flow: npm run e2e:ios -w @fandex/mobile -- flows/ask.yaml
set -e
cd "$(dirname "$0")"
MAESTRO="${MAESTRO:-$(command -v maestro || echo "$HOME/.maestro/bin/maestro")}"
export MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
if [ $# -gt 0 ]; then TARGET=""; else TARGET="."; fi
exec "$MAESTRO" test $TARGET "$@" \
  -e APP_URL="${APP_URL:-exp://127.0.0.1:8082}" \
  -e API_URL="${API_URL:-http://localhost:3000}" \
  --test-output-dir output
