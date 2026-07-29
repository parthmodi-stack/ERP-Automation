const { selectDropdown } = require('../helpers/dropdown');

// Demand Planning (dashboard/manufacturing/demand-planning) is a read-only reporting screen -
// filter -> shortfall summary table - not a create/edit/view/delete master-data or document
// screen, so this page object has no fillForm()/save()/openEdit() the way every other module's
// does. Manufacturing has no established page-object tier yet (see CLAUDE.md's "Page-object
// tiers" section) - this is closest in shape to Inventory's "operations" screens (Stock Transfer):
// a flat class with no shared base, reading a live report rather than mutating a record.
//
// The filter comboboxes (Subsidiary/Location/Item/Type) render with NO id, name, or aria-label at
// all (confirmed live via a full attribute dump) - unlike the Inventory Item wizard's
// `mui-component-select-<field>` pattern, there is nothing stable to select them by except DOM
// order within the Filter panel. Their popups DO render options with role="option" and the same
// "phantom search-wrapper as the first option" quirk as Accounting/CRM's dropdowns (confirmed
// live: clicking the Location combobox opens a role="option" list whose first entry is the
// search-input wrapper, not a real location) - so they reuse helpers/dropdown.js's
// `selectDropdown` rather than a bespoke click sequence.
class DemandPlanningPage {
  constructor(page) {
    this.page = page;

    // Filter changes (checkbox toggle, item selection, ...) can each kick off their own summary
    // refetch in quick succession, so a single one-shot `page.waitForResponse()` set up right
    // before an action risks resolving on an earlier, still-in-flight call instead of the one that
    // action actually triggered (confirmed live - a one-shot wait intermittently returned a
    // pre-filter response with no result). Recording every response into this array and reading
    // off the END of it after acting, instead of racing a single predicate-matched promise, is
    // deterministic regardless of how many calls overlap.
    this._summaryResponses = [];
    page.on('response', async (res) => {
      if (res.url().includes('demand-planning/summary') && res.request().method() === 'POST') {
        try {
          this._summaryResponses.push(await res.json());
        } catch {
          // ignore bodies that fail to parse as JSON
        }
      }
    });

    // Positional within the Filter panel - confirmed live order: Subsidiary(0), Location(1),
    // Item(2), Type(3); a 5th combobox (page-size selector, further down in the DOM near
    // pagination) is deliberately NOT included in this same locator so it can't be mis-indexed in.
    const filterCombos = page.locator('[role="combobox"]');
    this.subsidiaryFilterTrigger = filterCombos.nth(0);
    this.locationFilterTrigger = filterCombos.nth(1);
    this.itemFilterTrigger = filterCombos.nth(2);
    this.typeFilterTrigger = filterCombos.nth(3);

    this.asOfDateInput = page.getByPlaceholder('Select Date');
    // Reasonably confirmed (MUI FormControlLabel usually wires this correctly) but not verified
    // via an explicit role query the way the comboboxes above were - double check live if this
    // ever fails to resolve.
    this.showBelowReorderPointCheckbox = page.getByRole('checkbox', { name: 'Show Below Reorder Point' });

    this.clearAllButton = page.getByRole('button', { name: 'Clear All' });
    this.refreshButton = page.getByRole('button', { name: 'Refresh' });
    this.viewDetailsButton = page.getByRole('button', { name: 'View Details' });
    // Same button slot on the Detail view (dashboard/manufacturing/demand-planning/detail-demand-
    // planning) once at least one row is checked - confirmed live this is the REAL, intended path
    // to net a shortfall: it navigates straight to Procurement's own Add Request page with Entity,
    // Currency, Item, Quantity, Rate, Available and On Hand ALL already pre-filled from the
    // selected row - only Location still needs filling there.
    this.purchaseRequestButton = page.getByRole('button', { name: 'Purchase Request' });
    // Same button slot again, but labeled "Create Work Order" when Type is 'Production' instead
    // of 'Procurement' (confirmed live) - unlike Purchase Request, this one doesn't navigate to a
    // form at all: clicking it POSTs manufacturing/v1/work-order/demand-planning/save-as-draft
    // directly and creates a real Draft Work Order in one shot, then lands on the Work Order list
    // with a "Work Order created Successfully." toast.
    this.createWorkOrderButton = page.getByRole('button', { name: 'Create Work Order' });
    // "Summery" (sic) is the panel's real, live-confirmed heading text - not a typo introduced here.
    this.summaryTotal = page.getByText(/^Total\s*:/);

    this.tableRows = page.locator('table tbody tr');
    this.pageSizeTrigger = page.locator('text=Items per page').locator('xpath=following::*[@role="combobox"][1]');
  }

