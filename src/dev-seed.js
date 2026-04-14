// ── Development seed data ─────────────────────────────────────────────────────
// Race: Half Marathon, 30 May 2026 (~6 weeks out from 14 Apr 2026)
// Schedule: 2–3 runs/week (Tue threshold, Thu easy, Sun long)
// Current fitness: long runs ~5:34–5:53/km, goal 5:15/km (1:50:46)
// Projection gauge shows ~1:56 vs 1:50 — realistically behind, achievable in 6 weeks

export const DEV_SEED = {
  profile: {
    name: "Test Runner",
    goal: "Half Marathon",
    goalCustom: "",
    goalDate: "2026-05-30",
    goalTime: "1:50:46",
    racePace: "5:15",
    thresholdPace: "4:55",
    longRunPace: "5:40",
    easyHR: "145",
    experience: "Intermediate",
    injuries: [],
    schedule: {
      Mon: "rest",
      Tue: "run_threshold",
      Wed: "rest",
      Thu: "run_easy",
      Fri: "rest",
      Sat: "rest",
      Sun: "run_long",
    },
  },

  // ── Week plans ────────────────────────────────────────────────────────────
  // mainSets start with a distance so the delta row fires in the day card.
  weekPlans: [
    {
      // Week 1 of 8 — early build, 2 runs
      weekStart: "2026-03-02",
      weekGoals: {
        totalDistance: 18,
        longRunDistance: 11,
        runsPlanned: 2,
        targetPace: "5:20",
        dayGoals: {
          Thu: "Easy aerobic base — keep HR under 145",
          Sun: "First long run of the block — run easy, build confidence",
        },
        daySessions: {
          Thu: {
            type: "run_easy",
            mainSet: "7km easy at HR 140 or below. No pressure — settle into rhythm.",
          },
          Sun: {
            type: "run_long",
            mainSet: "11km at 5:20/km pace. Run the first 4km easy, last 7km at target.",
          },
        },
      },
    },
    {
      // Week 2 of 8 — build, 3 runs
      weekStart: "2026-03-09",
      weekGoals: {
        totalDistance: 27,
        longRunDistance: 12,
        runsPlanned: 3,
        targetPace: "5:15",
        dayGoals: {
          Tue: "First threshold session — controlled effort",
          Thu: "Easy aerobic — recover from Tuesday",
          Sun: "Build long run distance",
        },
        daySessions: {
          Tue: {
            type: "run_threshold",
            mainSet: "7km threshold — 1.5km warm-up, 4km at 4:55/km, 1.5km cool-down",
          },
          Thu: {
            type: "run_easy",
            mainSet: "8km easy at HR 140. Flush out Thursday's lactate, stay conversational.",
          },
          Sun: {
            type: "run_long",
            mainSet: "12km at 5:20/km pace. Progressive: 4km easy, 6km at target, 2km relaxed.",
          },
        },
      },
    },
    {
      // Week 4 of 8 — build, 3 runs (week 3 is unplanned recovery)
      weekStart: "2026-03-23",
      weekGoals: {
        totalDistance: 32,
        longRunDistance: 15,
        runsPlanned: 3,
        targetPace: "5:15",
        dayGoals: {
          Tue: "Tempo effort — push the threshold",
          Thu: "Easy recovery run",
          Sun: "Longest run so far — stay aerobic",
        },
        daySessions: {
          Tue: {
            type: "run_threshold",
            mainSet: "8km threshold — 1.5km warm-up, 5km at 4:55/km, 1.5km cool-down",
          },
          Thu: {
            type: "run_easy",
            mainSet: "9km easy at HR 142. Keep effort light — Tuesday was hard.",
          },
          Sun: {
            type: "run_long",
            mainSet: "15km at 5:15/km pace. 5km easy build, 8km at target, 2km relaxed finish.",
          },
        },
      },
    },
    {
      // Week 5 of 8 — peak build, 3 runs
      weekStart: "2026-03-30",
      weekGoals: {
        totalDistance: 36,
        longRunDistance: 17,
        runsPlanned: 3,
        targetPace: "5:15",
        dayGoals: {
          Tue: "Peak threshold session this block",
          Thu: "Easy 10km — aerobic maintenance",
          Sun: "Peak long run — biggest run before taper",
        },
        daySessions: {
          Tue: {
            type: "run_threshold",
            mainSet: "9km threshold — 2km warm-up, 5km at 4:52/km, 2km cool-down",
          },
          Thu: {
            type: "run_easy",
            mainSet: "10km easy at HR 142. Long and relaxed — don't push.",
          },
          Sun: {
            type: "run_long",
            mainSet: "17km at 5:15/km pace. 5km easy, 10km at target pace, 2km relaxed. This is your biggest run.",
          },
        },
      },
    },
    {
      // Week 6 of 8 — recovery/cutback, 2 runs
      weekStart: "2026-04-06",
      weekGoals: {
        totalDistance: 23,
        longRunDistance: 14,
        runsPlanned: 2,
        targetPace: "5:15",
        dayGoals: {
          Thu: "Easy shakeout — legs should feel fresh",
          Sun: "Long run — back off from last week, stay controlled",
        },
        daySessions: {
          Thu: {
            type: "run_easy",
            mainSet: "8km easy at HR 140. Recovery week — genuinely easy.",
          },
          Sun: {
            type: "run_long",
            mainSet: "12km at 5:15/km pace. Progressive build: 4km easy start, 6km at target pace, 2km relaxed finish. Monitor injury sites closely.",
          },
        },
      },
    },
    {
      // Week 7 of 8 — current week, sharpening phase
      weekStart: "2026-04-13",
      weekGoals: {
        totalDistance: 30,
        longRunDistance: 14,
        runsPlanned: 3,
        targetPace: "5:15",
        dayGoals: {
          Tue: "Race-pace work — get comfortable at 5:15/km",
          Thu: "Easy 8km — keep HR low",
          Sun: "Last big long run before taper starts",
        },
        daySessions: {
          Tue: {
            type: "run_threshold",
            mainSet: "8km — 2km warm-up, 4km at race pace 5:15/km, 2km cool-down",
          },
          Thu: {
            type: "run_easy",
            mainSet: "8km easy at HR 140. Short and easy — save legs for Sunday.",
          },
          Sun: {
            type: "run_long",
            mainSet: "14km at 5:15/km pace. Last big effort — 4km easy, 8km at target, 2km relaxed.",
          },
        },
      },
    },
  ],

  // ── Sessions — 10 runs over 6 weeks ──────────────────────────────────────
  // Paces are gradually improving. Projection shows ~1:56 vs goal 1:50:46.
  // Apr 12 session intentionally matches the screenshot.
  sessions: [
    // ── Week of Mar 2 — 2 runs ──
    {
      id: "seed-1",
      type: "run_easy",
      date: "2026-03-05",
      distance: "7.2",
      avgPace: "5:52",
      avgHR: "135",
      maxHR: "148",
      cadence: "166",
      elevation: "38",
      rpe: "4",
      te: "2.5",
      notes: "Easy Thursday — first run of the block",
      plannedDay: "Thu",
      plannedWeekStart: "2026-03-02",
    },
    {
      id: "seed-2",
      type: "run_long",
      date: "2026-03-08",
      distance: "10.4",
      avgPace: "5:58",
      avgHR: "143",
      maxHR: "160",
      cadence: "165",
      elevation: "78",
      rpe: "5",
      te: "3.1",
      notes: "First long run — felt comfortable",
      plannedDay: "Sun",
      plannedWeekStart: "2026-03-02",
    },

    // ── Week of Mar 9 — 3 runs ──
    {
      id: "seed-3",
      type: "run_threshold",
      date: "2026-03-10",
      distance: "6.8",
      avgPace: "5:03",
      avgHR: "164",
      maxHR: "177",
      cadence: "174",
      elevation: "31",
      rpe: "7",
      te: "3.6",
      notes: "First threshold — harder than expected",
      plannedDay: "Tue",
      plannedWeekStart: "2026-03-09",
    },
    {
      id: "seed-4",
      type: "run_easy",
      date: "2026-03-12",
      distance: "8.1",
      avgPace: "5:47",
      avgHR: "138",
      maxHR: "151",
      cadence: "167",
      elevation: "44",
      rpe: "4",
      te: "2.7",
      notes: "Easy legs after Tuesday",
      plannedDay: "Thu",
      plannedWeekStart: "2026-03-09",
    },
    {
      id: "seed-5",
      type: "run_long",
      date: "2026-03-15",
      distance: "12.3",
      avgPace: "5:53",
      avgHR: "147",
      maxHR: "163",
      cadence: "166",
      elevation: "92",
      rpe: "6",
      te: "3.4",
      notes: "Long run — legs heavy from Tuesday still",
      plannedDay: "Sun",
      plannedWeekStart: "2026-03-09",
    },

    // ── Week of Mar 16 — 2 runs, no plan (recovery week) ──
    {
      id: "seed-6",
      type: "run_easy",
      date: "2026-03-19",
      distance: "8.0",
      avgPace: "5:44",
      avgHR: "138",
      maxHR: "150",
      cadence: "168",
      elevation: "36",
      rpe: "4",
      te: "2.6",
      notes: "Easy recovery",
    },
    {
      id: "seed-7",
      type: "run_long",
      date: "2026-03-22",
      distance: "13.1",
      avgPace: "5:49",
      avgHR: "148",
      maxHR: "162",
      cadence: "167",
      elevation: "104",
      rpe: "6",
      te: "3.3",
      notes: "Felt better than last Sunday",
    },

    // ── Week of Mar 23 — 3 runs ──
    {
      id: "seed-8",
      type: "run_threshold",
      date: "2026-03-24",
      distance: "7.6",
      avgPace: "4:59",
      avgHR: "167",
      maxHR: "179",
      cadence: "175",
      elevation: "28",
      rpe: "8",
      te: "3.9",
      notes: "Strong threshold — pace felt more natural",
      plannedDay: "Tue",
      plannedWeekStart: "2026-03-23",
    },
    {
      id: "seed-9",
      type: "run_easy",
      date: "2026-03-26",
      distance: "9.2",
      avgPace: "5:41",
      avgHR: "140",
      maxHR: "153",
      cadence: "169",
      elevation: "51",
      rpe: "5",
      te: "2.9",
      notes: "Easy run",
      plannedDay: "Thu",
      plannedWeekStart: "2026-03-23",
    },
    {
      id: "seed-10",
      type: "run_long",
      date: "2026-03-29",
      distance: "15.2",
      avgPace: "5:45",
      avgHR: "150",
      maxHR: "166",
      cadence: "167",
      elevation: "138",
      rpe: "7",
      te: "3.8",
      notes: "Longest run so far — last 3km were tough",
      plannedDay: "Sun",
      plannedWeekStart: "2026-03-23",
    },

    // ── Week of Mar 30 — 3 runs ──
    {
      id: "seed-11",
      type: "run_threshold",
      date: "2026-03-31",
      distance: "8.4",
      avgPace: "4:57",
      avgHR: "169",
      maxHR: "181",
      cadence: "176",
      elevation: "34",
      rpe: "8",
      te: "4.0",
      notes: "Best threshold yet",
      plannedDay: "Tue",
      plannedWeekStart: "2026-03-30",
    },
    {
      id: "seed-12",
      type: "run_easy",
      date: "2026-04-02",
      distance: "10.1",
      avgPace: "5:37",
      avgHR: "142",
      maxHR: "155",
      cadence: "170",
      elevation: "58",
      rpe: "5",
      te: "3.0",
      notes: "Easy 10km",
      plannedDay: "Thu",
      plannedWeekStart: "2026-03-30",
    },
    {
      id: "seed-13",
      type: "run_long",
      date: "2026-04-05",
      distance: "17.4",
      avgPace: "5:41",
      avgHR: "154",
      maxHR: "169",
      cadence: "168",
      elevation: "196",
      rpe: "8",
      te: "4.2",
      notes: "Peak long run — really dug in after 14km",
      plannedDay: "Sun",
      plannedWeekStart: "2026-03-30",
    },

    // ── Week of Apr 6 — 2 runs (recovery cutback) ──
    {
      id: "seed-14",
      type: "run_easy",
      date: "2026-04-09",
      distance: "8.3",
      avgPace: "5:35",
      avgHR: "141",
      maxHR: "153",
      cadence: "169",
      elevation: "42",
      rpe: "4",
      te: "2.8",
      notes: "Easy Thursday — legs feel good after cutback",
      plannedDay: "Thu",
      plannedWeekStart: "2026-04-06",
    },
    {
      // Matches the screenshot: SUN 12 Apr, planned 12km @ 5:15, actual 14.36km 5:34 HR 153
      id: "seed-15",
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
