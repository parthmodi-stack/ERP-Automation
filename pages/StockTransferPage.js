const { expect } = require('@playwright/test');

class StockTransferPage {
  constructor(page) {
    this.page = page;
    this.formName = 'add_stock_transfer';

    // List page
    this.addButton = page.getByRole('button', { name: 'Add' }).first();

    // Header form (Basic Detail tab)
    this.saveButton      = page.getByRole('button', { name: 'Save' });
    this.nextButton      = page.getByRole('button', { name: 'Next' });
    this.discardButton   = page.getByRole('button', { name: 'Discard' });
    this.descriptionInput = page.locator(`textarea[name="${this.formName}.description"]`);

    this.requiredFieldsToast        = page.getByText('Please fill all the required fields.');
    this.employeeRequiredError      = page.getByText('Employee is required');
    this.operationTypeRequiredError = page.getByText('Operation type is required');
    // Source/Destination Location required errors render an untranslated
    // locale key instead of readable text - a real bug in the dev app, not a
    // typo here. Match it loosely so the test still passes if it's ever fixed.
    this.destinationLocationRequiredError = page.getByText(/destination_location_id_label is required|Destination Location is required/);
    this.sourceLocationRequiredError      = page.getByText(/source_location_id_label is required|Source Location is required/);
    this.sameLocationAlert = page.getByText('Source Location And Destination Location cannot be same.');

    // Operational Detail tab - table "Add" button opens the item modal
    this.addItemButton = page.getByRole('button', { name: 'Add', exact: true });

    // Add Item modal
    this.itemModal            = page.getByRole('dialog');
    this.itemModalSaveButton  = this.itemModal.getByRole('button', { name: 'Save' });
    this.itemModalCancelButton = this.itemModal.getByRole('button', { name: 'Cancel' });
    this.itemRequiredError             = page.getByText('Please select Item');
    this.requestQuantityRequiredError  = page.getByText('Request quantity is required');
    this.rateRequiredError             = page.getByText('Rate is required');
    this.transferQuantityRequiredError = page.getByText('Transfer quantity is required');

    // View page
    this.editButton       = page.getByRole('button', { name: 'Edit' });
    this.deleteButton     = page.getByRole('button', { name: 'Delete' });
    this.markAsToDoButton = page.getByRole('button', { name: 'Mark as to do' });
    this.validateButton   = page.getByRole('button', { name: 'Validate' });
    this.confirmDialog    = page.getByRole('dialog');
  }

  // Any Operational Detail row's "Track Detail" cell has its own AddCircleIcon button that opens
  // a "Track Detail" dialog - Validate is blocked ("Please complete the traceibility process
  // before validate") until every row has a Lot/Serial Number entry covering its full quantity
  // (confirmed live). This is a SEPARATE traceability gate from the item modal's own fields -
  // adding stock via Receipt is not enough on its own to make that stock Available downstream
  // (e.g. to a Work Order's Release check) without completing this too.
  rowByItemName(itemName) {
    return this.page.locator('table tbody tr', { hasText: itemName }).first();
  }

  async openTrackDetail(itemName) {
    await this.rowByItemName(itemName).locator('button').first().click();
    await this.page.getByRole('dialog', { name: 'Track Detail' }).waitFor({ state: 'visible' });
  }

