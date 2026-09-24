# AGENTS.md — Frost
Version 0.1.2 · 2026-09-24 · Handoff from Rimuru (strategy/architecture) to coding agent (Codex / Claude Code)

This document is self-contained. Execute from it without conversation history.

---

## 1. North Star and goal

**North Star:** a shipped, calibrated product with paying users — not architecture.

**What Frost is:** a consumer mobile app that reads the user's present (calendar, commute, email commitments) and shows the next 90 minutes to 24 hours as a small set of weighted branches — each with a calibrated probability and one ordinary action. It forecasts. It never schedules, moves, or acts.

**Why it exists:** every AI calendar tool (Motion, Reclaim, Sunsama) *steers* the user's day. Frost only *sees*. The product thesis is that calibrated odds plus restraint beats auto-scheduling for people who want to stay in control.

**Goal of this phase (MVP, 6 weeks):** prove the branch engine is calibrated on real days. If it can't beat a naive baseline on Brier score after 30 days of use, the project is killed. Everything else is downstream of that.

### Product rules (non-negotiable, derived from the source concept)

| Rule | Engineering constraint |
|---|---|
| Reading, not receiving | Engine input is only the present snapshot + the user's own history. No external trend data, no "predictions" beyond what state supports. |
| Calibrated or nothing | Every branch is logged with its probability and later resolved. Brier score is a first-class metric, computed per user. |
| Horizon lock | Nothing beyond 24 h is computed or rendered. |
| Cannot steer | The engine returns suggested actions as text. No code path writes to a calendar, sends a message, or changes external state. Ever. |
| Reflex reads | Automatic reads fire only when an irreversible decision is within 30 minutes (leave-by time, deadline, hard-stop meeting). Otherwise passive. |
| Debt ledger | Each manual read costs 1 point of a daily allowance (default 10). Auto-reads cost 0.5. Ledger is visible to the user. |
| Permission grants | User-authored scopes (e.g. `calendar: read`, `commute: read`, `email: none`) are enforced by the engine; a reader outside its grant throws `PermissionDenied`. |
| Visibility / privacy | Read history and branch logs stay on device. Server holds OAuth tokens and anonymized calibration aggregates only. |

---

## 2. Hard constraints

- **Language:** TypeScript, `strict: true`, no `any`. Node 20+.
- **Package manager:** pnpm workspaces (monorepo).
- **Mobile:** Expo SDK (latest stable) / React Native, EAS builds. Not in scope for the first task.
- **Backend:** Supabase (Postgres, Auth). Not in scope for the first task.
- **AI:** Vercel AI SDK (provider-agnostic). Used **only** for extracting commitments from email text. The AI SDK must never be used to produce a probability. Probabilities come from the statistical engine.
- **Engine purity:** `packages/engine` has zero runtime dependencies beyond the TS standard library and a seedable PRNG. No network, no I/O, no dates from `Date.now()` — the snapshot supplies `now`.
- **Determinism:** same snapshot + same seed → identical output. Required for tests.
- **Quality gates:** `tsc --noEmit`, Vitest, Husky pre-commit, conventional commits, GitHub Actions CI on push.
- **Licensing:** `packages/engine` MIT (adoption + licensing deals). `apps/mobile` and everything else AGPL-3.0 (public repo; forks must stay open). Add `LICENSE` files at both levels in the first task.
- **Business model:** free for all users; revenue from Pro features (email commitment extraction, history > 30 days, shared/household branches) and engine licensing. Consequence: **free-tier marginal cost must be ~zero.** Engine runs on device. Commute data comes from Apple MapKit on iOS (no per-request charge) and Google Distance Matrix on Android under a hard daily quota. Any feature that calls an LLM lives behind Pro.
- **Budget:** near zero. Free tiers only until paying users exist.
- **Compliance:** Google OAuth calendar/Gmail scopes require verification before public release — use test users during MVP. No SMS/iMessage reading, ever (store rejection risk).

---

## 3. Current state (verified)

- **Nothing exists.** Greenfield. No repo, no code, no fixtures.
- Strategy and architecture are decided (this document). Validation interviews are running in parallel and do not block engineering.
- Do not assume any prior implementation. Do not search for one.

---

## 4. File / module map

