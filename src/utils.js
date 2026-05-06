// ── Pure utility functions ────────────────────────────────────────────────────
// All functions here are side-effect free and fully unit-testable.

export const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export const SESSION_TYPES = ["rest","run_threshold","run_easy","run_long","run_medium_long","run_marathon_pace","run_hills","crossfit","run_interval"];

export const SESSION_COLORS = {
  rest:"#888780", run_threshold:"#1B6FE8", run_easy:"#0F6E56",
  run_long:"#3B6D11", run_medium_long:"#5A8A1E", run_marathon_pace:"#C2610A",
  run_hills:"#8B5E3C", crossfit:"#993C1D", run_interval:"#7C3AED",
};

export const SESSION_LABELS = {
  rest:"Rest", run_threshold:"Threshold", run_easy:"Easy Run",
  run_long:"Long Run", run_medium_long:"Medium Long", run_marathon_pace:"Marathon Pace",
  run_hills:"Hill Repeats", crossfit:"CrossFit", run_interval:"Intervals",
};

export const MARATHON_DEFAULT_SCHEDULE = {
  Mon:"rest", Tue:"run_threshold", Wed:"run_medium_long",
  Thu:"run_easy", Fri:"rest", Sat:"run_easy", Sun:"run_long",
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
 * Target pace is session-type-aware:
 *   - run_threshold / run_interval → weekPlan.weekGoals.targetPace
 *   - run_long                     → longRunPace from profile
 *   - run_easy                     → no pace comparison (paceDeltaSecs = null)
 * Returns { distDelta, plannedDist, paceDeltaSecs, targetPace }.
 */
export function computePlanDeltas(session, weekPlan, mainSet, sessionType, longRunPace) {
  const actualDist = parseFloat(session?.distance || "");
  const plannedDist = parseDistanceFromMainSet(mainSet);
  const distDelta = (!isNaN(actualDist) && actualDist > 0 && plannedDist !== null)
    ? parseFloat((actualDist - plannedDist).toFixed(2)) : null;

  const type = sessionType || session?.type;
  let targetPace = null;
  if (type === "run_threshold" || type === "run_interval") {
    targetPace = weekPlan?.weekGoals?.targetPace || null;
  } else if (type === "run_long") {
    targetPace = longRunPace || null;
  }
  // run_easy: targetPace stays null — no meaningful pace target

  const actualPaceSecs = parsePace(session?.avgPace);
  const targetPaceSecs = parsePace(targetPace);
  const paceDeltaSecs = (actualPaceSecs !== null && targetPaceSecs !== null)
    ? actualPaceSecs - targetPaceSecs : null;

  return { distDelta, plannedDist, paceDeltaSecs, targetPace };
}

/**
 * Derive threshold pace from a race pace string.
 * Uses ~6.5% faster than race pace (Jack Daniels T-pace methodology).
 * e.g. 5:15/km race pace → 4:55/km threshold
 */
export function deriveThresholdPace(racePaceStr) {
  const secs = parsePace(racePaceStr);
  if (!secs) return null;
  return secsTopace(Math.round(secs * 0.935));
}

/**
 * Derive long run pace from a race pace string.
 * Uses ~7.5% slower than race pace (aerobic base zone).
 * e.g. 5:15/km race pace → 5:39/km long run
 */
export function deriveLongRunPace(racePaceStr) {
  const secs = parsePace(racePaceStr);
  if (!secs) return null;
  return secsTopace(Math.round(secs * 1.075));
}

/**
 * Normalize injuries to [{area, severity}] format.
 * Handles legacy string[] data stored before severity was added.
 */
export function normalizeInjuries(injuries) {
  if (!Array.isArray(injuries)) return [];
  return injuries.filter(i => i !== "__none__").map(i =>
    typeof i === "string" ? { area: i, severity: null } : i
  );
}

/** Stringify injuries for AI prompts, including severity when present. */
export function injuriesToText(injuries) {
  return normalizeInjuries(injuries)
    .map(i => i.severity ? `${i.area} (${i.severity}/5)` : i.area)
    .join(", ") || "none";
}

/**
 * Compute projected race finish time.
 * Source priority:
 *   1. garminPredicted — only for standard goals (5km/10km/HM/Marathon) where
 *      Garmin's prediction applies to the same race distance.
 *   2. Weighted average of threshold/interval sessions (best race pace predictors).
 *      Falls back to all run sessions when fewer than 2 quality sessions exist.
 * Custom/Trail goals skip garminPredicted (it's a different-race estimate).
 */
export function computeRaceProjection(sessions, profile) {
  const raceDist = RACE_DISTANCES[profile?.goal]
    || (profile?.goal === "Custom..." && profile?.goalCustomDist ? parseFloat(profile.goalCustomDist) : null);
  const goalPaceSecs = parsePace(profile?.racePace);
  if (!raceDist || !goalPaceSecs) return null;

  const goalTimeSecs = Math.round(goalPaceSecs * raceDist);

  // Priority 1: Garmin predicted time (standard goals only)
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
        sampleSize: null,
        source: "garmin",
        usingQualitySessions: false,
        pct: Math.min(100, Math.round((goalTimeSecs / predSecs) * 100)),
      };
    }
  }

  // Priority 2: weighted average of recent runs (quality sessions preferred)
  const allRuns = (sessions || [])
    .filter(s => s.type?.startsWith("run") && parsePace(s.avgPace) !== null)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const qualityRuns = allRuns.filter(s => s.type === "run_threshold" || s.type === "run_interval");
  const usingQualitySessions = qualityRuns.length >= 2;
  const runs = usingQualitySessions ? qualityRuns.slice(0, 8) : allRuns.slice(0, 8);

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
    usingQualitySessions,
    pct: Math.min(100, Math.round((goalTimeSecs / projTimeSecs) * 100)),
  };
}

