# Deploying FDM-Monster on a VM

Runs the pre-built image from GHCR — no source tree, no Node, no submodules
needed on the VM. Just Docker.

## Prerequisites

- Docker Engine 24+ with the Compose plugin (`docker compose ...`, not the old
  `docker-compose` binary).
- If the GHCR image is **private**, a GitHub Personal Access Token with
  `read:packages` and `docker login ghcr.io` on the VM.

## First-time setup

```sh
# 1. Clone the repo (no submodules needed — deploy/ only pulls the image).
git clone https://github.com/jechandia/fdm-printer-project.git
cd fdm-printer-project/deploy

# 2. Configure secrets.
cp .env.example .env
# Generate a strong JWT_SECRET, e.g.:
#   openssl rand -hex 48
# Then edit .env and paste it in.
$EDITOR .env

# 3. Pull and start.
docker compose pull
docker compose up -d
```

The server is now on `http://<vm-host>:4000`. Persistent state lives in
`./data/` next to the compose file — back that up, not the container.

## Updates

```sh
cd ~/fdm-printer-project && git pull   # in case the compose file changed
cd deploy
docker compose pull
docker compose up -d
```

Pin `IMAGE_TAG` in `.env` to a specific version (e.g. `v1.2.3`) instead of
`latest` so a stray `docker compose pull` doesn't roll the running container
forward unexpectedly.

## Logs and status

```sh
docker compose ps
docker compose logs -f fdm-monster
```
