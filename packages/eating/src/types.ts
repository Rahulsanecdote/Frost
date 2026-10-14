export interface Grant {
  meals: "read" | "none";           // logged meals and their food groups
  lifestyle: "read" | "none";       // sleep, water, activity, calendar busyness
  connected_apps: "read" | "none";  // data the host app received from linked fitness apps
}

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
