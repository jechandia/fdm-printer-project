# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The repo is a **Yarn 4 workspaces monorepo** (`github.com/jechandia/fdm-printer-project`). Both the backend and frontend live in-tree:

- `server/` — backend, npm package `@fdm-monster/server`. Node + Express + TypeORM (SQLite) server that manages 3D printer farms. Built with **Vite+** (the `vp` global CLI).
- `client/` — frontend, npm package `@fdm-monster/client-next`. Vue 3 + Vuetify SPA built with Vite.

The workspace is intentionally flat: just `server` and `client`. The upstream OSS scaffolding (contributor docs, GH workflows, screenshot suites, mock-printer test consoles) has been stripped — this is a deployment-focused fork, not a community fork.

The server depends on the client via `workspace:*`, so its `node_modules/@fdm-monster/client-next` is a symlink to `client/`. Building the client first produces `client/dist/`, which the server then serves as static files at runtime — no npm publish step needed for development.

The two projects use **different toolchains** — do not assume commands from one work in the other. Both share a single root `node_modules/` via Yarn workspaces, but `server/` is driven by Vite+ (`vp`) while `client/` uses plain Yarn + Vite scripts.

### Historical note

Until May 2026 the workspace pulled `server/` and `client/` in as git submodules pointing at separate repos (`fdm-printer-farm` and `fdm-monster-client-next`). Those upstream repos still exist on GitHub for historical reference but are no longer the source of truth — all new work happens here.

## Working in the monorepo

From the workspace root:

- `yarn install` — installs everything (server + client) in a single hoisted `node_modules/`. The server's `@fdm-monster/client-next` dep is a `workspace:*` link, so `node_modules/@fdm-monster/client-next` resolves to `client/`.
- `yarn build` — builds the client first, then the server (`build:client && build:server`).
- `yarn start` — runs the production server (which serves the built client bundle).
- `yarn dev:server` / `yarn dev:client` — start the backend (watch mode) and the Vite dev server in two separate terminals.
You can also drive individual workspaces directly:

- `yarn workspace @fdm-monster/server <script>`
- `yarn workspace @fdm-monster/client-next <script>`

### Prerequisites

The server's `prepare` script runs `vp config`, so `vite-plus` must be available globally before the first `yarn install`:

```sh
corepack enable                 # picks up Yarn 4 from the .yarn/releases bin
npm install -g vite-plus        # provides the `vp` CLI
yarn install
```

## VM deployment

The VM runs Node natively — no Docker. Steps:

```sh
# One-time setup on a fresh VM (Debian/Ubuntu):
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential python3
sudo corepack enable
sudo npm install -g vite-plus

# Pull and build:
git clone https://github.com/jechandia/fdm-printer-project.git fdm-monster
cd fdm-monster
yarn install
yarn build

# Run:
yarn start
```

### Persistent via systemd

For an always-on install, drop this unit at `/etc/systemd/system/fdm-monster.service` (adjust `User` and `WorkingDirectory` to match the VM):

```ini
[Unit]
Description=FDM-Monster (3D printer farm manager)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=fdm
WorkingDirectory=/opt/fdm-monster
ExecStart=/usr/local/bin/yarn start
Restart=on-failure
RestartSec=5s
EnvironmentFile=-/opt/fdm-monster/server/.env

[Install]
WantedBy=multi-user.target
```

Then `sudo systemctl daemon-reload && sudo systemctl enable --now fdm-monster`. Logs: `journalctl -u fdm-monster -f`.

Configuration lives in `server/.env` (see `server/.env.template` for the full list — `SERVER_PORT`, `JWT_SECRET`, media/database paths, etc.). Persistent state goes wherever `MEDIA_PATH` and `DATABASE_PATH` point; keep those on a backed-up volume.

## Backend (`server/`)

Uses **Vite+** (the `vp` global CLI), not plain npm/yarn/vite. See `server/.claude/CLAUDE.md` for the full Vite+ workflow and pitfalls. Key rules: do not call npm/yarn/vite/vitest/oxlint directly; use `vp` wrappers.

Common commands (run inside `server/`, or via `yarn workspace @fdm-monster/server <script>` from root):

- `vp install` — install deps for this workspace only (the root `yarn install` already covers it)
- `yarn dev` — build in watch mode and start the server (`NODE_ENV=development START_SERVER=true vp pack --watch`)
- `yarn build` — production library build (`vp pack`) into `dist/`
- `yarn start` — run the built server (`node dist/index.js`)
- `vp check` — format + lint + typecheck (also `yarn tsc` for just types)
Database migrations (TypeORM, SQLite at `database/fdm-monster.sqlite`):

- `yarn typeorm:generate` — generate a migration from entity changes (`-d src/data-source.ts`)
- `yarn typeorm:migrate` — run pending migrations
- `yarn typeorm:revert` — revert the last migration

