const { test, expect } = require('@playwright/test');
const ItemsPage = require('../../../pages/ItemsPage');

// This suite's own test data is read live from whatever items currently exist
// (see pickSearchValues below) rather than hardcoded literals. Earlier drafts
// hardcoded specific SKU/Name values, but this shared dev environment's item
// list has already been reshuffled by other automation runs during this
// project's own development - hardcoding a value here would just repeat that
// mistake. Reading real, current values keeps the suite correct regardless of
// what other specs create or delete over time.
// Not every row has every field populated (e.g. some items have a blank
// Sales Price) - pick each field independently from whichever row has it,
// rather than requiring one single row to have all fields at once.
function firstNonEmpty(rows, field) {
  const row = rows.find((r) => r[field]);
  return row ? row[field] : '';
}

function pickSearchValues(rows) {
  // "0" is a bad Available Quantity test value: it substring-collides with
  // digits inside most SKUs (e.g. "ELEC-000071"), which would make the
  // "Available Quantity isn't searchable" assertion below fail for the wrong
  // reason (a false-positive match via SKU, not because the column actually
  // works). Prefer a row with a non-zero quantity instead.
  const withQty = rows.find((r) => r.availableQuantity && r.availableQuantity !== '0');

  return {
    sku:               firstNonEmpty(rows, 'sku'),
    name:              firstNonEmpty(rows, 'name'),
    status:            firstNonEmpty(rows, 'status'),
    cost:              firstNonEmpty(rows, 'cost'),
    salesPrice:        firstNonEmpty(rows, 'salesPrice'),
    availableQuantity: withQty ? withQty.availableQuantity : firstNonEmpty(rows, 'availableQuantity'),
    uom:               firstNonEmpty(rows, 'uom'),
    category:          firstNonEmpty(rows, 'category'),
  };
}

test.describe('Item Listing - Search box', () => {

  let items;
  let data;
  let baselineRowCount;

  test.beforeEach(async ({ page }, testInfo) => {
    // Each test does several search round-trips (each with its own debounce +
    // API wait); the default 30s budget is occasionally too tight on this
    // dev environment's slower moments (observed a few times while building
    // this suite, always transient - passed cleanly on retry).
    testInfo.setTimeout(45000);

    items = new ItemsPage(page);
    await items.gotoList();

    const rows = await items.getRowSnapshots();
    expect(rows.length, 'Items list has no rows to search against - seed at least one item first').toBeGreaterThan(0);
    data = pickSearchValues(rows);
    baselineRowCount = rows.length;
  });

  // ── TC-ISEARCH-01/02: searchable columns (positive) ───────────────────────
  test('TC-ISEARCH-01 [+] Search by SKU returns the matching item', async () => {
    await items.searchFor(data.sku);
    expect(await items.isNoDataShown(), `Expected a match for SKU="${data.sku}"`).toBeFalsy();
    await expect(items.dataRows().filter({ hasText: data.sku })).toHaveCount(1);
  });

  test('TC-ISEARCH-02 [+] Search by Name returns the matching item', async () => {
    await items.searchFor(data.name);
    expect(await items.isNoDataShown(), `Expected a match for Name="${data.name}"`).toBeFalsy();
    await expect(items.dataRows().filter({ hasText: data.name })).toHaveCount(1);
  });

  // ── TC-ISEARCH-03..08: non-searchable columns (negative) ───────────────────
  // Documents current behavior: the search box only covers SKU and Name.
  // Flip these to a positive assertion if/when the backend is extended to
  // search these columns too.
  const nonSearchableColumns = [
    ['TC-ISEARCH-03', 'Status', () => data.status],
    ['TC-ISEARCH-04', 'Cost', () => data.cost],
    ['TC-ISEARCH-05', 'Sales Price', () => data.salesPrice],
    ['TC-ISEARCH-06', 'Available Quantity', () => data.availableQuantity],
    ['TC-ISEARCH-07', 'Unit of Measurement', () => data.uom],
    ['TC-ISEARCH-08', 'Category', () => data.category],
  ];

  for (const [id, column, getValue] of nonSearchableColumns) {
    test(`${id} [-] Search by ${column} value shows No Data (column not covered by search)`, async () => {
      const value = getValue();
      await items.searchFor(value);
      expect(await items.isNoDataShown(), `${column}="${value}" unexpectedly returned results`).toBeTruthy();
    });
  }

  // ── TC-ISEARCH-09..12: invalid / adversarial input ─────────────────────────
  const invalidSearches = [
    ['TC-ISEARCH-09', 'non-existent alphanumeric string', 'zzz_nonexistent_item_xyz'],
    ['TC-ISEARCH-10', 'special characters', '@@@###!!!'],
    ['TC-ISEARCH-11', 'SQL-injection-style string', "' OR 1=1 --"],
    ['TC-ISEARCH-12', 'very long string (500 chars)', 'A'.repeat(500)],
  ];

  for (const [id, description, value] of invalidSearches) {
    test(`${id} [-] Invalid search - ${description} - shows No Data without error`, async () => {
      await items.searchFor(value);
      await expect(items.noDataMessage, `"${description}" should show No Data`).toBeVisible();
      // Confirms the string wasn't executed/reflected unsafely and didn't crash the page.
      await expect(items.page.locator('body')).not.toContainText('Error');
    });
  }

  // ── TC-ISEARCH-13: whitespace-only input ───────────────────────────────────
  // NOTE: whitespace-only is NOT treated as invalid input by this app - it's
  // trimmed server-side and behaves like an empty/cleared search (returns the
  // full unfiltered list), not "No Data". An earlier draft of this suite
  // assumed the opposite; that assumption didn't match observed behavior.
  test('TC-ISEARCH-13 [+] Whitespace-only input is treated as empty and shows the unfiltered list', async () => {
    await items.searchFor('    ');
    expect(await items.isNoDataShown()).toBeFalsy();
    expect(await items.getDataRowCount()).toBe(baselineRowCount);
  });

  // ── TC-ISEARCH-14: clearing search ──────────────────────────────────────────
  test('TC-ISEARCH-14 [+] Clearing search restores the full unfiltered list', async () => {
    await items.searchFor(data.sku);
    expect(await items.isNoDataShown()).toBeFalsy();
    expect(await items.getDataRowCount()).toBeLessThanOrEqual(baselineRowCount);

    await items.clearSearch();
    expect(await items.isNoDataShown()).toBeFalsy();
    // Row-count parity, not a hardcoded page count - this env's total item
    // count is data-dependent (currently fits on a single page), so asserting
    // ">1 page" the way an earlier draft did would fail regardless of whether
    // search actually works.
    expect(await items.getDataRowCount()).toBe(baselineRowCount);
  });

});
