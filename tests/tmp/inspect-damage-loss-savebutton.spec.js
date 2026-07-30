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

// Diagnostic: use the row's own "Save" icon-button (discovered in inspect-row-actions.spec.js -
// aria-label="Save", in the row's first cell alongside "Cancel") to commit, instead of a
// click-outside - which was proven to leave the row still in local edit-mode state, later
// discarded when Submit was clicked.
test('inspect commit via Save button', async ({ browser }) => {
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
  await descriptionInput.fill(testDataFactory.narration('Diagnostic Save-button check'));

  // Dump row buttons right before attempting Save, to see what's actually present at this stage.
  const rowButtons = row.locator('button');
  const rbCount = await rowButtons.count();
  for (let i = 0; i < rbCount; i++) {
    const b = rowButtons.nth(i);
    const label = (await b.getAttribute('aria-label')) || (await b.getAttribute('title')) || (await b.innerText().catch(() => ''));
    console.log(`PRE_SAVE_ROW_BUTTON[${i}]:`, JSON.stringify(label));
  }

  // Commit via the row's own Save icon-button - likely a hover-reveal action (opacity:0 until the
  // row is hovered), given scrollIntoViewIfNeeded alone still reported "not visible".
  const firstCell = row.locator('td, [role="cell"]').first();
  await firstCell.scrollIntoViewIfNeeded();
  await row.hover();
  await page.waitForTimeout(300);
  const saveButton = row.locator('button').nth(1);
  console.log('SAVE_BUTTON_VISIBLE after hover:', await saveButton.isVisible());
  const diag = await saveButton.evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const parents = [];
    let p = el.parentElement;
    for (let i = 0; i < 5 && p; i++) {
      const ps = getComputedStyle(p);
      parents.push({ tag: p.tagName, cls: p.className, display: ps.display, visibility: ps.visibility, opacity: ps.opacity, width: p.getBoundingClientRect().width });
      p = p.parentElement;
    }
    return {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      parents,
    };
  });
  console.log('SAVE_BUTTON_DIAG:', JSON.stringify(diag, null, 2));
  await saveButton.click();
  await page.waitForTimeout(600);
  console.log('AFTER_SAVE_BUTTON row text:', JSON.stringify(await row.innerText()));
  await page.screenshot({ path: 'test-results/inspect-savebutton-after-save.png', fullPage: true });

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
    await page.screenshot({ path: 'test-results/inspect-savebutton-submit-failed.png', fullPage: true });
  } else {
    console.log('SUBMIT_RESULT: got response', response.status());
    const body = await response.json().catch(() => null);
    console.log('SUBMIT_BODY:', JSON.stringify(body));
  }
  fs.unlinkSync(evidencePath);
});
