import { describe, it, expect } from "vitest";
import {
  parsePace, secsTopace,
  computeRacePace, computeGoalTime,
  getWeekStart, getPlannedDay, getAutoLink, getWeeksToRace,
  findLinkedSession, findLinkedSessions, sessionInWeek, sessionsForWeek,
  weekRunSessions, countRunsPlanned,
  computeAutoScore, bulkDeleteSessions,
  isDayAfterRace, isDayRaceDay, isWeekInPast,
  DAY_LABELS, SESSION_LABELS, SESSION_COLORS,
  secsToTime, parseDistanceFromMainSet, computePlanDeltas, computeRaceProjection,
} from "./utils.js";

// ─────────────────────────────────────────────────────────────────────────────
// parsePace
// ─────────────────────────────────────────────────────────────────────────────
describe("parsePace", () => {
  it("parses M:SS correctly", () => expect(parsePace("5:30")).toBe(330));
  it("parses 0:00 as 0", () => expect(parsePace("0:00")).toBe(0));
  it("parses single-digit seconds", () => expect(parsePace("5:08")).toBe(308));
  it("returns null for empty string", () => expect(parsePace("")).toBeNull());
  it("returns null for null input", () => expect(parsePace(null)).toBeNull());
  it("returns null for non-numeric input", () => expect(parsePace("abc")).toBeNull());
  it("handles double-digit minutes correctly", () => expect(parsePace("12:45")).toBe(765));
});

// ─────────────────────────────────────────────────────────────────────────────
// secsTopace
// ─────────────────────────────────────────────────────────────────────────────
describe("secsTopace", () => {
  it("converts 330 → '5:30'", () => expect(secsTopace(330)).toBe("5:30"));
  it("pads single-digit seconds with zero", () => expect(secsTopace(308)).toBe("5:08"));
  it("returns null for 0", () => expect(secsTopace(0)).toBeNull());
  it("returns null for null", () => expect(secsTopace(null)).toBeNull());
  it("handles 765 → '12:45'", () => expect(secsTopace(765)).toBe("12:45"));
});

