# PrusaHero

A self-hosted manager for **PrusaLink** 3D-printer farms. Deployment-focused fork of FDM Monster, trimmed to the PrusaLink vendor only.

- **`server/`** — `@prusahero/server`. Node + Express + TypeORM (SQLite), built with [Vite+](https://vite.plus) (the `vp` CLI).
- **`client/`** — `@prusahero/client-next`. Vue 3 + Vuetify SPA built with Vite.

The server depends on the client via a Yarn workspace link and serves the built client bundle (`client/dist/`) as static files at runtime.

## Prerequisites

- Node 22+
- Yarn 4 (via Corepack)
- The `vp` CLI (`vite-plus`), installed globally **before** the first `yarn install` (the server's `prepare` script runs `vp config`).

```sh
corepack enable
npm install -g vite-plus
```

## Develop

From the workspace root:

```sh
yarn install        # installs server + client into one hoisted node_modules
yarn dev:server     # backend on :4000 (watch mode)
yarn dev:client     # Vite dev server on :3000
```

Point the client at the backend via `VITE_API_BASE` in `client/.env` (see `client/.env.example`). Backend config lives in `server/.env` (see `server/.env.template`).

## Build & run (production)

```sh
yarn build          # builds client first, then server, into dist/
yarn start          # runs the built server, which serves the client bundle
```

## Ops scripts

| Command         | What it does                                                                 |
| --------------- | --------------------------------------------------------------------------- |
| `yarn doctor`   | Preflight checks (Node/Yarn versions, `vp` on PATH, build artifacts, `.env`, port). Non-zero exit on failure — use as a deploy gate. |
| `yarn backup`   | Snapshots `data/` to `backups/prusahero-<timestamp>.tar.gz`.                 |
| `yarn restore [path]` | Restores a backup (newest in `backups/` if no arg). Refuses while running. |
| `yarn reset`    | Wipes `data/` for a fresh FirstTimeSetup. Refuses while running.             |

## VM deployment

The VM runs Node natively (no Docker).

```sh
# One-time setup on a fresh Debian/Ubuntu VM:
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential python3
sudo corepack enable
sudo npm install -g vite-plus

# Pull, build, run:
git clone https://github.com/jechandia/prusahero.git prusahero
cd prusahero
yarn install
yarn build
yarn start
```

For an always-on install, run it under systemd (`Restart=on-failure`, `EnvironmentFile=server/.env`). Logs via `journalctl -u prusahero -f`.

## Further reading

See [`CLAUDE.md`](CLAUDE.md) for the full architecture guide (DI container, PrusaLink adapter, state caches, tasks, migrations).
