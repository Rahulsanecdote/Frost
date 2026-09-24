# Frost

Frost forecasts the next 24 hours from a user's present state and history. It suggests ordinary actions as text; it never acts on external services.

## Setup

Requires Node.js 22.12+ (use `nvm use`) and pnpm 11.22.0. With Corepack installed, run `corepack enable` and `corepack prepare pnpm@11.22.0 --activate`.

```sh
pnpm install
pnpm -r typecheck
pnpm -r test
```

Husky runs type checking and tests before commits. Commit messages follow Conventional Commits, for example `chore: scaffold Frost workspace`.

## Current scope

This repository contains the basic workspace, strict TypeScript configuration, engine type contracts, a contract smoke test, commit hooks, and a GitHub Actions workflow. The engine has no runtime dependencies. Source exports are intended for workspace development; publication/build packaging is deferred.

The reference brief is preserved in [docs/FROST_AGENTS.md](docs/FROST_AGENTS.md). Its full Task 1 is **not implemented**: statistical models, seeded simulation, grant enforcement, ledger, resolution logging, 30 fixtures, and calibration comparisons remain. No calibration scores are available. GitHub CI must run after pushing to a remote.

Mobile, readers, Supabase, and AI integration are deferred. No accounts, API keys, or paid services are needed for this setup.

## Licensing

The repository is AGPL-3.0-only under [LICENSE](LICENSE), except `packages/engine`, which is MIT under its own [LICENSE](packages/engine/LICENSE).
