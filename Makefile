# Build and publish the fdm-monster image to GHCR.
#
# Typical workflow:
#   make login           # one-time: docker login ghcr.io with a PAT
#   make publish         # build linux/amd64 and push :<version> + :latest
#
# Override defaults at the command line, e.g.:
#   VERSION=v1.2.3 make publish
#   PUBLISH_PLATFORM=linux/arm64 make publish

IMAGE            ?= ghcr.io/jechandia/fdm-monster
VERSION          ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
PUBLISH_PLATFORM ?= linux/amd64

.PHONY: version login build publish run-local stop-local

version:
	@echo $(VERSION)

login:
	docker login ghcr.io

# Build for the dev machine's native architecture. Good for `docker compose up`
# and smoke-testing before publishing.
build:
	IMAGE_TAG=$(VERSION) docker compose build

# Cross-build for the VM target and push directly to GHCR. buildx --push
# bypasses the local image store, which is required for multi-platform builds
# and harmless for single-platform ones.
publish:
	docker buildx build \
		--platform $(PUBLISH_PLATFORM) \
		--tag $(IMAGE):$(VERSION) \
		--tag $(IMAGE):latest \
		--push \
		.

run-local:
	IMAGE_TAG=$(VERSION) docker compose up -d --build

stop-local:
	docker compose down
