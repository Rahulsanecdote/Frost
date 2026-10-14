export type * from "./types.js";
export * from "./priors.js";
import { brierScore, posteriorMean, snapshotHash } from "@frost/engine";
import type { Score } from "@frost/engine";
import { FOOD_GROUPS, loadPriors } from "./priors.js";
import type { EatingBranch, EatingSnapshot, FoodGroup, Grant, MealLog, MealSlot, Resolution } from "./types.js";

// Four pseudo-opportunities keep sparse histories near the placeholder prior while allowing personal evidence to dominate.
export const PRIOR_STRENGTH = 4;
export class PermissionDenied extends Error {
  constructor(public readonly source: keyof Grant) { super(`PermissionDenied: ${source}`); this.name = "PermissionDenied"; }
}
export function enforceGrants(snapshot: EatingSnapshot): void {
  if (snapshot.grant.meals === "none" && (snapshot.history.length || snapshot.today.length)) throw new PermissionDenied("meals");
  if (snapshot.grant.lifestyle === "none" && (snapshot.lifestyle.sleepHours !== null || snapshot.lifestyle.busyMinutes !== null)) throw new PermissionDenied("lifestyle");
  // The only connected-app datum in §3 is activeMinutes. It belongs solely to this source.
  if (snapshot.grant.connected_apps === "none" && snapshot.lifestyle.activeMinutes !== null) throw new PermissionDenied("connected_apps");
}
/** Extension: caller-supplied slot opportunities avoid inferring meal times from logging timestamps.
 * Windows are observation bounds, not predicted eating times. ISO dates use the caller's local calendar. */
export interface SlotOpportunity { day: string; slot: MealSlot; windowStart: string; windowEnd: string }
function instant(value: string): number {
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new RangeError("Timestamp requires an explicit offset");
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new RangeError("Invalid timestamp");
  return ms;
}
function weekend(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10) !== day) throw new RangeError("Invalid local day");
  const weekday = new Date(day).getUTCDay(); return weekday === 0 || weekday === 6;
}
function validateOpportunities(snapshot: EatingSnapshot, slots: readonly SlotOpportunity[]): void {
  const now = instant(snapshot.now); const seen = new Set<string>();
  if (snapshot.horizonHours !== 24) throw new RangeError("Horizon must be twenty-four hours");
  for (const opportunity of slots) {
    weekend(opportunity.day);
    const start = instant(opportunity.windowStart), end = instant(opportunity.windowEnd);
    if (start < now || end <= start || end > now + 24 * 3600000) throw new RangeError("Opportunity outside horizon");
    const key = opportunity.day + ":" + opportunity.slot;
    if (seen.has(key)) throw new RangeError("Duplicate slot opportunity"); seen.add(key);
  }
}
/** Unknown logs never supply positive or negative evidence. Multiple logs form one slot opportunity.
 * A known presence resolves true even beside unknown foods; absence needs every food classified. */
