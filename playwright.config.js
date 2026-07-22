require('dotenv').config({ quiet: true });
const { defineConfig, devices } = require('@playwright/test');

// See .env.sample - copy it to .env to override these for your machine.
const BASE_URL = process.env.BASE_URL || 'https://dev.erpforce.co';
const WORKERS = process.env.WORKERS ? Number(process.env.WORKERS) : 1;

module.exports = defineConfig({
  testDir: './tests',

  // Run tests sequentially to avoid race conditions on shared data - only
  // override WORKERS in .env if you know the specs you're running don't
  // share state (see CLAUDE.md's "Sequential execution" note).
  fullyParallel: false,
  workers: WORKERS,

  retries: process.env.CI || 0,

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['./reporters/excel-reporter.js', { outputFile: 'Inventory_Test_Cases.xlsx' }],
  ],

  // Login once globally, reuse session for all tests
  globalSetup: require.resolve('./global-setup'),

  use: {
    baseURL: BASE_URL,
    storageState: 'auth.json',
    headless: false,
    slowMo: 500,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
