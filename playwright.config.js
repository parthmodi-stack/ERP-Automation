require('dotenv').config();
// NOTE ON BROWSER INSTALL LOCATION: this environment has, more than once, lost the Chromium
// binary from the default ~/.cache/ms-playwright between sessions (unrelated to any test/code
// change) - if `npx playwright test` fails with "Executable doesn't exist at
// .../chromium-XXXX/chrome-linux64/chrome", just run `npx playwright install chromium` again.
const { defineConfig, devices } = require("@playwright/test");

// See .env.sample - copy it to .env to override these for your machine.
const BASE_URL = process.env.BASE_URL || 'https://dev.erpforce.co';
const WORKERS = process.env.WORKERS ? Number(process.env.WORKERS) : 1;

module.exports = defineConfig({
  testDir: "./tests",

  // Run tests sequentially to avoid race conditions on shared data - only
  // override WORKERS in .env if you know the specs you're running don't
  // share state (see CLAUDE.md's "Sequential execution" note).
  fullyParallel: false,
  workers: WORKERS,

  // Playwright's own default is 30000ms - raised alongside actionTimeout below so a test with a
  // couple of slow steps has room to actually finish instead of hitting the per-test cap before
  // its own actions (each now allowed up to 25s) get the chance to.
  timeout: 60000,

  // expect().toBeVisible()-style assertions use their OWN default timeout (5000ms), separate
  // from actionTimeout - raised in step with it so a slow-to-render page fails assertions at the
  // same threshold actions are now given.
  expect: { timeout: 25000 },

  retries: process.env.CI || 0,

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['./reporters/excel-reporter.js', { outputFile: 'Inventory_Test_Cases.xlsx' }],
  ],

  // Login once globally, reuse session for all tests
  globalSetup: require.resolve("./global-setup"),

  use: {
    baseURL: BASE_URL,
    storageState: "auth.json",
    slowMo: 500,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 25000,
    navigationTimeout: 30000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
