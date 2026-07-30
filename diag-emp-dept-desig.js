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

  // ---- Department dropdown raw dump ----
  const deptCombobox = page.getByText(/^Department\s*\*?$/i).first().locator('xpath=..').getByRole('combobox').first();
  await deptCombobox.click();
  await page.waitForTimeout(800);
  let opts = await page.getByRole('listbox').getByRole('option').allTextContents();
  console.log('DEPARTMENT initial options (unfiltered):', JSON.stringify(opts));
  const hasExactQA = opts.some(o => o.replace(/[​﻿]/g, '').trim() === 'QA');
  console.log('Exact "QA" present in initial list?', hasExactQA);

  // try typing QA
  const deptInput = deptCombobox.locator('input').first();
  if (await deptInput.isVisible().catch(() => false)) {
    await deptInput.fill('QA');
    await page.waitForTimeout(800);
    opts = await page.getByRole('listbox').getByRole('option').allTextContents();
    console.log('DEPARTMENT options after typing "QA":', JSON.stringify(opts));
  } else {
    console.log('Department combobox has no typeable input');
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);

  // ---- Designation dropdown raw dump + footer link text ----
  const desigCombobox = page.getByText(/^Designation\/Grade\s*\*?$/i).first().locator('xpath=..').getByRole('combobox').first();
  await desigCombobox.click();
  await page.waitForTimeout(800);
  opts = await page.getByRole('listbox').getByRole('option').allTextContents();
  console.log('DESIGNATION initial options (unfiltered):', JSON.stringify(opts));
  await page.screenshot({ path: '/tmp/diag-designation-dropdown.png' });

  // Look for any footer text containing "Create"
  const footerCandidates = await page.getByText(/create new/i).allTextContents().catch(() => []);
  console.log('Footer "create new" texts found:', JSON.stringify(footerCandidates));

  // Click the first "Create New ..." looking text within the open listbox popover
  const createLink = page.getByText(/create new/i).first();
  if (await createLink.isVisible().catch(() => false)) {
    await createLink.click();
    await page.waitForTimeout(800);
    const dialog = page.getByRole('dialog');
    const dialogVisible = await dialog.isVisible().catch(() => false);
    console.log('Dialog opened after clicking create-new link?', dialogVisible);
    if (dialogVisible) {
      const dialogText = await dialog.innerText();
      console.log('DIALOG TEXT:\n', dialogText);
      await page.screenshot({ path: '/tmp/diag-designation-create-dialog.png' });
      // dump all placeholders/inputs within dialog
      const inputs = await dialog.locator('input').all();
      for (const inp of inputs) {
        const ph = await inp.getAttribute('placeholder').catch(() => null);
        const name = await inp.getAttribute('name').catch(() => null);
        console.log('  dialog input -> placeholder:', ph, ' name:', name);
      }
    }
  } else {
    console.log('No "Create New" link found in Designation dropdown');
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();
