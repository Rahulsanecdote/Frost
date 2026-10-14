# Frost brief v0.2 — eating domain

Version 0.2.0-draft · 2026-10-13 · **DRAFT for Rahul's review.** No code is written from this brief until Rahul
approves it. It extends [`FROST_AGENTS.md`](FROST_AGENTS.md) (v0.1.2); where the two disagree, this file wins for
the eating domain and v0.1.2 still governs the calendar domain.

This repo is public. Nothing here describes a real person, and nothing here copies code, file paths or internal
documents from the private app that will consume Frost (below, "the host app").

---

## 0. Decisions this brief rests on (Rahul, 2026-10-13)

1. Frost becomes a forecasting engine for **eating habits and routines**. Calendar and commute are inputs to it,
   not the product.
2. The "Reading, not receiving" rule changes so that **population priors from public data** may be used (§2.1).
3. **Cross-user learning** is allowed later, and only after counsel signs off. It is out of scope here.

Relation to v0.1 Task 1: the engine Task 1 builds (seeded simulation, Brier scoring, permission checks) stays.
Its domain-neutral parts become the MIT core that this brief builds on (§8). Nothing in Task 1 is thrown away.

---

## 1. Scope

On-device forecasts of eating habits and routines over the next 24 hours.

### Branch kinds

| Kind | What it forecasts | Shown to the user? |
|---|---|---|
| `food_group_gap` | A food group stays absent from the person's logs for the rest of the window | Yes, as a gap, never as a deficiency |
| `no_log_in_slot` | A meal slot passes with nothing logged | **Never.** Internal signal only (§1.2) |
| `eating_out` | A meal is eaten away from home | Yes, once the host app records it. Needs an "eaten out" field on logged meals; until one exists, every outcome is *unknown* and the branch is not emitted. Never assume "at home" |
| `rebalance_gap` | Coupled same-day check: given what is already logged, which group would round out the day | Yes, framed as filling a gap, **never "eat less later"** |

### 1.1 Never

- Never a weight, body or health outcome. Never a nutrient amount or a "likely shortfall".
- Never an LLM, or any AI SDK, to produce or adjust a probability.
- Never a meal-timing prediction (§1.3).
- Never acting on anything: Frost returns forecasts and text. It does not schedule, notify, log or change state.
- Never producing or changing a calorie or macronutrient number. Plan and meal nutrition is always computed
  from food-composition data by the host app; Frost's outputs are probabilities and text, never nutrition values.
- Never generating a meal plan. Frost may inform which suggestions a plan offers (for example, a food group that
  is likely to stay missing today); the host app's planner chooses the meals, and its numbers come from food data.
- Never treating a single missed day as a break or a reset, in any branch, summary or internal signal. One miss
  does not undo a habit (Lally et al. 2010).

### 1.2 Hard rules from the gate (cuts Rahul approved)

1. **No Frost code in the host app before its December launch.** No reader, flag, dependency or PR in the host
   app's repo. Any Guide-style feature that ships before then ships as the host app's existing deterministic code.
2. **No meal-timing predictions.** The host app's meal timestamp records when a meal was *logged*, not when it
   was *eaten*. Timing forecasts wait until an "eaten at" field exists.
3. **No "likely nutrient shortfall" predictions.** They sit too close to the host app's health-claim ceiling and
   would need a dietitian's review first.
4. **No user-facing "you'll skip" messages.** `no_log_in_slot` may be used internally only, never as copy, and
   never at all for people with a low-appetite or selective-eater profile.
5. **No real people in this repo.** No family stories, weights, biographies or quotes. Personas are parameter
   archetypes only (§5).

### 1.3 Out of scope for v0.2

