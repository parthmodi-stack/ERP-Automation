const { test } = require('@playwright/test');
const fs = require('fs');

test('check record 71 status', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('http://localhost:7172/dashboard/procurement/delivery-order/71/view-delivery-order');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const status = await page.getByText(/^(Picked|Packed|Dispatched|Delivered)$/, { exact: true }).first().innerText().catch(e => 'ERR ' + e.message);
  fs.writeFileSync('/tmp/record71-status.txt', status);

  await page.goto('http://localhost:7172/dashboard/procurement/delivery-order/71/edit-delivery-order');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const saveBtn = page.getByRole('button', { name: 'Save' });
  const saveVisible = await saveBtn.isVisible().catch(() => false);
  const saveDisabled = await saveBtn.isDisabled().catch(() => 'n/a');
  fs.appendFileSync('/tmp/record71-status.txt', `\nsaveVisible=${saveVisible} saveDisabled=${saveDisabled}`);
  const narrationDisabled = await page.getByPlaceholder('Enter Narration').isDisabled().catch(() => 'n/a');
  fs.appendFileSync('/tmp/record71-status.txt', `\nnarrationDisabled=${narrationDisabled}`);
  const refNoDisabled = await page.getByPlaceholder('Enter Reference No.').isDisabled().catch(() => 'n/a');
  fs.appendFileSync('/tmp/record71-status.txt', `\nrefNoDisabled=${refNoDisabled}`);
});
