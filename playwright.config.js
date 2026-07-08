const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',

  // Run tests sequentially to avoid race conditions on shared data
  fullyParallel: false,
  workers: 1,

  retries: process.env.CI ? 2 : 0,

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  // Login once globally, reuse session for all tests
  globalSetup: require.resolve('./global-setup'),

  use: {
    baseURL:           'https://dev.erpforce.co',
    storageState:      'auth.json',
    headless:          false,
    slowMo:            500,
    viewport:          { width: 1280, height: 720 },
    actionTimeout:     15000,
    navigationTimeout: 30000,
    trace:             'on-first-retry',
    screenshot:        'only-on-failure',
    video:             'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
    },
  ],
});
