# AGENTS.md

Read the full brief, [docs/FROST_AGENTS.md](docs/FROST_AGENTS.md), before doing anything. It is the source of truth; this file only repeats its non-negotiables.

- The engine forecasts and never acts: no code path writes to a calendar, sends a message, or changes external state.
- Horizon lock: nothing beyond 24 h is computed or rendered, and the horizon is not configurable.
- `packages/engine` uses no LLM, no AI SDK, no network, no I/O, and no `Date.now()`.
- Deterministic under a seed: same snapshot + same seed gives identical output.
- Validate with: `pnpm install && pnpm -r typecheck && pnpm -r test`