  async goto() {
    await this.page.goto('/dashboard/manufacturing/demand-planning');
    await this.page.waitForLoadState('networkidle');
    // Default page size is 10 (confirmed live options: 10/20/50), and this environment already
    // has more below-reorder-point items than that from accumulated test runs - confirmed live,
    // a fresh item can be silently pushed off page 1 (pagination.totalCount=11 > limit=10 with
    // the newest item missing from the returned page). Bump to 50 by default so a brand-new
    // item created by this run's own tests reliably fits, rather than intermittently failing as
    // this shared/cumulative environment keeps growing.
    await this.setPageSize(50);
  }

  async setPageSize(size) {
    const currentText = (await this.pageSizeTrigger.textContent()) || '';
    if (currentText.trim() === String(size)) return;
    await this._actionAndGetLatestSummary(async () => {
      await this.pageSizeTrigger.click();
      const listbox = this.page.locator('[role="listbox"]').last();
      await listbox.waitFor({ state: 'visible', timeout: 5000 });
      await listbox.getByRole('option', { name: String(size), exact: true }).click();
    });
  }

  // Runs `action`, then waits until the response array (see constructor) stops growing for a
  // short debounce window before returning its last entry. A single filter action can trigger
  // MORE than one summary refetch in quick succession (confirmed live: selecting an item filter
  // fires an interim call before the correctly-filtered one lands moments later) - grabbing the
  // first new array entry the instant it appears can catch that interim, not-yet-filtered one
  // even though the UI itself waits for and renders the final settled state. Waiting for growth
  // to pause, then reading the end of the array, is robust regardless of how many calls overlap.
  async _actionAndGetLatestSummary(action) {
    await action();
    const deadline = Date.now() + 20000;
    let lastLength = -1;
    let stableSince = Date.now();
    // slowMo:500 (playwright.config.js) pads every step of the triggering action, so the
    // debounced refetch this settles for can lag well behind the action's own completion -
    // 800ms of quiet wasn't enough (confirmed live: it grabbed a stale response before the real
    // filtered one had even fired yet), 2.5s is.
    while (Date.now() < deadline) {
      if (this._summaryResponses.length !== lastLength) {
        lastLength = this._summaryResponses.length;
        stableSince = Date.now();
      } else if (Date.now() - stableSince > 2500) {
        break;
      }
      await this.page.waitForTimeout(300);
    }
    if (this._summaryResponses.length === 0) {
      throw new Error('No demand-planning/summary response observed after the triggering action');
    }
    return this._summaryResponses[this._summaryResponses.length - 1];
  }

  async filterBySubsidiary(name) {
    return this._actionAndGetLatestSummary(() => selectDropdown(this.page, this.subsidiaryFilterTrigger, name, name));
  }

  async filterByLocation(name) {
    return this._actionAndGetLatestSummary(() => selectDropdown(this.page, this.locationFilterTrigger, name, name));
  }

  // KNOWN LIVE BUG, confirmed via direct network-response comparison: searching this filter for
  // an item within roughly a minute of that item being created can silently resolve to a
  // DIFFERENT, older item instead of failing or timing out - the item's own name appears
  // correctly in the unfiltered "Show Below Reorder Point" summary immediately, but this
  // filter's own search/autocomplete index lags behind, so helpers/dropdown.js's exact-match
  // search finds no result and falls back to "first available option" (some unrelated earlier
  // item). Do NOT rely on this method to locate a just-created item in a test - toggle
  // `showBelowReorderPointCheckbox` and read the row/response directly by name/id instead (see
  // TC-DP-01/02/03). Kept here for filtering by an item that's been stable for a while.
  async filterByItem(name) {
    return this._actionAndGetLatestSummary(() => selectDropdown(this.page, this.itemFilterTrigger, name, name));
  }

