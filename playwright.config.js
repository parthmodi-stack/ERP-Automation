require('dotenv').config();
// NOTE ON BROWSER INSTALL LOCATION: this environment has, more than once, lost the Chromium
// binary from the default ~/.cache/ms-playwright between sessions (unrelated to any test/code
// change) - if `npx playwright test` fails with "Executable doesn't exist at
// .../chromium-XXXX/chrome-linux64/chrome", just run `npx playwright install chromium` again.
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",

  // fullyParallel stays false: tests within a single spec file share module-level state
  // (e.g. a record created in one test is edited/deleted by a later test in the same file) and
  // must keep running in their written order on one worker. workers > 1 still parallelizes
  // across different spec FILES, which don't depend on each other's state.
  fullyParallel: false,
  workers: 4,

  retries: process.env.CI ? 2 : 0,

  reporter: [["html", { open: "never" }], ["list"]],

  // Login once globally, reuse session for all tests
  globalSetup: require.resolve("./global-setup"),

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:7172",
    storageState: "auth.json",
    headless: false,
    slowMo: 500,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15000,
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
