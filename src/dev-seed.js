// ── Development seed data ──────────────────────────────────────────────────
// Three scenarios for testing the race projection gauge colour states.
// All scenarios: Half Marathon 1:50:46 goal, race 30 May 2026 (~6 weeks out).
//
// GREEN  "Alex"   — on track; recent sessions near/below goal pace → projected 1:49:xx → ahead
// ORANGE "Sam"    — achievable with effort; ~5:34 behind, 6 weeks is enough
// RED    "Jordan" — high risk; paces too slow, 6 weeks can't close a 20+ min gap

// ── Shared week plan structure (same dates/structure for all 3 scenarios) ─

function makeWeekPlans(targetPace, threshPace, longPace, easyPace) {
  return [
    {
      weekStart: "2026-03-02",
      weekGoals: {
        totalDistance: 18, longRunDistance: 11, runsPlanned: 2, targetPace,
        dayGoals: { Thu: "Easy aerobic base", Sun: "First long run of the block" },
        daySessions: {
          Thu: { type: "run_easy", mainSet: `7km easy at ${easyPace}/km. Settle into rhythm.` },
          Sun: { type: "run_long", mainSet: `11km at ${longPace}/km. Run the first 4km easy.` },
        },
      },
    },
    {
      weekStart: "2026-03-09",
      weekGoals: {
        totalDistance: 27, longRunDistance: 12, runsPlanned: 3, targetPace,
        dayGoals: { Tue: "First threshold session", Thu: "Easy aerobic", Sun: "Build long run distance" },
        daySessions: {
          Tue: { type: "run_threshold", mainSet: `7km — 1.5km warm-up, 4km at ${threshPace}/km, 1.5km cool-down` },
          Thu: { type: "run_easy", mainSet: `8km easy at ${easyPace}/km.` },
          Sun: { type: "run_long", mainSet: `12km at ${longPace}/km. Progressive effort.` },
        },
      },
    },
    {
      weekStart: "2026-03-23",
      weekGoals: {
        totalDistance: 32, longRunDistance: 15, runsPlanned: 3, targetPace,
        dayGoals: { Tue: "Tempo effort", Thu: "Easy recovery run", Sun: "Longest run so far" },
        daySessions: {
          Tue: { type: "run_threshold", mainSet: `8km — 1.5km warm-up, 5km at ${threshPace}/km, 1.5km cool-down` },
          Thu: { type: "run_easy", mainSet: `9km easy at ${easyPace}/km.` },
          Sun: { type: "run_long", mainSet: `15km at ${longPace}/km. Stay aerobic.` },
        },
      },
    },
    {
      weekStart: "2026-03-30",
      weekGoals: {
        totalDistance: 36, longRunDistance: 17, runsPlanned: 3, targetPace,
        dayGoals: { Tue: "Peak threshold session", Thu: "Easy 10km", Sun: "Peak long run" },
        daySessions: {
          Tue: { type: "run_threshold", mainSet: `9km — 2km warm-up, 5km at ${threshPace}/km, 2km cool-down` },
          Thu: { type: "run_easy", mainSet: `10km easy at ${easyPace}/km.` },
          Sun: { type: "run_long", mainSet: `17km at ${longPace}/km. Biggest run of the block.` },
        },
      },
    },
    {
      weekStart: "2026-04-06",
      weekGoals: {
        totalDistance: 23, longRunDistance: 14, runsPlanned: 2, targetPace,
        dayGoals: { Thu: "Easy shakeout", Sun: "Long run — stay controlled" },
        daySessions: {
          Thu: { type: "run_easy", mainSet: `8km easy at ${easyPace}/km. Recovery week.` },
          Sun: { type: "run_long", mainSet: `12km at ${longPace}/km. Monitor effort closely.` },
        },
      },
    },
    {
      weekStart: "2026-04-13",
      weekGoals: {
        totalDistance: 30, longRunDistance: 14, runsPlanned: 3, targetPace,
        dayGoals: { Tue: "Race-pace work", Thu: "Easy 8km", Sun: "Last big long run before taper" },
        daySessions: {
          Tue: { type: "run_threshold", mainSet: `8km — 2km warm-up, 4km at race pace ${targetPace}/km, 2km cool-down` },
          Thu: { type: "run_easy", mainSet: `8km easy at ${easyPace}/km.` },
          Sun: { type: "run_long", mainSet: `14km at ${longPace}/km. Last big effort.` },
        },
      },
    },
  ];
}

