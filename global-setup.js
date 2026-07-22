const { chromium } = require('@playwright/test');
const testData = require('./config/testData');

async function globalSetup() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page    = await context.newPage();

  let url = testData.baseUrl;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }
  await page.goto(url + '/login');
  await page.waitForLoadState('networkidle');

  await page.getByPlaceholder(/email/i).fill(testData.credentials.valid.email);
  await page.getByPlaceholder(/password/i).fill(testData.credentials.valid.password);
  await page.getByRole('button', { name: /login|sign in/i }).click();

  await page.waitForURL(/dashboard/, { timeout: 30000 });

  await context.storageState({ path: 'auth.json' });
  await browser.close();

  console.log('Global setup: login successful, session saved.');
}

module.exports = globalSetup;
