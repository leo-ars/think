.PHONY: install dev check format lint fix types check-types test verify ci ci-quality build build-check deploy

install:
	pnpm install

dev:
	pnpm dev

check:
	pnpm run check

format:
	pnpm run format

lint:
	pnpm run lint

fix:
	pnpm run fix

types:
	pnpm run types

check-types:
	pnpm run check-types

test:
	pnpm run test

verify:
	pnpm run verify

ci:
	pnpm run ci

ci-quality:
	pnpm run ci-quality

build:
	pnpm run build

build-check:
	pnpm run build-check

deploy:
	pnpm run deploy
