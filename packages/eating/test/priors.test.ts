import { expect, it, vi } from "vitest";
import { DAY_TYPES, FOOD_GROUPS, MEAL_SLOTS, forecastGaps, loadPriors } from "../src/index.js";
import { generateFixtures } from "../scripts/gen-eating-fixtures.js";
import bundled from "../priors/nhanes-wweia-2017-2020.json" with { type: "json" };
it("bundles all one hundred twenty validated aggregate cells and provenance flags",()=>{
  const loaded=loadPriors();let count=0;
  expect(loaded.priorsVersion).toBe(bundled.contentHash);
  expect(loaded.table).toEqual(bundled.table);
  for(const slot of MEAL_SLOTS)for(const dayType of DAY_TYPES){
    const context=loaded.table[slot][dayType];
    expect(context.n).toBeGreaterThan(0);expect(context.pooled).toBe(context.n<100);
    for(const group of FOOD_GROUPS){
      count++;const cell=context.groups[group];
      expect(cell.mu).toBeGreaterThanOrEqual(0);expect(cell.mu).toBeLessThanOrEqual(1);
      expect(cell.surveyDerived).toBe(group!=="fermented" && group!=="herbs_spices");
      if(!cell.surveyDerived)expect(cell.mu).toBe(0.5);
    }
  }
  expect(count).toBe(120);
});
it("matches weekday versus weekend prior means with no personal evidence",()=>{
  const f=generateFixtures(7)[0]!;f.snapshot.history=[];
  for(const [day,dayType] of [["2026-09-29","weekday"],["2026-10-03","weekend"]] as const){
    f.snapshot.now=day+"T00:00:00Z";
    const slots=[{day,slot:"breakfast" as const,windowStart:f.snapshot.now,windowEnd:day+"T23:00:00Z"}];
    const branches=forecastGaps(f.snapshot,slots);
    for(const branch of branches){
      const group=FOOD_GROUPS.find(g=>g===branch.subject)!;
      expect(branch.probability).toBeCloseTo(1-loadPriors().table.breakfast[dayType].groups[group].mu,12);
    }
  }
  expect(loadPriors().table.breakfast.weekday.groups.fruits.mu).not.toBe(loadPriors().table.breakfast.weekend.groups.fruits.mu);
});
it("round-trips pooled and not-survey-derived flags and rejects invalid means",()=>{
  const table=structuredClone(loadPriors().table);
  table.other.weekend.n=20;table.other.weekend.pooled=true;
  const loaded=loadPriors(table);
  expect(loaded.table.other.weekend.pooled).toBe(true);
  expect(loaded.table.other.weekend.groups.fermented.surveyDerived).toBe(false);
  expect(Object.isFrozen(loaded.table.other.weekend.groups.fruits)).toBe(true);
  table.other.weekend.groups.fruits.mu=1.1;
  expect(()=>loadPriors(table)).toThrow("Invalid prior");
});
it("changing only a prior mean changes its version",()=>{
  const original=loadPriors(),table=structuredClone(original.table);
  table.breakfast.weekend.groups.fruits.mu+=0.001;
  expect(loadPriors(table).priorsVersion).not.toBe(original.priorsVersion);
});

it("loads bundled priors and forecasts without fetching data",()=>{
  const unavailable=vi.fn(()=>{throw new Error("Network unavailable");});
  vi.stubGlobal("fetch",unavailable);
  try {
    const f=generateFixtures(7)[0]!;
    expect(forecastGaps(f.snapshot,f.opportunities)).toHaveLength(12);
    expect(unavailable).not.toHaveBeenCalled();
  } finally {vi.unstubAllGlobals();}
});