// ── Schedule rotation helpers ─────────────────────────────────────────────────

/**
 * Resolve the session type for a given day and week number, accounting for
 * rotation pools. When a day has a rotation pool (≥2 types), cycles through
 * them in order: week 1 → index 0, week 2 → index 1, etc.
 * Falls back to the fixed schedule type when no rotation is defined.
 */
export function getDaySessionType(day, weekNumber, schedule, scheduleRotations) {
  const rotation = scheduleRotations?.[day];
  if (rotation && rotation.length >= 2) {
    const idx = weekNumber > 0 ? (weekNumber - 1) % rotation.length : 0;
    return rotation[idx];
  }
  return schedule?.[day] || "rest";
}

/**
 * Returns a human-readable rotation label for the AI prompt, e.g.:
 * "Threshold (rotation 2 of 3: Intervals → Threshold → Marathon Pace)"
 * Returns null if the day has no rotation.
 */
export function getRotationLabel(day, weekNumber, scheduleRotations) {
  const rotation = scheduleRotations?.[day];
  if (!rotation || rotation.length < 2) return null;
  const idx = weekNumber > 0 ? (weekNumber - 1) % rotation.length : 0;
  const labels = rotation.map(t => SESSION_LABELS[t] || t);
  return `${labels[idx]} (rotation ${idx + 1} of ${rotation.length}: ${labels.join(" → ")})`;
}

// ── Training periodization ─────────────────────────────────────────────────────

