const { test } = require('@playwright/test');
const testData = require('../../config/testData');

test.use({ storageState: { cookies: [], origins: [] } });

test('inspect asset return flow with Nishit', async ({ page }) => {
  const { secondUser } = testData.assetManagement.users;

  page.on('response', async (r) => {
    const url = r.url();
    if (url.includes('my-assets') || url.includes('/auth/')) {
      let bodySnippet = '';
      try {
        const json = await r.json();
        bodySnippet = JSON.stringify(json).slice(0, 800);
      } catch (e) {}
      console.log(r.request().method(), r.status(), url, bodySnippet);
    }
  });

  await page.goto('/login');
  await page.getByPlaceholder(/email/i).fill(secondUser.email);
  await page.getByPlaceholder(/password/i).fill(secondUser.password);
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 20000 });

  await page.goto('/dashboard/hrms/asset-list');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/asset-return-01-list.png', fullPage: true });

  // Select the first row's checkbox
  const firstRowCheckbox = page.locator('table tbody tr, [role="row"]').first().locator('input[type="checkbox"], [role="checkbox"]').first();
  await firstRowCheckbox.click();
  await page.waitForTimeout(300);

  const returnButton = page.getByRole('button', { name: 'Return Asset', exact: true });
  console.log('Return Asset button enabled:', await returnButton.isEnabled().catch(() => false));
  await returnButton.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/asset-return-02-confirm-modal.png', fullPage: true });

  const dialog = page.getByRole('dialog');
  console.log('Confirm dialog visible:', await dialog.isVisible().catch(() => false));
  console.log('Dialog text:', await dialog.textContent().catch(() => '(error)'));

  const confirmButton = dialog.getByRole('button').last();
  console.log('Confirm button text:', await confirmButton.textContent().catch(() => '(error)'));
  await confirmButton.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/asset-return-03-after-confirm.png', fullPage: true });
});
