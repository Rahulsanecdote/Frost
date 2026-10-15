import { createHash } from "node:crypto";
import { describe, expect, expectTypeOf, it } from "vitest";
import { brierScore, canonicalJson, snapshotHash } from "@frost/engine";
import { forecastGaps, groupInSlot, loadPriors, PermissionDenied, resolveGap, scoreShadow, slotEvidence } from "../src/index.js";
import type { EatingSnapshot, MealLog, Resolution } from "../src/types.js";
import { generateFixtures } from "../scripts/gen-eating-fixtures.js";
const fixture=()=>generateFixtures(123)[0]!;
const meal=(patch:Partial<MealLog>={}):MealLog=>({id:"synthetic",day:"2026-09-28",slot:"lunch",recognized:true,groups:[],eatenOut:null,...patch});
describe("eating contracts",()=>{
  it("retains the specified literal and nullable types",()=>{
    expectTypeOf<EatingSnapshot["horizonHours"]>().toEqualTypeOf<24>();
    expectTypeOf<Resolution["occurred"]>().toEqualTypeOf<true|false|null>();
  });
  it("is deterministic keyed on snapshotHash and fixture seed",()=>{
    expect(generateFixtures(123)).toEqual(generateFixtures(123));
    const f=fixture(), a=forecastGaps(f.snapshot,f.opportunities), b=forecastGaps(f.snapshot,f.opportunities);
    expect(a).toEqual(b); expect(a.length).toBe(12);
    for(const branch of a){expect(branch.snapshotHash).toBe(snapshotHash(f.snapshot));expect(branch.priorsVersion).toBe(loadPriors().priorsVersion);}
  });
  it("uses the exact product with slot and day-type shrinkage",()=>{
    const f=fixture(); f.snapshot.history=[meal({day:"2026-09-28",groups:["vegetables"]}),meal({day:"2026-09-27",groups:[]})];
    const opportunities=f.opportunities.filter(s=>s.slot==="lunch" || s.slot==="dinner");
    const branch=forecastGaps(f.snapshot,opportunities).find(b=>b.subject==="vegetables")!;
    const priors=loadPriors().table;
    expect(branch.probability).toBeCloseTo((1-(4*priors.lunch.weekday.groups.vegetables.mu+1)/5)*(1-priors.dinner.weekday.groups.vegetables.mu));
  });
  it("missing days and unrecognized foods never become negative evidence",()=>{
    const f=fixture(), slot=f.opportunities.find(s=>s.slot==="lunch")!;
    expect(slotEvidence([],slot,"vegetables")).toEqual({k:0,n:0});
    expect(slotEvidence([meal({recognized:false,groups:["vegetables"]})],slot,"vegetables")).toEqual({k:0,n:0});
    expect(groupInSlot([],"vegetables")).toBeNull();
    expect(groupInSlot([meal(),meal({recognized:false})],"vegetables")).toBeNull();
    expect(groupInSlot([meal()],"vegetables")).toBe(false);
    expect(groupInSlot([meal({groups:["vegetables"]}),meal({recognized:false})],"vegetables")).toBe(true);
    f.snapshot.history=[]; const before=forecastGaps(f.snapshot,f.opportunities);
    f.snapshot.history=[meal({recognized:false})]; const after=forecastGaps(f.snapshot,f.opportunities);
    expect(after.map(b=>b.probability)).toEqual(before.map(b=>b.probability));
  });
  it("counts a slot once and suppresses already-filled groups",()=>{
    const f=fixture(), slot=f.opportunities.find(s=>s.slot==="lunch")!;
    expect(slotEvidence([meal(),meal({id:"second",groups:["fruits"]})],slot,"fruits")).toEqual({k:1,n:1});
    f.snapshot.today=[meal({day:"2026-09-29",groups:["fruits"]})];
    expect(forecastGaps(f.snapshot,f.opportunities).some(b=>b.subject==="fruits")).toBe(false);
  });
  it("resolves no-log and unclassified coverage as null, not false",()=>{
    const f=fixture(), branch=forecastGaps(f.snapshot,f.opportunities)[0]!;
    const unknown=resolveGap(branch,f.opportunities,[],branch.windowEnd);
    expect(unknown.occurred).toBeNull();
    expect(()=>resolveGap(branch,f.opportunities.slice(1),[],branch.windowEnd)).toThrow("do not match");
    expect(()=>resolveGap(branch,f.opportunities,[],f.snapshot.now)).toThrow("not complete");
    expect(brierScore([{probability:branch.probability,occurred:unknown.occurred}]).resolvedShare).toBe(0);
    const outcomes=f.opportunities.map(s=>meal({day:s.day,slot:s.slot}));
    expect(resolveGap(branch,f.opportunities,outcomes,branch.windowEnd).occurred).toBe(true);
    outcomes[0]!.recognized=false;
    expect(resolveGap(branch,f.opportunities,outcomes,branch.windowEnd).occurred).toBeNull();
    outcomes[1]!.groups=["vegetables"];
    expect(resolveGap(branch,f.opportunities,outcomes,branch.windowEnd).occurred).toBe(false);
  });
  it("binds the prior hash to its canonical table",()=>{
    const a=loadPriors(); const table=JSON.parse(JSON.stringify(a.table)) as typeof a.table;
    table.lunch.weekday.groups.vegetables.mu=0.6;const b=loadPriors(table);expect(a.priorsVersion).not.toBe(b.priorsVersion);
    const f=fixture();expect(()=>forecastGaps(f.snapshot,f.opportunities,b)).toThrow("Priors version mismatch");
  });
  for(const source of ["meals","lifestyle","connected_apps"] as const) it(`denies ${source} data under none`,()=>{
    const f=fixture();f.snapshot.grant[source]="none";
    if(source==="lifestyle")f.snapshot.lifestyle.sleepHours=0;
    if(source==="connected_apps")f.snapshot.lifestyle.activeMinutes=0;
    expect(()=>forecastGaps(f.snapshot,f.opportunities)).toThrow(PermissionDenied);
  });
  it("enforces the horizon even with ninety history days",()=>{
    const f=fixture();for(const branch of forecastGaps(f.snapshot,f.opportunities)) expect(Date.parse(branch.windowEnd)).toBeLessThanOrEqual(Date.parse(f.snapshot.now)+86400000);
    expect(()=>forecastGaps(f.snapshot,[{...f.opportunities[0]!,windowEnd:"2026-10-01T00:00:00Z"}])).toThrow("horizon");
    expect(forecastGaps(f.snapshot,[])).toEqual([]);
  });
  it("uses factual logging copy without likelihood or banned wording",()=>{
    const banned=/weight|body|health|nutrient|medical|deficien|shortfall|calorie|protein|carb|vitamin|iron|you['’]ll skip|eat more|eat less|reset|streak|likely|unlikely|probably|chance|forecast|predict|\d|%/i;
    let visible = 0;
    for(const f of generateFixtures(71))for(const branch of forecastGaps(f.snapshot,f.opportunities)){
      expect(branch.kind).toBe("food_group_gap");
      if(branch.internalOnly){expect(branch.summary).toBeNull();continue;}
      visible++;
      expect(branch.summary).toMatch(/^No .+ logged yet today\. There's room to add some if it fits your choices\.$/);
      expect(branch.summary).not.toMatch(banned);
    }
    expect(visible).toBe(18);
    const f=fixture();
    expect(forecastGaps(f.snapshot,f.opportunities).find(b=>b.subject==="vegetables")!.summary)
      .toBe("No vegetables logged yet today. There's room to add some if it fits your choices.");
  });
  for(const appetite of ["low","selective"] as const) it(`keeps every ${appetite} profile branch internal and scorable`,()=>{
    const f=fixture();const typical=forecastGaps(f.snapshot,f.opportunities);
    f.snapshot.profile.appetite=appetite;
    const branches=forecastGaps(f.snapshot,f.opportunities);
    expect(branches).toHaveLength(12);
    expect(branches.map(b=>b.probability)).toEqual(typical.map(b=>b.probability));
    for(const branch of branches){expect(branch.internalOnly).toBe(true);expect(branch.summary).toBeNull();}
    const pairs=branches.map(branch=>({branch,resolution:{branchId:branch.id,occurred:true,resolvedAt:branch.windowEnd},neverShown:true}));
    expect(scoreShadow(pairs)).toEqual(brierScore(typical.map(b=>({probability:b.probability,occurred:true}))));
  });
  it("never suggests fats/oils or herbs/spices for any profile but preserves scoring",()=>{
    for(const appetite of ["typical","low","selective"] as const){
      const f=fixture();f.snapshot.profile.appetite=appetite;
      const branches=forecastGaps(f.snapshot,f.opportunities).filter(b=>b.subject==="fats_oils" || b.subject==="herbs_spices");
      expect(branches).toHaveLength(2);
      for(const branch of branches){
        expect(branch.internalOnly).toBe(true);expect(branch.summary).toBeNull();
        expect(branch.probability).toBeGreaterThanOrEqual(0);expect(branch.probability).toBeLessThanOrEqual(1);
      }
      const pairs=branches.map(branch=>({branch,resolution:{branchId:branch.id,occurred:true,resolvedAt:branch.windowEnd},neverShown:true}));
      expect(scoreShadow(pairs).resolved).toBe(2);
    }
  });
  it("keeps fermented forecasts internal for every profile and still scores them",()=>{
    for(const appetite of ["typical","low","selective"] as const){
      const f=fixture();f.snapshot.profile.appetite=appetite;
      const branch=forecastGaps(f.snapshot,f.opportunities).find(b=>b.subject==="fermented")!;
      expect(branch).toBeDefined();expect(branch.internalOnly).toBe(true);expect(branch.summary).toBeNull();
      const resolution={branchId:branch.id,occurred:true,resolvedAt:branch.windowEnd};
      const score=scoreShadow([{branch,resolution,neverShown:true}]);
      expect(score.resolved).toBe(1);expect(score.resolvedShare).toBe(1);
      expect(score.score).toBeCloseTo((1-branch.probability)**2);
    }
  });
  it("scores only never-shown matching resolutions",()=>{
    const f=fixture(), branch=forecastGaps(f.snapshot,f.opportunities)[0]!;
    const resolution={branchId:branch.id,occurred:true,resolvedAt:branch.windowEnd};
    const score=scoreShadow([{branch,resolution,neverShown:true},{branch,resolution:{...resolution,occurred:false},neverShown:false}]);
    expect(score.total).toBe(1);expect(score.score).toBeCloseTo((1-branch.probability)**2);
  });
  it("prints food_group_gap plumbing scores with unknowns excluded",()=>{
    const pairs=generateFixtures(123).flatMap(f=>forecastGaps(f.snapshot,f.opportunities).map(branch=>({branch,resolution:resolveGap(branch,f.opportunities,f.outcomes,branch.windowEnd),neverShown:true})));
    const score=scoreShadow(pairs);
    expect(score.resolved).toBeGreaterThan(0);expect(score.resolvedShare).toBeLessThan(1);
    console.log(`food_group_gap: Brier=${score.score?.toFixed(6)}; resolved share=${score.resolvedShare.toFixed(6)} (${score.resolved}/${score.total}); synthetic fixtures — not evidence; plumbing check only; excluded from §7 kill criterion`);
  });
});

it("matches platform SHA-256 for multilingual and multi-block canonical snapshots",()=>{
  for(const value of [null,[null,true,"é","食","🌱"],{long:"a".repeat(1000)}])
    expect(snapshotHash(value)).toBe(createHash("sha256").update(canonicalJson(value)).digest("hex"));
});
