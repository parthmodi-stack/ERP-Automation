const { test } = require('@playwright/test');
const fs = require('fs');

test('inspect action bar buttons', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('http://localhost:7172/dashboard/procurement/orders/delivery-order');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const html = await page.locator('body').innerHTML();
  fs.writeFileSync('/tmp/actionbar-full2.html', html);
  const buttons = await page.locator('button').all();
  const info = [];
  for (const b of buttons) {
    const label = await b.getAttribute('aria-label').catch(() => null);
    const cls = await b.getAttribute('class').catch(() => null);
    const text = await b.innerText().catch(() => '');
    info.push({ label, cls, text });
  }
  fs.writeFileSync('/tmp/actionbar-buttons.json', JSON.stringify(info, null, 1));
});
