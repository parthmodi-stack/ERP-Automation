const { test, expect } = require('@playwright/test');
const { registerSettingsEntityTests } = require('./settings-entity.contract');
const CurrencyPage = require('../../pages/accounting/CurrencyPage');
const testData = require('../../config/testData');

test.describe('Currency Management', () => {
  const data = testData.accounting.currency;

  // No `duplicateData` here: confirmed live against the running app that creating two
  // currencies with an identical currency_name is silently allowed (no toast, no field error) -
  // there is no uniqueness validation on this field. See ACCOUNTING_FINDINGS.md.
  registerSettingsEntityTests({
    tcPrefix: 'TC-CUR',
    PageClass: CurrencyPage,
    validData: data.valid,
    requiredFieldMissingData: data.missingRequired,
  });

  test('TC-CUR-10 [-] Duplicate currency_name is currently accepted without warning (documents a gap)', async ({ page }) => {
    const currency = new CurrencyPage(page);
    await currency.openAdd();
    await currency.create(data.duplicate);
    await currency.save();
    await page.waitForLoadState('networkidle');
    // Documents current (surprising) behavior: no rejection, no toast. If the FE team adds
    // uniqueness validation later, this assertion should be flipped to expect a toast/inline
    // error and the entity should NOT reach the list.
    await expect(page).toHaveURL(new RegExp(currency.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  });
});
