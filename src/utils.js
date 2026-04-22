// ── Pure utility functions ────────────────────────────────────────────────────
// All functions here are side-effect free and fully unit-testable.

export const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export const SESSION_TYPES = ["rest","run_threshold","run_easy","run_long","crossfit","run_interval"];

export const SESSION_COLORS = {
  rest:"#888780", run_threshold:"#1B6FE8", run_easy:"#0F6E56",
  run_long:"#3B6D11", crossfit:"#993C1D", run_interval:"#7C3AED",
};

export const SESSION_LABELS = {
  rest:"Rest", run_threshold:"Threshold", run_easy:"Easy Run",
  run_long:"Long Run", crossfit:"CrossFit", run_interval:"Intervals",
};

export const RACE_DISTANCES = {
  "5km":5, "10km":10, "15km":15, "Half Marathon":21.0975, "Marathon":42.195,
};

// ── Pace helpers ──────────────────────────────────────────────────────────────

/** "M:SS" → total seconds, null if invalid */
export function parsePace(str) {
  if (!str) return null;
  const [m, s] = str.split(":").map(Number);
  if (isNaN(m) || isNaN(s)) return null;
  return m * 60 + s;
}

/** Seconds → "M:SS" string, null if falsy */
export function secsTopace(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60), s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Compute race pace string from goal label + goal time string */
export function computeRacePace(goal, goalTime) {
  const dist = RACE_DISTANCES[goal];
  if (!dist || !goalTime) return null;
  const parts = goalTime.split(":").map(Number);
  let secs;
  if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
  else if (parts.length === 2) secs = parts[0] * 60 + (parts[1] || 0);
  else return null;
  if (!secs) return null;
  return secsTopace(Math.round(secs / dist));
}

/** Compute threshold and long run training paces from a fitness pace (sec/km).
 *  Threshold: 8% faster than fitness pace (lactate threshold effort).
 *  Long run:  20% slower than fitness pace (easy aerobic effort).
 *  Returns { threshold, longRun } as "M:SS" strings, or null for each if invalid. */
export function computeTrainingPaces(fitnessPaceSecs) {
  if (!fitnessPaceSecs || fitnessPaceSecs <= 0) return { threshold: null, longRun: null };
  return {
    threshold: secsTopace(Math.round(fitnessPaceSecs * 0.92)),
    longRun:   secsTopace(Math.round(fitnessPaceSecs * 1.20)),
  };
}

