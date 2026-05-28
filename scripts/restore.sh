#!/usr/bin/env bash
# yarn restore [path/to/backup.tar.gz] → wipe data/ and unpack the given backup.
# With no argument, restores the most recent file in backups/.
set -euo pipefail

cd "$(dirname "$0")/.."

src="${1:-}"
if [ -z "$src" ]; then
  # Pick the newest tarball under backups/ if no arg given.
  src=$(ls -1t backups/fdm-monster-*.tar.gz 2>/dev/null | head -1 || true)
  if [ -z "$src" ]; then
    echo "Usage: yarn restore <path/to/backup.tar.gz>" >&2
    echo "(or run \`yarn backup\` first, and \`yarn restore\` will pick the newest)" >&2
    exit 1
  fi
  echo "No path given — restoring newest backup: $src"
fi

if [ ! -f "$src" ]; then
  echo "Backup file not found: $src" >&2
  exit 1
fi

echo "⚠️  This will wipe ./data/ and unpack $src on top."
read -r -p "Continue? (yes/no) " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

# Make sure the server isn't holding the sqlite file open. Best-effort kill.
if pgrep -f "node dist/index.js" > /dev/null 2>&1; then
  echo "⚠️  fdm-monster server is running — stop it before restoring." >&2
  exit 1
fi

rm -rf data
tar -xzf "$src"
echo "✓ Restored from $src"
