const { test, expect } = require('@playwright/test');
const fs = require('fs');

test('find search toggle', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('http://localhost:7172/dashboard/procurement/orders/delivery-order');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const viewBtn = page.getByRole('button', { name: 'View' });
  const icon1 = viewBtn.locator('xpath=following-sibling::button[1]');
  const icon2 = viewBtn.locator('xpath=following-sibling::button[2]');

  await icon1.click();
  await page.waitForTimeout(500);
  const searchVisible1 = await page.getByPlaceholder('Search', { exact: true }).isVisible().catch(() => false);
  fs.writeFileSync('/tmp/search-toggle-result.txt', `icon1 click -> search visible: ${searchVisible1}\n`);

  if (!searchVisible1) {
    await page.keyboard.press('Escape').catch(() => {});
    await icon2.click();
    await page.waitForTimeout(500);
    const searchVisible2 = await page.getByPlaceholder('Search', { exact: true }).isVisible().catch(() => false);
    fs.appendFileSync('/tmp/search-toggle-result.txt', `icon2 click -> search visible: ${searchVisible2}\n`);
  }
});