// ─────────────────────────────────────────────────────────────────────────────
// parsePace ↔ secsTopace round-trip
// ─────────────────────────────────────────────────────────────────────────────
describe("parsePace ↔ secsTopace round-trip", () => {
  ["5:00", "5:30", "6:15", "4:45", "12:00"].forEach(pace => {
    it(`round-trips "${pace}"`, () => expect(secsTopace(parsePace(pace))).toBe(pace));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeRacePace / computeGoalTime
// ─────────────────────────────────────────────────────────────────────────────
describe("computeRacePace", () => {
  it("computes half-marathon pace from 1:50:46 goal", () => {
    const pace = computeRacePace("Half Marathon", "1:50:46");
    // 6646s / 21.0975km ≈ 315s = 5:15
    expect(pace).toBe("5:15");
  });
  it("returns null for unknown goal", () => {
    expect(computeRacePace("Ultramarathon", "4:00:00")).toBeNull();
  });
  it("returns null for missing time", () => {
    expect(computeRacePace("5km", "")).toBeNull();
  });
  it("computes 5km pace from 20:00 goal → 4:00/km", () => {
    expect(computeRacePace("5km", "20:00")).toBe("4:00");
  });
  it("computeGoalTime round-trips computeRacePace for Marathon", () => {
    const pace = computeRacePace("Marathon", "3:30:00");
    const goalTime = computeGoalTime("Marathon", pace);
    // Allow ±1s due to rounding
    expect(goalTime).toMatch(/^3:2[89]:|^3:30:/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getWeekStart — always returns the Monday of the week
// ─────────────────────────────────────────────────────────────────────────────
describe("getWeekStart", () => {
  it("Monday returns itself", () => expect(getWeekStart("2026-04-06")).toBe("2026-04-06"));
  it("Tuesday returns previous Monday", () => expect(getWeekStart("2026-04-07")).toBe("2026-04-06"));
  it("Wednesday returns Monday", () => expect(getWeekStart("2026-04-08")).toBe("2026-04-06"));
  it("Thursday returns Monday", () => expect(getWeekStart("2026-04-09")).toBe("2026-04-06"));
  it("Friday returns Monday", () => expect(getWeekStart("2026-04-10")).toBe("2026-04-06"));
  it("Saturday returns Monday", () => expect(getWeekStart("2026-04-11")).toBe("2026-04-06"));
  it("Sunday returns previous Monday (not next)", () => expect(getWeekStart("2026-04-12")).toBe("2026-04-06"));
  it("handles year boundary: Sun 2025-12-28 → Mon 2025-12-22", () =>
    expect(getWeekStart("2025-12-28")).toBe("2025-12-22"));
  it("handles year boundary: Mon 2026-01-05 → itself", () =>
    expect(getWeekStart("2026-01-05")).toBe("2026-01-05"));
});

// ─────────────────────────────────────────────────────────────────────────────
// getPlannedDay
// ─────────────────────────────────────────────────────────────────────────────
describe("getPlannedDay", () => {
  const plan = { weekStart: "2026-04-06" };
  it("maps Tuesday 2026-04-07 → 'Tue'", () => expect(getPlannedDay("2026-04-07", plan)).toBe("Tue"));
  it("maps Monday 2026-04-06 → 'Mon'", () => expect(getPlannedDay("2026-04-06", plan)).toBe("Mon"));
  it("maps Sunday 2026-04-12 → 'Sun'", () => expect(getPlannedDay("2026-04-12", plan)).toBe("Sun"));
  it("returns null for date outside the plan week", () =>
    expect(getPlannedDay("2026-04-13", plan)).toBeNull());
  it("returns null for missing date", () => expect(getPlannedDay(null, plan)).toBeNull());
  it("returns null for missing plan", () => expect(getPlannedDay("2026-04-07", null)).toBeNull());
});

// ─────────────────────────────────────────────────────────────────────────────
// getAutoLink
// ─────────────────────────────────────────────────────────────────────────────
describe("getAutoLink", () => {
  const plans = [{ weekStart: "2026-04-06" }, { weekStart: "2026-03-30" }];

  it("links Tuesday to correct plan week", () => {
    expect(getAutoLink("2026-04-07", plans)).toEqual({
      plannedDay: "Tue",
      plannedWeekStart: "2026-04-06",
    });
  });
  it("links Sunday to correct plan week", () => {
    expect(getAutoLink("2026-04-12", plans)).toEqual({
      plannedDay: "Sun",
      plannedWeekStart: "2026-04-06",
    });
  });
  it("returns null when no matching plan week exists", () =>
    expect(getAutoLink("2026-04-20", plans)).toBeNull());
  it("returns null for empty plans array", () =>
    expect(getAutoLink("2026-04-07", [])).toBeNull());
  it("returns null for missing date", () =>
    expect(getAutoLink(null, plans)).toBeNull());
});

// ─────────────────────────────────────────────────────────────────────────────
// getWeeksToRace — full-plan generation week list
// ─────────────────────────────────────────────────────────────────────────────
describe("getWeeksToRace", () => {
  it("returns weeks from current to race inclusive", () => {
    const weeks = getWeeksToRace("2026-04-06", "2026-05-03");
    expect(weeks[0]).toBe("2026-04-06");
    expect(weeks[weeks.length - 1]).toBe("2026-04-27"); // week containing 2026-05-03
    expect(weeks.length).toBe(4);
  });
  it("includes race week even if race is mid-week", () => {
    const weeks = getWeeksToRace("2026-04-06", "2026-04-09"); // Thursday
    expect(weeks).toContain("2026-04-06");
    expect(weeks.length).toBe(1);
  });
  it("returns [] when race is in the past", () =>
    expect(getWeeksToRace("2026-04-06", "2026-03-01")).toEqual([]));
  it("returns [] when raceDate is missing", () =>
    expect(getWeeksToRace("2026-04-06", null)).toEqual([]));
  it("all entries are valid Monday dates", () => {
    const weeks = getWeeksToRace("2026-04-06", "2026-05-31");
    weeks.forEach(ws => {
      expect(new Date(ws + "T00:00:00").getDay()).toBe(1); // 1 = Monday
    });
  });
  it("consecutive weeks are exactly 7 days apart", () => {
    const weeks = getWeeksToRace("2026-04-06", "2026-05-31");
    for (let i = 1; i < weeks.length; i++) {
      const diff = (new Date(weeks[i]) - new Date(weeks[i - 1])) / (1000 * 60 * 60 * 24);
      expect(diff).toBe(7);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findLinkedSession — date-first matching (key bug fix)
// ─────────────────────────────────────────────────────────────────────────────
describe("findLinkedSession", () => {
  const weekStart = "2026-04-06";
  const sessionByDate = { id: 1, date: "2026-04-07", plannedDay: null, plannedWeekStart: null };
  const sessionByLink = { id: 2, date: "2026-03-01", plannedDay: "Tue", plannedWeekStart: weekStart };
  const sessions = [sessionByDate, sessionByLink];

  it("finds session by exact date match (primary key)", () =>
    expect(findLinkedSession(sessions, "2026-04-07", "Tue", weekStart)).toBe(sessionByDate));

  it("date match takes precedence over plan link", () => {
    // Both match Tue: one by date, one by link — date wins
    const both = [sessionByDate, sessionByLink];
    expect(findLinkedSession(both, "2026-04-07", "Tue", weekStart)).toBe(sessionByDate);
  });

  it("falls back to plannedDay+plannedWeekStart when no date match", () =>
    expect(findLinkedSession(sessions, "2026-04-08", "Tue", weekStart)).toBe(sessionByLink));

  it("returns undefined when no match at all", () =>
    expect(findLinkedSession(sessions, "2026-04-09", "Thu", weekStart)).toBeUndefined());

  it("returns undefined for empty sessions array", () =>
    expect(findLinkedSession([], "2026-04-07", "Tue", weekStart)).toBeUndefined());

  it("returns undefined for null sessions", () =>
    expect(findLinkedSession(null, "2026-04-07", "Tue", weekStart)).toBeUndefined());
});

// ─────────────────────────────────────────────────────────────────────────────
// sessionInWeek / sessionsForWeek — week summary bar logic
// ─────────────────────────────────────────────────────────────────────────────
describe("sessionInWeek", () => {
  it("returns true for a session whose date falls in the week", () =>
    expect(sessionInWeek({ date: "2026-04-09" }, "2026-04-06")).toBe(true));
  it("returns true for Monday itself", () =>
    expect(sessionInWeek({ date: "2026-04-06" }, "2026-04-06")).toBe(true));
  it("returns true for Sunday of that week", () =>
    expect(sessionInWeek({ date: "2026-04-12" }, "2026-04-06")).toBe(true));
  it("returns false for a date in the next week", () =>
    expect(sessionInWeek({ date: "2026-04-13" }, "2026-04-06")).toBe(false));
  it("returns false for null session", () =>
    expect(sessionInWeek(null, "2026-04-06")).toBe(false));
});

describe("sessionsForWeek", () => {
  const sessions = [
    { id: 1, date: "2026-04-07", plannedWeekStart: "2026-04-06" }, // matches by both
    { id: 2, date: "2026-04-10", plannedWeekStart: null },          // matches by date only
    { id: 3, date: "2026-03-01", plannedWeekStart: "2026-04-06" }, // matches by link only
    { id: 4, date: "2026-04-20", plannedWeekStart: null },          // different week
  ];
  it("includes session matching by date", () =>
    expect(sessionsForWeek(sessions, "2026-04-06")).toContain(sessions[1]));
  it("includes session matching by plannedWeekStart", () =>
    expect(sessionsForWeek(sessions, "2026-04-06")).toContain(sessions[2]));
  it("excludes session from a different week", () =>
    expect(sessionsForWeek(sessions, "2026-04-06")).not.toContain(sessions[3]));
  it("returns empty array for no sessions", () =>
    expect(sessionsForWeek(null, "2026-04-06")).toEqual([]));
});

// ─────────────────────────────────────────────────────────────────────────────
// WeekStrip dot logic — session fills dot by date OR by explicit link
// ─────────────────────────────────────────────────────────────────────────────
describe("WeekStrip dot logic via findLinkedSession", () => {
  const weekStart = "2026-04-06"; // Mon Apr 6

  it("dot is filled when session date matches plan day date", () => {
    const sessions = [{ id: 1, date: "2026-04-07" }]; // Tue
    expect(findLinkedSession(sessions, "2026-04-07", "Tue", weekStart)).toBeTruthy();
  });

  it("dot is filled by explicit plan link even if date is wrong", () => {
    const sessions = [{ id: 1, date: "2026-03-15", plannedDay: "Thu", plannedWeekStart: weekStart }];
    expect(findLinkedSession(sessions, "2026-04-09", "Thu", weekStart)).toBeTruthy();
  });

  it("dot is empty when no session for that day", () => {
    const sessions = [{ id: 1, date: "2026-04-07" }]; // only Tue exists
    expect(findLinkedSession(sessions, "2026-04-09", "Thu", weekStart)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeAutoScore
// ─────────────────────────────────────────────────────────────────────────────
describe("computeAutoScore", () => {
  const plan = { weekGoals: { targetPace: "5:30" } };

  it("exact pace → score 10", () =>
    expect(computeAutoScore({ avgPace: "5:30" }, plan).value).toBe(10));
  it("10s faster than target → score 9", () =>
    expect(computeAutoScore({ avgPace: "5:19" }, plan).value).toBe(9));
  it("40s faster than target → score 7 (too fast, injury risk)", () =>
    expect(computeAutoScore({ avgPace: "4:50" }, plan).value).toBe(7));
  it("2min slower than target → score 2", () =>
    expect(computeAutoScore({ avgPace: "7:35" }, plan).value).toBe(2));

  it("RPE 7 alone → score 9", () =>
    expect(computeAutoScore({ rpe: "7" }, {}).value).toBe(9));
  it("RPE 10 alone → score 3 (max effort)", () =>
    expect(computeAutoScore({ rpe: "10" }, {}).value).toBe(3));

  it("combines pace and RPE scores with average", () => {
    const score = computeAutoScore({ avgPace: "5:30", rpe: "7" }, plan);
    expect(score.value).toBe(Math.round((10 + 9) / 2)); // = 10
    expect(score.verdict).toBe("Auto: pace + RPE");
  });

  it("returns null when no pace and no RPE", () =>
    expect(computeAutoScore({}, {})).toBeNull());
});

// ─────────────────────────────────────────────────────────────────────────────
// bulkDeleteSessions — single-pass, no stale closure
// ─────────────────────────────────────────────────────────────────────────────
describe("bulkDeleteSessions", () => {
  const sessions = [
    { id: 1, type: "run_easy" },
    { id: 2, type: "run_threshold" },
    { id: 3, type: "run_long" },
  ];

  it("removes a single session", () => {
    const result = bulkDeleteSessions(sessions, [2]);
    expect(result.map(s => s.id)).toEqual([1, 3]);
  });

  it("removes multiple sessions in one call", () => {
    const result = bulkDeleteSessions(sessions, [1, 3]);
    expect(result.map(s => s.id)).toEqual([2]);
  });

  it("removes all sessions", () => {
    expect(bulkDeleteSessions(sessions, [1, 2, 3])).toEqual([]);
  });

  it("no-op when ids list is empty", () =>
    expect(bulkDeleteSessions(sessions, [])).toHaveLength(3));

  it("handles null sessions gracefully", () =>
    expect(bulkDeleteSessions(null, [1])).toEqual([]));

  it("does not mutate the original array", () => {
    bulkDeleteSessions(sessions, [1]);
    expect(sessions).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Race date boundary helpers
// ─────────────────────────────────────────────────────────────────────────────
describe("isDayAfterRace", () => {
  it("returns true for day strictly after race", () =>
    expect(isDayAfterRace("2026-06-15", "2026-06-14")).toBe(true));
  it("returns false for race day itself", () =>
    expect(isDayAfterRace("2026-06-14", "2026-06-14")).toBe(false));
  it("returns false for day before race", () =>
    expect(isDayAfterRace("2026-06-13", "2026-06-14")).toBe(false));
  it("returns false when raceDate is null", () =>
    expect(isDayAfterRace("2026-06-15", null)).toBe(false));
});

describe("isDayRaceDay", () => {
  it("returns true on exact race date", () =>
    expect(isDayRaceDay("2026-06-14", "2026-06-14")).toBe(true));
  it("returns false the day before", () =>
    expect(isDayRaceDay("2026-06-13", "2026-06-14")).toBe(false));
  it("returns false the day after", () =>
    expect(isDayRaceDay("2026-06-15", "2026-06-14")).toBe(false));
  it("returns false when raceDate is null", () =>
    expect(isDayRaceDay("2026-06-14", null)).toBe(false));
});

// ─────────────────────────────────────────────────────────────────────────────
// isWeekInPast — disables plan generation for past weeks
// ─────────────────────────────────────────────────────────────────────────────
describe("isWeekInPast", () => {
  it("returns true for a week clearly in the past", () =>
    expect(isWeekInPast("2020-01-06")).toBe(true));
  it("returns false for a week clearly in the future", () =>
    expect(isWeekInPast("2099-01-05")).toBe(false));
  // Note: current week itself returns false (not strictly before current week)
  it("current week is not 'in the past'", () => {
    const current = getWeekStart(new Date().toISOString().split("T")[0]);
    expect(isWeekInPast(current)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findLinkedSessions — multiple sessions per day
// ─────────────────────────────────────────────────────────────────────────────
describe("findLinkedSessions", () => {
  const weekStart = "2026-04-06";

  it("returns all sessions matching by date", () => {
    const s1 = { id:1, date:"2026-04-07" };
    const s2 = { id:2, date:"2026-04-07" };
    const s3 = { id:3, date:"2026-04-08" };
    expect(findLinkedSessions([s1,s2,s3], "2026-04-07", "Tue", weekStart)).toEqual([s1,s2]);
  });

  it("returns a single date match as array of one", () => {
    const s = { id:1, date:"2026-04-07" };
    expect(findLinkedSessions([s], "2026-04-07", "Tue", weekStart)).toEqual([s]);
  });

  it("falls back to plan-link when no date match", () => {
    const s = { id:1, date:"2026-03-01", plannedDay:"Tue", plannedWeekStart:weekStart };
    expect(findLinkedSessions([s], "2026-04-07", "Tue", weekStart)).toEqual([s]);
  });

  it("date matches take full priority — plan-link ignored when date match exists", () => {
    const byDate = { id:1, date:"2026-04-07" };
    const byLink = { id:2, date:"2026-03-01", plannedDay:"Tue", plannedWeekStart:weekStart };
    const result = findLinkedSessions([byDate, byLink], "2026-04-07", "Tue", weekStart);
    expect(result).toContain(byDate);
    expect(result).not.toContain(byLink);
  });

  it("returns [] when no match at all", () =>
    expect(findLinkedSessions([{ id:1, date:"2026-04-08" }], "2026-04-07", "Tue", weekStart)).toEqual([]));

  it("returns [] for empty sessions", () =>
    expect(findLinkedSessions([], "2026-04-07", "Tue", weekStart)).toEqual([]));

  it("returns [] for null sessions", () =>
    expect(findLinkedSessions(null, "2026-04-07", "Tue", weekStart)).toEqual([]));

  it("two rest-day runs (no plan link) are both returned by date", () => {
    // Regression: rest days with logged runs were hidden entirely
    const run1 = { id:1, date:"2026-04-06", type:"run_easy", distance:"5.0" }; // Mon (rest day)
    const run2 = { id:2, date:"2026-04-06", type:"run_threshold", distance:"8.0" };
    expect(findLinkedSessions([run1,run2], "2026-04-06", "Mon", weekStart)).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sessionInWeek — summary bar uses date-only matching (regression: no plannedWeekStart bleed)
// ─────────────────────────────────────────────────────────────────────────────
describe("sessionInWeek — date-only matching", () => {
  const weekStart = "2026-04-06";

  it("returns true when session date falls in the target week", () =>
    expect(sessionInWeek({ date: "2026-04-08" }, weekStart)).toBe(true));

  it("returns false when session date is outside the target week, even if plannedWeekStart matches", () => {
    // Regression: old summary bar used sessionsForWeek which accepted plannedWeekStart as fallback,
    // causing sessions from other weeks to bleed into the wrong week's totals.
    const session = { date: "2026-03-15", plannedWeekStart: weekStart };
    expect(sessionInWeek(session, weekStart)).toBe(false);
  });

  it("returns false for a session in the following week", () =>
    expect(sessionInWeek({ date: "2026-04-13" }, weekStart)).toBe(false));

  it("returns false for missing date", () =>
    expect(sessionInWeek({ plannedWeekStart: weekStart }, weekStart)).toBe(false));
});

// ─────────────────────────────────────────────────────────────────────────────
// secsToTime
// ─────────────────────────────────────────────────────────────────────────────
describe("secsToTime", () => {
  it("formats sub-hour as M:SS", () => expect(secsToTime(330)).toBe("5:30"));
  it("formats over-1-hour as H:MM:SS", () => expect(secsToTime(6300)).toBe("1:45:00"));
  it("pads minutes and seconds", () => expect(secsToTime(3661)).toBe("1:01:01"));
  it("returns null for 0", () => expect(secsToTime(0)).toBeNull());
  it("returns null for null", () => expect(secsToTime(null)).toBeNull());
  it("returns null for negative", () => expect(secsToTime(-60)).toBeNull());
  it("formats half-marathon goal 1:45:00 = 6300s", () => expect(secsToTime(6300)).toBe("1:45:00"));
});

// ─────────────────────────────────────────────────────────────────────────────
// parseDistanceFromMainSet
// ─────────────────────────────────────────────────────────────────────────────
describe("parseDistanceFromMainSet", () => {
  it("extracts leading integer km", () => expect(parseDistanceFromMainSet("12km at 5:15/km pace")).toBe(12));
  it("extracts leading decimal km", () => expect(parseDistanceFromMainSet("14.5km easy run")).toBe(14.5));
  it("extracts distance before qualifier (secondary pattern)", () =>
    expect(parseDistanceFromMainSet("Easy 10km at HR 135")).toBe(10));
  it("returns null for interval notation (no leading distance)", () =>
    expect(parseDistanceFromMainSet("4x1km at threshold pace")).toBeNull());
  it("returns null for null input", () => expect(parseDistanceFromMainSet(null)).toBeNull());
  it("returns null for empty string", () => expect(parseDistanceFromMainSet("")).toBeNull());
  it("extracts km with space before unit", () =>
    expect(parseDistanceFromMainSet("10 km at 5:30")).toBe(10));
  it("returns null when mainSet starts with reps (e.g. 6x800m)", () =>
    expect(parseDistanceFromMainSet("6x800m @ 3:40 with 90s rest")).toBeNull());
});

// ─────────────────────────────────────────────────────────────────────────────
// computePlanDeltas
// ─────────────────────────────────────────────────────────────────────────────
describe("computePlanDeltas", () => {
  const weekPlan = { weekGoals: { targetPace: "5:15" } };

  it("returns distDelta and paceDeltaSecs for a complete session", () => {
    const session = { distance: "14.36", avgPace: "5:34" };
    const result = computePlanDeltas(session, weekPlan, "12km at 5:15/km pace");
    expect(result.distDelta).toBe(2.36);
    expect(result.paceDeltaSecs).toBe(19); // 5:34 - 5:15 = 19s slower
    expect(result.plannedDist).toBe(12);
    expect(result.targetPace).toBe("5:15");
  });

  it("returns null distDelta when mainSet has no parseable distance", () => {
    const session = { distance: "14.36", avgPace: "5:34" };
    const result = computePlanDeltas(session, weekPlan, "4x1km intervals");
    expect(result.distDelta).toBeNull();
    expect(result.paceDeltaSecs).toBe(19); // pace delta still computed
  });

  it("returns null paceDeltaSecs when weekPlan has no targetPace", () => {
    const session = { distance: "14.36", avgPace: "5:34" };
    const result = computePlanDeltas(session, { weekGoals: {} }, "12km at 5:15");
    expect(result.distDelta).toBe(2.36);
    expect(result.paceDeltaSecs).toBeNull();
  });

  it("returns both null when weekPlan is null", () => {
    const session = { distance: "14.36", avgPace: "5:34" };
    const result = computePlanDeltas(session, null, "12km at 5:15");
    expect(result.paceDeltaSecs).toBeNull();
    expect(result.targetPace).toBeNull();
  });

  it("returns negative paceDeltaSecs when session is faster than target", () => {
    const session = { distance: "10", avgPace: "5:00" };
    const result = computePlanDeltas(session, weekPlan, "10km at 5:15");
    expect(result.paceDeltaSecs).toBe(-15); // 5:00 - 5:15 = -15s (faster)
    expect(result.distDelta).toBe(0);
  });

  it("returns null distDelta when session has no distance", () => {
    const session = { avgPace: "5:34" };
    const result = computePlanDeltas(session, weekPlan, "12km at 5:15");
    expect(result.distDelta).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeRaceProjection
// ─────────────────────────────────────────────────────────────────────────────
describe("computeRaceProjection", () => {
  const profile = { goal: "Half Marathon", racePace: "5:15" };

  function makeRuns(paces) {
    return paces.map((p, i) => ({
      id: i + 1,
      type: "run_easy",
      avgPace: p,
      date: `2026-04-${String(i + 1).padStart(2, "0")}`,
    }));
  }

  it("returns null with fewer than 2 sessions", () => {
    expect(computeRaceProjection(makeRuns(["5:15"]), profile)).toBeNull();
  });

  it("returns null when profile has no racePace", () => {
    expect(computeRaceProjection(makeRuns(["5:15", "5:20"]), { goal: "Half Marathon" })).toBeNull();
  });

  it("returns null when profile has unknown goal", () => {
    expect(computeRaceProjection(makeRuns(["5:15", "5:20"]), { goal: "Ultramarathon", racePace: "5:15" })).toBeNull();
  });

  it("returns null for empty sessions", () => {
    expect(computeRaceProjection([], profile)).toBeNull();
  });

  it("returns a result with the correct shape", () => {
    const runs = makeRuns(["5:15", "5:20", "5:10"]);
    const result = computeRaceProjection(runs, profile);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("projTime");
    expect(result).toHaveProperty("goalTime");
    expect(result).toHaveProperty("gapSecs");
    expect(result).toHaveProperty("pct");
    expect(result).toHaveProperty("sampleSize");
    expect(result.sampleSize).toBe(3);
  });

  it("gapSecs is 0 when all runs are exactly at race pace", () => {
    const runs = makeRuns(["5:15", "5:15", "5:15"]);
    const result = computeRaceProjection(runs, profile);
    expect(result.gapSecs).toBe(0);
    expect(result.pct).toBe(100);
  });

  it("gapSecs is positive (slower) when runs are slower than race pace", () => {
    const runs = makeRuns(["5:34", "5:34", "5:34"]);
    const result = computeRaceProjection(runs, profile);
    expect(result.gapSecs).toBeGreaterThan(0);
    expect(result.pct).toBeLessThan(100);
  });

  it("gapSecs is negative (faster) when runs are faster than race pace", () => {
    const runs = makeRuns(["5:00", "5:00", "5:00"]);
    const result = computeRaceProjection(runs, profile);
    expect(result.gapSecs).toBeLessThan(0);
    expect(result.pct).toBe(100); // capped at 100
  });

  it("weights more recent runs more heavily (recency matters)", () => {
    // Most recent run is very fast (5:00), older runs are slow (6:00)
    // Dates must be ordered: later dates = more recent
    const runs = [
      { id:1, type:"run_easy", avgPace:"5:00", date:"2026-04-10" }, // most recent
      { id:2, type:"run_easy", avgPace:"6:00", date:"2026-04-03" },
      { id:3, type:"run_easy", avgPace:"6:00", date:"2026-03-27" },
    ];
    const result = computeRaceProjection(runs, profile);
    // Weighted avg should be closer to 5:00 than simple avg of 5:40
    expect(result.projPace).not.toBeNull();
    const projSecs = (parseInt(result.projPace.split(":")[0]) * 60 + parseInt(result.projPace.split(":")[1]));
    expect(projSecs).toBeLessThan(340); // less than 5:40 (simple average)
  });

  it("only includes run-type sessions (ignores crossfit)", () => {
    const sessions = [
      { id:1, type:"run_easy", avgPace:"5:15", date:"2026-04-10" },
      { id:2, type:"crossfit", avgPace:"5:00", date:"2026-04-09" },
      { id:3, type:"run_long", avgPace:"5:15", date:"2026-04-08" },
    ];
    const result = computeRaceProjection(sessions, profile);
    expect(result.sampleSize).toBe(2); // only the two run sessions
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// weekRunSessions — summary bar km/run totals (regression: excludes non-run types)
// ─────────────────────────────────────────────────────────────────────────────
describe("weekRunSessions", () => {
  const weekStart = "2026-04-06";
  const sessions = [
    { id: 1, date: "2026-04-07", type: "run_easy",      distance: "8.0" },
    { id: 2, date: "2026-04-08", type: "crossfit",       distance: "0" },    // no distance
    { id: 3, date: "2026-04-09", type: "run_threshold",  distance: "6.2" },
    { id: 4, date: "2026-04-10", type: "crossfit",       distance: "5.0" },  // CrossFit with km
    { id: 5, date: "2026-04-11", type: "rest",           distance: "" },
    { id: 6, date: "2026-04-20", type: "run_easy",       distance: "10.0" }, // different week
    // Regression: session linked by plan to this week but dated in another week
    { id: 7, date: "2026-03-10", type: "run_long",       distance: "18.0", plannedWeekStart: weekStart },
  ];

  it("includes run_easy sessions with distance", () =>
    expect(weekRunSessions(sessions, weekStart)).toContainEqual(expect.objectContaining({ id: 1 })));

  it("includes run_threshold sessions", () =>
    expect(weekRunSessions(sessions, weekStart)).toContainEqual(expect.objectContaining({ id: 3 })));

  it("excludes crossfit sessions even when a distance is logged", () => {
    // Regression: non-run types were being counted, inflating km and run totals.
    const result = weekRunSessions(sessions, weekStart);
    expect(result).not.toContainEqual(expect.objectContaining({ id: 4 }));
  });

  it("excludes rest sessions", () =>
    expect(weekRunSessions(sessions, weekStart)).not.toContainEqual(expect.objectContaining({ id: 5 })));

  it("excludes sessions from a different week by date", () =>
    expect(weekRunSessions(sessions, weekStart)).not.toContainEqual(expect.objectContaining({ id: 6 })));

  it("excludes sessions linked by plannedWeekStart but dated in another week", () => {
    // Regression: old code used sessionsForWeek (plannedWeekStart fallback), so session 7
    // would have been counted in this week's totals even though it happened in March.
    expect(weekRunSessions(sessions, weekStart)).not.toContainEqual(expect.objectContaining({ id: 7 }));
  });

  it("returns exactly 2 sessions (run_easy + run_threshold) for this week", () =>
    expect(weekRunSessions(sessions, weekStart)).toHaveLength(2));

  it("sums km correctly for run sessions only", () => {
    const runs = weekRunSessions(sessions, weekStart);
    const total = runs.reduce((sum, s) => sum + parseFloat(s.distance), 0);
    expect(total).toBeCloseTo(14.2);
  });

  it("returns empty array for null sessions", () =>
    expect(weekRunSessions(null, weekStart)).toEqual([]));
});

// ─────────────────────────────────────────────────────────────────────────────
// countRunsPlanned — planned run count (regression: excludes CrossFit and rest)
// ─────────────────────────────────────────────────────────────────────────────
describe("countRunsPlanned", () => {
  it("counts only run-type days", () => {
    const daySessions = {
      Mon: { type: "rest" },
      Tue: { type: "run_threshold" },
      Wed: { type: "crossfit" },
      Thu: { type: "run_interval" },
      Fri: { type: "crossfit" },
      Sat: { type: "run_long" },
      Sun: { type: "rest" },
    };
    // Regression: was counting all non-rest types (crossfit included), giving 5 instead of 3.
    expect(countRunsPlanned(daySessions)).toBe(3);
  });

  it("excludes crossfit from count", () => {
    const daySessions = {
      Mon: { type: "crossfit" },
      Tue: { type: "crossfit" },
      Wed: { type: "run_easy" },
    };
    expect(countRunsPlanned(daySessions)).toBe(1);
  });

  it("returns 0 for all-rest week", () => {
    const daySessions = { Mon: { type: "rest" }, Tue: { type: "rest" } };
    expect(countRunsPlanned(daySessions)).toBe(0);
  });

  it("counts all run sub-types: run_easy, run_threshold, run_long, run_interval", () => {
    const daySessions = {
      Mon: { type: "run_easy" },
      Tue: { type: "run_threshold" },
      Sat: { type: "run_long" },
      Sun: { type: "run_interval" },
    };
    expect(countRunsPlanned(daySessions)).toBe(4);
  });

  it("returns 0 for null daySessions", () =>
    expect(countRunsPlanned(null)).toBe(0));

  it("returns 0 for empty daySessions", () =>
    expect(countRunsPlanned({})).toBe(0));
});

// ─────────────────────────────────────────────────────────────────────────────
// Constants sanity checks
// ─────────────────────────────────────────────────────────────────────────────
describe("constants", () => {
  it("DAY_LABELS has 7 days starting with Mon", () => {
    expect(DAY_LABELS).toHaveLength(7);
    expect(DAY_LABELS[0]).toBe("Mon");
    expect(DAY_LABELS[6]).toBe("Sun");
  });
  it("every session type has a label", () => {
    ["rest","run_threshold","run_easy","run_long","crossfit","run_interval"].forEach(t =>
      expect(SESSION_LABELS[t]).toBeTruthy()
    );
  });
  it("every session type has a color", () => {
    ["rest","run_threshold","run_easy","run_long","crossfit","run_interval"].forEach(t =>
      expect(SESSION_COLORS[t]).toMatch(/^#[0-9a-fA-F]{6}$/)
    );
  });
});
