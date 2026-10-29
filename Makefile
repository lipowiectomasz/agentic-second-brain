ENV ?= local
ENV_FILE := $(if $(filter local,$(ENV)),.env,.env.$(ENV))
APPWRITE_VERSION ?= 2.5.0
APPWRITE_DOMAIN ?= localhost
PROXY_NETWORK ?= proxy
APPWRITE_HTTP_PORT ?= 127.0.0.1:18080
APPWRITE_HTTPS_PORT ?= 127.0.0.1:18443
APPWRITE_MQTT_PORT ?= 127.0.0.1:18883
APPWRITE_MQTT_WSS_PORT ?= 127.0.0.1:18084
PLATFORM_FILES := -f appwrite/docker-compose.yml -f appwrite/docker-compose.runtimes.yml $(if $(filter public,$(ENV)),-f appwrite/docker-compose.public.yml,)
OVERRIDE := $(if $(wildcard docker-compose.override.yml),-f docker-compose.override.yml,)
COMPOSE_APP := docker compose -f docker-compose.app.yml $(OVERRIDE)
RUN := HOST_UID=$(shell id -u) HOST_GID=$(shell id -g) CORTEX_ENV_FILE=$(ENV_FILE) $(COMPOSE_APP) --profile tools run --rm
TOOLS := $(RUN) tools
TOOLS_NET := $(RUN) tools-net

.DEFAULT_GOAL := help

.PHONY: help seed site-deploy appwrite-public-config demo-check smoke cli-image test-perf reindex test-e2e admin-grant admin-revoke appwrite-install platform-up up down app-up install bootstrap setup doctor test test-integration test-reset lint typecheck build shell

help:
	@printf '%s\n' \
	  'Cortex - every command runs in a container.' \
	  '' \
	  '  make appwrite-install      generate the self-hosted Appwrite stack (first time only)' \
	  '  make platform-up           start Appwrite' \
	  '  make install bootstrap setup doctor   prepare the project' \
	  '  make up | down | app-up    start or stop everything, restart the web app' \
	  '  make lint typecheck test build        quality gate' \
	  '  make test-integration test-e2e       integration and browser tests' \
	  '  make admin-grant EMAIL=<email>       give a user the organisation admin label' \
	  '  make admin-revoke EMAIL=<email>      remove it' \
	  '  make cli-image             build the cortex CLI image (bin/cortex)' \
	  '  make seed                  load the demo brain and demo accounts (idempotent)' \
	  '  make site-deploy           build and publish the web app on Appwrite Sites' \
	  '  make demo-check            scan the demo corpus for secrets and denylisted names' \
	  '  make smoke                 check the published site and API from outside' \
	  '' \
	  'Public instance: add ENV=public (reads .env.public); first install also needs' \
	  '  make appwrite-install appwrite-public-config ENV=public APPWRITE_DOMAIN=<api host> PUBLIC_IP=<ip>'

appwrite-install:
	@if [ -f appwrite/.env ]; then echo "appwrite/.env already exists; nothing to do."; else \
	  docker run --rm \
	    --volume "$(CURDIR)/appwrite":/usr/src/code/appwrite:rw \
	    --entrypoint=install appwrite/appwrite:$(APPWRITE_VERSION) \
	    --http-port=$(APPWRITE_HTTP_PORT) --https-port=$(APPWRITE_HTTPS_PORT) \
	    --interactive=N --no-start=true --database=postgresql --domain=$(APPWRITE_DOMAIN) && \
	  docker run --rm --volume "$(CURDIR)/appwrite":/w alpine chown -R $(shell id -u):$(shell id -g) /w && \
	  sed -i 's/^_APP_VECTORSDB=.*/_APP_VECTORSDB="enabled"/' appwrite/.env && \
	  sed -i '/^_APP_MQTT_PORT=/d; /^_APP_MQTT_WSS_PORT=/d' appwrite/.env && \
	  printf '_APP_MQTT_PORT="%s"\n_APP_MQTT_WSS_PORT="%s"\n' '$(APPWRITE_MQTT_PORT)' '$(APPWRITE_MQTT_WSS_PORT)' >> appwrite/.env; \
	fi

platform-up:
	PROXY_NETWORK=$(PROXY_NETWORK) docker compose $(PLATFORM_FILES) --env-file appwrite/.env --project-directory appwrite --profile embedding up -d

up:
	HOST_UID=$(shell id -u) HOST_GID=$(shell id -g) docker compose --profile embedding up -d

down:
	docker compose --profile embedding down

app-up:
	HOST_UID=$(shell id -u) HOST_GID=$(shell id -g) $(COMPOSE_APP) up -d --build --force-recreate web

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

admin-grant:
	@test -n "$(EMAIL)" || { echo "Use: make admin-grant EMAIL=<email>"; exit 2; }
	$(TOOLS_NET) npm run admin-grant -w @cortex/infra -- --email "$(EMAIL)"

site-deploy:
	$(TOOLS_NET) npm run site-deploy -w @cortex/infra

admin-revoke:
	@test -n "$(EMAIL)" || { echo "Use: make admin-revoke EMAIL=<email>"; exit 2; }
	$(TOOLS_NET) npm run admin-revoke -w @cortex/infra -- --email "$(EMAIL)"

test-e2e:
	$(RUN) e2e npx playwright test -c apps/web/playwright.config.ts

reindex:
	$(TOOLS_NET) npm run reindex -w @cortex/infra

test-perf:
	$(TOOLS_NET) npm run test:perf

cli-image:
	$(RUN) tools npm run build -w @cortex/cli
	docker build -t cortex-cli -f docker/cli.Dockerfile packages/cli

appwrite-public-config:
	@test -n "$(PUBLIC_IP)" -a "$(APPWRITE_DOMAIN)" != "localhost" || { echo "Use: make appwrite-public-config APPWRITE_DOMAIN=<api host> PUBLIC_IP=<server ip>"; exit 2; }
	sh appwrite/public-env.sh appwrite/.env "$(APPWRITE_DOMAIN)" "$(PUBLIC_IP)"

demo-check:
	$(TOOLS) npm run demo-check -w @cortex/infra

smoke:
	$(TOOLS_NET) npm run smoke -w @cortex/infra

seed:
	$(TOOLS_NET) npm run seed -w @cortex/infra
