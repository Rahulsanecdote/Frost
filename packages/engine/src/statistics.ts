/** Domain-neutral seeded randomness; no ambient entropy. */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), state | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
export function posteriorMean(mu: number, m: number, k: number, n: number): number {
  if (!Number.isFinite(mu) || mu < 0 || mu > 1 || !Number.isFinite(m) || m <= 0 ||
      !Number.isInteger(k) || !Number.isInteger(n) || k < 0 || n < k) throw new RangeError("Invalid posterior inputs");
  return (mu * m + k) / (m + n);
}
export interface ScoredPair { probability: number; occurred: boolean | null }
export interface Score { score: number | null; resolvedShare: number; resolved: number; total: number }
function validateProbability(p: number): void {
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError("Invalid probability");
}
export function brierScore(pairs: readonly ScoredPair[]): Score {
  let sum = 0, resolved = 0;
  for (const pair of pairs) { validateProbability(pair.probability);
    if (pair.occurred === null) continue;
    sum += (pair.probability - (pair.occurred ? 1 : 0)) ** 2; resolved++;
  }
  return { score: resolved ? sum / resolved : null, resolvedShare: pairs.length ? resolved / pairs.length : 0, resolved, total: pairs.length };
}
export interface BaselinePair extends ScoredPair { baseline: number }
export function brierSkillScore(pairs: readonly BaselinePair[]): Score & { model: number | null; baseline: number | null; delta: number | null } {
  const model = brierScore(pairs);
  const baseline = brierScore(pairs.map(p => ({ probability: p.baseline, occurred: p.occurred })));
  return { ...model, model: model.score, baseline: baseline.score,
    score: model.score !== null && baseline.score !== null && baseline.score > 0 ? 1 - model.score / baseline.score : null,
    delta: model.score !== null && baseline.score !== null ? baseline.score - model.score : null };
}
