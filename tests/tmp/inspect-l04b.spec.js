const { test } = require('@playwright/test');
const fs = require('fs');

test('inspect first row html', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('http://localhost:7172/dashboard/procurement/orders/delivery-order');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const firstRow = page.locator('tbody tr').first();
  const rowHtml = await firstRow.innerHTML();
  fs.writeFileSync('/tmp/l04-row.html', rowHtml);
});