/** Compute goal time string from goal label + race pace string */
export function computeGoalTime(goal, racePace) {
  const dist = RACE_DISTANCES[goal];
  const paceSecs = parsePace(racePace);
  if (!dist || !paceSecs) return null;
  const t = Math.round(paceSecs * dist);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Week helpers ──────────────────────────────────────────────────────────────

/** Returns the Monday of the week containing `date` as "YYYY-MM-DD" */
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getCurrentWeekStart() { return getWeekStart(new Date()); }

/**
 * Given a date string and a weekPlan, return the DAY_LABELS entry ("Mon"…"Sun")
 * if the session falls in that plan's week, or null otherwise.
 */
export function getPlannedDay(sessionDate, weekPlan) {
  if (!weekPlan?.weekStart || !sessionDate) return null;
  if (getWeekStart(sessionDate) !== weekPlan.weekStart) return null;
  const d = new Date(sessionDate + "T00:00:00");
  return DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

/**
 * Auto-link a session to a plan week by matching the session date to a week
 * that has a generated plan. Returns { plannedDay, plannedWeekStart } or null.
 */
export function getAutoLink(sessionDate, weekPlans) {
  if (!sessionDate || !weekPlans?.length) return null;
  const sessionWeekStart = getWeekStart(sessionDate);
  const plan = weekPlans.find(p => p.weekStart === sessionWeekStart);
  if (!plan) return null;
  const d = new Date(sessionDate + "T00:00:00");
  return { plannedDay: DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1], plannedWeekStart: sessionWeekStart };
}

/**
 * Build the ordered list of week-start dates from currentWeekStart up to and
 * including the race week. Returns [] if raceDate is in the past or missing.
 */
export function getWeeksToRace(currentWeekStart, raceDate) {
  if (!raceDate) return [];
  const raceWS = getWeekStart(new Date(raceDate + "T00:00:00"));
  if (raceWS < currentWeekStart) return [];
  const weeks = [];
  let ws = currentWeekStart;
  while (ws <= raceWS) {
    weeks.push(ws);
    const d = new Date(ws + "T00:00:00");
    d.setDate(d.getDate() + 7);
    ws = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return weeks;
}

// ── Session matching ──────────────────────────────────────────────────────────

/**
 * Find the session for a specific plan-day, using date as the primary key and
 * explicit plan-link (plannedDay + plannedWeekStart) as fallback.
 *
 * This is the canonical matching logic used in both WeekDayList and WeekStrip.
 */
export function findLinkedSession(sessions, dayDateStr, day, weekPlanWeekStart) {
  if (!sessions?.length) return undefined;
  return (
    sessions.find(s => s.date === dayDateStr) ??
    sessions.find(s => s.plannedDay === day && s.plannedWeekStart === weekPlanWeekStart)
  );
}

/**
 * Returns ALL sessions for a given plan day — supports multiple sessions on the same date.
 * Date match takes priority; if any session matches by date, all date-matches are returned.
 * Falls back to plan-link matches (plannedDay + plannedWeekStart) when no date match exists.
 */
export function findLinkedSessions(sessions, dayDateStr, day, weekPlanWeekStart) {
  if (!sessions?.length) return [];
  const byDate = sessions.filter(s => s.date === dayDateStr);
  if (byDate.length > 0) return byDate;
  return sessions.filter(s => s.plannedDay === day && s.plannedWeekStart === weekPlanWeekStart);
}

/**
 * Returns true if a session's date falls within the given week (Mon–Sun).
 * Used by WeekStrip dots and the week summary bar.
 */
export function sessionInWeek(session, weekStart) {
  if (!session?.date || !weekStart) return false;
  return getWeekStart(session.date) === weekStart;
}

/**
 * Filter sessions to those belonging to a specific week (by date or explicit link).
 */
export function sessionsForWeek(sessions, weekStart) {
  return (sessions || []).filter(s =>
    s.plannedWeekStart === weekStart || sessionInWeek(s, weekStart)
  );
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Compute an automatic score (1–10) for a session against a week plan.
 * Uses pace vs target pace and/or RPE.
 */
export function computeAutoScore(session, weekPlan) {
  let paceScore = null;
  const tSecs = parsePace(weekPlan?.weekGoals?.targetPace);
  const aSecs = parsePace(session.avgPace);
  if (tSecs && aSecs) {
    const delta = aSecs - tSecs; // positive = slower than target
    paceScore = delta <= -30 ? 7
      : delta <= -10 ? 9
      : delta <= 10  ? 10
      : delta <= 30  ? 8
      : delta <= 60  ? 6
      : delta <= 120 ? 4
      : 2;
  }
  let rpeScore = null;
  const rpe = Number(session.rpe);
  if (rpe) {
    const m = { 1:3, 2:4, 3:5, 4:5, 5:6, 6:8, 7:9, 8:7, 9:5, 10:3 };
    rpeScore = m[rpe] ?? null;
  }
  if (paceScore !== null && rpeScore !== null)
    return { value: Math.round((paceScore + rpeScore) / 2), verdict: "Auto: pace + RPE" };
  if (paceScore !== null) return { value: paceScore, verdict: "Auto: pace" };
  if (rpeScore !== null) return { value: rpeScore, verdict: "Auto: RPE" };
  return null;
}

// ── Week summary helpers ──────────────────────────────────────────────────────

/**
 * Returns sessions in a given week that are run-type and have a distance logged.
 * Uses date-only matching (sessionInWeek) — does NOT count by plannedWeekStart,
 * which would cause cross-week bleed when a session's plan link is stale.
 */
export function weekRunSessions(sessions, weekStart) {
  return (sessions || []).filter(s =>
    sessionInWeek(s, weekStart) &&
    s.type?.startsWith("run") &&
    parseFloat(s.distance || "") > 0
  );
}

/**
 * Counts the number of run-type days in a daySessions plan map.
 * Only counts types starting with "run" — CrossFit and rest are excluded.
 */
export function countRunsPlanned(daySessions) {
  if (!daySessions) return 0;
  return Object.values(daySessions).filter(d => d?.type?.startsWith("run")).length;
}

// ── Bulk operations ───────────────────────────────────────────────────────────

/** Return a new sessions array with the given IDs removed (single-pass, no stale-closure issues). */
export function bulkDeleteSessions(sessions, ids) {
  const idSet = new Set(ids);
  return (sessions || []).filter(s => !idSet.has(s.id));
}

// ── Race date helpers ─────────────────────────────────────────────────────────

/** True if dayDateStr is strictly after raceDate. Used to hide days beyond race day. */
export function isDayAfterRace(dayDateStr, raceDate) {
  if (!raceDate) return false;
  return dayDateStr > raceDate;
}

/** True if dayDateStr equals raceDate. */
export function isDayRaceDay(dayDateStr, raceDate) {
  if (!raceDate) return false;
  return dayDateStr === raceDate;
}

/** True if a week is in the past (strictly before current week). */
export function isWeekInPast(weekStart) {
  return weekStart < getCurrentWeekStart();
}

// ── Plan vs actual comparison ─────────────────────────────────────────────────

/** Seconds → "H:MM:SS" or "M:SS" string, null if falsy or negative */
export function secsToTime(secs) {
  if (!secs || secs < 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Extract the leading distance (km) from a Claude-generated mainSet string.
 * Returns null for interval notation like "4x1km" or when no distance is found.
 */
export function parseDistanceFromMainSet(mainSet) {
  if (!mainSet) return null;
  // Primary: number at start of string followed by km, e.g. "12km at 5:15"
  const a = mainSet.match(/^(\d+(?:\.\d+)?)\s*km/i);
  if (a) return parseFloat(a[1]);
  // Secondary: distance before a qualifier, e.g. "Easy 12km at HR 135"
  const b = mainSet.match(/\b(\d+(?:\.\d+)?)\s*km\s+(?:at|@|easy|threshold|long|run)/i);
  if (b) return parseFloat(b[1]);
  return null;
}

/**
 * Compute signed deltas between a logged session and its week plan.
 * Returns { distDelta, plannedDist, paceDeltaSecs, targetPace } — values are null when data is absent.
 */
export function computePlanDeltas(session, weekPlan, mainSet) {
  const actualDist = parseFloat(session?.distance || "");
  const plannedDist = parseDistanceFromMainSet(mainSet);
  const distDelta = (!isNaN(actualDist) && actualDist > 0 && plannedDist !== null)
    ? parseFloat((actualDist - plannedDist).toFixed(2)) : null;

  const targetPace = weekPlan?.weekGoals?.targetPace || null;
  const actualPaceSecs = parsePace(session?.avgPace);
  const targetPaceSecs = parsePace(targetPace);
  const paceDeltaSecs = (actualPaceSecs !== null && targetPaceSecs !== null)
    ? actualPaceSecs - targetPaceSecs : null;

  return { distDelta, plannedDist, paceDeltaSecs, targetPace };
}

/**
 * Compute projected race finish time.
 * Source priority:
 *   1. garminPredicted in profile — direct fitness signal from Garmin's algorithms
 *   2. Weighted average of recent logged runs (fallback when no predicted time set)
 * Requires a valid race goal + race pace in profile.
 */
export function computeRaceProjection(sessions, profile) {
  const raceDist = RACE_DISTANCES[profile?.goal]
    || (profile?.goal === "Custom..." && profile?.goalCustomDist ? parseFloat(profile.goalCustomDist) : null);
  const goalPaceSecs = parsePace(profile?.racePace);
  if (!raceDist || !goalPaceSecs) return null;

  const goalTimeSecs = Math.round(goalPaceSecs * raceDist);

  // Priority 1: use Garmin predicted time — only for standard goals where the
  // prediction applies to the same race distance. Custom/trail goals skip this
  // because garminPredicted is typically a HM/Marathon estimate, not the custom race.
  const isStandardGoal = !!RACE_DISTANCES[profile?.goal];
  if (isStandardGoal && profile?.garminPredicted) {
    const parts = profile.garminPredicted.split(":").map(Number);
    let predSecs;
    if (parts.length === 3) predSecs = parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    else if (parts.length === 2) predSecs = parts[0] * 60 + (parts[1] || 0);
    if (predSecs && predSecs > 0) {
      const projPaceSecs = predSecs / raceDist;
      const gapSecs = predSecs - goalTimeSecs;
      return {
        projPace: secsTopace(Math.round(projPaceSecs)),
        projTime: secsToTime(predSecs),
        goalTime: secsToTime(goalTimeSecs),
        gapSecs,
        goalTimeSecs,
        sampleSize: null, // from Garmin, not from logged runs
        source: "garmin",
        pct: Math.min(100, Math.round((goalTimeSecs / predSecs) * 100)),
      };
    }
  }

  // Priority 2: weighted average of recent logged runs
  const runs = (sessions || [])
    .filter(s => s.type?.startsWith("run") && parsePace(s.avgPace) !== null)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  if (runs.length < 2) return null;

  let weightedSum = 0, totalWeight = 0;
  runs.forEach((s, i) => {
    const w = Math.pow(0.85, i);
    weightedSum += parsePace(s.avgPace) * w;
    totalWeight += w;
  });
  const projPaceSecs = weightedSum / totalWeight;
  const projTimeSecs = Math.round(projPaceSecs * raceDist);
  const gapSecs = projTimeSecs - goalTimeSecs;

  return {
    projPace: secsTopace(Math.round(projPaceSecs)),
    projTime: secsToTime(projTimeSecs),
    goalTime: secsToTime(goalTimeSecs),
    gapSecs,
    goalTimeSecs,
    sampleSize: runs.length,
    source: "runs",
    pct: Math.min(100, Math.round((goalTimeSecs / projTimeSecs) * 100)),
  };
}