export function getTrainingPhase(weeksToRace, weekNumber, totalWeeks) {
  if (weeksToRace === null || weeksToRace === undefined) return null;
  if (weeksToRace <= 0) return {
    key:"race", name:"Race Week", color:"#FFF8ED", textColor:"#B07000",
    description:"Race day is here. Stay calm, trust your training, execute the plan.",
  };
  if (weeksToRace <= 3) return {
    key:"taper", name:"Taper", color:"#E8F5F0", textColor:"#0A6E5C",
    description:"Reduce volume: −30% week 1, −50% week 2, −60% race week. Keep 1 quality session per week at race pace. Strides daily.",
  };
  if (weeksToRace === 4) return {
    key:"peak", name:"Peak", color:"#FFF4E8", textColor:"#C2610A",
    description:"Highest volume and intensity. Final big training block — absorb it fully before the 3-week taper.",
  };
  if (weekNumber && weekNumber % 4 === 0) return {
    key:"recovery", name:"Recovery", color:"#F5F5F3", textColor:"#666",
    description:"Planned down week — reduce volume ~20%, easy effort only. Let the body absorb recent load.",
  };
  if (totalWeeks && weekNumber && weekNumber <= Math.ceil(totalWeeks / 3)) return {
    key:"base", name:"Base", color:"#EAF4F0", textColor:"#0F6E56",
    description:"Build aerobic foundation with easy volume and hill work. No hard quality sessions yet.",
  };
  return {
    key:"build", name:"Build", color:"#EEF3FF", textColor:"#1B6FE8",
    description:"Develop race-specific fitness with threshold, marathon-pace work, and progressive long runs.",
  };
}

export function getDistanceGuidance(raceDist, experience) {
  if (!raceDist) return null;
  if (raceDist >= 42) {
    const weekly = experience === "club_athlete" ? "65–90" : experience === "competitive_recreational" ? "55–75" : "45–65";
    const longStart = experience === "club_athlete" ? "20–24" : experience === "competitive_recreational" ? "18–22" : "16–20";
    const longPeak = experience === "club_athlete" ? "34–38" : experience === "competitive_recreational" ? "32–35" : "30–32";
    return `MARATHON volume targets: weekly total ${weekly}km. Long run is the primary driver — start at ${longStart}km in early weeks, add ~2km per non-recovery week, peak at ${longPeak}km (4 weeks out). Long run can be 40–50% of weekly volume. Threshold sessions 10–14km total. Do NOT generate half-marathon-level volumes.`;
  }
  if (raceDist >= 21) {
    const weekly = experience === "club_athlete" ? "55–70" : experience === "competitive_recreational" ? "45–60" : "35–50";
    const longPeak = experience === "club_athlete" ? "20–26" : experience === "competitive_recreational" ? "18–24" : "16–20";
    return `HALF MARATHON volume targets: weekly total ${weekly}km, long run building to ${longPeak}km peak, threshold sessions 10–14km total.`;
  }
  if (raceDist >= 10) {
    return `10K volume targets: weekly total 30–55km, long run building to 14–20km peak, threshold sessions 8–12km total.`;
  }
  return `5K volume targets: weekly total 25–45km, long run building to 12–16km peak, threshold sessions 6–10km total.`;
}

/**
 * Returns all coaching rules across every training phase, annotated with
 * the phase keys in which each rule is active.
 * Used to show the user which rules are applied now vs. coming in future phases.
 */
// ── Schedule validator ────────────────────────────────────────────────────────

const HARD_SESSION_TYPES = ["run_threshold", "run_interval", "run_marathon_pace"];
const RUN_SESSION_TYPES  = ["run_threshold", "run_interval", "run_marathon_pace", "run_easy", "run_long", "run_medium_long"];

/**
 * Validates a profile's schedule and rotation pool against critical coaching
 * rules. Returns an array of { id, rule, status, message, fix } objects —
 * one entry per rule regardless of pass/fail, so the user sees the full picture.
 * status: "pass" | "fail" | "warn"
 */