Configuration is via environment variables / `.env` — see `.env.template` for the full list (server port default 4000, JWT overrides, demo mode, media/database paths, Loki/Prometheus, Swagger toggles).

### Backend architecture

- **Entry point**: `src/index.ts` → `setupEnvConfig()` → `setupServer()` (`src/server.core.ts`) builds the Express app and DI container → resolves `ServerHost` (`src/server.host.ts`) which mounts routes, runs the `BootTask`, and listens.
- **Dependency injection**: Awilix container, configured in `src/container.ts` with tokens in `src/container.tokens.ts`. Classic injection mode (constructor param names are resolved by token name). Most services are `.singleton()`; printer API adapters and per-printer clients are `.transient()` on purpose (one per printer/request). `scopePerRequest` (awilix-express) creates a request scope so controllers and `printerResolveMiddleware` can inject per-request values like `printerLogin`.
- **Controllers**: `src/controllers/*.controller.ts` use `awilix-express` decorators (`@route`, `@GET`, `@before`, etc.). Auth/role guards are applied via `@before([authenticate(), authorizeRoles([...])])`. Routes are auto-loaded by `loadControllersFunc()`. API is served under `/api`; Swagger at `/api-docs`.
- **Multi-vendor printer abstraction**: The core feature is talking to four printer types — OctoPrint, Moonraker (Klipper), PrusaLink, and Bambu Lab. `PrinterApiFactory` (`src/services/printer-api.factory.ts`) resolves the right adapter per printer based on `login.printerType`, all implementing `IPrinterApi` (`src/services/printer-api.interface.ts`). Each vendor has its own service dir under `src/services/` (`octoprint/`, `moonraker/`, `prusa-link/`, `bambu/`) with an HTTP client/API and a websocket/MQTT/polling adapter.

#### PrusaLink API reference

