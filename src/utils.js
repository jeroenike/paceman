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