const BASE_PROFILE = {
  goal: "Half Marathon",
  goalCustom: "",
  goalDate: "2026-05-30",
  goalTime: "1:50:46",
  racePace: "5:15",
  experience: "Intermediate",
  injuries: [],
  schedule: {
    Mon: "rest", Tue: "run_threshold", Wed: "rest",
    Thu: "run_easy", Fri: "rest", Sat: "rest", Sun: "run_long",
  },
};

// ── GREEN — Alex — On track / ahead of goal ────────────────────────────────
// Weighted avg of last 8 sessions ≈ 5:12/km → projected ~1:49:40 → 1:04 ahead
// weeklyEffortNeeded = 0 (ahead) → green "Ahead of goal"

export const DEV_SEED_GREEN = {
  profile: {
    ...BASE_PROFILE,
    name: "Alex",
    garminPredicted: "1:46:00",
    easyHR: "142",
  },
  weekPlans: makeWeekPlans("5:12", "4:50", "5:20", "5:35"),
  sessions: [
    // Seeds 1–7: earlier runs, don't affect projection (algo takes last 8)
    { id:"g-1", type:"run_easy",      date:"2026-03-05", distance:"7.1", avgPace:"5:44", avgHR:"138", cadence:"167", elevation:"36", rpe:"4", te:"2.4", plannedDay:"Thu", plannedWeekStart:"2026-03-02" },
    { id:"g-2", type:"run_long",      date:"2026-03-08", distance:"10.8",avgPace:"5:38", avgHR:"145", cadence:"166", elevation:"72", rpe:"5", te:"3.0", plannedDay:"Sun", plannedWeekStart:"2026-03-02" },
    { id:"g-3", type:"run_threshold", date:"2026-03-10", distance:"6.9", avgPace:"5:04", avgHR:"165", cadence:"174", elevation:"30", rpe:"7", te:"3.5", plannedDay:"Tue", plannedWeekStart:"2026-03-09" },
    { id:"g-4", type:"run_easy",      date:"2026-03-12", distance:"8.0", avgPace:"5:42", avgHR:"140", cadence:"168", elevation:"42", rpe:"4", te:"2.6", plannedDay:"Thu", plannedWeekStart:"2026-03-09" },
    { id:"g-5", type:"run_long",      date:"2026-03-15", distance:"12.1",avgPace:"5:35", avgHR:"148", cadence:"167", elevation:"88", rpe:"6", te:"3.3", plannedDay:"Sun", plannedWeekStart:"2026-03-09" },
    { id:"g-6", type:"run_easy",      date:"2026-03-19", distance:"8.2", avgPace:"5:38", avgHR:"139", cadence:"168", elevation:"38", rpe:"4", te:"2.5" },
    { id:"g-7", type:"run_long",      date:"2026-03-22", distance:"13.0",avgPace:"5:33", avgHR:"149", cadence:"167", elevation:"100","rpe":"5", te:"3.2" },
    // Seeds 8–15: last 8 runs → these drive the projection
    { id:"g-8",  type:"run_threshold",date:"2026-03-24", distance:"7.8", avgPace:"5:02", avgHR:"166", cadence:"175", elevation:"29", rpe:"8", te:"3.8", plannedDay:"Tue", plannedWeekStart:"2026-03-23" },
    { id:"g-9",  type:"run_easy",     date:"2026-03-26", distance:"9.1", avgPace:"5:40", avgHR:"141", cadence:"169", elevation:"48", rpe:"4", te:"2.8", plannedDay:"Thu", plannedWeekStart:"2026-03-23" },
    { id:"g-10", type:"run_long",     date:"2026-03-29", distance:"15.3",avgPace:"5:18", avgHR:"151", cadence:"168", elevation:"134","rpe":"7", te:"3.9", plannedDay:"Sun", plannedWeekStart:"2026-03-23" },
    { id:"g-11", type:"run_threshold",date:"2026-03-31", distance:"8.5", avgPace:"4:55", avgHR:"168", cadence:"176", elevation:"33", rpe:"8", te:"4.0", plannedDay:"Tue", plannedWeekStart:"2026-03-30" },
    { id:"g-12", type:"run_easy",     date:"2026-04-02", distance:"10.2",avgPace:"5:32", avgHR:"143", cadence:"170", elevation:"55", rpe:"4", te:"2.9", plannedDay:"Thu", plannedWeekStart:"2026-03-30" },
    { id:"g-13", type:"run_long",     date:"2026-04-05", distance:"17.2",avgPace:"5:15", avgHR:"155", cadence:"169", elevation:"190","rpe":"8", te:"4.2", plannedDay:"Sun", plannedWeekStart:"2026-03-30" },
    { id:"g-14", type:"run_threshold",date:"2026-04-09", distance:"8.3", avgPace:"4:52", avgHR:"169", cadence:"177", elevation:"28", rpe:"8", te:"4.1", plannedDay:"Thu", plannedWeekStart:"2026-04-06" },
    { id:"g-15", type:"run_long",     date:"2026-04-12", distance:"14.4",avgPace:"5:12", avgHR:"154", cadence:"169", elevation:"122","rpe":"7", te:"3.9", plannedDay:"Sun", plannedWeekStart:"2026-04-06" },
  ],
  strava: null,
  weekScheduleOverrides: {},
};

