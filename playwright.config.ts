import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'android', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'ipad', use: { ...devices['iPad Mini'], browserName: 'webkit' } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 960 }, browserName: 'chromium' } },
    { name: 'small-phone', use: { viewport: { width: 320, height: 740 }, isMobile: true, browserName: 'chromium' } },
  ],
})
