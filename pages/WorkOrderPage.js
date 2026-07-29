const { expect } = require('@playwright/test');

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
class WorkOrderPage {
  constructor(page) {
    this.page = page;

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

  async selectDropdown(fieldName, optionText) {
    await this.page.locator(`[id="mui-component-select-work_order.${fieldName}"]`).click();
    const menu = this.page.locator(`[id="menu-work_order.${fieldName}"]`);
    await menu.waitFor({ state: 'visible', timeout: 5000 });
    await expect(async () => {
      expect(await menu.locator('li').count()).toBeGreaterThan(1);
    }).toPass({ timeout: 8000, intervals: [300] });
    if (optionText) {
      await menu.locator('input').fill(optionText);
      await this.page.waitForTimeout(600);
      await menu.locator('li[aria-disabled="false"], li:not([aria-disabled])')
        .filter({ hasText: new RegExp(`^${optionText}$`) })
        .first()
        .click();
    } else {
      await menu.locator('li').nth(1).click();
    }
    await menu.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
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

  // Returns the raw list of BOM option texts for whichever Item is currently selected - callers
  // check for "No data available" (see ensureBomForItem below) rather than this method deciding
  // that itself, so a caller that wants the full list for some other reason still can.
  async getBomOptionsForSelectedItem() {
    await this.page.locator('[id="mui-component-select-work_order.bom_id"]').click();
    const menu = this.page.locator('[id="menu-work_order.bom_id"]');
    await menu.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(800);
    const options = await menu.locator('li').allTextContents();
    // Escape alone doesn't reliably close this MUI popover (confirmed live - same underlying
    // quirk BasePage.js's own dropdown helpers were fixed for elsewhere this round: it can leave
    // a backdrop mounted that intercepts every later click on the page, blocking the very next
    // selectDropdown() call). Force-click the backdrop directly rather than relying on Escape.
    await this.page.keyboard.press('Escape').catch(() => {});
    const staleBackdrop = this.page.locator('.MuiBackdrop-root.MuiModal-backdrop').first();
    if (await staleBackdrop.count()) {
      await staleBackdrop.click({ force: true }).catch(() => {});
    }
    await this.page.waitForTimeout(300);
    return options;
  }

  async selectBOM(bomName) {
    await this.selectDropdown('bom_id', bomName);
  }

  // Self-healing dependency, matching this repo's own established pattern (e.g. 03-bin.spec.js's
  // Location check) rather than assuming every item already has one: call AFTER selectItem() on
  // the Work Order's own Add form. If the selected item's BOM list is empty, creates one for that
  // EXACT item via the given BillOfMaterialPage, approves it (only an Approved BOM with a sane
  // Start < End date range is confirmed live to actually appear in this dropdown), then re-opens
  // a fresh Work Order Add form and re-selects the same item so the caller can continue from a
  // known-good state either way.
  //
  // The Materials row pins "RM1" (confirmed live: 1728 available stock, one of item FG1's own
  // real working BOM's raw materials) instead of "first available" - confirmed live via direct
  // network capture that Release fails server-side with a 400 ("Cannot release work order.
  // Required materials are not available in sufficient quantity.") when the BOM's material has
  // no real stock, which a random "first available" pick can easily land on.
  async ensureBomForItem(bomPage, itemDisplayText) {
    const options = await this.getBomOptionsForSelectedItem();
    const hasRealBom = options.some((o) => o !== 'Select Bill of Material' && o !== 'No data available');
    if (hasRealBom) return;

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
    await bomPage.addMaterialRow({ itemName: 'RM1', quantity: 1 });
    await bomPage.save();
    await bomPage.openView((await bomPage.page.getByText(/^BOM-\d+$/).first().textContent()).trim());
    await bomPage.submitForApproval();
    await bomPage.approve();

    await this.goto();
    await this.selectItem(itemDisplayText);
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
  async release() {
    await this.releaseButton.click();
    await this.releaseConfirmDialog.waitFor({ state: 'visible' });
    await this.releaseConfirmDialog.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(this.page.getByText('Released', { exact: true })).toBeVisible({ timeout: 15000 });
  }

  // Released -> Material Issued. "Issue Material" opens a SEPARATE document ("Add Material
  // Issue"), pre-filled from this Work Order/its BOM, with its own Materials grid row already
  // populated with the BOM's material and quantity. That row's own "Trace Details" icon (same
  // Track Detail pattern as Stock Transfer - see StockTransferPage.addTrackDetail) already has a
  // lot/serial entry covering the full quantity pre-populated - confirming it via this dialog's
  // own Save is what makes Validate succeed instead of failing with "Stock Transfer details not
  // found".
  async issueMaterial() {
    await this.page.getByRole('button', { name: 'Issue Material' }).click();
    await this.page.waitForURL('**/material-issue/add-material-issue');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);

    const materialsRow = this.page.locator('table tbody tr').filter({ has: this.page.locator('text=Unit') }).first();
    await materialsRow.locator('button').first().click();
    const trackDialog = this.page.getByRole('dialog', { name: 'Track Detail' });
    await trackDialog.waitFor({ state: 'visible' });
    await trackDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await trackDialog.waitFor({ state: 'hidden' });

    await this.page.getByRole('button', { name: 'Validate' }).click();
    await this.page.waitForURL('**/view-work-order', { timeout: 15000 });
    await expect(this.page.getByText('Material Issued', { exact: true })).toBeVisible({ timeout: 10000 });
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
}

module.exports = WorkOrderPage;
