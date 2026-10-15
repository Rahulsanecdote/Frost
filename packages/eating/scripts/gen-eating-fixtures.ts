/** Synthetic archetype rates scaled around bundled weighted survey means, not empirical archetype estimates.
 * PLACEHOLDER: flat logging probability; fermented/herbs_spices have no survey-derived component. */
import { seededRng } from "@frost/engine";
import { FOOD_GROUPS, MEAL_SLOTS, loadPriors } from "../src/priors.js";
import type { EatingSnapshot, MealLog } from "../src/types.js";
import type { SlotOpportunity } from "../src/index.js";
export const ARCHETYPES = {
  high_variety:{rateScale:1.4,appetite:"typical"}, low_variety:{rateScale:0.6,appetite:"typical"},
  low_appetite:{rateScale:0.85,appetite:"low"}, selective:{rateScale:0.45,appetite:"selective"},
} as const;
export const PLACEHOLDER_LOGGING_PROBABILITY = 0.5;
export function generateFixtures(seed: number) {
  const random = seededRng(seed);
  const priors = loadPriors();
  const groupRate = (day: string, slot: (typeof MEAL_SLOTS)[number], group: (typeof FOOD_GROUPS)[number], scale: number): number => {
    const weekday = new Date(day).getUTCDay();
    const cell = priors.table[slot][weekday === 0 || weekday === 6 ? "weekend" : "weekday"].groups[group];
    return cell.surveyDerived ? Math.min(1, cell.mu * scale) : cell.mu;
  };
  return Object.entries(ARCHETYPES).map(([archetype,parameters])=>{
    const history: MealLog[] = [];
    for (let day=0;day<90;day++) {
      if (day % 9 === 0) continue; // Missing whole days are unknown.
      const date = new Date(Date.parse("2026-07-01T00:00:00Z") + day*86400000).toISOString().slice(0,10);
      for (const slot of MEAL_SLOTS) {
        if (random() >= PLACEHOLDER_LOGGING_PROBABILITY) continue;
        const recognized = day % 7 !== 0;
        history.push({id:`${archetype}-${day}-${slot}`,day:date,slot,recognized,
          groups:recognized?FOOD_GROUPS.filter(group=>random()<groupRate(date,slot,group,parameters.rateScale)):[],eatenOut:null});
      }
    }
    const now="2026-09-29T00:00:00Z";
    const snapshot: EatingSnapshot = {now,horizonHours:24,history,today:[],lifestyle:{sleepHours:null,busyMinutes:null,activeMinutes:null},
      profile:{appetite:parameters.appetite},grant:{meals:"read",lifestyle:"none",connected_apps:"none"},priorsVersion:loadPriors().priorsVersion};
    const opportunities: SlotOpportunity[] = MEAL_SLOTS.map(slot=>({day:"2026-09-29",slot,windowStart:now,windowEnd:"2026-09-30T00:00:00Z"}));
    // Dinner deliberately missing; snack unrecognized. Resolutions preserve those unknowns.
    const outcomes: MealLog[] = MEAL_SLOTS.filter(slot=>slot!=="dinner").map(slot=>({id:`${archetype}-outcome-${slot}`,day:"2026-09-29",slot,
      recognized:slot!=="snack",groups:slot!=="snack"?FOOD_GROUPS.filter(group=>random()<groupRate("2026-09-29",slot,group,parameters.rateScale)):[],eatenOut:null}));
    return {archetype,snapshot,opportunities,outcomes};
  });
}
