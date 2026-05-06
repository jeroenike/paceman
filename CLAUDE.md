# CLAUDE.md — Marathon Plan Generator Invariants

This file documents the non-negotiable rules the marathon plan generator must
satisfy. They exist because external review caught violations of each one.
Treat them as contracts, not preferences.

## Architecture

The plan generator is split across three layers:

1. **Profile inputs** (`store.profile`) — goal, goal time, race date, training
   start, race pace, easy HR, experience tier, weekly schedule, schedule
   rotations, injuries. The profile is the source of truth and is never
   mutated by the generator.
2. **Deterministic JS layer** (`src/utils.js`) — periodisation, per-week
   targets, prompt-time schedule overrides, derived paces, coaching-rule
   strings. Anything that must be true regardless of LLM behaviour lives here.
3. **AI layer** (`buildWeekPlanGoals` / `generateDayPlan` in `src/App.jsx`) —
   the LLM fills in `mainSet` text and any per-day prose, constrained by the
   prompt assembled from layers 1 and 2.

When a coaching invariant must always hold, encode it in layer 2 and verify it
with a unit test — do not rely on layer 3 alone.

## Invariants

### I-1. Race day is the race
- The user's `goalDate` is the race. The Sunday of the race week is **not** a
  training session — it is the marathon.
- The plan generator MUST NOT prescribe a separate training run on race day.
  The race-week prompt explicitly tells the AI that `daySessions.Sun` is the
  race itself.
- All renderers (in-app `WeekDayList` and `buildPrintHTML`) MUST detect
  `dayDateStr === raceDate` and render a race-day tile/row showing the race
  distance and race pace, regardless of what the AI emitted for Sunday.
- Days strictly after race day are hidden in both renderers.

### I-2. Recovery weeks are easy-only
- `getTrainingPhase` flags every 4th week (when not in peak/taper/race) as
  recovery. On recovery weeks:
  - `applyPhaseSchedule` swaps `run_threshold`, `run_marathon_pace`,
    `run_interval`, and `run_hills` to `run_easy` at prompt time.
  - `buildCoachingRules` injects an explicit "RECOVERY PHASE RESTRICTION"
    rule.
  - `buildWeekPlanGoals` injects a `MANDATORY RECOVERY WEEK` constraint.
  - `computeLongRunTarget` shortens the long run to ~75 % of the build-ramp
    value and removes the MP segment.
- The user's day pattern (which days are run vs rest vs cross) is preserved.
  Only intensity is downgraded.

### I-3. MP sessions run at exactly race pace
- Every `run_marathon_pace` session and every MP segment inside a long run is
  prescribed at exactly `profile.racePace` (tight band ± 3 sec/km).
- A coaching rule pins this for marathon distance in build/peak/taper/recovery.
- `buildWeekPlanGoals` and `generateDayPlan` both inject an explicit
  `MANDATORY MP PACE` constraint string referencing `racePace`.

### I-4. Easy pace band is constant across the block
- `deriveEasyPace(racePace)` returns `{min, max}` at race pace + 60–90 sec/km.
- Both prompts inject `MANDATORY EASY PACE BAND: <min>–<max>/km, HR-capped at
  <easyHR>`. The band depends only on `racePace`, so it never drifts week to
  week.

### I-5. Long-run distance is deterministic and progressive
- `computeLongRunTarget(raceDist, experience, weekNumber, totalWeeks,
  phaseKey, weeksToRace)` returns `{longRunKm, mpFinishKm, isRace}` per week.
- Two consecutive non-recovery build weeks must not have identical long-run
  distance — verified by unit test (`W9–W11 in a 17-week marathon all have
  DIFFERENT long-run distances`).
- Build weeks ramp the MP segment from 6 km → 12 km. Recovery weeks have no
  MP segment. Race week has no training long run.

### I-6. No hills or intervals in the final 14 days
- `applyPhaseSchedule` swaps `run_hills` and `run_interval` to `run_easy` for
  taper and race phases.
- `buildCoachingRules` adds a `FINAL 14 DAYS` rule banning hill repeats.
- `buildWeekPlanGoals` adds a `MANDATORY TAPER RULE` covering the same
  constraint.

### I-7. Profile inputs always influence the plan
- The user's stored `profile.schedule` and `profile.scheduleRotations` are
  never mutated. All phase-based downgrades happen at prompt-time only on a
  copy.
- Day pattern (run vs rest vs cross), the long-run day, the rotation order on
  Build/Peak weeks, goal pace, race date, training start, experience tier and
  injuries all flow into the prompt unchanged.
- The only intensity overrides are the periodisation-driven ones in I-2 and
  I-6. They are non-negotiable.

### I-8. Cross-week invariants live in code, not in the prompt
- Anything the AI must satisfy across multiple weeks (long-run progression,
  easy-pace consistency, MP pace, threshold ramp) is computed in JS and
  injected as a deterministic constraint string for that week.
- One-line previous-week summaries in the prompt are too thin a signal for
  multi-week consistency. Add a JS-side computation instead.

## When to add a new invariant

Add a new section to this file when:
- An external review catches a generator output that contradicts the plan's
  own week-type rules.
- A periodisation rule cannot be expressed as a single coaching-rule string
  and requires JS-side computation.
- A coaching rule must hold regardless of LLM nondeterminism.

Each new invariant should be backed by:
1. A pure function in `utils.js` (when computation is involved).
2. A unit test in `utils.test.js`.
3. A prompt-time injection in `App.jsx` (`buildWeekPlanGoals` or
   `generateDayPlan`) that surfaces the constraint to the AI.

## Tests

Run `npm test` (alias for `vitest run`) before committing changes to the
generator. The test suite includes:

- `getTrainingPhase` — phase boundaries
- `buildCoachingRules` — per-phase rule presence
- `applyPhaseSchedule` — recovery/taper/race downgrades
- `computeLongRunTarget` — per-week distances and MP segments
- `deriveEasyPace`, `deriveThresholdPace`, `deriveLongRunPace` — pace
  derivations
- `validateSchedule` — schedule rotation rules
