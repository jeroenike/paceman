# Paceman — Running Coach App

## Deploy to Vercel (5 minutes)

### 1. Install dependencies
```bash
npm install
```

### 2. Push to GitHub
```bash
git init
git add .
git commit -m "Initial Paceman app"
gh repo create paceman --public --push
```

### 3. Deploy to Vercel
```bash
npx vercel --prod
```

### 4. Add environment variables in Vercel dashboard
Go to: vercel.com → paceman project → Settings → Environment Variables

Add these three:
- `STRAVA_CLIENT_ID` = 215675
- `STRAVA_CLIENT_SECRET` = (your new secret from strava.com/settings/api)
- `STRAVA_REFRESH_TOKEN` = (your refresh token)

### 5. Update Strava callback domain
Go to strava.com/settings/api → update "Authorization Callback Domain" to your Vercel URL (e.g. paceman.vercel.app)

### 6. Add to iPhone home screen
Open your Vercel URL in Safari → Share → Add to Home Screen

## Features

### Adaptive training plan
- AI-generated weekly plans, periodised (base → build → peak → taper → race)
  with deterministic JS-side invariants (see `CLAUDE.md`).
- The plan adapts to what you actually ran: if last week was under-completed,
  regenerating the current week repeats the progression step instead of
  blindly ramping volume.
- Per-day adjustments: feeling strong/tired toggles, pain-area logging, and
  one-tap schedule overrides regenerate just that day's session.

### Strava + Garmin sync
- **Strava**: once connected, new runs sync automatically every time the app
  opens — auto-linked to their plan day and auto-scored against targets. A
  manual import remains on the Log screen.
- **Garmin**: enable *Garmin Connect → Strava auto-upload* and watch-recorded
  runs flow straight into Paceman. The optional Garmin race predictor field
  in Profile sharpens training paces and the race projection.
  (Garmin's own API requires an approved partner program, so Strava is the
  bridge.)

### Injury prevention
- Acute:chronic workload ratio (ACWR) monitoring from your logged runs — the
  Home screen shows your load zone, and elevated/high load injects hard
  volume caps into plan generation.
- Logged injuries (with severity) deterministically ban risky session types
  (e.g. Achilles → no hills, no intervals); severity 4+/5 swaps quality work
  for rest or low-impact cross-training.

### Gamification
- Week streak (🔥) tracked on the Home screen — the current week never breaks
  a streak until it's over.
- 12 achievement badges (runs, total km, longest run, streaks, plan
  adherence) with progress bars on the Progress screen.
