const { test, expect } = require('@playwright/test');
const LoginPage = require('../../pages/LoginPage');
const testData  = require('../../config/testData');

// Override storageState so login tests start with a fresh (unauthenticated) session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {

  // ─── POSITIVE ───────────────────────────────────────────────

  test('TC-AUTH-01 [+] Valid credentials redirect to dashboard', { tag: '@smoke' }, async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(
      testData.credentials.valid.email,
      testData.credentials.valid.password
    );
    await expect(page).toHaveURL(/dashboard/);
  });

  // ─── NEGATIVE ───────────────────────────────────────────────

  test('TC-AUTH-02 [-] Invalid email does not redirect to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      testData.credentials.invalidEmail.email,
      testData.credentials.invalidEmail.password
    );
    // App stays on login page silently (no redirect)
    await page.waitForTimeout(3000);
    await expect(page).not.toHaveURL(/dashboard/);
  });

  test('TC-AUTH-03 [-] Wrong password does not redirect to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      testData.credentials.wrongPassword.email,
      testData.credentials.wrongPassword.password
    );
    await page.waitForTimeout(3000);
    await expect(page).not.toHaveURL(/dashboard/);
  });

  test('TC-AUTH-04 [-] Empty email blocks submission', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      testData.credentials.emptyEmail.email,
      testData.credentials.emptyEmail.password
    );
    await expect(page).not.toHaveURL(/dashboard/);
  });

  test('TC-AUTH-05 [-] Empty password blocks submission', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      testData.credentials.emptyPassword.email,
      testData.credentials.emptyPassword.password
    );
    await expect(page).not.toHaveURL(/dashboard/);
  });
});
