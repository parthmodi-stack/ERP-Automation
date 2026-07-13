const { test } = require('@playwright/test');
const { registerSettingsEntityTests } = require('./settings-entity.contract');
const BankPage = require('../../pages/accounting/BankPage');
const testData = require('../../config/testData');

test.describe('Bank Management', () => {
  const data = testData.accounting.bank;

  registerSettingsEntityTests({
    tcPrefix: 'TC-BANK',
    PageClass: BankPage,
    validData: data.valid,
    requiredFieldMissingData: data.missingRequired,
  });
});
