/** PLACEHOLDER rates, not NHANES data. Outstanding: brief §5 survey calibration with codebook verification. */
import { seededRng } from "@frost/engine";
import { FOOD_GROUPS, MEAL_SLOTS, loadPriors } from "../src/priors.js";
import type { EatingSnapshot, MealLog } from "../src/types.js";
import type { SlotOpportunity } from "../src/index.js";
export const ARCHETYPES = {
  high_variety:{groupRate:0.7,appetite:"typical"}, low_variety:{groupRate:0.2,appetite:"typical"},
  low_appetite:{groupRate:0.3,appetite:"low"}, selective:{groupRate:0.1,appetite:"selective"},
} as const;
export const PLACEHOLDER_LOGGING_PROBABILITY = 0.5;
export function generateFixtures(seed: number) {
  const random = seededRng(seed);
  return Object.entries(ARCHETYPES).map(([archetype,parameters])=>{
    const history: MealLog[] = [];
    for (let day=0;day<90;day++) {
      if (day % 9 === 0) continue; // Missing whole days are unknown.
      const date = new Date(Date.parse("2026-07-01T00:00:00Z") + day*86400000).toISOString().slice(0,10);
      for (const slot of MEAL_SLOTS) {
        if (random() >= PLACEHOLDER_LOGGING_PROBABILITY) continue;
        const recognized = day % 7 !== 0;
        history.push({id:`${archetype}-${day}-${slot}`,day:date,slot,recognized,
          groups:recognized?FOOD_GROUPS.filter(()=>random()<parameters.groupRate):[],eatenOut:null});
      }
    }
    const now="2026-09-29T00:00:00Z";
    const snapshot: EatingSnapshot = {now,horizonHours:24,history,today:[],lifestyle:{sleepHours:null,busyMinutes:null,activeMinutes:null},
      profile:{appetite:parameters.appetite},grant:{meals:"read",lifestyle:"none",connected_apps:"none"},priorsVersion:loadPriors().priorsVersion};
    const opportunities: SlotOpportunity[] = MEAL_SLOTS.map(slot=>({day:"2026-09-29",slot,windowStart:now,windowEnd:"2026-09-30T00:00:00Z"}));
    // Dinner deliberately missing; snack unrecognized. Resolutions preserve those unknowns.
    const outcomes: MealLog[] = MEAL_SLOTS.filter(slot=>slot!=="dinner").map(slot=>({id:`${archetype}-outcome-${slot}`,day:"2026-09-29",slot,
      recognized:slot!=="snack",groups:slot!=="snack"?FOOD_GROUPS.filter(()=>random()<parameters.groupRate):[],eatenOut:null}));
    return {archetype,snapshot,opportunities,outcomes};
  });
}
