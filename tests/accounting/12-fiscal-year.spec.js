const { test } = require('@playwright/test');
const FiscalYearPage = require('../../pages/accounting/FiscalYearPage');
const testData = require('../../config/testData');
const { registerSettingsEntityTests } = require('./settings-entity.contract');

test.describe('Fiscal Year (Settings)', () => {
  registerSettingsEntityTests({
    tcPrefix: 'TC-FY',
    PageClass: FiscalYearPage,
    validData: testData.accounting.fiscalYear.valid,
    requiredFieldMissingData: testData.accounting.fiscalYear.missingRequired,
  });
});