The PrusaLink adapter (`src/services/prusa-link/`) targets the **PrusaLink Web API v1** (official OpenAPI spec: `title: PrusaLink Web`, contact `link@prusa3d.cz`, docs https://connect.prusa3d.com). PrusaLink has no websocket, so `PrusaLinkHttpPollingAdapter` polls `/api/v1/status` on an interval set by `PRUSA_LINK_POLL_INTERVAL_MS` (default 5000ms, clamped [1000, 60000]). Auth is HTTP **digest** (`digestAuth`); most endpoints return `401 Unauthorized` otherwise.

Key endpoints the adapter uses:

- `GET /api/version` — `Version` (api/version/printer/firmware, optional `capabilities.upload-by-put`). If `upload-by-put` is absent, fall back to legacy OctoPrint-style `POST /api/files/{storage}`.
- `GET /api/v1/info` — `Info` (printer name, nozzle diameter, serial, `farm_mode`, `active_camera`, …).
- `GET /api/v1/status` — telemetry: `printer.state` (`IDLE|BUSY|PRINTING|PAUSED|FINISHED|STOPPED|ERROR|ATTENTION|READY`), temps/targets, `job` (id/progress/time), `transfer`, `storage`, `camera`. This is the polling source of live printer state.
- `GET /api/v1/job` — current `Job` (id, state, progress); job control: `DELETE /api/v1/job/{id}` (stop), `PUT .../pause`, `PUT .../resume`, `PUT .../continue`.
- `GET /api/v1/storage` — list of `Storage` entries (`type: LOCAL|SDCARD|USB`, free/total space).
- Files at `/api/v1/files/{storage}/{path}`: `GET` (metadata — `FileInfo|PrintFileInfo|FirmwareFileInfo|FolderInfo`), `PUT` (upload raw octet-stream; headers `Print-After-Upload`, `Overwrite` use RFC 8941 `?0`/`?1` booleans), `POST` (start print of existing file), `HEAD` (presence + `Read-Only`/`Currently-Printed` headers), `DELETE` (header `Force` for non-empty folders).
- Cameras under `/api/v1/cameras` (list/reorder), `/api/v1/cameras/{id}` and `/snap` (PNG snapshot), `/config`, `/connection`.

Error bodies follow the `Error` schema (`code`, `title`, `text`, `url`) or `text/plain`. The full upstream spec lives outside the repo (e.g. a `prusalink openapi.yaml`); use the summary above as the working reference.

Hardware notes (verified against the physical farm — Prusa XL on Buddy fw 2.1.2, and an MK3 on the legacy Einsy standalone PrusaLink fw 0.8.1):

- **The Prusa XL only prints `.bgcode`, not plain `.gcode`** — slice/upload `.bgcode` for the XL. Plain `.gcode` is for the legacy Einsy boards (MK3/MK2.5), which conversely do **not** support `.bgcode` (8-bit). When choosing a test/print file, match the firmware: `.bgcode` for Buddy boards (XL/MK4/MINI/Core One), `.gcode` for Einsy (MK3).
- **Deleting a file returns `409` when the file is "in use" — including when it's open in the Buddy print preview.** On the XL, opening a file shows a preview/confirm screen that *selects* the file; a selected file can't be deleted (or its parent folder) until you deselect/cancel it on the printer screen. This state is **not** visible in `/api/v1/status` or `/api/v1/job`, so the `409` is the only signal — the adapter translates it into an actionable message (`throwDeleteError`). Not just "currently printing".
- **Do not issue `HEAD /api/v1/files/...` against the XL.** Its firmware returns a malformed HTTP response (Node throws `Parse Error: Expected HTTP/`). The adapter does **not** use `HEAD`; keep it that way for PrusaLink. (Earlier I mis-attributed a stuck-`409` delete to HEAD — the real cause is the selected-file state above.)
- **Listings on the legacy MK3 are eventually consistent** (~1s lag): a read immediately after a create/upload/delete can be stale. The XL (Buddy) is immediately consistent.
- The XL exposes storage `usb`; the MK3 exposes `local` (+ read-only `sdcard`). `getInternalStorage()` already resolves this.
- **State layer** (`src/state/`): in-memory caches and stores that mirror live printer state — `printer.cache`, `printer-socket.store` (live socket connections per printer), `printer-events.cache`, `settings.store`, `floor.store`, etc. These are singletons and are the source of truth for runtime printer status (the DB holds persistent config).
- **Tasks** (`src/tasks/`): scheduled/recurring jobs run via `toad-scheduler` / `TaskManagerService`. `BootTask` runs once at startup; `PrinterWebsocketTask` is a recurring heartbeat that maintains printer socket connections; `SocketIoTask` pushes state to clients; others handle client-bundle download, software updates, print-job analysis.
- **Persistence**: TypeORM entities in `src/entities/`, data source in `src/data-source.ts`, migrations in `src/migrations/` (timestamp-prefixed). ORM-backed services live in `src/services/orm/`.
- **Realtime to client**: Socket.IO via `SocketIoGateway` (`src/state/socket-io.gateway.ts`), attached to the HTTP server in `ServerHost`.
- **Auth**: Passport with JWT + anonymous strategies (`src/middleware/passport.ts`), role-based authorization (`ROLES` in `src/constants/authorization.constants.ts`), refresh tokens.

## Frontend (`client/`)

Standard **Yarn 4 + Vite**. Commands (run inside `client/`, or via `yarn workspace @fdm-monster/client-next <script>` from root):

- `yarn dev` — Vite dev server on port 3000
- `yarn build` — `vue-tsc --noEmit && vite build` into `dist/`
- `yarn lint` — ESLint with `--fix`

The OpenAPI-generated client (`@hey-api/openapi-ts`) is still checked into `src/backend/generated/`, but the regeneration script and the upstream Playwright/Vitest harnesses have been removed. If you need to regenerate, install `@hey-api/openapi-ts` ad-hoc and point it at a running backend (`http://localhost:4000/api-docs/swagger.json`).

### Frontend architecture

- **Entry**: `src/main.ts` mounts the Vue app with Pinia (state), Vue Router, Vuetify, TanStack Vue Query, and Sentry.
- **Generated API client**: `src/backend/generated/` is **auto-generated** by `@hey-api/openapi-ts` from the backend's Swagger JSON (`openapi-ts.config.ts` reads `http://localhost:4000/api-docs/swagger.json`). Do not hand-edit files in `generated/`; regenerate with `yarn openapi-ts` against a running backend. The axios client is configured with `baseUrl: '/api'` (`client.gen.ts`).
- **Service layer** (`src/backend/`): hand-written service classes (`*.service.ts`) wrap the generated SDK and expose typed methods to the rest of the app. `base.service.ts` / `server.api.ts` hold shared client setup.
- **Data fetching**: TanStack Vue Query hooks in `src/queries/`.
- **State**: Pinia stores in `src/store/` (auth, printers, floors, grid, settings, uploads, dialogs, etc.).
- **UI**: feature-grouped components under `src/components/` (PrinterGrid, PrinterList, Dashboard, CameraGrid, Files, PrintJobs, Settings, FirstTimeSetup, …). Vuetify is the component library. `unplugin-auto-import` and `unplugin-vue-components` auto-import Vue APIs and components — see generated `src/auto-imports.d.ts` and `src/components.d.ts` (do not edit by hand).
- **Realtime**: `socket.io-client` consumes the backend Socket.IO stream; message models in `src/models/socketio-messages/`.
- The `@` alias maps to `src/`.

## Local full-stack development

Two terminals at the workspace root:

1. `yarn dev:server` — backend on port 4000.
2. `yarn dev:client` — Vite on port 3000. Point the client at the backend via `VITE_API_BASE` in `client/.env` (e.g. `http://localhost:4000/`); see `client/.env.example`.
3. After backend API changes that affect contracts, you can regenerate the typed client SDK from the backend's Swagger JSON — see the note in the Frontend section.
