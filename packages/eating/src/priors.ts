/** PLACEHOLDER, not NHANES data. Outstanding: brief §5 survey calibration with codebook verification. */
import { snapshotHash } from "@frost/engine";
import type { FoodGroup, MealSlot } from "./types.js";
export const FOOD_GROUPS: readonly FoodGroup[] = ["vegetables","fruits","legumes","grains","dairy","eggs","fish_seafood","meat_poultry","nuts_seeds","fermented","herbs_spices","fats_oils"];
export const MEAL_SLOTS: readonly MealSlot[] = ["breakfast","lunch","dinner","snack","other"];
export type PriorTable = Record<MealSlot, Record<FoodGroup, number>>;
const table = Object.fromEntries(MEAL_SLOTS.map(slot => [slot, Object.fromEntries(FOOD_GROUPS.map(group => [group, 0.5]))])) as PriorTable;
/** Single loader boundary: survey replacement changes table data, not forecasting code. */
export function loadPriors(input: PriorTable = table): { table: PriorTable; priorsVersion: string } {
  const copy = {} as PriorTable;
  for (const slot of MEAL_SLOTS) {
    copy[slot] = {} as Record<FoodGroup, number>;
    for (const group of FOOD_GROUPS) {
      const value = input[slot][group];
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError("Invalid prior");
      copy[slot][group] = value;
    }
    Object.freeze(copy[slot]);
  }
  Object.freeze(copy);
  return { table: copy, priorsVersion: snapshotHash(copy) };
}
