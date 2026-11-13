// End-to-end tests against site/ served by tests/serve.mjs with the production security headers. Chromium only.
// Locally, PW_CHROMIUM_PATH can point at an already installed Chromium; CI runs `npx playwright install --with-deps chromium`.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 4393);
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.mjs$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  timeout: 60_000,
  // The canvas animation is heavy on software-rendered headless Chromium; two workers keep timings stable.
  workers: 2,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Most tests run without motion (the site honours prefers-reduced-motion); the animated scan has its own test.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: executablePath ? { executablePath } : {} } },
  ],
  webServer: {
    command: 'node tests/serve.mjs',
    cwd: '../..',
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
