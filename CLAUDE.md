# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This directory is a workspace holding two **separate git repositories** (the workspace root itself is not a git repo). They are developed and versioned independently:

- `fdm-printer-farm/` — the backend, npm package `@fdm-monster/server`. Node + Express + TypeORM (SQLite) server that manages 3D printer farms.
- `fdm-monster-client-next/` — the frontend, npm package `@fdm-monster/client-next`. Vue 3 + Vuetify SPA.

The server depends on the client as a published npm package (`@fdm-monster/client-next` in its `dependencies`) and serves the built client bundle as static files. During local frontend work you run the client dev server separately and point it at a running backend.

The two projects use **different toolchains** — do not assume commands from one work in the other.

## Backend (`fdm-printer-farm/`)

Uses **Vite+** (the `vp` global CLI), not plain npm/yarn/vite. See `fdm-printer-farm/.claude/CLAUDE.md` for the full Vite+ workflow and pitfalls. Key rules: do not call npm/yarn/vite/vitest/oxlint directly; use `vp` wrappers.

Common commands (run inside `fdm-printer-farm/`):

- `vp install` — install deps (run after pulling, before starting)
- `yarn dev` — build in watch mode and start the server (`NODE_ENV=development START_SERVER=true vp pack --watch`)
- `yarn build` — production library build (`vp pack`) into `dist/`
- `yarn start` — run the built server (`node dist/index.js`)
- `vp check` — format + lint + typecheck (also `yarn tsc` for just types)
- `vp test run` / `yarn test` — run the test suite once; `yarn test:watch`, `yarn test:ui`, `yarn test:cov`
- Run a single test file: `vp test run test/path/to/file.test.ts`

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
- **State layer** (`src/state/`): in-memory caches and stores that mirror live printer state — `printer.cache`, `printer-socket.store` (live socket connections per printer), `printer-events.cache`, `settings.store`, `floor.store`, etc. These are singletons and are the source of truth for runtime printer status (the DB holds persistent config).
- **Tasks** (`src/tasks/`): scheduled/recurring jobs run via `toad-scheduler` / `TaskManagerService`. `BootTask` runs once at startup; `PrinterWebsocketTask` is a recurring heartbeat that maintains printer socket connections; `SocketIoTask` pushes state to clients; others handle client-bundle download, software updates, print-job analysis.
- **Persistence**: TypeORM entities in `src/entities/`, data source in `src/data-source.ts`, migrations in `src/migrations/` (timestamp-prefixed). ORM-backed services live in `src/services/orm/`.
- **Realtime to client**: Socket.IO via `SocketIoGateway` (`src/state/socket-io.gateway.ts`), attached to the HTTP server in `ServerHost`.
- **Auth**: Passport with JWT + anonymous strategies (`src/middleware/passport.ts`), role-based authorization (`ROLES` in `src/constants/authorization.constants.ts`), refresh tokens.
- **Tests** (`test/`): Vitest, node environment. Setup in `test/setup-global.ts` and `test/setup-after-env.ts`. Uses `supertest` for API tests, `nock` for HTTP mocking, and in-memory/temp SQLite. Mock printer servers live in `packages/consoles/src/mock-*.server.ts`.

## Frontend (`fdm-monster-client-next/`)

Standard **Yarn 4 + Vite**. Commands (run inside `fdm-monster-client-next/`):

- `yarn dev` — Vite dev server on port 3000
- `yarn build` — `vue-tsc --noEmit && vite build` into `dist/`
- `yarn lint` — ESLint with `--fix`
- `yarn test` / `yarn test:unit` — Vitest (jsdom). `yarn test:coverage` for coverage; `-u` to update snapshots.
- Run a single test: `yarn vitest --environment jsdom src/path/to/file.spec.ts`
- `yarn openapi-ts` — regenerate the typed API client from the backend's OpenAPI spec (see below)
- `yarn screenshots:*` — Playwright visual/screenshot suites (per-feature scripts in `package.json`)

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

1. In `fdm-printer-farm/`: `yarn dev` (backend on port 4000 by default).
2. In `fdm-monster-client-next/`: `yarn dev` (Vite on port 3000). Point the client at the backend via `VITE_API_BASE` in `.env` (e.g. `http://localhost:4000/`); see `.env.example`.
3. After backend API changes that affect contracts, regenerate the client types with `yarn openapi-ts` (backend must be running with Swagger enabled).
