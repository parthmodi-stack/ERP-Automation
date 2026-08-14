// Hand-off point between tests/inventory/07-inventory-item.spec.ts (writer) and
// testData.purchaseOrder.valid's itemName/location/department getters (reader - see
// testData.js). Lets a freshly-created inventory item, plus the Location/Department it was
// assigned, flow straight into the Purchase Order/GRN/Vendor Return tests without editing test
// data by hand. Falls back to the pinned master data whenever this file is missing or stale
// (e.g. procurement tests run without inventory having run first in the same session).
const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '..', 'shared-item.json');

function saveCreatedItem({ dropdownOption, location, department }) {
  fs.writeFileSync(
    FILE_PATH,
    JSON.stringify({ dropdownOption, location, department, createdAt: Date.now() }, null, 2),
  );
}

function getCreatedItem() {
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

module.exports = { saveCreatedItem, getCreatedItem };
