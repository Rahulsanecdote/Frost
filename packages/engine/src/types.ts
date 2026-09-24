export interface DaySnapshot {
  now: string;                       // ISO 8601, supplied by caller — never Date.now()
  horizonHours: 24;                  // literal; horizon lock
  events: CalendarEvent[];
  commitments: Commitment[];
  commute: CommuteEstimate[];        // one per event that has a location
  history: UserHistory;
  grant: Grant;
}

export interface CalendarEvent {
  id: string;
  start: string; end: string;        // ISO
  location?: string;
  hardStop: boolean;                 // true if it cannot overrun (flight, pickup)
  attendees: number;
}

export interface Commitment {         // a promise extracted from email
  id: string;
  description: string;
  dueBy: string;                     // ISO
  estimatedMinutes: number;
}

export interface CommuteEstimate {
  eventId: string;
  fromCurrentLocation: boolean;
  minutesP50: number; minutesP90: number;   // from Maps API, supplied by reader
}

export interface UserHistory {
  arrivalDeltasMin: number[];        // observed (actual − planned) arrival deltas
  overrunDeltasMin: number[];        // observed meeting overruns
  slipRate: number;                  // fraction of past commitments missed, 0–1
}

export interface Grant {
  calendar: "read" | "none";
  commute: "read" | "none";
  email: "read" | "none";
}

export type BranchKind = "late" | "overrun_cascade" | "commitment_slip" | "clear";

export interface Branch {
  id: string;
  kind: BranchKind;
  subjectId: string | null;          // eventId or commitmentId; null for "clear"
  probability: number;               // 0–1, calibrated
  windowStart: string; windowEnd: string;
  summary: string;                   // one sentence, plain language
  ordinaryAction: string | null;     // e.g. "Leave by 2:35 instead of 2:45." Never an executed action.
}

export interface Resolution {
  branchId: string;
  occurred: boolean;
  resolvedAt: string;
}
