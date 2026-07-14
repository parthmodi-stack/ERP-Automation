const { test } = require('@playwright/test');
const TaxCategoryPage = require('../../pages/accounting/TaxCategoryPage');
const testData = require('../../config/testData');
const { registerSettingsEntityTests } = require('./settings-entity.contract');

test.describe('Tax Category (Settings)', () => {
  registerSettingsEntityTests({
    tcPrefix: 'TC-TXCAT',
    PageClass: TaxCategoryPage,
    validData: testData.accounting.taxCategory.valid,
    requiredFieldMissingData: testData.accounting.taxCategory.missingRequired,
  });
});
