# Eating priors and core (AGPL-3.0-only)

## Survey release and population

Bundled priors use **NHANES/WWEIA 2017–March 2020 Prepandemic**, the newest paired individual-foods and FPED release on the [USDA download page](https://www.ars.usda.gov/northeast-area/beltsville-md-bhnrc/beltsville-human-nutrition-research-center/food-surveys-research-group/docs/fped-databases/) when generated. Newer dietary files exist, but a matching newer FPED is not listed. Use only this release’s matched FPED, which corrects older assignments and maps additional foods as described in the [release documentation](https://www.ars.usda.gov/ARSUserFiles/80400530/pdf/fped/FPED%20for%20Use%20with%20WWEIA%20NHANES%202017-March%202020%20Prepandemic%20Documentation.pdf).

The population is reliable Day One recalls for ages thirteen and over, with a positive day-one dietary weight. The age restriction is a modelling choice, not a validated population for personalized forecasting. The status code must be one: reliable, first four recall steps completed, foods identified for each reported occasion. Recall weights are applied once per respondent-slot after collapsing all its food lines. Raw records and respondent identifiers never appear in the output, are not committed, and are never joined to the bundled aggregate table. No re-identification is attempted.

The event is group presence conditional on that slot being reported on that recall day. Any positive FPED equivalent consumed in the slot establishes presence. A missing slot contributes neither numerator nor denominator. This describes recalled eating, **not logging probability**, usual intake, individual outcomes or forecast calibration.

Weekday is Monday–Friday and weekend Saturday–Sunday, from intake day codes two through six versus one/seven. This is the requested context split, distinct from the Friday–Sunday definition used in the dietary-weight documentation. Day-one weights are used as published without rescaling by occasion count.

## Official variables

| Variable | Use and official codebook |
|---|---|
| `DR1DAY` | Intake day of week; [codebook](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_DR1IFF.htm#DR1DAY) |
| `DR1DRSTZ` | Recall reliability; retain code one; [codebook](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_DR1IFF.htm#DR1DRSTZ) |
| `DR1IFDCD` | Food code for matched FPED lookup; [codebook](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_DR1IFF.htm#DR1IFDCD) |
| `DR1IGRMS` | Consumed quantity; a positive food equivalent requires positive consumption; [codebook](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_DR1IFF.htm#DR1IGRMS) |
| `DR1_030Z` | Eating-occasion code; [codebook](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_DR1IFF.htm#DR1_030Z) |
| `RIDAGEYR` | Age at screening; thirteen and over; [codebook](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_DEMO.htm#RIDAGEYR) |
| `SEQN` | Public-use key for the offline dietary/demographic linkage; never exported; [codebook](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_DR1IFF.htm#SEQN) |
| `WTDRD1PP` | Day-one dietary sample weight; [codebook](https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_DR1IFF.htm#WTDRD1PP) |

## Occasion mapping

These are semantic slot mappings, not inferred eating times. Brunch is assigned to breakfast; Almuerzo and Comida to lunch; Cena and Supper to dinner. This is a declared modelling choice. Labels below retain the official codebook spelling.

| Code | Codebook occasion | Slot |
|---|---|---|
| 1 | Breakfast | `breakfast` |
| 10 | Desayano | `breakfast` |
| 11 | Almuerzo | `lunch` |
| 12 | Comida | `lunch` |
| 13 | Merienda | `snack` |
| 14 | Cena | `dinner` |
| 15 | Entre comida | `snack` |
| 16 | Botana | `snack` |
| 17 | Bocadillo | `snack` |
| 18 | Tentempie | `snack` |
| 19 | Bebida | `other` |
| 2 | Lunch | `lunch` |
| 3 | Dinner | `dinner` |
| 4 | Supper | `dinner` |
| 5 | Brunch | `breakfast` |
| 6 | Snack | `snack` |
| 7 | Drink | `other` |
| 8 | Infant feeding | `other` |
| 9 | Extended consumption | `other` |
| 91 | Other | `other` |
| 99 | Don't know | `other` |
| Missing | Missing | Reject; never silently treat as absence |

## FPED group mapping

Exact per-hundred-gram variable names are verified against the matched spreadsheet’s `Variable_labels` sheet and the [amended methodology, Appendix Four](https://www.ars.usda.gov/ARSUserFiles/80400530/pdf/fped/Amended%20FPED%202017-2018%20documentation%20for%20Use%20with%20WWEIA%20NHANES%202017-March%202020%20Prepandemic.pdf#page=76). Presence is any component above zero with positive consumed quantity; summing positive components for the event does not combine their different equivalent units into a nutrition amount.

| Group | FPED components |
|---|---|
| `dairy` | `D_TOTAL` |
| `eggs` | `PF_EGGS` |
| `fats_oils` | `OILS`, `SOLID_FATS` |
| `fermented` | **PLACEHOLDER: flat zero-point-five, not survey-derived** |
| `fish_seafood` | `PF_SEAFD_HI`, `PF_SEAFD_LOW` |
| `fruits` | `F_TOTAL` |
| `grains` | `G_TOTAL` |
| `herbs_spices` | **PLACEHOLDER: flat zero-point-five, not survey-derived** |
| `legumes` | `PF_LEGUMES` |
| `meat_poultry` | `PF_MEAT`, `PF_CUREDMEAT`, `PF_ORGAN`, `PF_POULT` |
| `nuts_seeds` | `PF_NUTSDS` |
| `vegetables` | `V_TOTAL` |

Vegetable total excludes legumes in this FPED. Legumes use its separate protein-equivalent component; soy products are not reassigned to it. Dairy total includes the soy beverages assigned there by FPED; nuts/seeds follow FPED’s exclusions. Both oils and solid fats exist in this release and are included in fats/oils. These are operational FPED mappings, not new food-code classifications.

Fermented foods and herbs/spices have no defensible FPED component. Their means remain **PLACEHOLDER zero-point-five**, with `surveyDerived: false` in every context. No invented food-code list is used.

## Small cells and precision

The unweighted count is distinct Day One respondent-slot recalls, not food lines. A context with fewer than one hundred uses its slot’s pooled weekday-plus-weekend weighted value and retains its original count with `pooled: true`. All current cells exceed the threshold; **no cells are pooled**.

| Slot | Weekday recalls | Weekend recalls |
|---|---:|---:|
| breakfast | 4598 | 2885 |
| dinner | 5033 | 3228 |
| lunch | 4225 | 2570 |
| other | 3799 | 2437 |
| snack | 4251 | 2718 |

Means are rounded to nine decimal places. Design-based standard errors are **not estimated**. These descriptive means do not quantify survey uncertainty or demonstrate forecast skill. Component positivity uses the published spreadsheet’s precision, including its rounded zeros.

## Selected prior means

| Group | Breakfast weekday | Breakfast weekend | Dinner weekday | Dinner weekend |
|---|---:|---:|---:|---:|
| dairy | 0.6486 | 0.6251 | 0.6111 | 0.6563 |
| eggs | 0.3470 | 0.4092 | 0.3550 | 0.3585 |
| fats_oils | 0.8952 | 0.8907 | 0.9744 | 0.9832 |
| fermented | 0.5000 | 0.5000 | 0.5000 | 0.5000 |
| fish_seafood | 0.0073 | 0.0093 | 0.1053 | 0.0996 |
| fruits | 0.3931 | 0.3453 | 0.1981 | 0.2193 |
| grains | 0.7234 | 0.7187 | 0.8392 | 0.8586 |
| herbs_spices | 0.5000 | 0.5000 | 0.5000 | 0.5000 |
| legumes | 0.0236 | 0.0327 | 0.1098 | 0.1125 |
| meat_poultry | 0.2217 | 0.2795 | 0.7565 | 0.7475 |
| nuts_seeds | 0.1595 | 0.1234 | 0.0872 | 0.0816 |
| vegetables | 0.1878 | 0.2229 | 0.8390 | 0.8405 |

Fermented and herbs/spices are non-survey placeholders; rounded display above does not change stored means.

## Reproduce byte for byte

Run from this package directory using Python three-point-ten or later with the pinned requirements. Source URLs and observed SHA-two-fifty-six checksums are hard-coded in the generator; any changed source stops generation. The recorded generation date is a fixed release field, not an ambient clock. A fresh source release must be explicitly reviewed rather than accepted automatically.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/priors/requirements.txt
.venv/bin/python scripts/priors/generate.py
.venv/bin/python scripts/priors/generate.py --offline --out .cache/reproduced.json
cmp priors/nhanes-wweia-2017-2020.json .cache/reproduced.json
```

The first generator invocation downloads missing files into `.cache/priors/`; `--offline` forbids downloads. Both paths verify checksums before parsing. Raw public-use survey and FPED files stay ignored. The generator is not invoked by CI or tests. Normal application code imports bundled JSON with no network or filesystem reads.

`loadPriors` is the sole runtime boundary. It validates, copies and freezes slot × day-type × group means and flags. `priorsVersion` is SHA-two-fifty-six of canonical JSON for the `table` member, including context counts and provenance flags; `contentHash` stores that same value. Citation metadata and generation date are outside this hash. The loader checks the bundled hash. Changing a cell or flag changes the version; each branch records it and its snapshot hash.

## Forecasting and fixtures

For each remaining caller-supplied slot, history is grouped by local day and slot, matching weekday/weekend. A recognized group presence is positive evidence; absence is evidence only when every food in that logged slot is recognized. Missing slots and unclassified foods are unknown. Four pseudo-opportunities provide shrinkage toward the matched survey mean. Gap probability remains the exact product of per-slot absence probabilities, assuming independence. Only the mean lookup acquired a day-type dimension; the formula and visibility policy are unchanged.

Callers supply remaining slot opportunities and observation bounds inside now plus twenty-four hours; Frost does not infer meal timing. Today’s recognized groups suppress already-filled gaps. Resolutions preserve unknown coverage. Active minutes belong to connected-app permission; sleep and busyness belong to lifestyle permission. Denied-source data throws.

Visible summaries state only what has not been logged: “No <label> logged yet today. There's room to add some if it fits your choices.” Probability stays numeric. Every low/selective-profile branch, and fats/oils, herbs/spices and fermented foods for every profile, is internal-only with a null summary. Fermented foods and herbs/spices stay internal because their priors are not survey-derived. These remain forecast and scorable. Shadow scoring requires explicit never-shown provenance.

Synthetic archetypes apply illustrative rate multipliers around each survey-derived mean; they are not empirically estimated archetype distributions. Unsupported groups remain flat. Logging probability stays **PLACEHOLDER flat one-half** and independent of archetype until real logging evidence exists. Missing days, unclassified foods and unresolved slots remain deliberate fixtures. Scores are labelled **synthetic fixtures — not evidence**, are plumbing checks only, and do not feed the brief’s primary-test kill criterion.

Deferred: design-based variance, survey-to-person calibration, real shadow evaluation, ATUS, finer day types, meal timing, other branch kinds and integrations. The MIT engine is untouched.

## Citations

- National Center for Health Statistics. National Health and Nutrition Examination Survey, 2017–March 2020 Prepandemic: Dietary Interview, Individual Foods, First Day and Demographics. Hyattsville, MD: Centers for Disease Control and Prevention.
- Waller AW, Friday JE, Morton S, Myrowitz R, Moshfegh AJ. 2023. Food Patterns Equivalents Database for Use with WWEIA, NHANES 2017-March 2020 Prepandemic. USDA Agricultural Research Service, Food Surveys Research Group. July 2023.
- https://www.ars.usda.gov/ARSUserFiles/80400530/pdf/fped/Amended%20FPED%202017-2018%20documentation%20for%20Use%20with%20WWEIA%20NHANES%202017-March%202020%20Prepandemic.pdf
