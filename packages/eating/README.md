# Eating core (AGPL-3.0-only)

PLACEHOLDER priors and generator rates: these are not NHANES data. Brief §5 survey calibration, including survey weights and official cycle codebook verification, remains outstanding for a follow-up slice.

`loadPriors` is the sole prior-data boundary. It validates, copies and freezes a flat slot × group table, then hashes its canonical JSON with SHA-256. Replacing survey data changes the table rather than forecasting logic. Snapshots must carry the matching hash.

Only `food_group_gap` is emitted. For each remaining caller-supplied slot, observations are grouped by local day and slot, matching weekday/weekend. A recognized group presence is positive evidence; absence is evidence only when every food in that logged slot is recognized. Missing slots and unclassified foods are unknown. Four prior pseudo-opportunities provide modest shrinkage. The gap probability is the exact product of per-slot absence probabilities, assuming independence.

Visible summaries state only what has not been logged: “No <label> logged yet today. There's room to add some if it fits your choices.” Likelihood is expressed only by the numeric probability. For appetite profiles `low` and `selective`, every emitted branch is `internalOnly: true` with `summary: null`. The `fats_oils` and `herbs_spices` groups are always internal with null summaries, for every profile; they are never suggested. Internal branches remain forecast and scorable under the same never-shown scoring rule, with unchanged probabilities.

Callers supply remaining slot opportunities and their observation-window bounds; Frost does not predict meal timing or infer it from log timestamps. Bounds must fit within the supplied now plus twenty-four hours. The snapshot's ISO local dates determine weekday/weekend. Today’s recognized groups suppress already-filled gaps. History is prior-day evidence. No logs produce an unknown resolution; a known group presence resolves the gap false, and complete recognized absence resolves it true.

`activeMinutes` belongs to connected-app permission; sleep and busyness belong to lifestyle permission. Data under a denied source throws. Forecasts carry snapshot and prior hashes. Explicit `neverShown` provenance is required for shadow scoring; shown records are excluded.

Fixture scores are a **placeholder rates — not evidence** plumbing check. Nothing in this slice feeds brief §7’s kill criterion. There is no live baseline comparison or production calibration.

Deferred: §5 survey calibration; all other eating branches; coupled simulation; real priors; meal timing; external integrations; and production shadow evaluation. Engine helpers remain MIT; eating policy and fixtures remain AGPL-3.0-only.
