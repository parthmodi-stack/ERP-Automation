const { expect } = require('@playwright/test');
const SettingsEntityPage = require('./base/SettingsEntityPage');
const StockTransferPage = require('./StockTransferPage');
const { seedMaterialStockViaReceipt } = require('../helpers/manufacturingStock');

// Work Order (dashboard/manufacturing/orders/work-order) - a real, fully-built document module,
// same `mui-component-select-work_order.<field>` pattern as Bill of Material's own `bom.<field>`.
// Reached by DIRECT navigation here (unlike the empty-stub `/dashboard/manufacturing/work-order`
// route, or the one-click "Create Work Order" shortcut from Demand Planning's Detail view, which
// produces a minimal Draft record missing Location and other fields needed to progress further).
//
// Critical, easy-to-miss dependency (confirmed live, and the whole reason
// ensureBomForItem() exists): "Bill of Material *" is a required field, and its own option list
// is scoped to whichever Item is currently selected - if that item has no BOM at all, the
// dropdown shows "No data available" and the Work Order can't be saved until one exists. Also
// confirmed live: a BOM whose own Start Date is AFTER its End Date (an easy mistake - see
// BillOfMaterialPage's own fillHeader callers) saves and can even reach Approved status with no
// validation error, but is then silently excluded from THIS dropdown too - "the BOM exists" is
// necessary but not sufficient; it also needs a sane date range.
//
// Selecting a BOM auto-populates UOM and the entire Materials grid from that BOM's own components
// (confirmed live) - no need to fill Materials by hand the way Bill of Material's own form
// requires.
//
// "Location" has no visible required-field asterisk but IS required (confirmed live: saving
// without it surfaces "Loacation is required" - a real app typo, not a mistake introduced here).
//
// Status lifecycle covered here: (Add form) -> Planned --(Release, confirm dialog)--> Released
// --(Issue Material, its own document)--> Material Issued --(Build, ANOTHER separate document -
// see BuildOrderPage)--> In progress --(Build Order's own Mark Completed)--> Completed. The Work
// Order's own "Close" button is NOT part of this path - confirmed live it's a mislabeled/buggy
// action that reverts status back to "Released" (toast: "Work Order has been released", the same
// confirm dialog/endpoint as Release itself) rather than completing anything.
class WorkOrderPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'work_order',
      listPath: '/dashboard/manufacturing/orders/work-order',
      addPath: '/dashboard/manufacturing/orders/work-order/add-work-order',
    });

    this.addButton = page.getByRole('button', { name: 'Add', exact: true });
    this.saveButton = page.locator('button[form="work_order"]');
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft' });
    this.discardButton = page.getByRole('button', { name: 'Discard' });

    this.dateInput = page.locator('input[name="work_order.date"]');
    this.quantityInput = page.locator('input[name="work_order.quantity"]');
    this.manufacturingTimeInput = page.locator('input[name="work_order.manufacturing_time"]');
    this.referenceNumberInput = page.locator('input[name="work_order.reference_number"]');

    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete' });

    this.releaseButton = page.getByRole('button', { name: 'Release', exact: true });
    this.releaseConfirmDialog = page.getByRole('dialog', { name: /Release Work order/i });
  }

  async gotoList() {
    await this.page.goto('/dashboard/manufacturing/orders/work-order');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-work-order');
    await this.page.waitForLoadState('networkidle');
  }

  // Delegates to the inherited selectField() (pages/base/SettingsEntityPage.js -> helpers/
  // dropdown.js) for the full search -> exact-match -> first-available-fallback -> create-new/
  // throw chain - see WorkCenterCategoryPage.js's own selectDropdown for the rationale.
  // `bom_id` specifically should go through ensureBomForItem() below instead of calling this
  // directly with no optionText, since a "first available" BOM pick can land on one whose own
  // material isn't RM1 and breaks Issue Material's downstream tracking - see that method's own
  // comment.
  async selectDropdown(fieldName, optionText, opts = {}) {
    const value = optionText || '';
    await this.selectField(fieldName, value, value, { optional: false, ...opts });
  }

  async selectItem(itemName) {
    await this.selectDropdown('item_id', itemName);
  }

  async getSelectedItemText() {
    return (await this.page.locator('[id="mui-component-select-work_order.item_id"]').textContent()).trim();
  }

  async selectLocation(locationName) {
    await this.selectDropdown('location_id', locationName);
  }

  // "Category" (visible label) is a whole different field name under the hood, `work_order.type`
  // (confirmed live) - and only renders as a REQUIRED field for certain items (confirmed live:
  // raw-material "Coil"-style items like "RWM-HR-00113 - HR Coil 2.80mm x 1325mm" trigger it,
  // alongside two other conditional text fields, Material Width/Material Thickness, that stay
  // optional even then). Since "first available" item selection can land on either kind between
  // runs, call this right after selectItem() on every Work Order - it silently no-ops when the
  // field isn't present rather than making callers detect the item type themselves.
  async selectCategoryIfPresent(categoryName) {
    const trigger = this.page.locator('[id="mui-component-select-work_order.type"]');
    if ((await trigger.count()) === 0) return;
    await this.selectDropdown('type', categoryName);
  }

  async selectBOM(bomName) {
    await this.selectDropdown('bom_id', bomName);
  }

  // Routing is scoped by BOTH the header's own selected BOM AND Location together (confirmed
  // live) - a Routing record whose own BOM matches but whose own Location doesn't (or vice versa)
  // never appears here. Call AFTER both selectBOM() and selectLocation(), not before either.
  //
  // Filters the already-open, already-short option list client-side rather than going through
  // selectDropdown()'s own typed-search path - this scoping already narrows it down to only a
  // handful of options, and typing into its search box hits the same debounced-filter flakiness
  // documented on BillOfMaterialPage.js's addMaterialRow() (a fixed wait after .fill() can resolve
  // in ~1s or still be unfiltered several seconds later depending on load).
  async selectRouting(routingName) {
    await this.page.locator('[id="mui-component-select-work_order.routing_id"]').click();
    const menu = this.page.locator('[id="menu-work_order.routing_id"]');
    await menu.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(800);
    const option = menu.locator('li').filter({ hasText: routingName });
    await option.first().click();
    await menu.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  // Creates a fresh, Approved BOM for the exact given item (only an Approved BOM with a sane
  // Start < End date range is confirmed live to actually appear in the Work Order's own BOM
  // dropdown), then re-opens a fresh Work Order Add form and re-selects the same item so the
  // caller continues from a known-good state. Returns the Materials row's own actually-selected
  // item text (via BillOfMaterialPage.addMaterialRow's own return value).
  //
  // The Materials row is left to "first available" rather than pinned to "RM1" - RM1 is no
  // longer reliably reachable via this row's own item search (confirmed live: the search box's
  // own debounced filter API never actually applies a name filter at all - it just re-fetches the
  // same fixed "most recent 25 items by id" page regardless of what's typed - and RM1, an older
  // item, has long since aged out of that window as newer automation items from other suites
  // accumulate).
  //
  // CONFIRMED LIVE this session: Submit For Approval hangs indefinitely (no visible error, no
  // status change) when the Materials row's own item has no real stock - stock it in via a real
  // Stock Transfer Receipt (same mechanism Release's own "insufficient material" fallback uses)
  // BEFORE attempting Submit, rather than after - this BOM can't be Approved at all otherwise.
  // The receipt's own destination location is left to "first available" (StockTransferPage's own
  // fallback when no location is passed) rather than pinned to this Work Order's own eventual
  // Location - Submit For Approval doesn't check location at all (the BOM's own header shows
  // Location as blank/unset here), that's only Release's own separate, Location-scoped concern,
  // which already has its own conditional seeding fallback where it's actually needed.
  async _createApprovedBomForItem(bomPage, itemDisplayText) {
    await bomPage.goto();
    await bomPage.selectItem(itemDisplayText);
    const bomName = `Automation_BOM_ForWO_${Date.now()}`;
    await bomPage.fillHeader({
      name: bomName,
      quantity: 1,
      startDate: '01-08-2026',
      endDate: '31-12-2027', // must be AFTER startDate - see this class's own header comment
    });
    await bomPage.selectUOM();
    const materialItemText = await bomPage.addMaterialRow({ quantity: 1 });
    await bomPage.save();
    const bomSeriesNumber = (await bomPage.page.getByText(/^BOM-\d+$/).first().textContent()).trim();
    await bomPage.openView(bomSeriesNumber);

    // addMaterialRow() returns "<SKU> - <Name>" (the Materials row's own display format), but
    // Stock Transfer's own Operational Detail row shows only the plain Name (confirmed live) -
    // StockTransferPage.rowByItemName()'s own substring match never finds a "<SKU> - <Name>"
    // search string against that plain-name row, so strip the SKU prefix back off first.
    const materialPlainName = materialItemText.includes(' - ')
      ? materialItemText.slice(materialItemText.indexOf(' - ') + 3)
      : materialItemText;
    await seedMaterialStockViaReceipt(new StockTransferPage(this.page), {
      itemName: materialPlainName,
      availableQuantity: 500,
    });

    await bomPage.openView(bomSeriesNumber);
    await bomPage.submitForApproval();
    await bomPage.approve();

    await this.goto();
    await this.selectItem(itemDisplayText);
    return materialItemText;
  }

  // Call AFTER selectItem() on the Work Order's own Add form. ALWAYS creates a fresh BOM rather
  // than reusing whatever BOM the item might already have (confirmed live: an item can already
  // carry an approved BOM from an earlier, unrelated test run whose own material has no real
  // stock - reusing that would hit the same Submit-hangs-forever gap this method now stocks in
  // for from scratch every time). Also directly selects the newly-created BOM, so callers no
  // longer need a separate selectDropdown('bom_id') call afterward - existing calls to that are
  // now a harmless re-selection, not a required step. Returns the Materials row's own item text.
  async ensureBomForItem(bomPage, itemDisplayText) {
    const materialItemText = await this._createApprovedBomForItem(bomPage, itemDisplayText);
    await this.selectField('bom_id', '', '', { optional: false });
    return materialItemText;
  }

  async fillHeader({ date, quantity, manufacturingTime, referenceNumber } = {}) {
    if (date !== undefined) await this.dateInput.fill(date);
    if (quantity !== undefined) await this.quantityInput.fill(String(quantity));
    if (manufacturingTime !== undefined) await this.manufacturingTimeInput.fill(String(manufacturingTime));
    if (referenceNumber !== undefined) await this.referenceNumberInput.fill(referenceNumber);
  }

  async save() {
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async saveToDraft() {
    await this.saveToDraftButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async openView(seriesNumber) {
    await this.gotoList();
    await this.page.getByText(seriesNumber, { exact: true }).first().click();
    await this.page.waitForURL('**/view-work-order');
    await this.page.waitForLoadState('networkidle');
  }

  async openEdit(seriesNumber) {
    await this.openView(seriesNumber);
    await this.editButton.click();
    await this.page.waitForURL('**/edit-work-order');
    await this.page.waitForLoadState('networkidle');
  }

  async openActions() {
    await this.actionsButton.click();
    await this.page.waitForTimeout(400);
  }

  async deleteRecord() {
    await this.openActions();
    await this.deleteMenuItem.click();
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  // Planned -> Released. Clicking Release opens a confirmation dialog ("Release Work order: Are
  // you sure you want to Release Work order: <id> ?") whose own button is also labeled "Submit"
  // (same pattern as Bill of Material's Approve confirmation) - scope to the dialog.
  //
  // Returns 'released' or 'insufficient_material' rather than hard-asserting success, so callers
  // can seed real stock (via helpers/manufacturingStock.js's seedMaterialStockViaReceipt) ONLY
  // when Release actually needs it - per explicit instruction, don't run that (slow) Stock
  // Transfer Receipt setup unconditionally on every run when the material already has enough
  // Available stock left over from a previous run.
  async release() {
    await this.releaseButton.click();
    await this.releaseConfirmDialog.waitFor({ state: 'visible' });
    await this.releaseConfirmDialog.getByRole('button', { name: 'Submit', exact: true }).click();

    const releasedText = this.page.getByText('Released', { exact: true });
    const insufficientMaterialError = this.page.getByText(/Required materials are not available in sufficient quantity/i);
    return Promise.race([
      releasedText.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'released'),
      insufficientMaterialError.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'insufficient_material'),
    ]);
  }

  // Released -> Material Issued. "Issue Material" opens a SEPARATE document ("Add Material
  // Issue"), pre-filled from this Work Order/its BOM, with its own Materials grid row already
  // populated with the BOM's material (RM1, per ensureBomForItem's own pinning) and quantity.
  // That row's own "Trace Details" icon opens the same Track Detail dialog Stock Transfer uses
  // (see StockTransferPage.addTrackDetail) - it should normally already have a lot/serial entry
  // from Release's own conditional stock-seeding (seedMaterialStockViaReceipt, which creates a
  // real Lot for RM1 as part of seeding its stock). If RM1's existing lot(s) have since been
  // fully consumed by other runs, this dialog shows a genuinely empty "No Data" list with no way
  // to create a new lot from THIS screen at all (confirmed live: no "Create New" option here,
  // unlike Stock Transfer's own version of this feature) - fall back to seeding a fresh lot via a
  // real Stock Transfer Receipt and restarting Issue Material from a clean state, same
  // self-healing shape as ensureBomForItem().
  async issueMaterial() {
    const workOrderViewUrl = this.page.url();
    await this.openMaterialIssueTrackDetail();

    const trackDialog = this.page.getByRole('dialog', { name: 'Track Detail' });
    const hasExistingEntry = !(await trackDialog.getByText('No Data', { exact: true }).isVisible().catch(() => false));
    if (!hasExistingEntry) {
      const itemName = (await trackDialog.locator('text=Item').locator('xpath=following-sibling::*[1]').textContent()).trim();
      const quantity = (await trackDialog.locator('text=Quantity').first().locator('xpath=following-sibling::*[1]').textContent()).trim();
      const location = (await trackDialog.locator('text=Location').locator('xpath=following-sibling::*[1]').textContent()).trim();

      await this.page.keyboard.press('Escape').catch(() => {});
      await seedMaterialStockViaReceipt(new StockTransferPage(this.page), {
        itemName,
        availableQuantity: Math.ceil(Number(quantity)) + 10, // headroom over this row's own requirement
        location,
      });

      await this.page.goto(workOrderViewUrl);
      await this.page.waitForLoadState('networkidle');
      await this.openMaterialIssueTrackDetail();
    }

    await trackDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await trackDialog.waitFor({ state: 'hidden' });

    await this.page.getByRole('button', { name: 'Validate' }).click();
    await this.page.waitForURL('**/view-work-order', { timeout: 15000 });
    await expect(this.page.getByText('Material Issued', { exact: true })).toBeVisible({ timeout: 10000 });
  }

  // Navigates from this Work Order's own View page (if not already on the Material Issue page)
  // through "Issue Material" and opens the Materials row's own Track Detail dialog - factored out
  // so issueMaterial() can restart from a clean state after seeding a lot.
  async openMaterialIssueTrackDetail() {
    if (!/\/material-issue\/add-material-issue/.test(this.page.url())) {
      await this.page.getByRole('button', { name: 'Issue Material' }).click();
      await this.page.waitForURL('**/material-issue/add-material-issue');
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(1000);
    }

    const materialsRow = this.page.locator('table tbody tr').filter({ has: this.page.locator('text=Unit') }).first();
    await materialsRow.locator('button').first().click();
    const trackDialog = this.page.getByRole('dialog', { name: 'Track Detail' });
    await trackDialog.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(500);
  }

  // Material Issued -> In progress (on the Work Order side) - opens Build Order's own "Add Build
  // Order" form, reachable ONLY from here (not by direct navigation - confirmed live, unlike Bill
  // of Material/Work Order themselves). Call BuildOrderPage.fillAndSave() next to actually create
  // it; completing THAT record (BuildOrderPage.markCompleted()) is what finally flips this Work
  // Order to "Completed" too.
  async openBuildForm() {
    await this.openActions();
    await this.page.getByRole('menuitem', { name: 'Build' }).click();
    await this.page.waitForURL('**/add-build-order');
    await this.page.waitForLoadState('networkidle');
  }

  // Reachable from a Completed Work Order's own Actions menu ONLY (confirmed live: navigating
  // directly to /dashboard/manufacturing/job-cards/add-job-cards loses all pre-fill context and
  // renders a completely empty form, unlike this path which pre-fills Entity/Location/Item/UOM/
  // BOM/Quantity/Routing from this Work Order). Call JobCardPage's own fillAndSave() next.
  async openCreateJobCardsForm() {
    await this.openActions();
    await this.page.getByRole('menuitem', { name: 'Create Job Cards' }).click();
    await this.page.waitForURL('**/add-job-cards');
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = WorkOrderPage;