Meal timing, nutrient amounts, weight, cross-user learning, any server component, and all host-app integration
(listed in §9 so it isn't lost).

---

## 2. Rules that change from v0.1

Each change is stated explicitly. Every v0.1 rule not listed here still holds.

### 2.1 Reading, not receiving → narrow exception for public priors

v0.1: engine input is only the present snapshot and the user's own history.
v0.2: also allowed, and nothing else:

- **Static, versioned summary tables** derived offline from **NHANES/WWEIA** (what Americans eat, by meal and
  food group) and **ATUS** (when and where people eat).
- Tables are small (target: a few KB), checked into the repo as JSON with a generator script, and **never raw
  survey files**.
- Each table cites its source and cycle as NCHS and BLS terms require, and is **never used to re-identify**
  anyone or joined to individual records.
- Each table carries a content hash. **Every forecast records the priors' version hash** it used.
- No network: tables are bundled. No table is fetched at runtime.

### 2.2 Horizon

Stays at **24 hours**, not configurable. 7-, 30- and 90-day history windows are *inputs*, not horizon. No forecast
is emitted with a window ending more than 24 h after `now`.

### 2.3 Grant → per source

v0.1's grant (`calendar` / `commute` / `email`) becomes per source:

```ts
export interface Grant {
  meals: "read" | "none";           // logged meals and their food groups
  lifestyle: "read" | "none";       // sleep, water, activity, calendar busyness
  connected_apps: "read" | "none";  // data the host app received from linked fitness apps
}
```

Input present for a source whose grant is `"none"` throws `PermissionDenied`, as in v0.1.

### 2.4 Reads and the debt ledger → dropped for eating

No eating decision becomes irreversible within 30 minutes, so reflex reads and the read-debt ledger do not apply
to the eating domain. They remain in the calendar domain unchanged.

### 2.5 Server-held calibration aggregates → struck

v0.1 allowed anonymized calibration aggregates on a server. v0.2 removes that. Calibration data, resolutions and
branch logs **stay on the device** until (a) counsel has advised and (b) the person has opted in. Inferred eating
patterns count as consumer health data under Washington's My Health My Data Act and similar laws.

---

## 3. Types

Implement as written; extend only with a justifying comment (v0.1 rule). Each type below says why it exists.

```ts
/** Meal slots. Why: branches are per slot; "other" keeps unslotted logs from being dropped. */
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack" | "other";

/** The 12 food groups the host app uses. Why: gaps are per group. */
export type FoodGroup =
  | "vegetables" | "fruits" | "legumes" | "grains" | "dairy" | "eggs"
  | "fish_seafood" | "meat_poultry" | "nuts_seeds" | "fermented" | "herbs_spices" | "fats_oils";

/** A logged meal. Why: the only eating evidence Frost sees. No timing beyond the slot (§1.2.2). */
export interface MealLog {
  id: string;
  day: string;                       // ISO date, local
  slot: MealSlot;
  recognized: boolean;               // false = food not classified: its groups are unknown, not empty
  groups: FoodGroup[];               // [] with recognized: true = a food in no group (tea, salt, sweets)
  eatenOut: boolean | null;          // null = not recorded; never assumed false
}

/** Lifestyle inputs. Why: busy days and short sleep shift slot behaviour. All optional. */
export interface LifestyleInputs {
  sleepHours: number | null;
  busyMinutes: number | null;        // calendar time booked today, from the calendar domain
  activeMinutes: number | null;      // from connected apps, if granted
}

/** Coverage of a group over a window. Why: missing data must stay distinguishable from zero. */
export interface GroupCoverage {
  group: FoodGroup;
  daysObserved: number;              // days with at least one log
  daysWithGroup: number;
  // daysObserved === 0 means unknown; consumers must not read it as "never eats this group"
}

export interface EatingSnapshot {
  now: string;                       // ISO, supplied by caller, never Date.now()
  horizonHours: 24;
  history: MealLog[];                // up to 90 days
  today: MealLog[];
  lifestyle: LifestyleInputs;
  profile: { appetite: "typical" | "low" | "selective" };
  grant: Grant;
  priorsVersion: string;             // hash of the bundled priors tables
}

export interface EatingBranch {
  id: string;
  kind: "food_group_gap" | "no_log_in_slot" | "eating_out" | "rebalance_gap";
  subject: FoodGroup | MealSlot;
  probability: number;               // 0–1
  windowStart: string; windowEnd: string;
  internalOnly: boolean;             // true for every no_log_in_slot branch
  summary: string | null;            // null when internalOnly
  priorsVersion: string;
  snapshotHash: string;
}

/** Why three states: a slot with no log has no known outcome. */
export interface Resolution {
  branchId: string;
  occurred: true | false | null;     // null = unknown (nothing logged)
  resolvedAt: string;
}
```

**Missing data is never zero.** A day with no logs is unknown, not "ate nothing". An unrecognized food adds no
evidence for or against any group; it is not a gap. A group never observed is
unknown, not "never eaten". Any function that turns `null` into `0` or `false` is a bug.

**Scoring only resolved pairs.** Brier scores use only resolutions where `occurred !== null`. Every reported Brier
score is printed beside its **resolved share** (resolved ÷ all forecasts), so a high-quality score on 10% of
forecasts can't pass as a good model.

---

## 4. Engine method

Exact formulas wherever they exist; Monte Carlo only for coupled branches.

### 4.1 Single branches: beta-binomial shrinkage

For a binary event (e.g. "group *g* appears in slot *s*"):

- Population prior mean μ from the priors table (matched by slot and, where tables allow, by day type).
- Prior strength *m* (pseudo-observations), fixed per branch kind and stated in code with its reasoning.
- Prior: α₀ = μ·m, β₀ = (1−μ)·m.
- Person's history: *k* events in *n* **observed** opportunities (unknown days excluded from both).
- Posterior mean: p = (α₀ + k) / (m + n).

As history grows, the person's own rate dominates; with no history, the forecast is the population rate.

**Inputs are context features:** slot, weekday or weekend, and day type. Habits are associations between a
context and a response, so the context, not the clock or a streak count, is what predicts behaviour.

`food_group_gap` over the remaining slots of the window, assuming slot independence:
P(gap) = ∏ over remaining slots (1 − p_slot). Independence is an assumption; §6 tests calibration, and §4.2
handles the case where it clearly fails.

### 4.2 Coupled branches: Monte Carlo

`rebalance_gap` depends on several slots and groups together, so it is simulated: seeded draws of each
remaining slot from its posterior, then the gap check on each simulated day. Default 2,000 samples, as in v0.1.

### 4.3 Determinism

Same snapshot + same seed + same priors version → identical output. Each branch carries `snapshotHash`
(a stable hash of the canonicalised snapshot), and a test asserts deep equality across two runs keyed on it.

---

## 5. Synthetic generator

- `scripts/gen-eating-fixtures.ts`, seeded, reproducible.
- **Personas are parameter archetypes**, nothing more: `high_variety`, `low_variety`, `low_appetite`, `selective`.
  No names, ages, stories or weights.
- **Rates calibrated to the NHANES/WWEIA summary tables, with survey weights applied.** Variable names must be
  checked against the official codebooks for the cycle used: the gate's data review named them from memory.
- **NHANES measures eating, not logging.** People don't log every meal, so the logging probability has its own
  prior, which **starts flat** (uniform) until real logging data exists.
- Fixtures include ground-truth outcomes, including deliberately unresolved slots (`occurred: null`).

---

## 6. Tests (done-criteria)

- [ ] Determinism: two runs on one snapshot deep-equal; keyed on `snapshotHash`.
- [ ] Null-not-zero: fixtures with missing days and unmapped foods; no code path reads `null` as `0` or `false`.
- [ ] A no-log fixture resolves to `occurred: null` and is excluded from Brier.
- [ ] Brier score and resolved share **per branch kind**, printed in test output.
- [ ] Every forecast records `priorsVersion`; changing a table changes the hash.
- [ ] Text scan: no `summary` contains weight, body, health-outcome, nutrient-amount, medical or "you'll skip"
      language; every `no_log_in_slot` branch has `internalOnly: true` and `summary: null`; no branch of any kind
      targets "eat more" or "eat less" for `low_appetite` or `selective` profiles.
- [ ] Shadow/holdout path: a forecast is scored only if it was **never shown**. Shown forecasts nudge behaviour
      and so change their own outcome; scoring them would flatter the model.
- [ ] Horizon: no branch ends beyond `now + 24h`, including with history spanning 90 days.
- [ ] `PermissionDenied` for each source when data is present under a `"none"` grant.

Validation command, unchanged: `pnpm install && pnpm -r typecheck && pnpm -r test`.

---

## 7. Kill criterion (fixed before any code)

**Metric.** Brier *skill score* per branch kind: BSS = 1 − BS_model / BS_baseline.

**Baseline.** The stronger of:
- (a) persistence, or the person's own trailing base rate; and
- (b) the host app's existing deterministic rules (usual-slot frequency, food-group coverage gaps).
  The real competitor is the code the host app already has.

For `rebalance_gap`, baseline (b) is the host app's rule-based same-day rebalancer once it ships (planned for
after launch: it suggests a group that would round out the day and never says "eat less later"). Until it
exists, the `rebalance_gap` baseline is the stronger of persistence and the person's own base rate.

