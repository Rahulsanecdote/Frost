import { expect, it } from "vitest";
import { brierScore, brierSkillScore, canonicalJson, posteriorMean, seededRng, snapshotHash } from "../src/index.js";
it("uses reproducible seeded draws",()=>{
  const a=seededRng(19), b=seededRng(19), c=seededRng(20);
  const values=Array.from({length:100},()=>a());
  expect(values).toEqual(Array.from({length:100},()=>b()));
  expect(values).not.toEqual(Array.from({length:100},()=>c()));
  expect(values.every(v=>v>=0 && v<1)).toBe(true);
});
it("shrinks counts with no observations staying at the prior",()=>{
  expect(posteriorMean(0.25,4,2,4)).toBe(0.375);
  expect(posteriorMean(0.25,4,0,0)).toBe(0.25);
  expect(()=>posteriorMean(0.5,4,3,2)).toThrow();
});
it("excludes unknown outcomes rather than reading null as zero",()=>{
  expect(brierScore([{probability:0.8,occurred:true},{probability:0.99,occurred:null}])).toEqual({score:expect.closeTo(0.04),resolvedShare:0.5,resolved:1,total:2});
  expect(brierScore([{probability:0.99,occurred:null}]).score).toBeNull();
  expect(brierScore([]).resolvedShare).toBe(0);
  expect(()=>brierScore([{probability:NaN,occurred:null}])).toThrow();
});
it("reports skill and delta on exactly the same resolved subset",()=>{
  const score=brierSkillScore([{probability:0.8,baseline:0.5,occurred:true},{probability:0.99,baseline:0,occurred:null}]);
  expect(score.score).toBeCloseTo(0.84); expect(score.delta).toBeCloseTo(0.21); expect(score.resolvedShare).toBe(0.5);
  expect(brierSkillScore([{probability:0,baseline:0,occurred:false}]).score).toBeNull();
});
it("hashes canonical JSON with standard SHA-256 known vectors",()=>{
  expect(snapshotHash({})).toBe("44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a");
  expect(snapshotHash({b:2,a:1})).toBe(snapshotHash({a:1,b:2}));
  expect(snapshotHash({a:2})).not.toBe(snapshotHash({a:1}));
  expect(canonicalJson([null,true,"é"]).length).toBeGreaterThan(0);
  expect(()=>snapshotHash({a:undefined})).toThrow();
});
