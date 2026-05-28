#!/usr/bin/env bash
# yarn reset → wipe data/ so the next boot is a fresh FirstTimeSetup.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d data ] || [ -z "$(ls -A data 2>/dev/null)" ]; then
  echo "data/ already empty — nothing to do."
  exit 0
fi

echo "⚠️  This wipes ./data/ (database, media, uploads) and is NOT recoverable."
read -r -p "Type 'reset' to confirm: " confirm
if [ "$confirm" != "reset" ]; then
  echo "Aborted."
  exit 1
fi

if pgrep -f "node dist/index.js" > /dev/null 2>&1; then
  echo "⚠️  prusahero server is running — stop it before resetting." >&2
  exit 1
fi

rm -rf data
echo "✓ data/ wiped. Next \`yarn start\` will trigger FirstTimeSetup."
