#!/usr/bin/env bash
# yarn doctor → preflight checks for a fresh clone or a VM deploy.
# Runs every check, reports pass/fail per line, exits non-zero if any failed.
#
# Lives at the workspace root and assumes:
#   - server/.env exists for runtime config
#   - data/ at the workspace root holds persistent state
#   - server listens on $SERVER_PORT (default 4000)

cd "$(dirname "$0")/.."

ok=0
fail=0

pass() { echo "  ✓ $1"; ok=$((ok + 1)); }
warn() { echo "  ⚠ $1"; }
fail() { echo "  ✗ $1"; fail=$((fail + 1)); }

echo "── Toolchain ─────────────────────────────────────────"

node_v=$(node --version 2>/dev/null | sed 's/^v//' || echo "")
if [ -z "$node_v" ]; then
  fail "node not found on PATH"
else
  node_major=$(echo "$node_v" | cut -d. -f1)
  if [ "$node_major" -ge 22 ]; then
    pass "node $node_v (>= 22)"
  else
    fail "node $node_v — need >= 22, install nvm or distro-package"
  fi
fi

yarn_v=$(yarn --version 2>/dev/null || echo "")
if [ -z "$yarn_v" ]; then
  fail "yarn not found — run \`corepack enable\`"
else
  yarn_major=$(echo "$yarn_v" | cut -d. -f1)
  if [ "$yarn_major" -ge 4 ]; then
    pass "yarn $yarn_v (>= 4)"
  else
    fail "yarn $yarn_v — workspace lockfile is Berry/4.x"
  fi
fi

if command -v vp >/dev/null 2>&1; then
  pass "vp (vite-plus) $(vp --version 2>&1 | head -1 | awk '{print $2}')"
else
  fail "vp not on PATH — run \`npm install -g vite-plus\` (server build needs it)"
fi

echo ""
echo "── Workspace ─────────────────────────────────────────"

if [ -d node_modules ] && [ -f node_modules/.yarn-state.yml ]; then
  pass "node_modules present (yarn install has run)"
else
  warn "node_modules missing — run \`yarn install\` next"
fi

if [ -d client/dist ] && [ -d server/dist ]; then
  pass "client/dist and server/dist both exist (yarn build has run)"
else
  warn "no build output — run \`yarn build\` before \`yarn start\`"
fi

if [ -f server/.env ]; then
  pass "server/.env present"
else
  fail "server/.env missing — copy server/.env.template and fill in"
fi

if [ -d data ]; then
  if [ -w data ]; then
    pass "data/ exists and is writable"
  else
    fail "data/ exists but is not writable for $(whoami)"
  fi
else
  warn "data/ does not exist yet — created on first \`yarn start\`"
fi

echo ""
echo "── Config sanity ─────────────────────────────────────"

if [ -f server/.env ]; then
  secret=$(grep -E "^OVERRIDE_JWT_SECRET=" server/.env | cut -d= -f2-)
  case "$secret" in
    "fdm-monster-jwt-secret-2023" | "change-me-with-openssl-rand-hex-48" | "")
      fail "OVERRIDE_JWT_SECRET is the template default or empty — regenerate with \`openssl rand -hex 48\`"
      ;;
    *)
      if [ "${#secret}" -lt 32 ]; then
        warn "OVERRIDE_JWT_SECRET is set but short (${#secret} chars) — aim for 64+"
      else
        pass "OVERRIDE_JWT_SECRET looks set (${#secret} chars, non-default)"
      fi
      ;;
  esac

  port=$(grep -E "^SERVER_PORT=" server/.env | cut -d= -f2-)
  port=${port:-4000}
else
  port=4000
fi

if command -v lsof >/dev/null 2>&1; then
  if lsof -i ":$port" -sTCP:LISTEN >/dev/null 2>&1; then
    holder=$(lsof -i ":$port" -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR==2 {print $1, $2}')
    warn "port $port already in use by: $holder (stop it before \`yarn start\`)"
  else
    pass "port $port is free"
  fi
else
  warn "lsof not available — can't verify port $port is free"
fi

echo ""
echo "── Summary ───────────────────────────────────────────"
echo "  $ok check(s) passed, $fail failed."

if [ "$fail" -gt 0 ]; then
  exit 1
fi
