// Column order in the Items grid, matching the <td> index of each field
// (0 = row menu, 1 = row checkbox) - confirmed via live DOM inspection.
const COLUMNS = ['', '', 'sku', 'name', 'status', 'cost', 'salesPrice', 'availableQuantity', 'uom', 'category'];

class ItemsPage {
  constructor(page) {
    this.page = page;

    // The page has two "search" icon buttons: a global sidebar menu search
    // (first in DOM) and this grid's own search toggle (last). Matching by
    // icon alone is ambiguous - always take .last().
    this.searchToggle = page.locator('button:has(svg[data-testid="SearchIcon"])').last();
    this.searchInput  = page.locator('input[placeholder="Search"]');
    this.noDataMessage = page.getByText('No Data', { exact: true });
  }

  async gotoList() {
    await this.page.goto('/dashboard/inventory/product-management/items');
    await this.page.waitForLoadState('networkidle');
    await this.waitForListLoaded();
  }

  // A row can be "visible" while still showing skeleton placeholder blocks
  // instead of real text (the data fetch settles a moment after the row
  // itself renders) - the same class of race hit elsewhere in this suite's
  // other grids. Wait for the first row's SKU cell to actually contain text,
  // not just for the row element to exist, before trusting anything read
  // from the table (row count, cell values, "No Data" absence).
  async waitForListLoaded() {
    // A genuine zero-result search never gets a SKU cell at all, so this
    // can't unconditionally wait for one to appear first - poll for either
    // outcome: "No Data" shown, or the first row's SKU cell has real text.
    const firstSkuCell = this.page.locator('tbody tr td').nth(2);
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (await this.isNoDataShown()) return;
      if (await firstSkuCell.isVisible().catch(() => false)) {
        const text = await firstSkuCell.innerText().catch(() => '');
        if (text.trim()) return;
      }
      await this.page.waitForTimeout(300);
    }
  }

  async openSearch() {
    if (!(await this.searchInput.isVisible().catch(() => false))) {
      await this.searchToggle.click();
    }
    await this.searchInput.waitFor({ state: 'visible' });
  }

  async searchFor(value) {
    await this.openSearch();
    await this.searchInput.click();
    await this.searchInput.fill('');
    if (value) await this.searchInput.type(value);
    // Debounce + API round-trip - the grid re-renders a moment after typing stops.
    await this.page.waitForTimeout(1800);
    await this.waitForListLoaded();
  }

  async clearSearch() {
    await this.openSearch();
    await this.searchInput.fill('');
    await this.page.waitForTimeout(1500);
    await this.waitForListLoaded();
  }

  async isNoDataShown() {
    return this.noDataMessage.isVisible().catch(() => false);
  }

  // Data rows only - excludes the "+ Add Calculation" footer row, which is a
  // decorative row rendered in the same tbody as real data rows.
  dataRows() {
    return this.page.locator('tbody tr').filter({ hasNotText: 'Add Calculation' });
  }

  async getDataRowCount() {
    if (await this.isNoDataShown()) return 0;
    return this.dataRows().count();
  }

  // Reads every currently visible data row into plain objects keyed by
  // column name (see COLUMNS above), for tests that need real, current
  // values instead of hardcoded ones that can go stale as data changes.
  async getRowSnapshots() {
    if (await this.isNoDataShown()) return [];
    const rows = this.dataRows();
    const count = await rows.count();
    const snapshots = [];
    for (let i = 0; i < count; i++) {
      const cells = await rows.nth(i).locator('td').allInnerTexts();
      const row = {};
      COLUMNS.forEach((key, idx) => {
        if (key) row[key] = (cells[idx] || '').trim();
      });
      snapshots.push(row);
    }
    return snapshots;
  }
}

module.exports = ItemsPage;
