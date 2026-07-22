const { test } = require('@playwright/test');

test('inspect edit delivery order dom', async ({ page }) => {
  await page.goto('http://localhost:7172/dashboard/procurement/delivery-order/71/edit-delivery-order');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByText('Vendor', { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const fs = require('fs');
  for (const label of ['Vendor', 'Currency', 'Location', 'Date', 'Exchange Rate', 'ID']) {
    try {
      const loc = page.getByText(new RegExp('^' + label.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*\\*?$', 'i')).first();
      const parentHtml = await loc.locator('xpath=..').innerHTML({ timeout: 3000 });
      fs.writeFileSync(`/tmp/edit-do-${label.replace(/\s+/g,'_')}.html`, parentHtml);
    } catch (e) {
      fs.writeFileSync(`/tmp/edit-do-${label.replace(/\s+/g,'_')}.html`, 'ERROR: ' + e.message);
    }
  }
});