  // Returns the most recently observed summary response without triggering a new action - use
  // after toggleShowBelowReorderPoint()/goto() when you don't also want to risk the Item filter's
  // indexing-lag bug documented on filterByItem() above.
  getLatestSummary() {
    return this._summaryResponses[this._summaryResponses.length - 1];
  }

  // Type is a fixed two-option list (Procurement/Production, confirmed live), not search-driven
  // like the other filters - it renders no filter <input> at all, so helpers/dropdown.js's
  // selectDropdown (which always looks for one) doesn't fit; this is a plain click-and-pick.
  async selectType(name) {
    return this._actionAndGetLatestSummary(async () => {
      await this.typeFilterTrigger.click();
      const listbox = this.page.locator('[role="listbox"]').last();
      await listbox.waitFor({ state: 'visible', timeout: 5000 });
      await listbox.getByRole('option', { name, exact: true }).click();
    });
  }

  async toggleShowBelowReorderPoint(checked) {
    const isChecked = await this.showBelowReorderPointCheckbox.isChecked();
    if (isChecked === checked) return undefined;
    return this._actionAndGetLatestSummary(() => this.showBelowReorderPointCheckbox.click());
  }

  async clearAll() {
    return this._actionAndGetLatestSummary(() => this.clearAllButton.click());
  }

  rowByItemName(itemName) {
    return this.tableRows.filter({ hasText: itemName });
  }

  async isItemVisible(itemName) {
    return (await this.rowByItemName(itemName).count()) > 0;
  }

  // Column order confirmed live: Item, Description, Units, Demand, On Hand, On Order, Available,
  // Committed, PR, Required - Required is the 10th (index 9) cell.
  async getRequiredQuantity(itemName) {
    const cellText = await this.rowByItemName(itemName).locator('td').nth(9).textContent();
    return Number(cellText.trim());
  }

  // Navigates from the summary view to /detail-demand-planning - same filters, but each row gets
  // its own selection checkbox and the "View Details" button slot becomes "Purchase Request"
  // (enabled once >=1 row is checked). Shares the same page size drift risk as the summary view
  // (confirmed live: 10/20/50 options here too), so bump it the same way.
  async openDetailView() {
    await this.viewDetailsButton.click();
    await this.page.waitForLoadState('networkidle');
    await this.setPageSize(50);
  }

  async selectDetailRow(itemName) {
    await this.rowByItemName(itemName).locator('input[type="checkbox"]').click();
  }

  // Navigates to Procurement's Add Request page with the selected row(s) pre-filled - see the
  // purchaseRequestButton locator comment above for exactly which fields come pre-populated.
  async createPurchaseRequestFromSelection() {
    await this.purchaseRequestButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  // Unlike createPurchaseRequestFromSelection, this doesn't navigate to a form - it creates the
  // Work Order immediately (confirmed live: POST manufacturing/v1/work-order/demand-planning/
  // save-as-draft, response includes the new record's id/series_number/quantity/status) and lands
  // on the Work Order list. Returns the parsed response body so callers can assert on the created
  // record directly instead of re-deriving it from the list's DOM.
  async createWorkOrderFromSelection() {
    const responsePromise = this.page.waitForResponse(
      (res) => res.url().includes('work-order/demand-planning/save-as-draft') && res.request().method() === 'POST',
    );
    await this.createWorkOrderButton.click();
    const response = await responsePromise;
    await this.page.waitForLoadState('networkidle');
    return response.json();
  }

  async getTotalCount() {
    const text = await this.summaryTotal.textContent();
    return Number(text.replace(/[^\d]/g, ''));
  }
}

module.exports = DemandPlanningPage;
