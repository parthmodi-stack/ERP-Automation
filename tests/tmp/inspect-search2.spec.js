const { test } = require('@playwright/test');
const fs = require('fs');

test('verify search toggle override', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('http://localhost:7172/dashboard/procurement/orders/delivery-order');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  await page.locator('.action-bar--RightContent button').first().click();
  await page.waitForTimeout(500);
  const visible = await page.getByPlaceholder('Search', { exact: true }).isVisible().catch(() => false);
  fs.writeFileSync('/tmp/search-toggle-result2.txt', `visible: ${visible}\n`);

  if (visible) {
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('search='), { timeout: 10000 }).catch(() => null),
      page.getByPlaceholder('Search', { exact: true }).fill('DLO-2026-000071'),
    ]);
    fs.appendFileSync('/tmp/search-toggle-result2.txt', `search response seen: ${!!resp}\n`);
  }
});