// ── ORANGE — Sam — Achievable with effort ─────────────────────────────────
// Weighted avg ≈ 5:45/km → projected ~1:56:20 → 5:34 behind with 6 weeks left
// weeklyEffortNeeded ≈ 0.008 → orange "Achievable with effort"

export const DEV_SEED_ORANGE = {
  profile: {
    ...BASE_PROFILE,
    name: "Sam",
    garminPredicted: "1:52:00",
    easyHR: "145",
  },
  weekPlans: makeWeekPlans("5:15", "4:55", "5:40", "5:50"),
  sessions: [
    { id:"o-1",  type:"run_easy",      date:"2026-03-05", distance:"7.2", avgPace:"5:52", avgHR:"135", cadence:"166", elevation:"38", rpe:"4", te:"2.5", plannedDay:"Thu", plannedWeekStart:"2026-03-02" },
    { id:"o-2",  type:"run_long",      date:"2026-03-08", distance:"10.4",avgPace:"5:58", avgHR:"143", cadence:"165", elevation:"78", rpe:"5", te:"3.1", plannedDay:"Sun", plannedWeekStart:"2026-03-02" },
    { id:"o-3",  type:"run_threshold", date:"2026-03-10", distance:"6.8", avgPace:"5:03", avgHR:"164", cadence:"174", elevation:"31", rpe:"7", te:"3.6", plannedDay:"Tue", plannedWeekStart:"2026-03-09" },
    { id:"o-4",  type:"run_easy",      date:"2026-03-12", distance:"8.1", avgPace:"5:47", avgHR:"138", cadence:"167", elevation:"44", rpe:"4", te:"2.7", plannedDay:"Thu", plannedWeekStart:"2026-03-09" },
    { id:"o-5",  type:"run_long",      date:"2026-03-15", distance:"12.3",avgPace:"5:53", avgHR:"147", cadence:"166", elevation:"92", rpe:"6", te:"3.4", plannedDay:"Sun", plannedWeekStart:"2026-03-09" },
    { id:"o-6",  type:"run_easy",      date:"2026-03-19", distance:"8.0", avgPace:"5:44", avgHR:"138", cadence:"168", elevation:"36", rpe:"4", te:"2.6" },
    { id:"o-7",  type:"run_long",      date:"2026-03-22", distance:"13.1",avgPace:"5:49", avgHR:"148", cadence:"167", elevation:"104","rpe":"6", te:"3.3" },
    { id:"o-8",  type:"run_threshold", date:"2026-03-24", distance:"7.6", avgPace:"4:59", avgHR:"167", cadence:"175", elevation:"28", rpe:"8", te:"3.9", plannedDay:"Tue", plannedWeekStart:"2026-03-23" },
    { id:"o-9",  type:"run_easy",      date:"2026-03-26", distance:"9.2", avgPace:"5:41", avgHR:"140", cadence:"169", elevation:"51", rpe:"5", te:"2.9", plannedDay:"Thu", plannedWeekStart:"2026-03-23" },
    { id:"o-10", type:"run_long",      date:"2026-03-29", distance:"15.2",avgPace:"5:45", avgHR:"150", cadence:"167", elevation:"138","rpe":"7", te:"3.8", plannedDay:"Sun", plannedWeekStart:"2026-03-23" },
    { id:"o-11", type:"run_threshold", date:"2026-03-31", distance:"8.4", avgPace:"4:57", avgHR:"169", cadence:"176", elevation:"34", rpe:"8", te:"4.0", plannedDay:"Tue", plannedWeekStart:"2026-03-30" },
    { id:"o-12", type:"run_easy",      date:"2026-04-02", distance:"10.1",avgPace:"5:37", avgHR:"142", cadence:"170", elevation:"58", rpe:"5", te:"3.0", plannedDay:"Thu", plannedWeekStart:"2026-03-30" },
    { id:"o-13", type:"run_long",      date:"2026-04-05", distance:"17.4",avgPace:"5:41", avgHR:"154", cadence:"168", elevation:"196","rpe":"8", te:"4.2", plannedDay:"Sun", plannedWeekStart:"2026-03-30" },
    { id:"o-14", type:"run_easy",      date:"2026-04-09", distance:"8.3", avgPace:"5:35", avgHR:"141", cadence:"169", elevation:"42", rpe:"4", te:"2.8", plannedDay:"Thu", plannedWeekStart:"2026-04-06" },
    { id:"o-15", type:"run_long",      date:"2026-04-12", distance:"14.36",avgPace:"5:34",avgHR:"153", cadence:"168", elevation:"124","rpe":"7", te:"3.8", plannedDay:"Sun", plannedWeekStart:"2026-04-06" },
  ],
  strava: null,
  weekScheduleOverrides: {},
};

