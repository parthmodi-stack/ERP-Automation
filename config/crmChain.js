// Hand-off point across tests/crm/01-lead.spec.js -> 02-opportunity.spec.js -> 03-quotation.spec.js
// -> 04-sales-order.spec.js. Same convention as config/sharedItem.js (write-what-you-created,
// read-what-you-need via a small JSON file) - each stage's test writes its own real created
// record here right after saving it, and the NEXT stage's test reads it back to reference the
// exact same record instead of picking/creating an unrelated one. Falls back to testData.js's
// pinned fixtures whenever this file is missing or stale (e.g. a later stage run standalone,
// without an earlier stage having run first in the same session) - same reasoning as
// sharedItem.js's own fallback.
const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '..', 'crm-chain.json');

function save(patch) {
  const current = load();
  const next = { ...current, ...patch, updatedAt: Date.now() };
  fs.writeFileSync(FILE_PATH, JSON.stringify(next, null, 2));
  return next;
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

module.exports = { save, load };
