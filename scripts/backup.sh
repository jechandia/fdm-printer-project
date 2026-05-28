#!/usr/bin/env bash
# yarn backup → snapshot data/ into a timestamped tarball at the workspace root.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d data ]; then
  echo "No data/ directory found — nothing to back up." >&2
  exit 1
fi

stamp=$(date +%Y%m%d-%H%M%S)
out="backups/fdm-monster-${stamp}.tar.gz"
mkdir -p backups

tar -czf "$out" data
size=$(du -h "$out" | cut -f1)
echo "✓ Backed up data/ → $out ($size)"