export function validateSchedule(schedule, scheduleRotations, raceDist) {
  const sched = schedule || {};
  const rotations = scheduleRotations || {};
  const isMarathon = raceDist != null && raceDist >= 42;
  const results = [];

  // Helper: all type values across schedule and every rotation pool
  const allConfiguredTypes = [
    ...DAY_LABELS.map(d => sched[d]).filter(Boolean),
    ...Object.values(rotations).flat(),
  ];

  // ── 1. Long run present ──────────────────────────────────────────────────
  const hasLongRun = DAY_LABELS.some(d => sched[d] === "run_long");
  results.push({
    id: "long_run_present",
    rule: "Long run in schedule",
    status: hasLongRun ? "pass" : "fail",
    message: hasLongRun
      ? "Long run is scheduled"
      : "No long run found in weekly schedule",
    fix: hasLongRun ? null : "Set one day (typically Sunday) to Long Run",
  });

  // ── 2. 80/20 hard/easy balance ───────────────────────────────────────────
  const hardDays = DAY_LABELS.filter(d => HARD_SESSION_TYPES.includes(sched[d]));
  const runDays  = DAY_LABELS.filter(d => RUN_SESSION_TYPES.includes(sched[d]));
  const hardPct  = runDays.length > 0 ? hardDays.length / runDays.length : 0;
  const hardPctLabel = `${Math.round(hardPct * 100)}%`;
  results.push({
    id: "eighty_twenty",
    rule: "80/20 hard/easy balance",
    status: hardPct <= 0.2 ? "pass" : "fail",
    message: hardPct <= 0.2
      ? `${hardDays.length} hard / ${runDays.length} runs (${hardPctLabel}) — within the 20% cap`
      : `${hardDays.length} hard / ${runDays.length} runs (${hardPctLabel}) — exceeds 20% hard cap`,
    fix: hardPct > 0.2
      ? `Convert ${hardDays.length - Math.floor(runDays.length * 0.2)} session(s) to Easy Run or rest`
      : null,
  });

  // ── 3. No back-to-back hard sessions ────────────────────────────────────
  const backToBack = [];
  for (let i = 0; i < DAY_LABELS.length - 1; i++) {
    const d1 = DAY_LABELS[i], d2 = DAY_LABELS[i + 1];
    if (HARD_SESSION_TYPES.includes(sched[d1]) && HARD_SESSION_TYPES.includes(sched[d2])) {
      backToBack.push(`${d1}+${d2}`);
    }
  }
  results.push({
    id: "no_back_to_back_hard",
    rule: "No consecutive hard sessions",
    status: backToBack.length === 0 ? "pass" : "fail",
    message: backToBack.length === 0
      ? "No consecutive hard session days"
      : `Consecutive hard days: ${backToBack.join(", ")}`,
    fix: backToBack.length > 0
      ? `Insert an Easy Run or Rest day between ${backToBack[0].replace("+", " and ")}`
      : null,
  });

  // ── 4. CrossFit not on Friday ─────────────────────────────────────────────
  const friIsCrossfit = sched["Fri"] === "crossfit";
  results.push({
    id: "crossfit_placement",
    rule: "CrossFit not on Friday",
    status: friIsCrossfit ? "fail" : "pass",
    message: friIsCrossfit
      ? "CrossFit is on Friday — adds fatigue directly before the long run weekend"
      : "CrossFit is not scheduled on Friday",
    fix: friIsCrossfit ? "Move Friday to Rest or Easy Run. Put CrossFit on Monday instead" : null,
  });

  if (isMarathon) {
    // ── 5. Tuesday rotation pool ───────────────────────────────────────────
    const tueRotation = rotations["Tue"] || [];
    const hasIntervals = tueRotation.includes("run_interval");
    const hasThreshold = tueRotation.includes("run_threshold") || sched["Tue"] === "run_threshold";
    const hasMP        = tueRotation.includes("run_marathon_pace");
    const tueRotates   = tueRotation.length >= 2;

    let tueStatus, tueMessage, tueFix;
    if (!tueRotates) {
      tueStatus  = "fail";
      tueMessage = `Tuesday is fixed as ${SESSION_LABELS[sched["Tue"]] || "one type"} every week — no rotation`;
      tueFix     = "Add a rotation pool on Tuesday: Intervals → Threshold → Marathon Pace";
    } else if (!hasIntervals || !hasThreshold || !hasMP) {
      const missing = [
        !hasIntervals && "Intervals",
        !hasThreshold && "Threshold",
        !hasMP        && "Marathon Pace",
      ].filter(Boolean);
      tueStatus  = "warn";
      tueMessage = `Tuesday rotates but is missing: ${missing.join(", ")}`;
      tueFix     = `Add ${missing.join(", ")} to Tuesday's rotation pool`;
    } else {
      tueStatus  = "pass";
      tueMessage = "Tuesday rotates through Intervals → Threshold → Marathon Pace";
      tueFix     = null;
    }
    results.push({ id: "tuesday_rotation", rule: "Tuesday intensity rotation", status: tueStatus, message: tueMessage, fix: tueFix });

    // ── 6. VO2max intervals somewhere in schedule/rotations ───────────────
    const hasIntervalAnywhere = allConfiguredTypes.includes("run_interval");
    results.push({
      id: "vo2max_intervals",
      rule: "VO2max intervals included",
      status: hasIntervalAnywhere ? "pass" : "warn",
      message: hasIntervalAnywhere
        ? "Interval sessions are included in the schedule or a rotation pool"
        : "No interval sessions (VO2max work) anywhere in schedule or rotation pools",
      fix: hasIntervalAnywhere ? null : "Add 'Intervals' to Tuesday's rotation pool",
    });

    // ── 7. Medium-long run present ─────────────────────────────────────────
    const hasMediumLong = DAY_LABELS.some(d => sched[d] === "run_medium_long");
    results.push({
      id: "medium_long_present",
      rule: "Medium-long run in schedule",
      status: hasMediumLong ? "pass" : "fail",
      message: hasMediumLong
        ? "Medium-long run is scheduled (typically Thursday)"
        : "No medium-long run in schedule — critical for marathon aerobic base",
      fix: hasMediumLong ? null : "Set Thursday to Medium Long Run",
    });

    // ── 8. Thursday rotation (if it's medium-long) ────────────────────────
    const thuIsMediumLong = sched["Thu"] === "run_medium_long";
    const thuRotation     = rotations["Thu"] || [];
    if (thuIsMediumLong) {
      results.push({
        id: "thursday_rotation",
        rule: "Thursday medium-long rotation",
        status: thuRotation.length >= 2 ? "pass" : "warn",
        message: thuRotation.length >= 2
          ? "Thursday medium-long run has a rotation pool"
          : "Thursday medium-long has no rotation — same stimulus every week",
        fix: thuRotation.length < 2
          ? "Rotate Thursday between: Medium Long → Marathon Pace → Hill Repeats (or Easy Run)"
          : null,
      });
    }

    // ── 9. Marathon pace included ─────────────────────────────────────────
    const hasMPAnywhere = allConfiguredTypes.includes("run_marathon_pace");
    results.push({
      id: "marathon_pace_included",
      rule: "Marathon pace sessions included",
      status: hasMPAnywhere ? "pass" : "warn",
      message: hasMPAnywhere
        ? "Marathon pace sessions are included in the schedule or a rotation pool"
        : "No marathon pace sessions anywhere in schedule or rotation pools",
      fix: hasMPAnywhere ? null : "Add 'Marathon Pace' to Tuesday's rotation pool",
    });

    // ── 10. No MP stacking on Tue + Thu ─────────────────────────────────────────
    const tueMayHaveMP = sched["Tue"] === "run_marathon_pace" || (rotations["Tue"] || []).includes("run_marathon_pace");
    const thuMayHaveMP = sched["Thu"] === "run_marathon_pace" || (rotations["Thu"] || []).includes("run_marathon_pace");
    const tueAlwaysMP  = sched["Tue"] === "run_marathon_pace" && !(rotations["Tue"] || []).length;
    const thuAlwaysMP  = sched["Thu"] === "run_marathon_pace" && !(rotations["Thu"] || []).length;
    if (tueMayHaveMP && thuMayHaveMP) {
      results.push({
        id: "mp_stacking",
        rule: "No MP stacking on Tue+Thu",
        status: (tueAlwaysMP && thuAlwaysMP) ? "fail" : "warn",
        message: "Marathon Pace can appear on both Tuesday and Thursday — risks stacking 2 hard MP sessions in one week",
        fix: "Remove Marathon Pace from Thursday's rotation. Keep MP on Tuesday; use Medium Long or Hill Repeats for Thursday.",
      });
    } else {
      results.push({
        id: "mp_stacking",
        rule: "No MP stacking on Tue+Thu",
        status: "pass",
        message: "Marathon Pace is not scheduled on both Tuesday and Thursday simultaneously",
        fix: null,
      });
    }
  }

  return results;
}

