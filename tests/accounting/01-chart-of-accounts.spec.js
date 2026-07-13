const { test, expect } = require('@playwright/test');
const { registerSettingsEntityTests } = require('./settings-entity.contract');
const ChartOfAccountsPage = require('../../pages/accounting/ChartOfAccountsPage');
const testData = require('../../config/testData');

test.describe('Chart of Accounts Management', () => {
  const data = testData.accounting.chartOfAccounts;

  registerSettingsEntityTests({
    tcPrefix: 'TC-COA',
    PageClass: ChartOfAccountsPage,
    validData: data.valid,
    requiredFieldMissingData: data.missingRequired,
  });

  // Entity-specific: Parent Type -> Account Type cascade auto-derives a read-only account_code
  // (add-chart-of-accounts.tsx:184-223). This is COA's one piece of real client-side logic
  // beyond generic FormParser rendering, so it gets its own dedicated test.
  test('TC-COA-10 [+] Selecting Account Type auto-populates a read-only Account Code', async ({ page }) => {
    const coa = new ChartOfAccountsPage(page);
    await coa.openAdd();
    await coa.selectParentType(data.valid.parentType);
    await coa.selectAccountType(data.valid.accountType);

    await expect(coa.accountCodeField()).not.toHaveValue('');
    await expect(coa.accountCodeField()).toBeDisabled();
  });
});
