const { test } = require('@playwright/test');
const { registerSettingsEntityTests } = require('./settings-entity.contract');
const BankAccountPage = require('../../pages/accounting/BankAccountPage');
const BankPage = require('../../pages/accounting/BankPage');
const testData = require('../../config/testData');

test.describe('Bank Account Management', () => {
  const data = testData.accounting.bankAccount;

  // Bank Account requires an existing Bank to select in its dropdown. Create it here (rather
  // than depending on 04-bank.spec.js's own bank, which that suite deletes) so this file can
  // run independently, per the automation standard of independently-runnable test files.
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'auth.json' });
    const page = await context.newPage();
    const bank = new BankPage(page);
    await bank.openAdd();
    await bank.create({ name: data.valid.bank, swift_number: `AUTOSWIFTFA${Date.now()}` });
    await bank.save();
    await page.waitForLoadState('networkidle');
    await context.close();
  });

  registerSettingsEntityTests({
    tcPrefix: 'TC-BACC',
    PageClass: BankAccountPage,
    validData: data.valid,
    requiredFieldMissingData: data.missingRequired,
  });
});
