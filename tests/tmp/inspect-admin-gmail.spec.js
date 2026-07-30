const { test } = require('@playwright/test');

test.use({ storageState: { cookies: [], origins: [] } });

test('diagnose admin@gmail.com account', async ({ page }) => {
  page.on('response', async (r) => {
    const url = r.url();
    if (url.includes('employee') || url.includes('/auth/') || url.includes('asset-return')) {
      let bodySnippet = '';
      try {
        const json = await r.json();
        bodySnippet = JSON.stringify(json).slice(0, 500);
      } catch (e) {}
      console.log(r.request().method(), r.status(), url, bodySnippet);
    }
  });

  await page.goto('/login');
  await page.getByPlaceholder(/email/i).fill('admin@gmail.com');
  await page.getByPlaceholder(/password/i).fill('Admin@123');
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
  console.log('URL after login attempt:', page.url());

  await page.goto('/dashboard/hrms/asset-return');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/admin-gmail-asset-return-list.png', fullPage: true });

  const is403 = await page.getByText('403', { exact: true }).isVisible().catch(() => false);
  console.log('403 shown:', is403);
});