**Primary test** (decided by Rahul, 2026-10-14). The decision rests on `food_group_gap` alone, the most frequent
branch kind. The other kinds are scored and reported the same way but don't decide. Fifty beta users can't power
four separate tests: the gate's data review estimated about 70 for one comparison at a 0.01 gain.

**Margin** (decided by Rahul, 2026-10-14). For the primary test, ΔBrier = BS_baseline − BS_model, with a 95%
confidence interval clustered by user:
- **Pass:** ΔBrier ≥ 0.01 **and** the interval's lower bound is above zero.
- **Kill:** the interval's upper bound is below 0.01, so the forecast is confidently short of the margin.
- **Inconclusive, extend:** anything else. Re-check the power estimate with the real variance once the first two
  weeks of shadow data exist.

**Kill if any of:**
1. The primary test returns **kill** against baseline (b) at day 60.
2. It increases eat-more or eat-less prompts for low-appetite or selective-eater profiles.
3. Once the host app's Guide suggestions ship, their acceptance is no better than the deterministic version's.
   This criterion can't be measured before then and doesn't apply to the day-60 review.

**Why day 60.** Day 60 tests whether the forecasts are accurate, not whether anyone has formed a habit.
Individual habit change takes roughly 2–8 months, longer for complex behaviours (Lally et al. 2010), so
habit formation is not a kill criterion and no forecast may promise a timeline.

