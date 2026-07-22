const { test } = require('@playwright/test');
const fs = require('fs');

test('inspect row action menu', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('http://localhost:7172/dashboard/procurement/orders/delivery-order');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const firstRow = page.locator('tbody tr').first();
  await firstRow.locator('[aria-label="More Icon"], td:first-child').first().click();
  await page.waitForTimeout(500);
  const menuHtml = await page.getByRole('menu').innerHTML().catch(async (e) => 'ERR ' + e.message);
  fs.writeFileSync('/tmp/l04-menu.html', menuHtml);
  const items = await page.getByRole('menuitem').allTextContents();
  fs.writeFileSync('/tmp/l04-items.json', JSON.stringify(items));
});
