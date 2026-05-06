import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))
const buildDate = new Date().toLocaleDateString("en-GB", { day:"numeric", month:"short" })
// Vercel sets VERCEL_GIT_COMMIT_SHA on every deploy; GitHub Actions sets GITHUB_SHA.
// Falls back to "dev" for local builds. Show short 7-char SHA in the badge.
const sha = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'dev').slice(0, 7)

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'SUPABASE_'],
  define: { __APP_VERSION__: JSON.stringify(`${version} · ${sha} · ${buildDate}`) },
  build: { outDir: 'dist' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
