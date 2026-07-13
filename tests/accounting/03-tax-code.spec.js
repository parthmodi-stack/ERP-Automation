const { test, expect } = require('@playwright/test');
const { registerSettingsEntityTests } = require('./settings-entity.contract');
const TaxCodePage = require('../../pages/accounting/TaxCodePage');
const testData = require('../../config/testData');

test.describe('Tax Code Management', () => {
  const data = testData.accounting.taxCode;

  registerSettingsEntityTests({
    tcPrefix: 'TC-TAX',
    PageClass: TaxCodePage,
    validData: data.valid,
    requiredFieldMissingData: data.missingRequired,
  });

  // Boundary validation on the tax rate field - a good candidate for data-driven testing once
  // the real field name/validation rules are confirmed against the running app.
  test('TC-TAX-10 [-] Negative tax rate is rejected', async ({ page }) => {
    const taxCode = new TaxCodePage(page);
    await taxCode.openAdd();
    await taxCode.create({ name: `Automation_TaxCode_Negative_${Date.now()}`, rate: data.boundaryRates.negative });
    await taxCode.save();
    await page.waitForLoadState('networkidle');
    // Negative rate should not be accepted - stays on the add form.
    await expect(page).toHaveURL(new RegExp(taxCode.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});
