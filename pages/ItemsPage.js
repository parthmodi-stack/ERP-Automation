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
    await this.page.goto('/dashboard/inventory/product-management/items', { timeout: 60000 });
    // CONFIRMED LIVE (same class of bug as every other module in this suite): this page can get
    // genuinely STUCK on a blank page after navigation - a single wait, however generous, never
    // resolves that, but a hard reload reliably recovers it. Retry with a reload rather than trust
    // one wait. CONFIRMED LIVE this page specifically needed more than one reload to recover (a
    // single reload still left it blank twice in a row) - given 2 reloads here.
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const visible = await this.searchToggle.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      if (visible) break;
      if (attempt === 3) break;
      await this.page.reload({ timeout: 60000 }).catch(() => {});
    }
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

  // CONFIRMED LIVE: searches for the item, then opens it by clicking its name cell (column index
  // 3) directly rather than the whole row - a stray MUI menu/popover backdrop left open elsewhere
  // on this page can intercept a bare row click. Lands on
  // /dashboard/inventory/product-management/items/:id/view-inventory-item.
  async openItemByName(name) {
    await this.gotoList();
    await this.searchFor(name);
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.mouse.click(2, 2).catch(() => {});
    await this.page.waitForTimeout(300);
    await this.dataRows().first().locator('td').nth(3).click();
    await this.page.waitForURL('**/view-inventory-item', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  // "Moves History" - one of the tabs on an Inventory Item's own view page (CONFIRMED LIVE tab
  // order: Primary, Rental Price, Sales, Purchase, Accounting, Inventory, Price Rules/Sales,
  // Update Quantity, Moves History, Reordering Rules, Variant). Columns: Date, Item, Lot/Serial
  // Number, From, To, Quantity, Move Type ("In"/"Out"), Move Status, Entity.
  async goToMovesHistoryTab() {
    await this.page.getByRole('tab', { name: 'Moves History', exact: true }).click();
    await this.page.waitForTimeout(800);
  }

  async getMovesHistoryRows() {
    const rows = this.page.locator('table tbody tr');
    const count = await rows.count().catch(() => 0);
    const snapshots = [];
    for (let i = 0; i < count; i++) {
      const cells = await rows.nth(i).locator('td').allInnerTexts().catch(() => []);
      snapshots.push({
        date: (cells[0] || '').trim(),
        item: (cells[1] || '').trim(),
        lotSerialNumber: (cells[2] || '').trim(),
        from: (cells[3] || '').trim(),
        to: (cells[4] || '').trim(),
        quantity: (cells[5] || '').trim(),
        moveType: (cells[6] || '').trim(),
        moveStatus: (cells[7] || '').trim(),
        entity: (cells[8] || '').trim(),
      });
    }
    return snapshots;
  }
}

module.exports = ItemsPage;
