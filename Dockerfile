# syntax=docker/dockerfile:1.7
# Workspace-level Dockerfile for FDM-Monster. Builds the local Vue client and
# the Node/Vite+ server, then assembles a single runtime image where the server
# serves the freshly-built client bundle in place of the npm-published one.

ARG NODE_IMAGE=node:22-bookworm-slim

# ──────────────────────────────────────────────────────────────────────────────
# 1) Build the Vue 3 client. Output: /build/client/dist
# ──────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS client-builder
WORKDIR /build/client

# Yarn 4 via corepack — version is pinned in the project's `packageManager`.
RUN corepack enable

# Bring in the pinned Yarn binary first so the install step is cache-friendly.
COPY fdm-monster-client-next/package.json fdm-monster-client-next/yarn.lock fdm-monster-client-next/.yarnrc.yml ./
COPY fdm-monster-client-next/.yarn/releases .yarn/releases
COPY fdm-monster-client-next/.yarn/cache .yarn/cache
RUN yarn install --immutable

# Now the source — `vue-tsc --noEmit && vite build` produces dist/.
COPY fdm-monster-client-next ./
RUN yarn build

# ──────────────────────────────────────────────────────────────────────────────
# 2) Build the Node/Express server with Vite+ (vp).
# ──────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS server-builder
WORKDIR /build/server

# Vite+'s `vp` CLI is published on npm as `vite-plus` — install globally so
# `yarn build` (== `vp pack`) finds it on PATH.
RUN corepack enable \
 && npm install -g vite-plus

COPY fdm-printer-farm/package.json fdm-printer-farm/yarn.lock fdm-printer-farm/.yarnrc.yml ./
COPY fdm-printer-farm/.yarn/releases .yarn/releases
# Not --immutable: the backend's lockfile has peer-dep drift that local installs
# silently re-resolve; in a throwaway image we just let yarn settle it.
RUN yarn install

COPY fdm-printer-farm ./
RUN yarn build

# The server serves the client from
# `node_modules/@fdm-monster/client-next/dist` (see server.host.ts). Swap the
# published bundle for the locally-built one so the image carries the
# workspace's modifications instead of the published @x.y.z.
RUN rm -rf node_modules/@fdm-monster/client-next/dist
COPY --from=client-builder /build/client/dist node_modules/@fdm-monster/client-next/dist

# ──────────────────────────────────────────────────────────────────────────────
# 3) Runtime: ships only the built server and the patched node_modules.
# ──────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    SERVER_PORT=4000 \
    MEDIA_PATH=/app/media \
    DATABASE_PATH=/app/database

# Bring in the artefacts the runtime needs. Migrations are TS files read by
# TypeORM's CLI loader at startup, so they must survive the trim.
COPY --from=server-builder /build/server/package.json ./
COPY --from=server-builder /build/server/node_modules ./node_modules
COPY --from=server-builder /build/server/dist ./dist

# Persistent state lives under /app/media and /app/database — meant to be
# mounted as volumes by docker compose.
RUN mkdir -p /app/media /app/database

EXPOSE 4000
CMD ["node", "dist/index.js"]
