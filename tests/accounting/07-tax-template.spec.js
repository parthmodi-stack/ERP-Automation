const { test } = require('@playwright/test');
const TaxTemplatePage = require('../../pages/accounting/TaxTemplatePage');
const TaxCodePage = require('../../pages/accounting/TaxCodePage');
const TaxCategoryPage = require('../../pages/accounting/TaxCategoryPage');
const testData = require('../../config/testData');
const { registerSettingsEntityTests } = require('./settings-entity.contract');

test.describe('Tax Template (Settings)', () => {
  const data = testData.accounting.taxTemplate;

  // Tax Template's `tax_codes` field requires an existing Tax Code, which in turn requires a
  // tax_category_id - confirmed live that neither survives by default in this environment (see
  // testData.js's comment). Seed a dedicated, never-deleted Tax Category then Tax Code here so
  // this file can run independently (same pattern as 05-bank-account.spec.js's beforeAll-seeded
  // Bank).
  test.beforeAll(async ({ browser }, testInfo) => {
    // Two full entity creations (Tax Category, then Tax Code) plus playwright.config.js's global
    // slowMo: 500 add up past the 30s default hook timeout.
    testInfo.setTimeout(90000);
    const context = await browser.newContext({ storageState: 'auth.json' });
    const page = await context.newPage();

    const taxCategory = new TaxCategoryPage(page);
    await taxCategory.openAdd();
    await taxCategory.create({
      name:                 data.seedTaxCategoryName,
      sales_account_id:     'Employee Expense Reimbursement',
      purchase_account_id:  'Depreciation Expense',
    });
    await taxCategory.save();
    await page.waitForLoadState('networkidle');

    const taxCode = new TaxCodePage(page);
    await taxCode.openAdd();
    await taxCode.create({
      name:                 data.seedTaxCodeName,
      rate:                 '5',
      effective_start_date: '01-01-2026',
      effective_end_date:   '31-12-2026',
      tax_category_id:      data.seedTaxCategoryName,
      applies_to:           'Net',
    });
    await taxCode.save();
    await page.waitForLoadState('networkidle');
    await context.close();
  });

  registerSettingsEntityTests({
    tcPrefix: 'TC-TXTMPL',
    PageClass: TaxTemplatePage,
    validData: data.valid,
    requiredFieldMissingData: data.missingRequired,
  });
});
