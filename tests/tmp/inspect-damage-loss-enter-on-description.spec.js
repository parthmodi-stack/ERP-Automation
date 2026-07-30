const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const LoginPage = require('../../pages/LoginPage');
const MyAssetsPage = require('../../pages/MyAssetsPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

const { requester } = testData.assetManagement.users;

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// Theory (from reading material-editable-table.tsx + report-damage-loss/form/form.tsx source):
// hideSaveButton=true on THIS table - the Save/Cancel icon buttons exist in the DOM but are
// CSS-forced display:none (confirmed live via getComputedStyle). The only two intended commit
// paths are: (1) Enter (row's own onKeyUp -> saveEditingRow(table)), or (2) a genuine click
// OUTSIDE .MRT-TableWrapper (a global document click-listener, debounced 200ms, but SUPPRESSED
// for 300ms after any click on a MuiFormControl/MuiInputBase/MuiButtonBase element - which is
// almost every field in this row, hence our commit attempts kept losing the race). Prior testing
// found Enter "reopens the combobox" - but that was tested with FOCUS ON THE SELECT. Testing here
// with focus left in the plain Description TEXT field (last one filled) instead.
test('inspect Enter with focus on Description', async ({ browser }) => {
  test.setTimeout(90000);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const loginPage = new LoginPage(page);
  const myAssetsPage = new MyAssetsPage(page);

  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
  await myAssetsPage.reportDamageLoss();

  const table = page.locator('table').first();
  const row = table.locator('tbody tr, [role="row"]').first();
  await row.locator('td, [role="cell"]').nth(3).click();
  await page.waitForTimeout(300);

  const conditionCombobox = table.getByRole('combobox').first();
  await conditionCombobox.click();
  await page.getByRole('option', { name: 'Damaged', exact: true }).click();
  await expect(conditionCombobox).toHaveText('Damaged', { timeout: 5000 });

  const severityCombobox = table.getByRole('combobox').nth(1);
  await severityCombobox.click();
  await page.getByRole('option', { name: 'High', exact: true }).click();
  await expect(severityCombobox).toHaveText('High', { timeout: 5000 });

  const dateInput = table.getByPlaceholder('Select Date of Incident');
  const d = new Date();
  const dateValue = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  await dateInput.fill(dateValue);
  await expect(dateInput).toHaveValue(dateValue, { timeout: 5000 });

  const descriptionInput = table.getByPlaceholder(/add reason/i);
  await descriptionInput.click();
  await descriptionInput.fill(testDataFactory.narration('Diagnostic Enter-on-description check'));

  console.log('BEFORE_ENTER row text:', JSON.stringify(await row.innerText()));

  // Press Enter while focus is still in the Description text field.
  await descriptionInput.press('Enter');
  await page.waitForTimeout(600);

  console.log('AFTER_ENTER row text:', JSON.stringify(await row.innerText()));
  await page.screenshot({ path: 'test-results/inspect-enter-on-description-after.png', fullPage: true });

  const evidencePath = path.join(os.tmpdir(), `diag-evidence-${Date.now()}.png`);
  fs.writeFileSync(evidencePath, Buffer.from(PNG_1X1_BASE64, 'base64'));
  await page.locator('input[type="file"]').first().setInputFiles(evidencePath);
  await page.waitForTimeout(500);

  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('damage-loss-claims') && r.request().method() === 'POST',
    { timeout: 10000 },
  ).catch((e) => ({ error: e.message }));
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  const response = await responsePromise;
  if (response && response.error) {
    console.log('SUBMIT_RESULT: no response,', response.error);
    await page.screenshot({ path: 'test-results/inspect-enter-on-description-submit-failed.png', fullPage: true });
  } else {
    console.log('SUBMIT_RESULT: got response', response.status());
    const body = await response.json().catch(() => null);
    console.log('SUBMIT_BODY:', JSON.stringify(body));
  }
  fs.unlinkSync(evidencePath);
});
