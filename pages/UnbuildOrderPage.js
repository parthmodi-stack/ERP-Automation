const { expect } = require('@playwright/test');
const SettingsEntityPage = require('./base/SettingsEntityPage');
const StockTransferPage = require('./StockTransferPage');
const { seedMaterialStockViaReceipt } = require('../helpers/manufacturingStock');

// Unbuild Order (dashboard/manufacturing/orders/unbuild-order) - consumes an Item's own built
// stock and produces its BOM's raw materials back. Two creation paths exist:
//
// 1. Direct navigation to /unbuild-order/add-unbuild-order - the Items dropdown's own API used to
//    return a 500 ("Unknown column 'items.purchase_tax_id' in 'on clause'"), confirmed live
//    earlier this session; that backend bug has since been fixed, so this path is now usable.
//    Location/Item/Bill of Materials all need selecting manually (none are pre-filled) - Bills of
//    Materials is scoped to whichever Item is selected, same "No data available if the item has
//    no BOM" shape as Work Order's own Add form, so ensureBomForItem() below exists for the same
//    reason WorkOrderPage.ensureBomForItem() does. The Materials grid DOES auto-populate once a
//    BOM is selected here too (confirmed live), same as Work Order.
// 2. From a COMPLETED Build Order's own Actions menu ("Unbuild" - see
//    BuildOrderPage.openUnbuildForm()) - pre-fills Work Order/Build Order/Id/Item/UOM/Bill of
//    Materials/Quantity Built (all disabled/read-only) and the same auto-populated Materials row -
//    only Quantity To Unbuild needs attention.
//
// One more confirmed bug, specific to the initial CREATE flow: the Add form's main "Save" button
// (which should submit to Pending/whatever the "real" first status is) crashes client-side BEFORE
// any network request fires - "formValues?.unbuild_order_materials?.map is not a function" -
// reproducible with or without touching the pre-filled Materials row. "Save To Draft" (a
// different handler/endpoint, POST .../unbuild-orders/save-draft) works correctly and is the only
// usable Create action. Once a Draft record exists, its own Edit page's "Save" button works fine
// (a real PUT .../unbuild-orders/<id>, 200) and transitions Draft -> In progress.
//
// Status lifecycle: (Save To Draft) -> Draft --(Edit -> Save)--> In progress --(see
// completeUnbuild() below)--> Completed. Reaching Completed requires TWO separate Track Detail
// confirmations, confirmed live:
// 1. The Materials grid row's own "Trace Detail" icon - only responsive on the EDIT page (the
//    View page's equivalent icon does nothing at all, confirmed live) - generates tracking and
//    opens a pre-populated "Track Detail" dialog covering the row's full consumed quantity;
//    saving it is a precondition for step 2 below.
// 2. Only THEN does the View page's "Adjust Inventory" button actually progress: its own
//    "Validation Error" dialog ("Please select the lot/serial number and done quantity for
//    Finished Item...") - clicking its "Ok" auto-generates the FINISHED ITEM's own tracking
//    (distinct from the Materials row above) and opens a second Track Detail dialog, pre-
//    populated the same way - saving it replaces "Adjust Inventory" with a "Mark Completed"
//    button, which finally completes the record.
class UnbuildOrderPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'unbuild_order',
      listPath: '/dashboard/manufacturing/orders/unbuild-order',
      addPath: '/dashboard/manufacturing/orders/unbuild-order/add-unbuild-order',
    });

    this.quantityToUnbuildInput = page.locator('input[name="unbuild_order.quantity_to_unbuild"]');
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft', exact: true });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete' });

    this.adjustInventoryButton = page.getByRole('button', { name: 'Adjust Inventory' });
    this.markCompletedButton = page.getByRole('button', { name: 'Mark Completed' });
    this.validationErrorDialog = page.getByRole('dialog', { name: 'Validation Error' });
    this.trackDetailDialog = page.getByRole('dialog', { name: 'Track Detail' });
  }

  async gotoList() {
    await this.page.goto('/dashboard/manufacturing/orders/unbuild-order');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoAdd() {
    await this.page.goto('/dashboard/manufacturing/orders/unbuild-order/add-unbuild-order');
    await this.page.waitForLoadState('networkidle');
  }

  // Delegates to the inherited selectField() (pages/base/SettingsEntityPage.js -> helpers/
  // dropdown.js) for the full search -> exact-match -> first-available-fallback -> create-new/
  // throw chain - see WorkCenterCategoryPage.js's own selectDropdown for the rationale. The
  // `bom_id` field additionally gets a `createIfMissing` fallback wired in automatically - see
  // ensureBomForItem() below.
  async selectDropdown(fieldName, optionText, opts = {}) {
    const value = optionText || '';
    await this.selectField(fieldName, value, value, { optional: false, ...opts });
  }

  async selectItem(itemName) {
    await this.selectDropdown('item_id', itemName);
  }

  async getSelectedItemText() {
    return (await this.page.locator('[id="mui-component-select-unbuild_order.item_id"]').textContent()).trim();
  }

  async selectLocation(locationName) {
    await this.selectDropdown('location_id', locationName);
  }

  async selectBOM(bomName) {
    await this.selectDropdown('bom_id', bomName);
  }

  // On the direct-creation Add form, selecting a BOM auto-populates the Materials grid
  // asynchronously (confirmed live, same as Work Order's own form) - selectDropdown()'s own
  // "menu closed" wait resolves before this fetch completes, so filling Quantity To Unbuild and
  // clicking Save To Draft too soon can save with an EMPTY Materials array ("No Data" persists
  // even though the header shows the right BOM). Call this right after selectDropdown('bom_id')
  // and before fillAndSaveAsDraft() on that path.
  async waitForMaterialsRow() {
    const noDataRow = this.page.getByText('No Data', { exact: true });
    await expect(noDataRow).toHaveCount(0, { timeout: 8000 });
  }

  // Creates a fresh, Approved BOM for the exact given item (Approved, sane date range), then
  // returns to a fresh Add form with the same item re-selected. Returns the Materials row's own
  // actually-selected item text (via BillOfMaterialPage.addMaterialRow's own return value).
  //
  // The Materials row is left to "first available" rather than pinned to "RM1" - RM1 is no
  // longer reliably reachable via this row's own item search (confirmed live: its debounced
  // filter API never actually applies a name filter, always re-fetching the same fixed "most
  // recent 25 items" page regardless of what's typed, and RM1 has aged out of that window - see
  // WorkOrderPage._createApprovedBomForItem's own comment for the full finding).
  //
  // CONFIRMED LIVE this session: Submit For Approval hangs indefinitely (no visible error, no
  // status change) when the Materials row's own item has no real stock - stock it in via a real
  // Stock Transfer Receipt (same mechanism Release's own "insufficient material" fallback uses)
  // BEFORE attempting Submit, rather than after - this BOM can't be Approved at all otherwise.
  // The receipt's own destination location is left to "first available" (StockTransferPage's own
  // fallback when no location is passed) rather than pinned to a specific one - Submit For
  // Approval doesn't check location at all (the BOM's own header shows Location as blank/unset
  // here), that's only Release's own separate, Location-scoped concern.
  async _createApprovedBomForItem(bomPage, itemDisplayText) {
    await bomPage.goto();
    await bomPage.selectItem(itemDisplayText);
    const bomName = `Automation_BOM_ForUO_${Date.now()}`;
    await bomPage.fillHeader({
      name: bomName,
      quantity: 1,
      startDate: '01-08-2026',
      endDate: '31-12-2027', // must be AFTER startDate - see BillOfMaterialPage's own comment
    });
    await bomPage.selectUOM();
    const materialItemText = await bomPage.addMaterialRow({ quantity: 1 });
    await bomPage.save();
    const bomSeriesNumber = (await bomPage.page.getByText(/^BOM-\d+$/).first().textContent()).trim();
    await bomPage.openView(bomSeriesNumber);

    // addMaterialRow() returns "<SKU> - <Name>", but Stock Transfer's own Operational Detail row
    // shows only the plain Name (confirmed live) - strip the SKU prefix back off, see
    // WorkOrderPage._createApprovedBomForItem's own comment for the full finding.
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

    await this.gotoAdd();
    await this.selectItem(itemDisplayText);
    return materialItemText;
  }

  // Call AFTER selectItem() on this Add form. ALWAYS creates a fresh BOM rather than reusing
  // whatever BOM the item might already have - matching WorkOrderPage.ensureBomForItem()'s own
  // established pattern and reasoning. Also directly selects the newly-created BOM, so a
  // separate selectDropdown('bom_id') call afterward is now a harmless re-selection rather than a
  // required step. Returns the Materials row's own item text.
  async ensureBomForItem(bomPage, itemDisplayText) {
    const materialItemText = await this._createApprovedBomForItem(bomPage, itemDisplayText);
    await this.selectField('bom_id', '', '', { optional: false });
    return materialItemText;
  }

  // Fills Quantity To Unbuild and saves as Draft (the only usable Create action - see class
  // header comment on why the main "Save" button is broken). Works for both creation paths:
  // - Via BuildOrderPage.openUnbuildForm(): Work Order/Build Order/Item/UOM/Bill of Materials are
  //   already pre-filled and disabled.
  // - Direct navigation: call selectItem(), ensureBomForItem(), selectLocation() and selectBOM()
  //   first - Quantity To Unbuild is filled LAST here, right before saving, matching Work Order's
  //   own established reasoning that earlier field selections (BOM in particular) can silently
  //   reset a too-early value.
  // Captures the created record's own series_number from the save-draft response (flat
  // `data.unbuild_order.series_number`, confirmed live) since the post-save redirect lands on the
  // LIST, not this record's own view page.
  async fillAndSaveAsDraft({ quantityToUnbuild }) {
    await this.quantityToUnbuildInput.fill(String(quantityToUnbuild));

    const draftResponsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/unbuild-orders/save-draft')
    );
    await this.saveToDraftButton.click();
    const draftResponse = await draftResponsePromise;
    const body = await draftResponse.json();
    await this.page.waitForURL('**/orders/unbuild-order', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return body.data.unbuild_order.series_number;
  }

  async openView(seriesNumber) {
    await this.gotoList();
    await this.page.getByText(seriesNumber, { exact: true }).first().click();
    await this.page.waitForURL('**/view-unbuild-order');
    await this.page.waitForLoadState('networkidle');
    // The URL/networkidle can both resolve before the SPA has actually re-rendered from the
    // list's own content to this record's own View content (confirmed live: a strict-mode
    // "resolved to 8 elements" failure on the very next assertion, matching stale list rows) -
    // wait for a real View-page element (the ID field) before returning.
    await this.page.getByText('ID', { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 });
  }

  async openEdit(seriesNumber) {
    await this.openView(seriesNumber);
    await this.editButton.click();
    await this.page.waitForURL('**/edit-unbuild-order');
    await this.page.waitForLoadState('networkidle');
  }

  // Draft -> In progress. Unlike the CREATE page, Edit's own "Save" works correctly here (a real
  // PUT, confirmed live) - only the initial Add form's Save is broken (see class header comment).
  async save() {
    await this.saveButton.click();
    await this.page.waitForURL('**/orders/unbuild-order', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }

  async openActions() {
    await this.actionsButton.click();
    await this.page.waitForTimeout(400);
  }

  // The DELETE request itself succeeds server-side (confirmed live: DELETE .../unbuild-orders/
  // <id> returns 200), but the View page's own post-delete success handler can throw client-side
  // before it redirects to the list - wait for the real DELETE response instead of the redirect,
  // then navigate to the list explicitly, so this doesn't depend on that handler's own timing.
  async deleteRecord() {
    await this.openActions();
    await this.deleteMenuItem.click();
    const deleteResponsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'DELETE' && res.url().includes('/unbuild-orders/')
    );
    await this.confirmDeleteButton.click();
    await deleteResponsePromise;
    await this.gotoList();
  }

  // Confirms the Materials grid row's own "Trace Detail" - call on the EDIT page (the row's
  // matching icon on the View page does nothing at all, confirmed live). Clicking it triggers a
  // material-tracking call server-side and opens a "Track Detail" dialog already pre-populated
  // with a lot covering the row's full quantity - saving it is what this method does. This is a
  // precondition for Adjust Inventory (see completeUnbuild()) to progress past its own
  // Finished-Item validation.
  async confirmMaterialsTraceDetail(seriesNumber) {
    await this.openEdit(seriesNumber);
    await this.page.mouse.wheel(0, 1000);
    await this.page.waitForTimeout(300);

    const materialsRow = this.page.locator('table tbody tr').filter({ has: this.page.locator('text=Unit') }).first();
    // Row's own icon order: edit (pencil), delete (trash), Trace Detail - confirmed live.
    await materialsRow.locator('button').nth(2).click();
    await this.trackDetailDialog.waitFor({ state: 'visible' });
    await this.trackDetailDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await this.trackDetailDialog.waitFor({ state: 'hidden' });
  }

  // In progress -> Completed. Requires confirmMaterialsTraceDetail() to have already run for this
  // same record (see class header comment for the full two-step reasoning) - Adjust Inventory's
  // own "Ok" only progresses instead of looping the same Validation Error once that precondition
  // is met.
  async completeUnbuild(seriesNumber) {
    await this.confirmMaterialsTraceDetail(seriesNumber);

    await this.openView(seriesNumber);
    await this.adjustInventoryButton.click();
    await this.validationErrorDialog.waitFor({ state: 'visible' });
    await this.validationErrorDialog.getByRole('button', { name: 'Ok', exact: true }).click();
    await this.trackDetailDialog.waitFor({ state: 'visible' });
    await this.trackDetailDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await this.trackDetailDialog.waitFor({ state: 'hidden' });

    await this.markCompletedButton.click();
    await expect(this.page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 15000 });
  }
}

module.exports = UnbuildOrderPage;