// ── RED — Jordan — High risk ───────────────────────────────────────────────
// Weighted avg ≈ 6:15/km → projected ~2:12 → 21+ min behind with 6 weeks left
// weeklyEffortNeeded ≈ 0.032 → red "High risk"
// Scenario: ambitious goal but training paces are far off — 6 weeks can't fix this.

export const DEV_SEED_RED = {
  profile: {
    ...BASE_PROFILE,
    name: "Jordan",
    garminPredicted: "",
    easyHR: "150",
  },
  weekPlans: makeWeekPlans("6:00", "5:35", "6:20", "6:40"),
  sessions: [
    { id:"r-1",  type:"run_easy",      date:"2026-03-05", distance:"6.8", avgPace:"6:48", avgHR:"152", cadence:"160", elevation:"34", rpe:"5", te:"2.2", plannedDay:"Thu", plannedWeekStart:"2026-03-02" },
    { id:"r-2",  type:"run_long",      date:"2026-03-08", distance:"9.6", avgPace:"6:52", avgHR:"158", cadence:"159", elevation:"68", rpe:"6", te:"2.8", plannedDay:"Sun", plannedWeekStart:"2026-03-02" },
    { id:"r-3",  type:"run_threshold", date:"2026-03-10", distance:"6.2", avgPace:"5:42", avgHR:"170", cadence:"168", elevation:"28", rpe:"8", te:"3.2", plannedDay:"Tue", plannedWeekStart:"2026-03-09" },
    { id:"r-4",  type:"run_easy",      date:"2026-03-12", distance:"7.4", avgPace:"6:44", avgHR:"153", cadence:"161", elevation:"40", rpe:"5", te:"2.4", plannedDay:"Thu", plannedWeekStart:"2026-03-09" },
    { id:"r-5",  type:"run_long",      date:"2026-03-15", distance:"11.2",avgPace:"6:50", avgHR:"160", cadence:"160", elevation:"84", rpe:"7", te:"3.0", plannedDay:"Sun", plannedWeekStart:"2026-03-09" },
    { id:"r-6",  type:"run_easy",      date:"2026-03-19", distance:"7.6", avgPace:"6:40", avgHR:"151", cadence:"162", elevation:"32", rpe:"5", te:"2.3" },
    { id:"r-7",  type:"run_long",      date:"2026-03-22", distance:"12.0",avgPace:"6:45", avgHR:"161", cadence:"160", elevation:"96", rpe:"7", te:"2.9" },
    { id:"r-8",  type:"run_threshold", date:"2026-03-24", distance:"6.8", avgPace:"5:40", avgHR:"172", cadence:"169", elevation:"26", rpe:"9", te:"3.4", plannedDay:"Tue", plannedWeekStart:"2026-03-23" },
    { id:"r-9",  type:"run_easy",      date:"2026-03-26", distance:"8.4", avgPace:"6:35", avgHR:"152", cadence:"163", elevation:"46", rpe:"5", te:"2.5", plannedDay:"Thu", plannedWeekStart:"2026-03-23" },
    { id:"r-10", type:"run_long",      date:"2026-03-29", distance:"14.1",avgPace:"6:42", avgHR:"162", cadence:"161", elevation:"126","rpe":"8", te:"3.3", plannedDay:"Sun", plannedWeekStart:"2026-03-23" },
    { id:"r-11", type:"run_threshold", date:"2026-03-31", distance:"7.0", avgPace:"5:38", avgHR:"173", cadence:"170", elevation:"30", rpe:"9", te:"3.5", plannedDay:"Tue", plannedWeekStart:"2026-03-30" },
    { id:"r-12", type:"run_easy",      date:"2026-04-02", distance:"9.3", avgPace:"6:30", avgHR:"153", cadence:"163", elevation:"52", rpe:"5", te:"2.6", plannedDay:"Thu", plannedWeekStart:"2026-03-30" },
    { id:"r-13", type:"run_long",      date:"2026-04-05", distance:"16.0",avgPace:"6:38", avgHR:"163", cadence:"161", elevation:"180","rpe":"8", te:"3.7", plannedDay:"Sun", plannedWeekStart:"2026-03-30" },
    { id:"r-14", type:"run_easy",      date:"2026-04-09", distance:"7.8", avgPace:"6:25", avgHR:"151", cadence:"163", elevation:"38", rpe:"5", te:"2.4", plannedDay:"Thu", plannedWeekStart:"2026-04-06" },
    { id:"r-15", type:"run_long",      date:"2026-04-12", distance:"13.5",avgPace:"6:18", avgHR:"162", cadence:"162", elevation:"118","rpe":"8", te:"3.5", plannedDay:"Sun", plannedWeekStart:"2026-04-06" },
  ],
  strava: null,
  weekScheduleOverrides: {},
};

// ── Legacy export (kept for backwards compat) ──────────────────────────────
export const DEV_SEED = DEV_SEED_ORANGE;
