// ── Development seed data ─────────────────────────────────────────────────────
// Realistic test fixture for local dev and Vercel preview testing.
// Load via the "Load sample data" button (visible at ?dev in the URL).
// Covers: race projection gauge, day card plan-vs-actual deltas, Claude analysis.

export const DEV_SEED = {
  profile: {
    name: "Test Runner",
    goal: "Half Marathon",
    goalCustom: "",
    goalDate: "2026-10-04",
    goalTime: "1:50:46",
    racePace: "5:15",
    thresholdPace: "4:50",
    longRunPace: "5:40",
    easyHR: "145",
    experience: "Intermediate",
    injuries: [],
    schedule: {
      Mon: "rest",
      Tue: "run_threshold",
      Wed: "crossfit",
      Thu: "run_easy",
      Fri: "crossfit",
      Sat: "crossfit",
      Sun: "run_long",
    },
  },

  // ── Week plans — mainSets start with distances so delta row fires ─────────
  weekPlans: [
    {
      weekStart: "2026-03-09",
      weekGoals: {
        totalDistance: 45,
        longRunDistance: 14,
        runsPlanned: 3,
        targetPace: "5:15",
        dayGoals: {
          Thu: "Easy aerobic base — keep HR under 145",
          Sun: "Build aerobic endurance safely",
        },
        daySessions: {
          Tue: {
            type: "run_threshold",
            mainSet: "8km threshold — 2km warm-up, 5km at 4:50/km, 1km cool-down",
          },
          Thu: {
            type: "run_easy",
            mainSet: "8km easy at HR 145 or below. Focus on relaxed form.",
          },
          Sun: {
            type: "run_long",
            mainSet:
              "14km at 5:15/km pace. Progressive build: 4km easy start, 6km at target pace, 2km relaxed finish.",
          },
        },
      },
    },
    {
      weekStart: "2026-03-30",
      weekGoals: {
        totalDistance: 52,
        longRunDistance: 18,
        runsPlanned: 3,
        targetPace: "5:15",
        dayGoals: {
          Thu: "Aerobic maintenance — easy effort",
          Sun: "Peak long run — biggest effort of the block",
        },
        daySessions: {
          Tue: {
            type: "run_threshold",
            mainSet:
              "10km threshold — 2km warm-up, 7km at 4:50/km, 1km cool-down",
          },
          Thu: {
            type: "run_easy",
            mainSet: "10km easy at HR 145. Recover from Tuesday.",
          },
          Sun: {
            type: "run_long",
            mainSet:
              "18km long run at 5:15/km. 6km easy build, 10km steady at target, 2km relaxed.",
          },
        },
      },
    },
    {
      weekStart: "2026-04-06",
      weekGoals: {
        totalDistance: 50,
        longRunDistance: 12,
        runsPlanned: 3,
        targetPace: "5:15",
        dayGoals: {
          Thu: "Recovery — easy effort only",
          Sun: "Long run — monitor effort closely",
        },
        daySessions: {
          Tue: {
            type: "run_interval",
            mainSet: "6x800m @ 3:58/km with 90s rest — 2km warm-up, intervals, 1km cool-down",
          },
          Thu: {
            type: "run_easy",
            mainSet: "8km easy at HR 145. Flush out Tuesday's lactate.",
          },
          Sun: {
            type: "run_long",
            mainSet:
              "12km at 5:15/km pace. Progressive build: 4km easy start, 6km at target pace, 2km relaxed finish. Monitor injury sites closely.",
          },
        },
      },
    },
  ],

  // ── Sessions — 8 runs over ~5 weeks, recent paces ~5:34–5:50 ─────────────
  // Projection will show ~1:59 vs goal 1:50:46 — clearly "behind goal" signal.
  sessions: [
    {
      id: "seed-1",
      type: "run_easy",
      date: "2026-03-12",
      distance: "8.2",
      avgPace: "5:43",
      avgHR: "139",
      maxHR: "152",
      cadence: "168",
      elevation: "45",
      rpe: "5",
      te: "2.8",
      notes: "Easy Thursday run",
      plannedDay: "Thu",
      plannedWeekStart: "2026-03-09",
    },
    {
      id: "seed-2",
      type: "run_long",
      date: "2026-03-15",
      distance: "14.1",
      avgPace: "5:49",
      avgHR: "148",
      maxHR: "165",
      cadence: "166",
      elevation: "112",
      rpe: "6",
      te: "3.4",
      notes: "Morning long run — legs felt heavy early",
      plannedDay: "Sun",
      plannedWeekStart: "2026-03-09",
    },
    {
      id: "seed-3",
      type: "run_easy",
      date: "2026-03-19",
      distance: "9.0",
      avgPace: "5:40",
      avgHR: "141",
      maxHR: "158",
      cadence: "169",
      elevation: "38",
      rpe: "5",
      te: "2.9",
      notes: "Good easy run",
    },
    {
      id: "seed-4",
      type: "run_long",
      date: "2026-03-22",
      distance: "16.2",
      avgPace: "5:43",
      avgHR: "150",
      maxHR: "168",
      cadence: "167",
      elevation: "134",
      rpe: "7",
      te: "3.6",
      notes: "Longest run so far — felt strong",
    },
    {
      id: "seed-5",
      type: "run_easy",
      date: "2026-04-02",
      distance: "9.8",
      avgPace: "5:37",
      avgHR: "143",
      maxHR: "156",
      cadence: "170",
      elevation: "52",
      rpe: "5",
      te: "3.0",
      notes: "Easy recovery run",
      plannedDay: "Thu",
      plannedWeekStart: "2026-03-30",
    },
    {
      id: "seed-6",
      type: "run_long",
      date: "2026-04-05",
      distance: "18.5",
      avgPace: "5:41",
      avgHR: "153",
      maxHR: "172",
      cadence: "167",
      elevation: "198",
      rpe: "8",
      te: "4.1",
      notes: "Peak long run — tough finish",
      plannedDay: "Sun",
      plannedWeekStart: "2026-03-30",
    },
    {
      id: "seed-7",
      type: "run_easy",
      date: "2026-04-09",
      distance: "8.1",
      avgPace: "5:38",
      avgHR: "142",
      maxHR: "154",
      cadence: "169",
      elevation: "41",
      rpe: "5",
      te: "2.8",
      notes: "Easy Thursday",
      plannedDay: "Thu",
      plannedWeekStart: "2026-04-06",
    },
    {
      // Matches the screenshot: SUN 12 Apr, planned 12km @ 5:15, actual 14.36km 5:34 HR 153
      id: "seed-8",
      type: "run_long",
      date: "2026-04-12",
      distance: "14.36",
      avgPace: "5:34",
      avgHR: "153",
      maxHR: "171",
      cadence: "168",
      elevation: "124",
      rpe: "7",
      te: "3.8",
      notes: "Long Run",
      plannedDay: "Sun",
      plannedWeekStart: "2026-04-06",
    },
  ],

  strava: null,
  weekScheduleOverrides: {},
};