export function groupInSlot(logs: readonly MealLog[], group: FoodGroup): boolean | null {
  if (logs.some(log => log.recognized && log.groups.includes(group))) return true;
  if (!logs.length || logs.some(log => !log.recognized)) return null;
  return false;
}
export function slotEvidence(history: readonly MealLog[], opportunity: SlotOpportunity, group: FoodGroup): { k: number; n: number } {
  const days = new Map<string, MealLog[]>();
  for (const log of history) {
    if (log.day >= opportunity.day || log.slot !== opportunity.slot || weekend(log.day) !== weekend(opportunity.day)) continue;
    const bucket = days.get(log.day) ?? []; bucket.push(log); days.set(log.day,bucket);
  }
  let k = 0, n = 0;
  for (const logs of days.values()) { const event = groupInSlot(logs,group); if (event === null) continue; n++; if (event) k++; }
  return { k, n };
}
const labels: Record<FoodGroup,string> = {
  vegetables:"vegetables",fruits:"fruit",legumes:"legumes",grains:"grains",dairy:"dairy",eggs:"eggs",
  fish_seafood:"fish or seafood",meat_poultry:"meat or poultry",nuts_seeds:"nuts or seeds",fermented:"fermented foods",herbs_spices:"herbs or spices",fats_oils:"fats or oils",
};
export function forecastGaps(snapshot: EatingSnapshot, opportunities: readonly SlotOpportunity[], priors = loadPriors()): EatingBranch[] {
  enforceGrants(snapshot); validateOpportunities(snapshot,opportunities);
  // Validate supplied loader output and bind the caller's snapshot to precisely the same table.
  const loaded = loadPriors(priors.table);
  if (priors.priorsVersion !== loaded.priorsVersion || snapshot.priorsVersion !== loaded.priorsVersion) throw new RangeError("Priors version mismatch");
  if (!opportunities.length) return [];
  const hash = snapshotHash(snapshot);
  const slots = [...opportunities].sort((a,b)=>a.day.localeCompare(b.day)||a.slot.localeCompare(b.slot));
  const end = new Date(Math.max(...slots.map(slot=>instant(slot.windowEnd)))).toISOString();
  return FOOD_GROUPS.filter(group=>!snapshot.today.some(log=>log.recognized && log.groups.includes(group))).map(group=>{
    const probability = slots.reduce((product,slot)=>{
      const {k,n} = slotEvidence(snapshot.history,slot,group);
      return product * (1 - posteriorMean(loaded.table[slot.slot][group],PRIOR_STRENGTH,k,n));
    },1);
    // Visibility policy does not alter the forecast probability or its scoring eligibility.
    const internalOnly = snapshot.profile.appetite !== "typical" || group === "fats_oils" || group === "herbs_spices";
    return { id:snapshotHash({snapshotHash:hash,priorsVersion:loaded.priorsVersion,group,slots}),kind:"food_group_gap",subject:group,probability,
      windowStart:snapshot.now,windowEnd:end,internalOnly,
      summary:internalOnly ? null : `No ${labels[group]} logged yet today. There's room to add some if it fits your choices.`,
      priorsVersion:loaded.priorsVersion,snapshotHash:hash };
  });
}
/** Extension: outcome logs are supplied separately; unknown coverage is never inferred as absence. */
export function resolveGap(branch: EatingBranch, opportunities: readonly SlotOpportunity[], outcomeLogs: readonly MealLog[], resolvedAt: string): Resolution {
  if (branch.kind !== "food_group_gap" || !FOOD_GROUPS.includes(branch.subject as FoodGroup)) throw new RangeError("Unsupported branch");
  if (instant(resolvedAt) < instant(branch.windowEnd)) throw new RangeError("Window not complete");
  if (!opportunities.length) return {branchId:branch.id,occurred:null,resolvedAt};
  const slots = [...opportunities].sort((a,b)=>a.day.localeCompare(b.day)||a.slot.localeCompare(b.slot));
  // Bind resolutions to the exact opportunity set used for this forecast, not a convenient subset.
  const expectedId = snapshotHash({snapshotHash:branch.snapshotHash,priorsVersion:branch.priorsVersion,group:branch.subject,slots});
  if (branch.id !== expectedId) throw new RangeError("Resolution opportunities do not match forecast");
  const outcomes = slots.map(slot=>groupInSlot(outcomeLogs.filter(log=>log.day===slot.day && log.slot===slot.slot),branch.subject as FoodGroup));
  const occurred = outcomes.includes(true) ? false : outcomes.includes(null) ? null : true;
  return {branchId:branch.id,occurred,resolvedAt};
}
/** Extension: explicit exposure provenance. Only never-shown observations belong in shadow scoring. */
export interface ShadowPair { branch: EatingBranch; resolution: Resolution; neverShown: boolean }
export function scoreShadow(pairs: readonly ShadowPair[]): Score {
  const shadow = pairs.filter(pair=>pair.neverShown);
  for (const pair of shadow) if (pair.branch.id !== pair.resolution.branchId) throw new RangeError("Resolution does not match branch");
  return brierScore(shadow.map(pair=>({probability:pair.branch.probability,occurred:pair.resolution.occurred})));
}
