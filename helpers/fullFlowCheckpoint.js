// Checkpoint for tests/erpforce-full-inventory-to-procurement.spec.js.
// Same hand-off convention as config/sharedItem.js (write-what-you-created, read-what-you-need),
// applied WITHIN one long chained flow instead of across files: each step, right after it
// succeeds, persists whatever the next steps need (a name it created, an id the app assigned) so
// that if a LATER step fails, fixing that step and re-running doesn't have to recreate the
// earlier steps' real records - it re-reads their names/ids from here instead. Cleared only when
// a fresh run explicitly starts one (see resetIfFreshRun below), so a normal first run and a
// resumed retry both work through the exact same read-or-create code path in the spec file.
const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '..', 'full-flow-checkpoint.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function save(patch) {
  const current = load();
  const next = { ...current, ...patch, updatedAt: Date.now() };
  fs.writeFileSync(FILE_PATH, JSON.stringify(next, null, 2));
  return next;
}

function clear() {
  try {
    fs.unlinkSync(FILE_PATH);
  } catch {
    // nothing to remove
  }
}

// Call at the very top of a fresh (not resumed) run - e.g. gated behind an env var like
// FULL_FLOW_RESUME=1 that a resume invocation sets and a normal run leaves unset - so leftover
// checkpoint data from a previous run's SUCCESSFUL full pass doesn't silently get reused by a
// later, unrelated fresh run.
function resetIfFreshRun() {
  if (!process.env.FULL_FLOW_RESUME) {
    clear();
  }
}

module.exports = { load, save, clear, resetIfFreshRun };
