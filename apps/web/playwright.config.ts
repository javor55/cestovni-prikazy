import { defineConfig, devices } from '@playwright/test';

// E2E_BASE_URL = test běžící aplikace (např. kontejneru Docker) místo náhledu Vite.
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: external ?? 'http://localhost:4173',
    locale: 'cs-CZ',
    timezoneId: 'Europe/Prague',
  },
  projects: [
    { name: 'mobil-320', use: { ...devices['Pixel 5'], viewport: { width: 320, height: 640 } } },
    { name: 'mobil', use: { ...devices['Pixel 5'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
  ...(!external && {
    webServer: {
      command: 'pnpm vite build && pnpm vite preview --strictPort',
      port: 4173,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  }),
});
