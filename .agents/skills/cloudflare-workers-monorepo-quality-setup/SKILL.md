---
name: cloudflare-workers-monorepo-quality-setup
description: Recreate a production-oriented testing, typechecking, linting, formatting, CI, and Makefile workflow for pnpm/Turborepo monorepos with Cloudflare Workers, Hono, React/Vite, TypeScript, Biome, Vitest, and Wrangler. Use when asked to set up repo quality gates, make commands, CI workflows, worker test structure, or local verification commands. Do not include browser E2E setup.
---

# Cloudflare Workers Monorepo Quality Setup

You are helping replicate this repository's development and quality structure in another Cloudflare Workers monorepo.

The target architecture is usually:

- `pnpm` workspaces
- `turbo` for task orchestration
- `apps/*` for Workers and frontend apps
- `packages/*` for shared packages
- Cloudflare Workers using `wrangler`
- Hono for Worker APIs
- React + Vite for frontend apps when present
- TypeScript everywhere
- Biome for formatting and linting
- Vitest for unit tests
- Makefiles as the primary command interface
- GitHub Actions for CI quality gates
- No browser E2E setup unless the user explicitly asks for it

## Core Goal

Create a consistent local and CI workflow with these commands:

```bash
make install
make dev
make check
make format
make lint
make fix
make types
make check-types
make test
make verify
make ci
make ci-quality
make build-check
```

For individual apps/workers, support:

```bash
make dev
make check
make format
make lint
make fix
make types
make check-types
make test
make verify
make ci
make deploy
```

Do not add E2E commands, Playwright, Cypress, browser test workflows, or Docker test harnesses.

## Expected Repository Shape

Prefer this structure:

```
repo/
├── apps/
│   ├── worker-api/
│   ├── orm-account/
│   ├── worker-email/
│   ├── webhook-email/
│   └── front-app/
├── packages/
│   ├── dtos-common/
│   ├── enums-common/
│   └── typescript-config/
├── make/
│   ├── root.mk
│   └── worker.mk
├── biome.json
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
└── .github/
    └── workflows/
        ├── quality.yml
        └── unit-tests.yml
```

Adapt names to the target repo, but preserve the same ideas.

## Package Scripts

At the root package.json, create scripts that Turbo can run:

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "build-check": "turbo build-check",
    "check": "biome check .",
    "format": "biome format --write .",
    "lint": "biome lint .",
    "fix": "biome check --write .",
    "types": "turbo types",
    "check-types": "turbo check-types",
    "test": "turbo test",
    "ci": "pnpm check && pnpm check-types",
    "ci-quality": "pnpm check && pnpm check-types && pnpm build-check",
    "verify": "pnpm ci && pnpm test"
  }
}
```

If the repo already has scripts, preserve existing behavior and add the missing quality commands.

## Turborepo

Create or update turbo.json with tasks for local dev, build, typecheck, tests, and Wrangler type generation.

Use this shape:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".vite/**"]
    },
    "build-check": {
      "dependsOn": ["^build-check"],
      "outputs": ["dist/**", ".vite/**"]
    },
    "types": {
      "cache": false
    },
    "check-types": {
      "dependsOn": ["^check-types"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "deploy": {
      "dependsOn": ["build"],
      "cache": false
    }
  }
}
```

Adjust outputs for the target repo.

## TypeScript Presets

Create packages/typescript-config with shared presets:

```
packages/typescript-config/
├── package.json
├── base.json
├── workers.json
├── workers-lib.json
├── vite-react.json
└── vite-node.json
```

Use these rules:

- Workers extend `@repo/typescript-config/workers.json`
- shared Worker-compatible packages extend `workers-lib.json`
- React/Vite apps extend `vite-react.json`
- do not duplicate compiler options in every app
- app-specific aliases like `@/*` belong in the app tsconfig.json

Each app should expose:

```json
{
  "scripts": {
    "check-types": "tsc --noEmit",
    "types": "wrangler types",
    "test": "vitest run"
  }
}
```

For React apps, use the appropriate Vite/Vitest setup.

## Biome

Create biome.json at the root.

Required behavior:

- format and lint the whole monorepo
- fail on unused imports
- fail on unused variables
- require block statements
- enforce filename conventions
- forbid array index React keys
- warn on explicit any
- keep generated files, build output, coverage, and Wrangler generated files ignored where appropriate