```
frost/
├── AGENTS.md                      ← this file
├── package.json                   ← pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json             ← strict, shared
├── .github/workflows/ci.yml       ← pnpm install, tsc, vitest
├── packages/
│   ├── engine/                    ← OWNER: first task. Pure TS. MIT.
│   │   ├── src/
│   │   │   ├── types.ts           ← DaySnapshot, Event, Commitment, Branch, Grant, Ledger
│   │   │   ├── grants.ts          ← permission enforcement
│   │   │   ├── models/
│   │   │   │   ├── lateness.ts    ← arrival distribution from commute + history
│   │   │   │   ├── overrun.ts     ← meeting overrun distribution from history
│   │   │   │   └── slip.ts        ← commitment-slip likelihood vs free blocks
│   │   │   ├── simulate.ts        ← Monte Carlo over the day, seeded
│   │   │   ├── branches.ts        ← rank + summarize top-k branches with actions
│   │   │   ├── calibration.ts     ← Brier score, resolution logging
│   │   │   ├── ledger.ts          ← debt accounting
│   │   │   └── index.ts
│   │   ├── test/
│   │   │   ├── fixtures/days/     ← 30 synthetic days with ground-truth outcomes (JSON)
│   │   │   ├── engine.test.ts
│   │   │   └── calibration.test.ts
│   │   └── package.json
│   ├── readers/                   ← LATER. Calendar / commute / email adapters → DaySnapshot
│   └── ui/                        ← LATER. Shared RN components
├── apps/
│   └── mobile/                    ← LATER. Expo app
└── supabase/                      ← LATER. migrations, edge functions
```

Ownership: the coding agent owns `packages/engine` entirely for the first task. Nothing else is to be created yet beyond workspace scaffolding.

---

## 5. First task — the branch engine with a calibration test

### Scope

Build `packages/engine` so that it turns a `DaySnapshot` into ranked `Branch[]`, and prove on synthetic data that its probabilities are calibrated.

### Types (implement exactly; extend only with justification in a comment)

```ts
export interface DaySnapshot {
  now: string;                       // ISO 8601, supplied by caller — never Date.now()
  horizonHours: 24;                  // literal; horizon lock
  events: CalendarEvent[];
  commitments: Commitment[];
  commute: CommuteEstimate[];        // one per event that has a location
  history: UserHistory;
  grant: Grant;
}

export interface CalendarEvent {
  id: string;
  start: string; end: string;        // ISO
  location?: string;
  hardStop: boolean;                 // true if it cannot overrun (flight, pickup)
  attendees: number;
}

export interface Commitment {         // a promise extracted from email
  id: string;
  description: string;
  dueBy: string;                     // ISO
  estimatedMinutes: number;
}

export interface CommuteEstimate {
  eventId: string;
  fromCurrentLocation: boolean;
  minutesP50: number; minutesP90: number;   // from Maps API, supplied by reader
}

export interface UserHistory {
  arrivalDeltasMin: number[];        // observed (actual − planned) arrival deltas
  overrunDeltasMin: number[];        // observed meeting overruns
  slipRate: number;                  // fraction of past commitments missed, 0–1
}

export interface Grant {
  calendar: "read" | "none";
  commute: "read" | "none";
  email: "read" | "none";
}

export type BranchKind = "late" | "overrun_cascade" | "commitment_slip" | "clear";

export interface Branch {
  id: string;
  kind: BranchKind;
  subjectId: string | null;          // eventId or commitmentId; null for "clear"
  probability: number;               // 0–1, calibrated
  windowStart: string; windowEnd: string;
  summary: string;                   // one sentence, plain language
  ordinaryAction: string | null;     // e.g. "Leave by 2:35 instead of 2:45." Never an executed action.
}

export interface Resolution {
  branchId: string;
  occurred: boolean;
  resolvedAt: string;
}
```

### Public API

```ts
export function readBranches(snapshot: DaySnapshot, opts: { seed: number; samples?: number; topK?: number }): Branch[];
export function brierScore(pairs: Array<{ probability: number; occurred: boolean }>): number;
export function naiveBaseline(snapshot: DaySnapshot): Branch[];   // "everything on time": every risk branch at history base rate
export class Ledger { /* charge(kind: "manual" | "auto"): void; remaining(): number; reset(dayISO: string): void */ }
```