export function getAllCoachingRules(raceDist, experience, easyHR) {
  const phaseKeys = ["base", "build", "peak", "taper"];
  const rulePhases = new Map();
  phaseKeys.forEach(key => {
    buildCoachingRules(raceDist, experience, easyHR, { key }).forEach(rule => {
      if (!rulePhases.has(rule)) rulePhases.set(rule, []);
      rulePhases.get(rule).push(key);
    });
  });
  return Array.from(rulePhases.entries()).map(([rule, phases]) => ({ rule, phases }));
}

export function buildCoachingRules(raceDist, experience, easyHR, phase) {
  const isMarathon = raceDist != null && raceDist >= 42;
  const phaseKey = phase?.key;
  const rules = [];

  rules.push("Build volume ~10% per week (unless recovery/taper week)");

  if (isMarathon) {
    rules.push("Long run progresses independently as the primary adaptation driver — percentage cap does not apply for marathon");

    if (phaseKey === "base") {
      rules.push("BASE PHASE RESTRICTION: Only easy runs (HR-based), strides from week 2+, and light hill work. NO threshold sessions, NO marathon pace, NO VO2max intervals. Aerobic foundation only — intensity added in Build phase.");
      rules.push("Early long runs (weeks 2–6): run last 3–5km slightly faster than easy pace — NOT marathon pace. Builds fatigue resistance without race-specificity stress.");
    }

    if (phaseKey === "build" || phaseKey === "peak") {
      rules.push("Progression long runs: from week 5 onward, run the final 5–12km at marathon race pace to build race specificity");
      rules.push("Tuesday intensity MUST ROTATE every 3 weeks — VO2max intervals (5–6×1km at 5K effort) → Threshold (8–10km at threshold pace) → Marathon pace (10km at race pace). Never threshold every single Tuesday");
      rules.push("Thursday medium-long stimulus must ROTATE weekly: Week A = steady finish (last 4–5km at 15–20s/km faster than easy), Week B = hill-based (5–8×60–90s uphill efforts, jog-down recovery), Week C = MP block (5–8km at race pace — only if no other MP session that week). Never repeat the same structure two weeks running. All-easy Thursday runs are wasted miles for a performance goal");
      rules.push("MP STACKING RULE: Marathon pace counts as a hard session. If Sunday long run includes an MP segment → Thursday MUST NOT include MP. Max 1 dedicated MP session (Tuesday OR Thursday) + 1 MP segment in long run per week. Never stack MP on Tue+Thu+Sun in the same week.");
      rules.push("Long run MP segments must progress each non-recovery week: 6–8km MP in early Build → 10km MP in mid-Build → 12–14km MP in late Build/Peak");
      rules.push("Long run stimulus must VARY week-to-week: rotate between progression finish (last 5–8km faster), rolling terrain in the final third, and broken MP blocks (e.g. 3×4km at race pace with 2min easy). Never repeat the same long run structure two consecutive weeks");
      rules.push("Downhill conditioning: include controlled downhill running at least every 2 weeks. Cue: relaxed upper body, quick turnover, avoid braking. Builds eccentric quad strength for late-race durability");
      rules.push("Include 1 hill session every 2 weeks: replace Wednesday easy run with 6–8×90s hard uphill efforts (jog down recovery). Critical for hilly marathon courses");
    }
  } else {
    rules.push("Long run = 30–40% of weekly volume");
  }

  if (isMarathon && phaseKey === "peak") {
    rules.push("Peak long run must reach 30–32km for recreational/competitive athletes. A 24km peak long run prepares for completion only, not performance");
    rules.push("PEAK WEEK MP LIMIT: max 1 dedicated MP session on Tuesday OR Thursday (not both), plus 1 MP segment inside the long run. No triple MP stacking (Tue+Thu+Sun). Thursday in peak week must NOT include MP if Tuesday already has MP.");
    rules.push("Race simulation: at least 2 long runs this phase must include ≥10km at marathon pace within the final 12km, on rolling terrain. This bridges training to race execution");
  }

  rules.push("80/20 rule: at least 80% of weekly volume must be easy effort. Hard volume (threshold + intervals + marathon pace combined) must not exceed 20% of total weekly km");
  rules.push("Hard sessions max 2×/week, never back-to-back");
  rules.push("run_interval = VO2max work: 5×1000–1200m at 5K effort, 2–3 min recovery. Use in Build/Peak phase only — not during Base");
  rules.push("run_threshold = lactate threshold: 10–14km total at threshold pace (sustained, or 3×3km with 2 min rest)");

  if (isMarathon) {
    rules.push("run_marathon_pace = sustained goal race pace: 12–18km total. Use in Build/Peak phase");
    rules.push("Effort-based pacing: MP and steady efforts must NOT be pace-locked. Allow 10–30 sec/km pace drop on climbs without forcing correction. Prevents overexertion on rolling courses");
    rules.push("No racing in training: MP and long runs must finish controlled. If athlete cannot sustain MP → reduce volume, do NOT force pace. Overreaching causes inconsistency and injury");
    rules.push("Fatigue override: if HR is 5–8 bpm above baseline OR legs feel heavy → downgrade the session to easy effort. Protect the long run above all other sessions");
    rules.push("Cross-training (crossfit days): low-impact only — cycling, swimming, elliptical. No high-intensity CrossFit during marathon training");
    rules.push("CrossFit on Monday only — never Friday. Friday CrossFit creates compounded fatigue into the long run weekend. Peak weeks: max 1 CrossFit session, no heavy lower-body work (squats, deadlifts, box jumps)");
  }

  if (isMarathon && (phaseKey === "build" || phaseKey === "peak" || phaseKey === "taper")) {
    rules.push("Long runs ≥18km must include fueling practice: gel at 45 min, every 25–30 min after. Nutrition execution on race day is a skill that must be trained");
  }

  if (isMarathon && phaseKey === "taper") {
    rules.push("TAPER INTENSITY: NO VO2max intervals (no 5K-pace work) during taper weeks. Replace with short marathon pace blocks (3–6km total) and strides. Keep 1 quality MP-focused session per week. Stay sharp, not fatigued.");
  }

  rules.push(`Easy runs at HR ${easyHR || "below 145"} bpm, truly conversational`);
  rules.push("Strides: 6×80–100m relaxed accelerations at the end of easy runs, 2–3 times/week from week 3 onward. Not a hard effort — smooth build to ~5K pace then float down");
  rules.push("mainSet: specific targets — exact distance, pace, reps, rest, HR zone");
  rules.push("Taper: drop volume 30% in taper week 1, 50% in week 2, 60% in race week. Keep 1 quality session per taper week at race pace. Race-pace strides daily");

  return rules;
}
