const { chromium } = require('@playwright/test');
const EmployeeMasterPage = require('/home/trootech/Documents/Project/Erpforce/ERP-Automation/pages/EmployeeMasterPage');
const testDataFactory = require('/home/trootech/Documents/Project/Erpforce/ERP-Automation/config/testDataFactory');
const testData = require('/home/trootech/Documents/Project/Erpforce/ERP-Automation/config/testData');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const context = await browser.newContext({
    storageState: '/home/trootech/Documents/Project/Erpforce/ERP-Automation/auth.json',
    viewport: { width: 1400, height: 900 },
    baseURL: testData.baseUrl,
  });
  const page = await context.newPage();

  const empPage = new EmployeeMasterPage(page);
  const ts = Date.now();

  await empPage.goto();
  console.log('On add page:', page.url());

  await empPage.employeeNameInput.fill(testDataFactory.uniqueName('Diag_Emp'));
  await empPage.selectFieldByLabel(empPage.companyField, 'erp-force', { exact: false });
  await empPage.emailInput.fill(`diag.${ts}@company.com`);
  await empPage.phoneInput.fill(`+97150${Math.floor(1000000 + Math.random() * 9000000)}`);
  await empPage.dateOfJoiningInput.fill('01-08-2026');
  await empPage.nationalityInput.fill('Emirati');
  await empPage.dobInput.fill('15-05-1995');
  await empPage.openDropdownAndPick(empPage.genderField, 'Male');
  await empPage.passportNumberInput.fill(`PDIAG${ts}`);
  await empPage.labourContractNoInput.fill(`LCDIAG${ts}`);
  await empPage.labourIdInput.fill(`LIDDIAG${ts}`);

  console.log('--- selecting Department=QA ---');
  try {
    await empPage.selectFieldByLabel(empPage.departmentField, 'QA', { exact: false });
    console.log('Department QA selected OK');
  } catch (e) {
    console.log('Department QA FAILED:', e.message.slice(0, 300));
  }

  console.log('--- selecting Designation (first available) ---');
  try {
    await empPage.selectFirstOptionByLabel(empPage.designationField);
    console.log('Designation first-available selected OK');
  } catch (e) {
    console.log('Designation FAILED:', e.message.slice(0, 300));
  }

  await page.screenshot({ path: '/tmp/diag-basic-filled.png', fullPage: true });

  console.log('--- clicking Next ---');
  await empPage.nextButton.click();
  await page.waitForTimeout(1500);
  const errs = await page.locator('.Mui-error, [class*="error"]').allTextContents();
  console.log('Any error-class texts on page:', errs.filter(Boolean));
  await page.screenshot({ path: '/tmp/diag-contract-tab.png', fullPage: true });
  console.log('Contract Details tab visible now?', await page.getByText('Employment Type').first().isVisible().catch(() => false));

  // Inspect auto-filled values
  console.log('Contract Start Date:', await empPage.contractStartDateInput.inputValue().catch(e => 'ERR'));
  console.log('Contract End Date:', await empPage.contractEndDateInput.inputValue().catch(e => 'ERR'));
  console.log('Effective From Date:', await empPage.effectiveFromDateInput.inputValue().catch(e => 'ERR'));

  await browser.close();
})();
