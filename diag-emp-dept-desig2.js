const { chromium } = require('@playwright/test');
const EmployeeMasterPage = require('/home/trootech/Documents/Project/Erpforce/ERP-Automation/pages/EmployeeMasterPage');
const testDataFactory = require('/home/trootech/Documents/Project/Erpforce/ERP-Automation/config/testDataFactory');
const testData = require('/home/trootech/Documents/Project/Erpforce/ERP-Automation/config/testData');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 40 });
  const context = await browser.newContext({
    storageState: '/home/trootech/Documents/Project/Erpforce/ERP-Automation/auth.json',
    viewport: { width: 1400, height: 900 },
    baseURL: testData.baseUrl,
  });
  const page = await context.newPage();
  const empPage = new EmployeeMasterPage(page);

  await empPage.goto();
  await empPage.selectFieldByLabel(empPage.companyField, 'erp-force', { exact: false });

  // ---- Create a fresh Department via footer ----
  const deptName = testDataFactory.uniqueName('Automation_Department');
  const deptCode = 'DPT-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  const deptCombobox = page.getByText(/^Department\s*\*?$/i).first().locator('xpath=..').getByRole('combobox').first();
  await deptCombobox.click();
  await page.waitForTimeout(500);
  await page.getByText('Create New Department', { exact: false }).click();
  let dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  console.log('DEPT DIALOG TEXT:\n', await dialog.innerText());
  await empPage.selectFieldByLabel('Company', 'erp-force', { exact: false, scope: dialog });
  await dialog.getByPlaceholder('Enter Department Code').fill(deptCode);
  await dialog.getByPlaceholder('Enter Department Name').fill(deptName);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  console.log('Department created:', deptName);

  await page.locator('body').click({ position: { x: 300, y: 10 }, force: true }).catch(() => {});
  await page.waitForTimeout(500);

  // Reselect newly created department
  await deptCombobox.click();
  await page.waitForTimeout(500);
  let opts = await page.getByRole('listbox').getByRole('option').allTextContents();
  console.log('Dept options after create (contains new one?):', opts.some(o => o.includes(deptName)));
  await empPage.selectOptionFromListbox(deptName, { timeout: 7000 });
  const deptFieldVal = await deptCombobox.textContent();
  console.log('Department field value after reselect:', deptFieldVal);

  // ---- Now open Designation dropdown ----
  const desigCombobox = page.getByText(/^Designation\s*\*?$/i).first().locator('xpath=..').getByRole('combobox').first();
  console.log('Designation combobox disabled?', await desigCombobox.isDisabled().catch(() => 'ERR'));
  await desigCombobox.click();
  await page.waitForTimeout(600);
  opts = await page.getByRole('listbox').getByRole('option').allTextContents();
  console.log('DESIGNATION options (after Department selected):', JSON.stringify(opts));

  const createDesigLink = page.getByText(/create new designation/i).first();
  const hasCreateLink = await createDesigLink.isVisible().catch(() => false);
  console.log('Has "Create New Designation" footer link?', hasCreateLink);
  if (hasCreateLink) {
    await createDesigLink.click();
    dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    console.log('DESIGNATION DIALOG TEXT:\n', await dialog.innerText());
    const inputs = await dialog.locator('input').all();
    for (const inp of inputs) {
      const ph = await inp.getAttribute('placeholder').catch(() => null);
      const name = await inp.getAttribute('name').catch(() => null);
      const disabled = await inp.isDisabled().catch(() => null);
      console.log('  dialog input -> placeholder:', ph, ' name:', name, ' disabled:', disabled);
    }
    await page.screenshot({ path: '/tmp/diag-designation-dialog2.png' });

    // Try filling it out fully
    const desigName = testDataFactory.uniqueName('Automation_Designation');
    const desigCode = 'DSG-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    await empPage.selectFieldByLabel('Company', 'erp-force', { exact: false, scope: dialog });
    console.log('--- selecting Department inside designation dialog ---');
    try {
      await empPage.selectFieldByLabel('Department', deptName, { exact: false, scope: dialog });
      console.log('Department selected inside dialog OK');
    } catch (e) {
      console.log('Department select inside dialog FAILED:', e.message.slice(0, 400));
    }
    await dialog.getByPlaceholder('Enter Designation Code').fill(desigCode).catch(e => console.log('code fill fail', e.message));
    await dialog.getByPlaceholder('Enter Designation Name').fill(desigName).catch(e => console.log('name fill fail', e.message));
    await page.screenshot({ path: '/tmp/diag-designation-dialog-filled.png' });
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    const closed = await dialog.waitFor({ state: 'hidden', timeout: 8000 }).then(() => true).catch(() => false);
    console.log('Designation dialog closed after save?', closed);
    if (!closed) {
      const errTexts = await dialog.locator('.Mui-error, [class*="error"]').allTextContents();
      console.log('Dialog error texts:', errTexts);
      await page.screenshot({ path: '/tmp/diag-designation-dialog-error.png' });
    } else {
      await page.waitForTimeout(500);
      opts = await page.getByRole('listbox').getByRole('option').allTextContents().catch(() => []);
      console.log('Designation options/listbox state after dialog close:', JSON.stringify(opts));
      const desigFieldVal = await desigCombobox.textContent().catch(() => 'ERR');
      console.log('Designation field value right after dialog close (auto-selected?):', desigFieldVal);
    }
  }

  await page.waitForTimeout(2500);
  await browser.close();
})();
