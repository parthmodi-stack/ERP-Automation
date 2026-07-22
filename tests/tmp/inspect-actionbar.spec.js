const { test } = require('@playwright/test');
const fs = require('fs');

test('inspect action bar', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('http://localhost:7172/dashboard/procurement/orders/delivery-order');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const addBtn = page.getByRole('button', { name: 'Add' }).first();
  const count = await page.getByRole('button', { name: 'Add' }).count();
  fs.writeFileSync('/tmp/actionbar-addcount.txt', String(count));
  // Dump the whole action bar area html - try to find a toolbar/header container
  const html = await page.locator('body').innerHTML();
  fs.writeFileSync('/tmp/actionbar-full.html', html.slice(0, 20000));
});
