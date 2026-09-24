import { describe, expect, expectTypeOf, it } from "vitest";
import type { DaySnapshot, Grant } from "../src/index.js";

describe("snapshot contract", () => {
  it("locks the horizon and grants to the specified values", () => {
    expectTypeOf<DaySnapshot["horizonHours"]>().toEqualTypeOf<24>();
    expectTypeOf<Grant["calendar"]>().toEqualTypeOf<"read" | "none">();
    const snapshot: DaySnapshot = {
      now: "2026-09-24T12:00:00Z",
      horizonHours: 24,
      events: [], commitments: [], commute: [],
      history: { arrivalDeltasMin: [], overrunDeltasMin: [], slipRate: 0 },
      grant: { calendar: "none", commute: "none", email: "none" },
    };
    expect(snapshot.horizonHours).toBe(24);
  });
});
