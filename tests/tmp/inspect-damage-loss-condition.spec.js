const { test } = require('@playwright/test');
const testData = require('../../config/testData');

test.use({ storageState: { cookies: [], origins: [] } });

test('inspect exact fillClaimDetails order for Loss condition', async ({ page }) => {
  const { requester } = testData.assetManagement.users;

  await page.goto('/login');
  await page.getByPlaceholder(/email/i).fill(requester.email);
  await page.getByPlaceholder(/password/i).fill(requester.password);
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 20000 });

  await page.goto('/dashboard/hrms/asset-list');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const row = page.locator('table tbody tr, [role="row"]').first();
  await row.getByRole('link').first().click().catch(() => row.click());
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const detailRow = page.locator('table tbody tr, [role="row"]').first();
  await detailRow.locator('input[type="checkbox"], [role="checkbox"]').first().click();

  const reportButton = page.getByRole('button', { name: /Report Damage\/Loss/i });
  await reportButton.click();
  await page.waitForURL(/add-damage-loss-claim/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const table = page.locator('table').first();

  // Step 1: click cell to enter edit mode
  await table.locator('tbody tr, [role="row"]').first().locator('td, [role="cell"]').nth(3).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/dl-seq-01-edit-mode.png', fullPage: true });
  console.log('STEP1 comboboxes:', await table.getByRole('combobox').count());

  // Step 2: fill date
  const dateInput = table.getByPlaceholder('Select Date of Incident');
  await dateInput.fill('29/07/2026');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/dl-seq-02-after-date.png', fullPage: true });
  console.log('STEP2 comboboxes:', await table.getByRole('combobox').count());
  console.log('STEP2 date value:', await dateInput.inputValue().catch(() => '(err)'));

  // Step 3: fill description
  const descriptionInput = table.getByPlaceholder(/add reason/i);
  await descriptionInput.fill('test description');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/dl-seq-03-after-description.png', fullPage: true });
  console.log('STEP3 comboboxes:', await table.getByRole('combobox').count());

  // Step 4: click condition combobox
  const conditionCombobox = table.getByRole('combobox').first();
  console.log('STEP4 condition combobox visible:', await conditionCombobox.isVisible().catch(() => false));
  await conditionCombobox.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/dl-seq-04-condition-dropdown-open.png', fullPage: true });

  const options = await page.getByRole('option').allTextContents();
  console.log('STEP4 options:', JSON.stringify(options));

  // Step 5: select Loss
  await page.getByRole('option', { name: 'Loss', exact: true }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/dl-seq-05-after-loss-select.png', fullPage: true });
  console.log('STEP5 condition text:', await conditionCombobox.textContent().catch(() => '(err)'));
  console.log('STEP5 date value still:', await dateInput.inputValue().catch(() => '(err)'));
});
