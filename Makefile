ENV ?= local
ENV_FILE := $(if $(filter local,$(ENV)),.env,.env.$(ENV))
APPWRITE_VERSION ?= 2.5.0
APPWRITE_HTTP_PORT ?= 127.0.0.1:18080
APPWRITE_HTTPS_PORT ?= 127.0.0.1:18443
APPWRITE_MQTT_PORT ?= 127.0.0.1:18883
APPWRITE_MQTT_WSS_PORT ?= 127.0.0.1:18084
OVERRIDE := $(if $(wildcard docker-compose.override.yml),-f docker-compose.override.yml,)
COMPOSE_APP := docker compose -f docker-compose.app.yml $(OVERRIDE)
RUN := HOST_UID=$(shell id -u) HOST_GID=$(shell id -g) CORTEX_ENV_FILE=$(ENV_FILE) $(COMPOSE_APP) --profile tools run --rm
TOOLS := $(RUN) tools
TOOLS_NET := $(RUN) tools-net

.PHONY: appwrite-install platform-up up down app-up install bootstrap setup doctor test test-integration test-reset lint typecheck build shell

appwrite-install:
	test -f appwrite/.env || docker run --rm \
	  --volume "$(CURDIR)/appwrite":/usr/src/code/appwrite:rw \
	  --entrypoint=install appwrite/appwrite:$(APPWRITE_VERSION) \
	  --http-port=$(APPWRITE_HTTP_PORT) --https-port=$(APPWRITE_HTTPS_PORT) \
	  --interactive=N --no-start=true --database=postgresql --domain=localhost
	docker run --rm --volume "$(CURDIR)/appwrite":/w alpine chown -R $(shell id -u):$(shell id -g) /w
	sed -i 's/^_APP_VECTORSDB=.*/_APP_VECTORSDB="enabled"/' appwrite/.env
	sed -i '/^_APP_MQTT_PORT=/d; /^_APP_MQTT_WSS_PORT=/d' appwrite/.env
	printf '_APP_MQTT_PORT="%s"\n_APP_MQTT_WSS_PORT="%s"\n' '$(APPWRITE_MQTT_PORT)' '$(APPWRITE_MQTT_WSS_PORT)' >> appwrite/.env

platform-up:
	docker compose -f appwrite/docker-compose.yml --env-file appwrite/.env --project-directory appwrite --profile embedding up -d

up:
	HOST_UID=$(shell id -u) HOST_GID=$(shell id -g) docker compose --profile embedding up -d

down:
	docker compose --profile embedding down

app-up:
	HOST_UID=$(shell id -u) HOST_GID=$(shell id -g) $(COMPOSE_APP) up -d --build web

install:
	$(TOOLS) sh -c 'if [ -f package-lock.json ]; then npm ci; else npm install; fi'

bootstrap:
	$(TOOLS_NET) npm run bootstrap -w @cortex/infra

setup:
	$(TOOLS_NET) npm run setup -w @cortex/infra

doctor:
	$(TOOLS_NET) npm run doctor -w @cortex/infra

test:
	$(TOOLS) npm test

test-integration:
	$(TOOLS_NET) npm run test:integration

test-reset:
	$(TOOLS_NET) npm run test-reset -w @cortex/infra

lint:
	$(TOOLS) npm run lint

typecheck:
	$(TOOLS) npm run typecheck

build:
	$(TOOLS) npm run build

shell:
	$(TOOLS) bash