  // Creates a brand-new Lot Number (the "+ Create New Lot/Serial number" option is always present
  // - no existing lot is assumed) and assigns the given quantity to it, then saves the Track
  // Detail dialog itself. `[role="combobox"]` is scoped with `.last()` rather than an id/name
  // selector because this nested "Add Lot Number" popup doesn't carry a stable `mui-component-
  // select-*` id of its own (confirmed live) - `.last()` reliably targets it since it's always the
  // most-recently-opened combobox once its own dialog is showing.
  async addTrackDetail({ itemName, quantity }) {
    await this.openTrackDetail(itemName);
    const trackDialog = this.page.getByRole('dialog', { name: 'Track Detail' });
    await trackDialog.getByRole('button', { name: 'Add', exact: true }).click();
    await this.page.waitForTimeout(500);

    const lotTrigger = this.page.locator('[id="mui-component-select-add_stock_transfer.lot_number"]');
    await lotTrigger.click();
    await this.page.waitForTimeout(800);
    const lotControlsId = await lotTrigger.getAttribute('aria-controls');
    const lotMenu = this.page.locator(`[id="${lotControlsId}"]`);
    await lotMenu.getByText('Create New Lot/Serial number').click();
    await this.page.waitForTimeout(1500);

    const typeTrigger = this.page.locator('[role="combobox"]').last();
    await typeTrigger.click();
    await this.page.waitForTimeout(500);
    const typeControlsId = await typeTrigger.getAttribute('aria-controls');
    const typeMenu = this.page.locator(`[id="${typeControlsId}"]`);
    await typeMenu.getByText('Lot Number', { exact: true }).click();
    await this.page.waitForTimeout(300);

    const lotName = `Automation_Lot_${Date.now()}`;
    await this.page.getByPlaceholder('Enter Lot Number').fill(lotName);
    await this.page.waitForTimeout(300);
    await this.page.getByRole('button', { name: 'Save', exact: true }).last().click();
    await this.page.waitForTimeout(1500);

    // The Lot/Serial number dropdown reopens automatically with the new lot as a selectable
    // option (confirmed live) - select it, then fill this entry's own Quantity field.
    await lotMenu.getByText(lotName, { exact: true }).click();
    await this.page.waitForTimeout(500);
    await this.page.locator('input[name="add_stock_transfer.quantity"]').fill(String(quantity));
    await this.page.waitForTimeout(300);
    await this.page.getByRole('button', { name: 'Save', exact: true }).last().click();
    await this.page.waitForTimeout(1500);

    await trackDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await trackDialog.waitFor({ state: 'hidden', timeout: 8000 });
  }

  // Ready -> Done. Confirm dialog text is "Are you sure you want to mark Stock Transfer as Done ?"
  // - same Submit-confirmation pattern as markAsToDo/confirmDialogAction elsewhere in this class.
  async validate() {
    await this.validateButton.click();
    await this.confirmDialog.waitFor({ state: 'visible' });
    await this.confirmDialogAction('Submit');
    await this.page.waitForTimeout(1500);
  }