### Behavior

1. `readBranches` throws `PermissionDenied` if any input present in the snapshot is outside the grant (e.g. `commute` array non-empty while `grant.commute === "none"`).
2. Monte Carlo: `samples` (default 2,000) simulated days. Per sample: draw arrival delta from an empirical distribution built from `history.arrivalDeltasMin` widened by commute P50/P90; draw overruns from `overrunDeltasMin`; propagate overruns forward to later events; mark commitments slipped when remaining free minutes before `dueBy` < `estimatedMinutes`.
3. Aggregate per-subject frequencies into `Branch.probability`. Return `topK` (default 5) by probability, always including one `"clear"` branch with the probability that nothing breaks.
4. Every branch must have a non-empty `summary`. `ordinaryAction` is required for `late` and `commitment_slip`, optional otherwise.
5. Nothing is emitted with `windowEnd` beyond `now + 24h`.
6. Deterministic under a fixed seed.

### Fixtures

Create 30 synthetic days in `test/fixtures/days/*.json`, each with a snapshot **and** ground-truth outcomes (which events were late, overran, which commitments slipped). Generate them with a script (`scripts/gen-fixtures.ts`, seeded) so they are reproducible.

**Weighting (v0.1.1):** commute lateness is a commodity feature (native calendars already do time-to-leave), so Frost's differentiator is the branches nobody else predicts. Weight the fixture set accordingly:
- 12 days: **overrun cascade** — back-to-back meetings where one overrun knocks later events late; include at least 4 days where a `hardStop` event is the victim.
- 10 days: **commitment slip** — promises due today with shrinking free blocks; include days where an overrun *causes* the slip (cascade → slip coupling must be modeled, not independent).
- 5 days: commute lateness (long commutes, wide P50–P90 gaps).
- 3 days: sparse / clear days (engine must confidently return a high-probability `"clear"` branch — false alarms are a calibration failure too).

Add a test asserting the engine's Brier advantage over baseline holds *within* the cascade and slip subsets, not just overall.

### Done-criteria

- [ ] `pnpm --filter @frost/engine typecheck` passes (`tsc --noEmit`, strict, zero `any`).
- [ ] `pnpm --filter @frost/engine test` passes.
- [ ] Test: `readBranches` is deterministic for a fixed seed (two runs deep-equal).
- [ ] Test: horizon lock — no branch beyond 24 h on a fixture with events at +30 h.
- [ ] Test: `PermissionDenied` thrown when commute data present under `commute: "none"`.
- [ ] Test: across the 30 fixtures, engine Brier score < naive baseline Brier score by at least 0.05. Print both scores in test output.
- [ ] Test: `"clear"` branch always present; probabilities in [0, 1].
- [ ] `README.md` in `packages/engine` explaining the model in ≤ 300 words, honestly stating that synthetic calibration is not real-world calibration.
- [ ] CI green on GitHub Actions.

### Validation command

```bash
pnpm install && pnpm -r typecheck && pnpm -r test
```

### Report back

On completion, append a section `## Task 1 report` to this file with: engine vs baseline Brier scores, any type extensions made and why, and open questions for the next task (readers).

---

## 6. What NOT to touch

- Do not create `apps/mobile`, `packages/readers`, or `supabase/` beyond empty directories, if at all.
- Do not add network calls, environment variables, or API keys anywhere in `packages/engine`.
- Do not use an LLM or the Vercel AI SDK inside the engine for any purpose.
- Do not write code that mutates calendars, sends email, or triggers notifications — there is no such feature in Frost.
- Do not exceed the 24 h horizon or make it configurable.
- Do not "improve" the type definitions by widening them; extend only with a justifying comment.

---

## 7. Version

- **v0.1.0 — 2026-09-24.** Initial handoff. Scope: engine + calibration test.
- **v0.1.1 — 2026-09-24.** Fixtures reweighted toward overrun-cascade and commitment-slip days after competitor scan; subset Brier test added.
- **v0.1.2 — 2026-09-24.** Business model locked: free + OSS (engine MIT, app AGPL), revenue from Pro features and engine licensing; zero-marginal-cost constraint added.
- Next planned: v0.2.0 — `packages/readers` (Google Calendar, Maps Distance Matrix, Gmail commitment extraction via Vercel AI SDK).
