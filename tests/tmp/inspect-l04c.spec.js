const { test } = require('@playwright/test');
const fs = require('fs');

test('click more icon button', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('http://localhost:7172/dashboard/procurement/orders/delivery-order');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const firstRow = page.locator('tbody tr').first();
  const moreBtn = firstRow.locator('button:has(img[alt="More Icon"])');
  await moreBtn.click();
  await page.waitForTimeout(600);
  const items = await page.getByRole('menuitem').allTextContents().catch((e) => ['ERR', e.message]);
  fs.writeFileSync('/tmp/l04c-items.json', JSON.stringify(items));
  const dupCount = await page.getByRole('menuitem', { name: 'Duplicate' }).count();
  fs.appendFileSync('/tmp/l04c-items.json', `\ndupCount=${dupCount}`);
});
