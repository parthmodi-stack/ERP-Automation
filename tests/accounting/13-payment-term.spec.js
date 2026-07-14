const { test } = require('@playwright/test');
const PaymentTermPage = require('../../pages/accounting/PaymentTermPage');
const testData = require('../../config/testData');
const { registerSettingsEntityTests } = require('./settings-entity.contract');

test.describe('Payment Term (Settings)', () => {
  registerSettingsEntityTests({
    tcPrefix: 'TC-PT',
    PageClass: PaymentTermPage,
    validData: testData.accounting.paymentTerm.valid,
    requiredFieldMissingData: testData.accounting.paymentTerm.missingRequired,
  });
});
