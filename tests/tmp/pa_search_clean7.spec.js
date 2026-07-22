const { test, expect } = require('@playwright/test');

test('check what firing on toggle click', async ({ page }) => {
  await page.goto('/dashboard/procurement/purchase-agreements');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByRole('button', { name: 'Add' }).first().waitFor({ state: 'visible', timeout: 15000 });

  page.on('request', (r) => {
    if (r.url().includes('purchase-agreements')) console.log('REQ', Date.now(), r.url());
  });

  console.log('T0 before click', Date.now());
  await page.getByRole('button', { name: 'Add' }).first().locator('xpath=preceding-sibling::button[2]').click();
  console.log('T1 after click', Date.now());
  await page.waitForTimeout(3000);
  console.log('T2 after wait', Date.now());
});
