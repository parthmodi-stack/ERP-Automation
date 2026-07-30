const { chromium } = require('@playwright/test');
const EmployeeMasterPage = require('/home/trootech/Documents/Project/Erpforce/ERP-Automation/pages/EmployeeMasterPage');
const testData = require('/home/trootech/Documents/Project/Erpforce/ERP-Automation/config/testData');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 20 });
  const context = await browser.newContext({
    storageState: '/home/trootech/Documents/Project/Erpforce/ERP-Automation/auth.json',
    viewport: { width: 1400, height: 900 },
    baseURL: testData.baseUrl,
  });
  const page = await context.newPage();
  const empPage = new EmployeeMasterPage(page);

  await empPage.goto();
  await empPage.selectFieldByLabel(empPage.companyField, 'erp-force', { exact: false });

  const deptCombobox = page.getByText(/^Department\s*\*?$/i).first().locator('xpath=..').getByRole('combobox').first();
  await deptCombobox.click();
  await page.waitForTimeout(600);

  const listbox = page.getByRole('listbox');
  for (let i = 0; i < 6; i++) {
    const opts = await listbox.getByRole('option').allTextContents();
    console.log(`Scroll pass ${i}: option count = ${opts.length}, has exact QA = ${opts.some(o => o.replace(/[​﻿]/g,'').trim() === 'QA')}`);
    // scroll the listbox container down
    await listbox.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(700);
  }
  const finalOpts = await listbox.getByRole('option').allTextContents();
  console.log('FINAL options dump:', JSON.stringify(finalOpts));

  await browser.close();
})();
