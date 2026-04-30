import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))
const buildDate = new Date().toLocaleDateString("en-GB", { day:"numeric", month:"short" })

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'SUPABASE_'],
  define: { __APP_VERSION__: JSON.stringify(`${version} · ${buildDate}`) },
  build: { outDir: 'dist' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
