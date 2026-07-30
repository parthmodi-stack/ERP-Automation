const { test } = require('@playwright/test');
const testData = require('../../config/testData');

test.use({ storageState: { cookies: [], origins: [] } });

test('inspect handover row edit state', async ({ page }) => {
  const { requester } = testData.assetManagement.users;

  await page.goto('/login');
  await page.getByPlaceholder(/email/i).fill(requester.email);
  await page.getByPlaceholder(/password/i).fill(requester.password);
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 20000 });

  await page.goto('/dashboard/hrms/asset-transfer/138/view-asset-transfer');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'test-results/handover-row-initial.png', fullPage: true });

  const comboboxes = await page.getByRole('combobox').all();
  console.log('Number of comboboxes found:', comboboxes.length);
  for (let i = 0; i < comboboxes.length; i++) {
    const text = await comboboxes[i].textContent().catch(() => '(error)');
    const visible = await comboboxes[i].isVisible().catch(() => false);
    console.log(`combobox[${i}]: visible=${visible} text="${text}"`);
  }

  // Now actually perform the click+select and see if it sticks.
  const statusCombobox = page.getByRole('combobox').first();
  await statusCombobox.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/handover-row-dropdown-open.png', fullPage: true });

  const options = await page.getByRole('option').all();
  console.log('Number of options found after opening dropdown:', options.length);
  for (let i = 0; i < options.length; i++) {
    const text = await options[i].textContent().catch(() => '(error)');
    console.log(`option[${i}]: text="${text}"`);
  }

  await page.getByRole('option', { name: 'Yes', exact: true }).click();
  await page.waitForTimeout(300);

  const newText = await statusCombobox.textContent().catch(() => '(error)');
  console.log('combobox[0] text AFTER selecting Yes:', newText);
  await page.screenshot({ path: 'test-results/handover-row-after-yes.png', fullPage: true });
});
