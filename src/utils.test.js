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
  deriveThresholdPace, deriveLongRunPace, normalizeInjuries, injuriesToText,
  getTrainingPhase, getDistanceGuidance, buildCoachingRules,
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
    const session = { distance: "14.36", avgPace: "5:34", type: "run_threshold" };
    const result = computePlanDeltas(session, weekPlan, "12km at 5:15/km pace");
    expect(result.distDelta).toBe(2.36);
    expect(result.paceDeltaSecs).toBe(19); // 5:34 - 5:15 = 19s slower
    expect(result.plannedDist).toBe(12);
    expect(result.targetPace).toBe("5:15");
  });

  it("returns null distDelta when mainSet has no parseable distance", () => {
    const session = { distance: "14.36", avgPace: "5:34", type: "run_threshold" };
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
    const session = { distance: "10", avgPace: "5:00", type: "run_threshold" };
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

// ─────────────────────────────────────────────────────────────────────────────
// deriveThresholdPace — Jack Daniels T-pace ~6.5% faster than race pace
// ─────────────────────────────────────────────────────────────────────────────
describe("deriveThresholdPace", () => {
  it("derives 4:55 from 5:15 race pace", () => expect(deriveThresholdPace("5:15")).toBe("4:55"));
  it("derives a faster pace (fewer seconds) than the input", () => {
    const raceSecs = parsePace("5:00");
    const thrSecs = parsePace(deriveThresholdPace("5:00"));
    expect(thrSecs).toBeLessThan(raceSecs);
  });
  it("returns null for null input", () => expect(deriveThresholdPace(null)).toBeNull());
  it("returns null for empty string", () => expect(deriveThresholdPace("")).toBeNull());
  it("rounds to nearest second", () => {
    const result = deriveThresholdPace("5:00");
    expect(result).toMatch(/^\d+:\d{2}$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deriveLongRunPace — ~7.5% slower than race pace
// ─────────────────────────────────────────────────────────────────────────────
describe("deriveLongRunPace", () => {
  it("derives ~5:39 from 5:15 race pace (within ±3s)", () => {
    const result = parsePace(deriveLongRunPace("5:15"));
    expect(result).toBeGreaterThanOrEqual(336); // 5:36
    expect(result).toBeLessThanOrEqual(342);    // 5:42
  });
  it("derives a slower pace (more seconds) than the input", () => {
    const raceSecs = parsePace("5:00");
    const lrSecs = parsePace(deriveLongRunPace("5:00"));
    expect(lrSecs).toBeGreaterThan(raceSecs);
  });
  it("returns null for null input", () => expect(deriveLongRunPace(null)).toBeNull());
  it("returns null for empty string", () => expect(deriveLongRunPace("")).toBeNull());
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeInjuries — backward-compat with string[] and new {area,severity}[]
// ─────────────────────────────────────────────────────────────────────────────
describe("normalizeInjuries", () => {
  it("converts string array to object array", () => {
    expect(normalizeInjuries(["Achilles", "Knee"])).toEqual([
      { area: "Achilles", severity: null },
      { area: "Knee", severity: null },
    ]);
  });
  it("passes through object array unchanged", () => {
    const input = [{ area: "Achilles", severity: 3 }];
    expect(normalizeInjuries(input)).toEqual(input);
  });
  it("filters out __none__ sentinel", () => {
    expect(normalizeInjuries(["__none__"])).toEqual([]);
  });
  it("handles mixed strings and objects", () => {
    const result = normalizeInjuries(["Achilles", { area: "Knee", severity: 2 }]);
    expect(result).toEqual([
      { area: "Achilles", severity: null },
      { area: "Knee", severity: 2 },
    ]);
  });
  it("returns empty array for null", () => expect(normalizeInjuries(null)).toEqual([]));
  it("returns empty array for empty array", () => expect(normalizeInjuries([])).toEqual([]));
});

// ─────────────────────────────────────────────────────────────────────────────
// injuriesToText — AI prompt string with optional severity
// ─────────────────────────────────────────────────────────────────────────────
describe("injuriesToText", () => {
  it("formats string injuries without severity", () =>
    expect(injuriesToText(["Achilles", "Knee"])).toBe("Achilles, Knee"));
  it("includes severity when present", () =>
    expect(injuriesToText([{ area: "Achilles", severity: 3 }])).toBe("Achilles (3/5)"));
  it("omits severity when null", () =>
    expect(injuriesToText([{ area: "Achilles", severity: null }])).toBe("Achilles"));
  it("mixes entries with and without severity", () =>
    expect(injuriesToText([{ area: "Achilles", severity: 2 }, { area: "Knee", severity: null }]))
      .toBe("Achilles (2/5), Knee"));
  it("returns 'none' for empty array", () => expect(injuriesToText([])).toBe("none"));
  it("returns 'none' for null", () => expect(injuriesToText(null)).toBe("none"));
  it("returns 'none' for __none__ sentinel", () => expect(injuriesToText(["__none__"])).toBe("none"));
});

// ─────────────────────────────────────────────────────────────────────────────
// getTrainingPhase
// ─────────────────────────────────────────────────────────────────────────────
describe("getTrainingPhase", () => {
  it("returns null when weeksToRace is null", () =>
    expect(getTrainingPhase(null, 1, 17)).toBeNull());

  it("returns null when weeksToRace is undefined", () =>
    expect(getTrainingPhase(undefined, 1, 17)).toBeNull());

  it("returns race when 0 weeks to race", () =>
    expect(getTrainingPhase(0, 17, 17).key).toBe("race"));

  // Taper — 3 weeks (standard marathon taper)
  it("returns taper when 3 weeks to race", () =>
    expect(getTrainingPhase(3, 14, 17).key).toBe("taper"));

  it("returns taper when 2 weeks to race", () =>
    expect(getTrainingPhase(2, 15, 17).key).toBe("taper"));

  it("returns taper when 1 week to race", () =>
    expect(getTrainingPhase(1, 16, 17).key).toBe("taper"));

  it("does NOT return taper when 4 weeks to race", () =>
    expect(getTrainingPhase(4, 13, 17).key).not.toBe("taper"));

  // Peak — exactly 4 weeks out
  it("returns peak when 4 weeks to race", () =>
    expect(getTrainingPhase(4, 13, 17).key).toBe("peak"));

  it("does NOT return peak at 3 weeks (that is taper)", () =>
    expect(getTrainingPhase(3, 14, 17).key).toBe("taper"));

  it("does NOT return peak at 5 weeks", () =>
    expect(getTrainingPhase(5, 12, 17).key).not.toBe("peak"));

  // Recovery — every 4th week, not during taper
  it("returns recovery on week 4", () =>
    expect(getTrainingPhase(13, 4, 17).key).toBe("recovery"));

  it("returns recovery on week 8", () =>
    expect(getTrainingPhase(9, 8, 17).key).toBe("recovery"));

  it("does NOT return recovery during taper even if week is divisible by 4", () =>
    expect(getTrainingPhase(2, 16, 17).key).toBe("taper"));

  // Base — first third of block
  it("returns base in week 1", () =>
    expect(getTrainingPhase(16, 1, 17).key).toBe("base"));

  it("returns base up to week ceil(totalWeeks/3)", () =>
    expect(getTrainingPhase(11, 6, 17).key).toBe("base")); // ceil(17/3)=6

  it("returns build after first third", () =>
    expect(getTrainingPhase(10, 7, 17).key).toBe("build"));

  // Build — default for middle of block
  it("returns build in mid-block", () =>
    expect(getTrainingPhase(8, 9, 17).key).toBe("build"));

  // Phase descriptions present
  it("taper description mentions volume reduction", () =>
    expect(getTrainingPhase(2, 15, 17).description).toMatch(/30%|50%|60%/));

  it("peak description mentions highest volume", () =>
    expect(getTrainingPhase(4, 13, 17).description.toLowerCase()).toContain("highest"));

  it("base description mentions no hard sessions", () =>
    expect(getTrainingPhase(16, 1, 17).description.toLowerCase()).toContain("no hard"));
});

// ─────────────────────────────────────────────────────────────────────────────
// getDistanceGuidance
// ─────────────────────────────────────────────────────────────────────────────
describe("getDistanceGuidance", () => {
  it("returns null for no race distance", () =>
    expect(getDistanceGuidance(null, "recreational")).toBeNull());

  describe("marathon (42.195km)", () => {
    it("recreational: correct weekly range 45–65km", () =>
      expect(getDistanceGuidance(42.195, "recreational")).toContain("45–65"));

    it("competitive_recreational: correct weekly range 55–75km", () =>
      expect(getDistanceGuidance(42.195, "competitive_recreational")).toContain("55–75"));

    it("club_athlete: correct weekly range 65–90km", () =>
      expect(getDistanceGuidance(42.195, "club_athlete")).toContain("65–90"));

    it("recreational: peak long run 26–32km", () =>
      expect(getDistanceGuidance(42.195, "recreational")).toContain("26–32"));

    it("club_athlete: peak long run 32–38km", () =>
      expect(getDistanceGuidance(42.195, "club_athlete")).toContain("32–38"));

    it("threshold capped at 14km (not 18km)", () => {
      const g = getDistanceGuidance(42.195, "recreational");
      expect(g).toContain("10–14");
      expect(g).not.toContain("18km");
    });

    it("long run can be 40–50% of weekly volume", () =>
      expect(getDistanceGuidance(42.195, "recreational")).toContain("40–50%"));

    it("explicitly says do not generate half-marathon volumes", () =>
      expect(getDistanceGuidance(42.195, "recreational").toLowerCase()).toContain("do not"));
  });

  describe("half marathon (21.0975km)", () => {
    it("recreational: weekly range 35–50km", () =>
      expect(getDistanceGuidance(21.0975, "recreational")).toContain("35–50"));

    it("club_athlete: weekly range 55–70km", () =>
      expect(getDistanceGuidance(21.0975, "club_athlete")).toContain("55–70"));

    it("is labelled HALF MARATHON, not standalone MARATHON", () => {
      const g = getDistanceGuidance(21.0975, "recreational");
      expect(g).toContain("HALF MARATHON");
      expect(g.startsWith("HALF MARATHON")).toBe(true);
    });
  });

  describe("10K (10km)", () => {
    it("includes 10K label", () =>
      expect(getDistanceGuidance(10, "recreational")).toContain("10K"));

    it("weekly range 30–55km", () =>
      expect(getDistanceGuidance(10, "recreational")).toContain("30–55"));
  });

  describe("5K (5km)", () => {
    it("includes 5K label", () =>
      expect(getDistanceGuidance(5, "recreational")).toContain("5K"));

    it("weekly range 25–45km", () =>
      expect(getDistanceGuidance(5, "recreational")).toContain("25–45"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCoachingRules
// ─────────────────────────────────────────────────────────────────────────────
describe("buildCoachingRules", () => {
  const buildPhase = { key: "build" };
  const basePhase = { key: "base" };
  const taperPhase = { key: "taper" };

  function rules(raceDist, exp = "recreational", hr = "130-145", phase = buildPhase) {
    return buildCoachingRules(raceDist, exp, hr, phase);
  }

  it("returns an array of strings", () =>
    expect(Array.isArray(rules(42.195))).toBe(true));

  // 80/20 rule
  it("includes 80/20 easy/hard rule", () => {
    const r = rules(42.195);
    expect(r.some(s => s.includes("80%") || s.includes("80/20"))).toBe(true);
  });

  it("hard volume cap is 20% of weekly km", () => {
    const r = rules(42.195);
    expect(r.some(s => s.includes("20%") && s.toLowerCase().includes("hard"))).toBe(true);
  });

  // Strides
  it("includes strides guidance", () => {
    const r = rules(42.195);
    expect(r.some(s => s.toLowerCase().includes("strides"))).toBe(true);
  });

  it("strides are 6×80–100m", () => {
    const r = rules(42.195);
    expect(r.some(s => s.includes("80–100m"))).toBe(true);
  });

  // VO2max vs threshold differentiation
  it("distinguishes run_interval as VO2max work", () => {
    const r = rules(42.195);
    expect(r.some(s => s.includes("run_interval") && (s.includes("VO2max") || s.includes("5K effort")))).toBe(true);
  });

  it("restricts intervals to Build/Peak phase only", () => {
    const r = rules(42.195);
    expect(r.some(s => s.includes("run_interval") && s.toLowerCase().includes("base"))).toBe(true);
  });

  it("threshold defined as 10–14km total", () => {
    const r = rules(42.195);
    expect(r.some(s => s.includes("run_threshold") && s.includes("10–14km"))).toBe(true);
  });

  // Marathon-specific rules
  describe("marathon", () => {
    it("long run progresses independently (no percentage cap)", () => {
      const r = rules(42.195);
      expect(r.some(s => s.toLowerCase().includes("independently"))).toBe(true);
      expect(r.some(s => s.includes("30–40%"))).toBe(false);
    });

    it("includes marathon-pace miles in long run during Build phase", () => {
      const r = rules(42.195, "recreational", "130-145", buildPhase);
      expect(r.some(s => s.toLowerCase().includes("marathon race pace"))).toBe(true);
    });

    it("does NOT include marathon-pace miles in long run during Base phase", () => {
      const r = rules(42.195, "recreational", "130-145", basePhase);
      expect(r.some(s => s.toLowerCase().includes("marathon race pace"))).toBe(false);
    });

    it("cross-training guidance recommends cycling/swimming, not CrossFit", () => {
      const r = rules(42.195);
      const crossTrainRule = r.find(s => s.toLowerCase().includes("cross"));
      expect(crossTrainRule).toBeDefined();
      expect(crossTrainRule.toLowerCase()).toMatch(/cycling|swimming/);
      expect(crossTrainRule.toLowerCase()).toContain("no high-intensity crossfit");
    });

    it("includes marathon_pace session type guidance", () => {
      const r = rules(42.195);
      expect(r.some(s => s.includes("run_marathon_pace"))).toBe(true);
    });

    // Tuesday rotation
    it("requires Tuesday intensity rotation in Build phase", () => {
      const r = rules(42.195, "recreational", "130-145", buildPhase);
      expect(r.some(s => s.includes("ROTATE") && s.toLowerCase().includes("tuesday"))).toBe(true);
    });

    it("Tuesday rotation includes VO2max, threshold, and marathon pace options", () => {
      const r = rules(42.195, "recreational", "130-145", buildPhase);
      const rotRule = r.find(s => s.toLowerCase().includes("tuesday") && s.includes("ROTATE"));
      expect(rotRule).toBeDefined();
      expect(rotRule).toMatch(/VO2max|interval/i);
      expect(rotRule).toMatch(/[Tt]hreshold/);
      expect(rotRule).toMatch(/[Mm]arathon pace/);
    });

    it("Tuesday rotation does NOT appear in Base phase", () => {
      const r = rules(42.195, "recreational", "130-145", basePhase);
      expect(r.some(s => s.toLowerCase().includes("tuesday") && s.includes("ROTATE"))).toBe(false);
    });

    it("Tuesday rotation does NOT appear in Taper phase", () => {
      const r = rules(42.195, "recreational", "130-145", taperPhase);
      expect(r.some(s => s.toLowerCase().includes("tuesday") && s.includes("ROTATE"))).toBe(false);
    });

    // Thursday structure
    it("requires structured Thursday medium-long run in Build phase", () => {
      const r = rules(42.195, "recreational", "130-145", buildPhase);
      expect(r.some(s => s.toLowerCase().includes("thursday") && s.toLowerCase().includes("structure"))).toBe(true);
    });

    it("Thursday rule explicitly rejects all-easy runs for performance goal", () => {
      const r = rules(42.195, "recreational", "130-145", buildPhase);
      const thuRule = r.find(s => s.toLowerCase().includes("thursday"));
      expect(thuRule).toBeDefined();
      expect(thuRule.toLowerCase()).toMatch(/wasted|performance/);
    });

    it("Thursday structure rule does NOT appear in Base phase", () => {
      const r = rules(42.195, "recreational", "130-145", basePhase);
      expect(r.some(s => s.toLowerCase().includes("thursday"))).toBe(false);
    });

    // Long run MP progression
    it("requires MP segments to progress across build weeks", () => {
      const r = rules(42.195, "recreational", "130-145", buildPhase);
      expect(r.some(s => s.toLowerCase().includes("progress") && s.includes("MP"))).toBe(true);
    });

    it("MP progression targets 12–14km by late Build/Peak", () => {
      const r = rules(42.195, "recreational", "130-145", buildPhase);
      const progRule = r.find(s => s.includes("MP") && s.toLowerCase().includes("progress"));
      expect(progRule).toBeDefined();
      expect(progRule).toContain("12–14km");
    });

    it("MP progression rule does NOT appear in Base phase", () => {
      const r = rules(42.195, "recreational", "130-145", basePhase);
      expect(r.some(s => s.includes("MP") && s.toLowerCase().includes("progress"))).toBe(false);
    });

    // Peak long run distance
    it("peak long run must reach 30–32km (Peak phase only)", () => {
      const peakPhase = { key: "peak" };
      const r = rules(42.195, "recreational", "130-145", peakPhase);
      expect(r.some(s => s.includes("30–32km"))).toBe(true);
    });

    it("peak long run rule does NOT appear in Build phase", () => {
      const r = rules(42.195, "recreational", "130-145", buildPhase);
      expect(r.some(s => s.includes("30–32km"))).toBe(false);
    });

    it("peak long run rule rejects 24km as performance target", () => {
      const peakPhase = { key: "peak" };
      const r = rules(42.195, "recreational", "130-145", peakPhase);
      const peakRule = r.find(s => s.includes("30–32km"));
      expect(peakRule).toBeDefined();
      expect(peakRule.toLowerCase()).toMatch(/24km|completion only|performance/);
    });

    // Hill work
    it("includes hill work sessions in Build phase", () => {
      const r = rules(42.195, "recreational", "130-145", buildPhase);
      expect(r.some(s => s.toLowerCase().includes("hill"))).toBe(true);
    });

    it("hill sessions are every 2 weeks with uphill efforts", () => {
      const r = rules(42.195, "recreational", "130-145", buildPhase);
      const hillRule = r.find(s => s.toLowerCase().includes("hill"));
      expect(hillRule).toBeDefined();
      expect(hillRule).toMatch(/2 weeks|uphill/i);
    });

    it("hill work does NOT appear in Base phase", () => {
      const r = rules(42.195, "recreational", "130-145", basePhase);
      expect(r.some(s => s.toLowerCase().includes("hill") && s.toLowerCase().includes("uphill"))).toBe(false);
    });

    // CrossFit placement
    it("CrossFit must be Monday only, never Friday", () => {
      const r = rules(42.195);
      const cfRule = r.find(s => s.toLowerCase().includes("crossfit") && s.toLowerCase().includes("monday"));
      expect(cfRule).toBeDefined();
      expect(cfRule.toLowerCase()).toContain("never friday");
    });

    it("CrossFit rule warns against heavy lower-body work in peak", () => {
      const r = rules(42.195);
      const cfRule = r.find(s => s.toLowerCase().includes("crossfit") && s.toLowerCase().includes("monday"));
      expect(cfRule).toBeDefined();
      expect(cfRule.toLowerCase()).toMatch(/squat|deadlift|lower-body/);
    });

    it("CrossFit placement rule applies in Base phase too", () => {
      const r = rules(42.195, "recreational", "130-145", basePhase);
      expect(r.some(s => s.toLowerCase().includes("crossfit") && s.toLowerCase().includes("monday"))).toBe(true);
    });

    // Fueling practice
    it("includes fueling practice rule in Build phase", () => {
      const r = rules(42.195, "recreational", "130-145", buildPhase);
      expect(r.some(s => s.toLowerCase().includes("fuel") || s.toLowerCase().includes("gel"))).toBe(true);
    });

    it("fueling rule specifies ≥18km long runs and gel timing", () => {
      const r = rules(42.195, "recreational", "130-145", buildPhase);
      const fuelRule = r.find(s => s.toLowerCase().includes("gel"));
      expect(fuelRule).toBeDefined();
      expect(fuelRule).toMatch(/18km|45 min/);
    });

    it("fueling practice rule appears in Taper phase", () => {
      const r = rules(42.195, "recreational", "130-145", taperPhase);
      expect(r.some(s => s.toLowerCase().includes("gel"))).toBe(true);
    });

    it("fueling practice rule does NOT appear in Base phase (no long runs ≥18km)", () => {
      const r = rules(42.195, "recreational", "130-145", basePhase);
      expect(r.some(s => s.toLowerCase().includes("gel"))).toBe(false);
    });

    it("fueling rule is absent for half marathon (shorter race)", () => {
      const r = rules(21.0975, "recreational", "130-145", buildPhase);
      expect(r.some(s => s.toLowerCase().includes("gel"))).toBe(false);
    });
  });

  // Non-marathon keeps 30–40% long run rule
  describe("half marathon", () => {
    it("applies 30–40% long run cap", () => {
      const r = rules(21.0975);
      expect(r.some(s => s.includes("30–40%"))).toBe(true);
    });

    it("does NOT include marathon-pace session guidance", () => {
      const r = rules(21.0975);
      expect(r.some(s => s.includes("run_marathon_pace"))).toBe(false);
    });
  });

  // Taper rules
  it("includes taper volume drop percentages", () => {
    const r = rules(42.195, "recreational", "130-145", taperPhase);
    const taperRule = r.find(s => s.startsWith("Taper:"));
    expect(taperRule).toBeDefined();
    expect(taperRule).toMatch(/30%|50%|60%/);
  });

  // Easy HR in rules
  it("uses easyHR value in easy run rule", () => {
    const r = rules(42.195, "recreational", "140-155");
    expect(r.some(s => s.includes("140-155"))).toBe(true);
  });

  it("falls back to 'below 145' when easyHR is empty", () => {
    const r = buildCoachingRules(42.195, "recreational", "", buildPhase);
    expect(r.some(s => s.includes("below 145"))).toBe(true);
  });

  // mainSet rule always present
  it("always includes mainSet specificity rule", () => {
    const r = rules(42.195);
    expect(r.some(s => s.includes("mainSet"))).toBe(true);
  });
});