  async gotoList() {
    // CONFIRMED LIVE: this SPA can get genuinely stuck on its own bare loading spinner on a cold
    // first load, not just slow - a single wait, however generous, never resolves, but a hard
    // reload recovers it (same fix as LocationPage.gotoList()/BinPage.gotoList()).
    await this.page.goto('/dashboard/inventory/operations/stock-transfer', { timeout: 60000 });
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      try {
        await this.addButton.waitFor({ state: 'visible', timeout: 20000 });
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        await this.page.reload({ timeout: 60000 }).catch(() => {});
      }
    }
    await this.waitForListLoaded();
  }

  // The table's row data fetch can still be in flight right after
  // "networkidle" fires (it kicks off on mount, slightly after the page's
  // initial XHRs settle), leaving skeleton placeholder rows with no readable
  // text/links in place of real ones. Waiting for the skeleton to become
  // hidden isn't reliable on its own - a second fetch (e.g. after a redirect)
  // can swap a fresh wave of skeleton rows back in right after the first
  // wave clears, and a one-shot check can land in that gap. Wait for actual
  // row content (a real view-stock-transfer link) instead of the skeleton's
  // absence - needed both after gotoList() and after any Save-triggered
  // redirect back to this list.
  async waitForListLoaded() {
    await this.page.locator('tbody a[href*="/stock-transfer/"]').first().waitFor({ state: 'visible', timeout: 10000 });
  }

  async openAdd() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-stock-transfer');
    // CONFIRMED LIVE: same stuck-loading-spinner class of bug as LocationPage.gotoList()/
    // BinPage.gotoList() - a single networkidle wait can hang well past a generous timeout on a
    // cold first load, and only a reload recovers it.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 20000 });
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        await this.page.reload({ timeout: 60000 }).catch(() => {});
        await this.page.waitForURL('**/add-stock-transfer').catch(() => {});
      }
    }
    // The schema-driven form fields load via a separate API call after the
    // shell renders; submitting before react-hook-form finishes wiring up
    // per-field validation lets onSubmit fire early and hit the (buggy)
    // source === destination check with both still undefined, showing
    // "cannot be same" instead of the expected required-field errors.
    await this.page.waitForTimeout(1000);
  }

  async gotoView(id) {
    // Same stuck-loading-spinner recovery as gotoList()/openAdd() above.
    await this.page.goto(`/dashboard/inventory/operations/stock-transfer/${id}/view-stock-transfer`, { timeout: 60000 });
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      try {
        // Edit button renders regardless of status (Draft/Ready/...), unlike Mark as to do/Validate
        // which are status-specific - a reliable "page is not stuck on the spinner" signal here.
        await this.editButton.waitFor({ state: 'visible', timeout: 20000 });
        return;
      } catch (e) {
        if (attempt === 3) throw e;
        await this.page.reload({ timeout: 60000 }).catch(() => {});
      }
    }
  }

  // Generic MUI "search & select" dropdown shared by the header form and the
  // item modal: a `mui-component-select-<fieldArrayName>.<field>` id trigger
  // opens a `menu-<fieldArrayName>.<field>` popover with a filter input.
  // Pass no searchText to pick the first real (non-placeholder) option.
  async selectMuiField(fieldArrayName, fieldName, searchText) {
    await this.page.locator(`[id="mui-component-select-${fieldArrayName}.${fieldName}"]`).click();
    const menu = this.page.locator(`[id="menu-${fieldArrayName}.${fieldName}"]`);
    await menu.waitFor({ state: 'visible', timeout: 8000 });
    await this.page.waitForTimeout(500);
    if (searchText) {
      // Real keystrokes, not .fill() - confirmed live that .fill()'s single programmatic value
      // change doesn't reliably trigger this component's debounced filter (the option list can
      // stay stuck on its full unfiltered set well past several seconds).
      await menu.locator('input').pressSequentially(searchText, { delay: 80 });
      // Prefer an exact match over `:has-text`'s substring match - confirmed live (via screenshot)
      // that a generic name like "Mumbai" can rank AFTER longer, unrelated options that merely
      // contain the search text (e.g. "Mumbai_<timestamp>" automation-created locations sort
      // first). Poll for the exact option directly rather than trying to detect "the filtered
      // list has settled" some other way (e.g. by list length) - the filtered list's own size
      // isn't a reliable settle signal here (confirmed live: it can plateau at the FULL unfiltered
      // count for multiple consecutive reads before actually shrinking).
      const exact = menu.locator('li').filter({ hasText: new RegExp(`^${searchText}$`) });
      const hasExactMatch = await expect(exact.first()).toBeVisible({ timeout: 8000 }).then(() => true).catch(() => false);
      if (hasExactMatch) {
        await exact.first().click();
      } else {
        await menu.locator(`li:has-text("${searchText}")`).first().click();
      }
    } else {
      await menu.locator('li').nth(1).click();
    }
    await menu.waitFor({ state: 'hidden', timeout: 8000 });
    await this.page.waitForTimeout(300);
  }

  async selectEmployee(searchText) {
    await this.selectMuiField(this.formName, 'employee_id', searchText);
  }

  async selectOperationType(displayText) {
    await this.selectMuiField(this.formName, 'operation_type', displayText);
  }

  async selectSourceLocation(searchText) {
    await this.selectMuiField(this.formName, 'source_location_id', searchText);
  }

  async selectDestinationLocation(searchText) {
    await this.selectMuiField(this.formName, 'destination_location_id', searchText);
  }

  async goToOperationalDetailTab() {
    await this.nextButton.click();
    await this.page.waitForTimeout(1000);
  }

  async selectTab(tabName) {
    await this.page.getByRole('tab', { name: tabName }).click();
    await this.page.waitForTimeout(500);
  }

  async openAddItemModal() {
    await this.addItemButton.click();
    await this.itemModal.waitFor({ state: 'visible' });
  }

  // Selecting an item triggers an async auto-fill of UOM/Rate/Reserve Quantity
  // from that item's own data (see stock-transfer-operation-modal.tsx's
  // item_data effect - it fires once the item's full record has been fetched,
  // not synchronously on click). Wait for Rate to actually receive that
  // auto-filled value before overwriting it below, otherwise the effect can
  // land after our own fill and silently revert it back to the item's price.
  async waitForItemAutoFill() {
    const rateInput = this.page.locator('input[name="stock_transfer_operation.rate"]');
    const deadline = Date.now() + 5000;
    while (!(await rateInput.inputValue()) && Date.now() < deadline) {
      await this.page.waitForTimeout(300);
    }
  }

  // Item field uses the same mui-component-select pattern but under the
  // `stock_transfer_operation` fieldArrayName instead of `add_stock_transfer`.
  async fillItemModal({ item, requestQuantity, rate, transferQuantity } = {}) {
    if (item !== undefined) {
      await this.selectMuiField('stock_transfer_operation', 'item_id', item);
      await this.waitForItemAutoFill();
    }
    if (requestQuantity !== undefined) {
      await this.page.locator('input[name="stock_transfer_operation.request_quantity"]').fill(requestQuantity);
    }
    if (rate !== undefined) {
      await this.page.locator('input[name="stock_transfer_operation.rate"]').fill(rate);
    }
    if (transferQuantity !== undefined) {
      await this.page.locator('input[name="stock_transfer_operation.transfer_quantity"]').fill(transferQuantity);
    }
    // Transfer Amount is recalculated on a 500ms debounce after rate/quantity
    // change - give it a moment to settle before Save reads the form values.
    await this.page.waitForTimeout(800);
  }

  async saveItemModal() {
    await this.itemModalSaveButton.click();
    await this.itemModal.waitFor({ state: 'hidden', timeout: 8000 });
  }

  async addOperationItem(data) {
    await this.openAddItemModal();
    await this.fillItemModal(data);
    await this.saveItemModal();
  }

  async save() {
    await this.saveButton.click();
  }

  // Stock Transfer rows have no name field to match on, so specs locate "their"
  // row by a value they chose when creating it (e.g. the destination location).
  rowFor(identifyingText) {
    return this.page.getByRole('row').filter({ hasText: identifyingText });
  }

  // Extract the numeric record id from a row's view-stock-transfer link, e.g.
  // ".../operations/stock-transfer/2060/view-stock-transfer" -> "2060".
  // Retries for a few seconds instead of reading once: the same skeleton-vs-
  // real-content race waitForListLoaded() guards against can still reopen a
  // narrow window right after a redirect, and this is the method that most
  // directly needs the list settled (it's what identifies "our" record).
  async getIdsForRow(identifyingText, { timeout = 10000, interval = 500 } = {}) {
    const deadline = Date.now() + timeout;
    let ids = [];
    do {
      const hrefs = await this.rowFor(identifyingText).locator('a').evaluateAll(
        (as) => as.map((a) => a.getAttribute('href')).filter(Boolean)
      );
      ids = [...new Set(
        hrefs.map((href) => href.match(/stock-transfer\/(\d+)\//)).filter(Boolean).map((m) => m[1])
      )];
      if (ids.length > 0) break;
      await this.page.waitForTimeout(interval);
    } while (Date.now() < deadline);
    return ids;
  }

  async getIdForRow(identifyingText) {
    const ids = await this.getIdsForRow(identifyingText);
    return ids[0] || null;
  }

  // Duplicate is only reachable from the list row's "..." menu - the view
  // page's own Actions dropdown trigger is commented out in the app, so it
  // never renders there.
  async openRowMenu(identifyingText) {
    const row = this.rowFor(identifyingText).first();
    await row.locator('button').first().click();
    await this.page.getByRole('menuitem', { name: 'View' }).waitFor({ state: 'visible' });
  }

  async duplicateFromList(identifyingText) {
    await this.openRowMenu(identifyingText);
    await this.page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await this.page.waitForURL('**/add-stock-transfer');
    await this.page.waitForLoadState('networkidle');
  }

  async confirmDialogAction(buttonName) {
    await this.confirmDialog.getByRole('button', { name: buttonName }).click();
  }
}

module.exports = StockTransferPage;
