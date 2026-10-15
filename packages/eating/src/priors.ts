/** Bundled NHANES/WWEIA aggregate priors. Fermented and herbs_spices are PLACEHOLDER, not survey-derived. */
import bundled from "../priors/nhanes-wweia-2017-2020.json" with { type: "json" };
import { snapshotHash } from "@frost/engine";
import type { FoodGroup, MealSlot } from "./types.js";
export const FOOD_GROUPS: readonly FoodGroup[] = ["vegetables","fruits","legumes","grains","dairy","eggs","fish_seafood","meat_poultry","nuts_seeds","fermented","herbs_spices","fats_oils"];
export const MEAL_SLOTS: readonly MealSlot[] = ["breakfast","lunch","dinner","snack","other"];
export type DayType = "weekday" | "weekend";
export interface PriorCell { mu: number; surveyDerived: boolean }
export interface PriorContext { n: number; pooled: boolean; groups: Record<FoodGroup, PriorCell> }
export type PriorTable = Record<MealSlot, Record<DayType, PriorContext>>;
export const DAY_TYPES: readonly DayType[] = ["weekday", "weekend"];
/** Single loader boundary: validates and freezes bundled aggregates, including their provenance flags.
 * Custom tables remain supported for offline testing; bundled content is verified against its stored hash. */
export function loadPriors(input: PriorTable = bundled.table): { table: PriorTable; priorsVersion: string } {
  const copy = {} as PriorTable;
  for (const slot of MEAL_SLOTS) {
    copy[slot] = {} as Record<DayType, PriorContext>;
    for (const dayType of DAY_TYPES) {
      const context = input[slot][dayType];
      if (!Number.isInteger(context.n) || context.n < 0 || typeof context.pooled !== "boolean") throw new RangeError("Invalid prior context");
      const groups = {} as Record<FoodGroup, PriorCell>;
      for (const group of FOOD_GROUPS) {
        const cell = context.groups[group];
        if (!Number.isFinite(cell.mu) || cell.mu < 0 || cell.mu > 1 || typeof cell.surveyDerived !== "boolean") throw new RangeError("Invalid prior");
        groups[group] = Object.freeze({ mu: cell.mu, surveyDerived: cell.surveyDerived });
      }
      copy[slot][dayType] = Object.freeze({n: context.n, pooled: context.pooled, groups: Object.freeze(groups)});
    }
    Object.freeze(copy[slot]);
  }
  Object.freeze(copy);
  const priorsVersion = snapshotHash(copy);
  if (input === bundled.table && priorsVersion !== bundled.contentHash) throw new RangeError("Bundled prior content hash mismatch");
  return { table: copy, priorsVersion };
}