**Never scored:** comparisons between choices made by simulation ("what if you'd had dal"). They are
counterfactual and have no observed outcome.

---

## 8. Licensing and placement

| What | Where | Licence |
|---|---|---|
| Domain-neutral simulate, shrink and score code (`readBranches`-style core, beta-binomial, Brier/BSS, determinism helpers) | `packages/engine` | MIT |
| Eating policy (branch kinds, text rules), priors tables and their mapping, personas, fixture generator | `packages/eating` (new) | AGPL-3.0 |
| Host-app reader | **In the host app, never in Frost.** Not in `packages/readers`. | Host app's own |

**Decided by Rahul, 2026-10-14:** eating policy, priors mapping and personas live in Frost, under AGPL, in
`packages/eating`. Reason: they need public review and the synthetic tests live beside them. The host app may
import only MIT code, so at integration time the host app either re-implements the policy layer or receives a
separate licence from the copyright holder. That second route needs every contribution to be licensable, hence:

**CLA before outside contributions.** No external PR is merged until a contributor licence agreement is in place.

---

## 9. Later host-app integration (out of scope; post-launch; own plan gate including a UI gate)

Recorded so it isn't lost. None of this starts before the host app's December launch.

- A reader in the host app built on its existing per-day analytics vectors.
- A lazily loaded worker, modelled on the host app's existing insights worker, with its own bundle-budget lines:
  the main bundle has almost no headroom.
- The engine shipped compiled or vendored: the two repos use different TypeScript and Vitest major versions.
- An "eaten at" field: migration, row-level security, grants and a data-export entry.
- Opt-in consent (reusing the host app's existing derived-analytics consent) before anything leaves the device.
- A 20% holdout so §7 can be measured.
- Two constraints from the host app's existing design: stepping back from logging stays a Natural-mode-only
  behaviour; and food rotation already runs server-side in meal plans, so a forecast must never fight it.

---

## 10. Owner prerequisites (Rahul's)

- IP assignment of Frost to the company before Frost code is used commercially.
- Counsel's view on on-device inference of eating patterns under Washington's My Health My Data Act.
- CLA wording.

---

## 11. Version

- **v0.2.0-draft — 2026-10-13.** Eating domain. Public priors exception, per-source grants, ledger dropped for
  eating, server aggregates struck, three-state resolution, beta-binomial method, kill criterion. Awaiting
  Rahul's approval.
- **v0.2.0-draft, review 1 — 2026-10-14.** Rahul's decisions: kill margin, one primary test (`food_group_gap`),
  eating layer in Frost under AGPL. Guide-acceptance criterion deferred until Guide ships; `eating_out` waits
  for an eaten-out field.
