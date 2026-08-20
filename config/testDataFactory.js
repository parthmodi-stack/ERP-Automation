const { faker } = require('@faker-js/faker');

// Generators for the FREE-TEXT fields only (names/narrations/reference numbers/quantities/
// amounts) - never for foreign-key-reference values (vendor/location/item/currency/company
// names, purchase representatives, approvers). Those are pinned to real, live-verified master
// data in config/testData.js and faker cannot invent valid ones; see the comments there.

function uniqueName(prefix) {
  return `${prefix}_${Date.now()}_${faker.string.alphanumeric(4)}`;
}

function referenceNumber(prefix = 'AUTO') {
  return `${prefix}-${faker.string.numeric(8)}`;
}

function narration(context) {
  return `${context} ${faker.lorem.words(6)}`;
}

function quantity({ min = 1, max = 20 } = {}) {
  return String(faker.number.int({ min, max }));
}

function amount({ min = 10, max = 1000 } = {}) {
  return String(faker.number.int({ min, max }));
}

// Company Calendar's Calendar Name has no uniqueness rule in the app itself, but every other
// free-text generator here appends a run-unique suffix so `searchList()` reliably isolates the
// record this run created among the shared/cumulative dataset - keep that same guarantee while
// still basing the value on a realistic company-style name per the calendar module's test data.
function calendarName() {
  return `${faker.company.name()}_${Math.random().toString(36).substr(2, 9)}`;
}

// For tests that deliberately reuse another test's fixture email for a second real create
// (e.g. to isolate a duplicate-COMPANY-NAME check without also tripping a duplicate-email one).
function uniqueEmail(localPrefix = 'automation.lead') {
  return `${localPrefix}.${Date.now()}@acmeglobal.com`;
}

module.exports = { uniqueName, referenceNumber, narration, quantity, amount, calendarName, uniqueEmail };
