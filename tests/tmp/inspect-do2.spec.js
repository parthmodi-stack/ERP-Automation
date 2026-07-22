const { test } = require('@playwright/test');
const fs = require('fs');

test('inspect date field', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('http://localhost:7172/dashboard/procurement/delivery-order/71/edit-delivery-order');
  await page.getByPlaceholder('Enter Reference No.').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(1000);

  const mainHtml = await page.locator('main').innerHTML();
  fs.writeFileSync('/tmp/edit-do-full-main.html', mainHtml);
});
