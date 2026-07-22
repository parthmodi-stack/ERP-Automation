const { test } = require('@playwright/test');
const JournalTypePage = require('../../pages/accounting/JournalTypePage');
const testData = require('../../config/testData');
const { registerSettingsEntityTests } = require('./settings-entity.contract');

// Confirmed against the running app: add-journal-type's only fields are `name` and `is_payment`
// (see JournalTypePage.js). No duplicate-name check has been observed (the list currently has no
// existing custom rows to test against), so `duplicateData` is intentionally omitted rather than
// guessed - TC-JT-04 is skipped by the shared contract when it isn't provided.
test.describe('Journal Type (Settings)', () => {
  registerSettingsEntityTests({
    tcPrefix: 'TC-JT',
    PageClass: JournalTypePage,
    validData: testData.accounting.journalType.valid,
    requiredFieldMissingData: testData.accounting.journalType.missingRequired,
  });
});
