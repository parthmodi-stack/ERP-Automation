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

// Diagnostic: upload the Evidence FIRST, THEN fill the Damage-Loss Details row - testing the
// theory that the file upload itself triggers a re-render that wipes Condition/Severity/Date
// (Description alone seemed to survive in the opposite order - see prior run's
// inspect-commit-submit-failed.png).
test('inspect commit behavior - upload first', async ({ browser }) => {
  test.setTimeout(90000);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const loginPage = new LoginPage(page);
  const myAssetsPage = new MyAssetsPage(page);

  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
  await myAssetsPage.reportDamageLoss();

  const evidencePath = path.join(os.tmpdir(), `diag-evidence-${Date.now()}.png`);
  fs.writeFileSync(evidencePath, Buffer.from(PNG_1X1_BASE64, 'base64'));
  await page.locator('input[type="file"]').first().setInputFiles(evidencePath);
  await page.waitForTimeout(500);

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
  await descriptionInput.fill(testDataFactory.narration('Diagnostic commit check - upload first'));

  console.log('BEFORE_CLICK_OUTSIDE row text:', JSON.stringify(await row.innerText()));
  await page.getByText('Evidences of Damage-Loss').click({ force: true });
  await page.waitForTimeout(600);
  console.log('AFTER_CLICK_OUTSIDE row text:', JSON.stringify(await row.innerText()));
  await page.screenshot({ path: 'test-results/inspect-commit-uploadfirst-after-click-outside.png', fullPage: true });

  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('damage-loss-claims') && r.request().method() === 'POST',
    { timeout: 10000 },
  ).catch((e) => ({ error: e.message }));
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  const response = await responsePromise;
  if (response && response.error) {
    console.log('SUBMIT_RESULT: no response,', response.error);
    await page.screenshot({ path: 'test-results/inspect-commit-uploadfirst-submit-failed.png', fullPage: true });
  } else {
    console.log('SUBMIT_RESULT: got response', response.status());
  }
  fs.unlinkSync(evidencePath);
});