Use strict defaults and adapt file naming rules:

- Workers and package `src/**/*.ts`: kebab-case
- React components: PascalCase or kebab-case
- frontend utility `.ts` files: kebab-case

## Makefiles

Use Make as the stable human interface.

Root Makefile should delegate to pnpm:

```makefile
.PHONY: install dev check format lint fix types check-types test verify ci ci-quality build build-check deploy

install:
	pnpm install

dev:
	pnpm dev

check:
	pnpm check

format:
	pnpm format

lint:
	pnpm lint

fix:
	pnpm fix

types:
	pnpm types

check-types:
	pnpm check-types

test:
	pnpm test

verify:
	pnpm verify

ci:
	pnpm ci

ci-quality:
	pnpm ci-quality

build:
	pnpm build

build-check:
	pnpm build-check

deploy:
	pnpm turbo deploy
```

Each app/worker Makefile should delegate locally:

```makefile
.PHONY: dev check format lint fix types check-types test verify ci deploy

dev:
	pnpm dev

check:
	pnpm check

format:
	pnpm format

lint:
	pnpm lint

fix:
	pnpm fix

types:
	pnpm types

check-types:
	pnpm check-types

test:
	pnpm test

verify:
	pnpm ci && pnpm test

ci:
	pnpm check && pnpm check-types

deploy:
	pnpm deploy
```

If an app has no tests yet, either add a minimal smoke test or make `pnpm test` a clear no-op only when that matches the repo convention.

## Vitest Structure

Use unit tests only.

Preferred layout:

```
apps/<app>/tests/
├── routes/
├── services/
└── handlers/
```

Do not colocate tests inside src unless the target repo already does that consistently.

For Cloudflare Workers:

- test Hono routes using request objects or Hono test helpers
- test service functions directly where possible
- mock external bindings explicitly
- avoid real network calls
- avoid relying on deployed Cloudflare resources
- keep environment binding types aligned with generated `worker-configuration.d.ts`

Typical worker scripts:

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "types": "wrangler types",
    "check": "biome check .",
    "format": "biome format --write .",
    "lint": "biome lint .",
    "fix": "biome check --write .",
    "check-types": "tsc --noEmit",
    "test": "vitest run",
    "ci": "pnpm check && pnpm check-types",
    "verify": "pnpm ci && pnpm test"
  }
}
```

## Wrangler

For each Worker app:

- add wrangler.jsonc
- define main
- define compatibility_date
- define dev.port
- define service bindings where needed
- generate Worker types with `wrangler types`
- commit example env files, not real `.dev.vars`

Do not commit secrets.

## GitHub Actions

Create two workflows unless the repo already has equivalent ones.

### Quality Workflow

`.github/workflows/quality.yml`

Run on pull requests and pushes to main.

It should:

1. check out code
2. set up pnpm
3. set up Node
4. install with frozen lockfile
5. run quality checks

Use:

```bash
make ci-quality
```

For PR optimization, `pnpm run ci:pr` or Turbo affected mode is acceptable if already configured, but keep the default simple and reliable.

### Unit Tests Workflow

`.github/workflows/unit-tests.yml`

Run on pull requests and pushes to main.

It should:

```bash
make test
```

No E2E workflow. No Playwright. No Cypress. No browser matrix.

## Local Verification Contract

After setup, verify:

```bash
make install
make types
make ci
make test
make verify
make build-check
```

If some commands cannot run because dependencies or credentials are missing, document the exact blocker and leave scripts wired correctly.

## Implementation Rules

When applying this skill:

1. Inspect the existing repo first.
2. Preserve existing scripts where they are compatible.
3. Prefer adding missing commands over renaming working ones.
4. Keep Make commands stable even if package scripts vary internally.
5. Use Turbo for cross-workspace orchestration.
6. Use Biome as the single formatter/linter.
7. Use TypeScript `tsc --noEmit` for type checks.
8. Use Vitest for unit tests.
9. Use Wrangler for Cloudflare Worker dev, deploy, and generated types.
10. Do not add E2E infrastructure.
11. Do not add browser automation dependencies.
12. Do not add Docker-only test requirements.

## Final Response Expected From Agent

When finished, summarize:

- files changed
- commands added
- CI workflows added or updated
- verification commands run
- any commands that could not be run and why
