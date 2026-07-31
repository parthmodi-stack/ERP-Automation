const { expect } = require('@playwright/test');

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
class UnbuildOrderPage {
  constructor(page) {
    this.page = page;

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

  // Same `mui-component-select-unbuild_order.<field>` / `menu-unbuild_order.<field>` pattern as
  // Work Order/Bill of Material's own forms.
  async selectDropdown(fieldName, optionText) {
    await this.page.locator(`[id="mui-component-select-unbuild_order.${fieldName}"]`).click();
    const menu = this.page.locator(`[id="menu-unbuild_order.${fieldName}"]`);
    await menu.waitFor({ state: 'visible', timeout: 5000 });
    await expect(async () => {
      expect(await menu.locator('li').count()).toBeGreaterThan(1);
    }).toPass({ timeout: 8000, intervals: [300] });
    if (optionText) {
      // Real keystrokes, not .fill() - confirmed live elsewhere in this repo (StockTransferPage's
      // own selectMuiField) that .fill() doesn't reliably trigger a debounced filter.
      await menu.locator('input').pressSequentially(optionText, { delay: 60 });
      const exact = menu.locator('li').filter({ hasText: new RegExp(`^${optionText}$`) });
      await expect(exact.first()).toBeVisible({ timeout: 8000 });
      await exact.first().click();
    } else {
      await menu.locator('li').nth(1).click();
    }
    await menu.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
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

  // Returns the raw list of BOM option texts for whichever Item is currently selected - same
  // "check for No data available" pattern as WorkOrderPage.getBomOptionsForSelectedItem().
  async getBomOptionsForSelectedItem() {
    await this.page.locator('[id="mui-component-select-unbuild_order.bom_id"]').click();
    const menu = this.page.locator('[id="menu-unbuild_order.bom_id"]');
    await menu.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(800);
    const options = await menu.locator('li').allTextContents();
    await this.page.keyboard.press('Escape').catch(() => {});
    const staleBackdrop = this.page.locator('.MuiBackdrop-root.MuiModal-backdrop').first();
    if (await staleBackdrop.count()) {
      await staleBackdrop.click({ force: true }).catch(() => {});
    }
    await this.page.waitForTimeout(300);
    return options;
  }

  // Self-healing dependency, matching WorkOrderPage.ensureBomForItem()'s own established pattern
  // (call AFTER selectItem() on this Add form) - if the selected item's BOM list is empty,
  // creates one for that EXACT item via the given BillOfMaterialPage (Approved, sane date range,
  // RM1 as the material row), then returns to a fresh Add form with the same item re-selected so
  // the caller can continue from a known-good state either way.
  async ensureBomForItem(bomPage, itemDisplayText) {
    const options = await this.getBomOptionsForSelectedItem();
    const hasRealBom = options.some((o) => o !== 'Select Bills of Materials' && o !== 'No data available');
    if (hasRealBom) return;

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
    await bomPage.addMaterialRow({ itemName: 'RM1', quantity: 1 });
    await bomPage.save();
    await bomPage.openView((await bomPage.page.getByText(/^BOM-\d+$/).first().textContent()).trim());
    await bomPage.submitForApproval();
    await bomPage.approve();

    await this.gotoAdd();
    await this.selectItem(itemDisplayText);
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
