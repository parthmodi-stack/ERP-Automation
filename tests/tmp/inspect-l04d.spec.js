const { test } = require('@playwright/test');
const fs = require('fs');

test('check duplicate disabled state', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('http://localhost:7172/dashboard/procurement/orders/delivery-order');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const firstRow = page.locator('tbody tr').first();
  const moreBtn = firstRow.locator('button:has(img[alt="More Icon"])');
  await moreBtn.click();
  await page.waitForTimeout(600);
  const dup = page.getByRole('menuitem', { name: 'Duplicate' });
  const ariaDisabled = await dup.getAttribute('aria-disabled');
  const cls = await dup.getAttribute('class');
  fs.writeFileSync('/tmp/l04d.txt', `aria-disabled=${ariaDisabled}\nclass=${cls}\n`);
})
