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
