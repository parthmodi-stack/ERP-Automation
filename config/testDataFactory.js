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

module.exports = { uniqueName, referenceNumber, narration, quantity, amount };
