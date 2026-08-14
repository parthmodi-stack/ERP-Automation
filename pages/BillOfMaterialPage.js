const { expect } = require('@playwright/test');
const SettingsEntityPage = require('./base/SettingsEntityPage');

// Bill of Material (dashboard/manufacturing/bill-of-material) - a real, fully-built document
// module (unlike Work Order/BOM screens reached by direct navigation elsewhere, which are empty
// stubs - this one has genuine Add/View/Edit/Delete/Duplicate and Draft/Pending/Approved
// statuses, confirmed live). Its Save button carries `form="bom"` / `type="submit"`, the same
// backend-form-driven convention CLAUDE.md documents for Accounting's Settings-entity screens -
// so this follows that tier's flat-field-by-name style rather than Inventory's per-locator one,
// even though Manufacturing has no established page-object tier of its own yet.
//
// Two live-confirmed field-order gotchas, both easy to get backwards:
// 1. Selecting Item resets/auto-generates Name to "BOM - <item name>" - call fillHeader's `name`
//    AFTER selectItem(), not before, or your own Name value gets silently overwritten.
// 2. A Materials row added via "+ Add" is NOT part of the form's data until its own row-level
//    save (disk) icon is clicked - just filling the row's fields and clicking the page's main
//    Save produces "body/materials must NOT have fewer than 1 items" even though the row LOOKS
//    filled in the DOM.
class BillOfMaterialPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'bom',
      listPath: '/dashboard/manufacturing/bill-of-material',
      addPath: '/dashboard/manufacturing/bill-of-material/add-bill-of-material',
    });

    this.addButton = page.getByRole('button', { name: 'Add', exact: true });
    this.saveButton = page.locator('button[form="bom"]');
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft' });
    this.discardButton = page.getByRole('button', { name: 'Discard' });

    this.nameInput = page.locator('input[name="bom.name"]');
    this.quantityInput = page.locator('input[name="bom.quantity"]');
    this.versionNumberInput = page.locator('input[name="bom.version_number"]');
    this.startDateInput = page.locator('input[name="bom.start_date"]');
    this.endDateInput = page.locator('input[name="bom.end_date"]');
    this.narrationInput = page.locator('textarea[name="bom.narration"]');
    // MUI status toggle - same pattern as every other module in this repo (assert on the input,
    // click the visible switch).
    this.statusToggle = page.locator('input[name="is_active"]');
    this.statusSwitch = page.locator('input[name="is_active"]').locator('xpath=ancestor::span[contains(@class,"MuiSwitch-root")]');

    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.duplicateMenuItem = page.getByRole('menuitem', { name: 'Duplicate' });
    this.deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete' });

    // Approval workflow, confirmed live: Pending --(Submit)--> Submitted --(Accept, then confirm
    // the "Approved request" dialog's own Submit button)--> Approved. Edit/Actions/Submit are all
    // visible together on a Pending record (an earlier assumption that Edit was hidden there was
    // wrong - a stale check, not real app behavior). Delete is available on Pending (confirmed via
    // Actions menu) but NOT on Approved (confirmed live: an Approved record's Actions menu only
    // has Duplicate) - so any Delete test must run before Submit/Approve, on its own record.
    this.submitButton = page.getByRole('button', { name: 'Submit', exact: true });
    this.acceptButton = page.getByRole('button', { name: 'Accept', exact: true });
    this.approveConfirmDialog = page.getByRole('dialog', { name: /Approved request/i });
  }

  async gotoList() {
    await this.page.goto('/dashboard/manufacturing/bill-of-material');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-bill-of-material');
    await this.page.waitForLoadState('networkidle');
  }

  // Delegates to the inherited selectField() (pages/base/SettingsEntityPage.js -> helpers/
  // dropdown.js) for the full search -> exact-match -> first-available-fallback -> create-new/
  // throw chain - see WorkCenterCategoryPage.js's own selectDropdown for the rationale.
  async selectDropdown(fieldName, optionText, opts = {}) {
    const value = optionText || '';
    await this.selectField(fieldName, value, value, { optional: false, ...opts });
  }

  // Call BEFORE fillHeader's own `name` - see class header comment.
  async selectItem(itemName) {
    await this.selectDropdown('item_id', itemName);
  }

  // Units of Measurement is a DynamicDependentField scoped to the selected Item (confirmed live:
  // shows "No data available" until an Item is chosen, then exactly that item's own stock unit) -
  // call selectItem() first.
  async selectUOM(uomName) {
    await this.selectDropdown('unit_of_measurement_id', uomName);
  }

  async selectLocation(locationName) {
    await this.selectDropdown('location_id', locationName);
  }

  async fillHeader({ name, quantity, versionNumber, startDate, endDate, narration } = {}) {
    if (name !== undefined) await this.nameInput.fill(name);
    if (quantity !== undefined) await this.quantityInput.fill(String(quantity));
    if (versionNumber !== undefined) await this.versionNumberInput.fill(versionNumber);
    if (startDate !== undefined) await this.startDateInput.fill(startDate);
    if (endDate !== undefined) await this.endDateInput.fill(endDate);
    if (narration !== undefined) await this.narrationInput.fill(narration);
  }

  // Adds one Materials row - item selection here is a SEPARATE, unprefixed `item`/`uom` dropdown
  // pair, distinct from the header's `bom.item_id`/`bom.unit_of_measurement_id` (confirmed live).
  //
  // Deliberately NOT delegated to helpers/dropdown.js's selectDropdown() the way the header-level
  // fields above are: that helper requires an EXACT accessible-name match, but this row's own
  // option text is "<SKU> - <Name>" (e.g. "RM1 - RM1"), never equal to the plain name a caller
  // passes in - an exact-match requirement would always miss and silently fall through to
  // whichever option happens to render first, which would break WorkOrderPage.ensureBomForItem's
  // own `addMaterialRow({ itemName: 'RM1', quantity: 1 })` call (RM1 is pinned deliberately - see
  // that method's own comment on why "first available" isn't good enough there). The substring
  // filter/retry logic below is already the correct fallback shape (match -> first-available via
  // the `else` branch) for this field's real constraints; only the generic helper's create-new/
  // throw-if-empty tail would add anything, and Item is never confirmed empty in this environment.
  async addMaterialRow({ itemName, quantity } = {}) {
    await this.page.getByRole('button', { name: 'Add', exact: true }).last().click();
    await this.page.waitForTimeout(500);

    await this.page.locator('[id="mui-component-select-item"]').click();
    const menu = this.page.locator('[id="menu-item"]');
    await menu.waitFor({ state: 'visible' });
    await expect(async () => {
      expect(await menu.locator('li').count()).toBeGreaterThan(1);
    }).toPass({ timeout: 8000, intervals: [300] });
    if (itemName) {
      // pressSequentially, not fill - confirmed live that .fill()'s single synthetic input event
      // only sometimes reaches this debounced server-side filter, silently leaving the list on its
      // default unfiltered/most-recent-first page. Even with pressSequentially, this field can
      // still occasionally sit on an unfiltered/empty result for several seconds under load
      // (confirmed live, cause not fully isolated - possibly colliding with another in-flight
      // dropdown fetch on this same form) - the retry below re-clears and retypes rather than
      // assuming one attempt is enough.
      const filtered = menu.locator('li[aria-disabled="false"], li:not([aria-disabled])')
        .filter({ hasText: itemName });
      await expect(async () => {
        await menu.locator('input').fill('');
        await menu.locator('input').pressSequentially(itemName, { delay: 80 });
        await this.page.waitForTimeout(800);
        expect(await filtered.count()).toBeGreaterThan(0);
      }).toPass({ timeout: 20000, intervals: [1000] });
      // Substring match, not exact - the option's own display text is "<SKU> - <Name>" (e.g.
      // "RM1 - RM1"), never just the plain search term a caller passes in (confirmed live: an
      // anchored `^itemName$` regex here never matches, hanging until this locator's own click
      // timeout, since the search input itself already narrowed the list down to just this item).
      await filtered.first().click();
    } else {
      await menu.locator('li').nth(1).click();
    }
    // Capture the resolved item's own display text BEFORE the row-level save collapses this
    // dropdown into plain text - the only reliable way for a caller to know which item "first
    // available" (no itemName passed) actually picked.
    const selectedItemText = (await this.page.locator('[id="mui-component-select-item"]').textContent()).trim();
    await menu.waitFor({ state: 'hidden' }).catch(() => {});
    await this.page.waitForTimeout(500);

    if (quantity !== undefined) {
      await this.page.locator('input[name="quantity"]').last().fill(String(quantity));
    }
    await this.page.waitForTimeout(300);

    // Row-level save (disk) icon - confirmed live it's the 2nd button in the row's own icon
    // column (1st is the row's delete/cancel "x") - see class header comment on why this step
    // can't be skipped.
    const materialRow = this.page.locator('table tbody tr')
      .filter({ has: this.page.locator('input[name="quantity"]') })
      .last();
    await materialRow.locator('button').nth(1).click();
    await this.page.waitForTimeout(500);
    return selectedItemText;
  }

  // Submits directly to Pending status (confirmed live) - Edit is NOT available afterward from
  // the View page, only Duplicate/Delete. Use saveToDraft() instead if the record needs to stay
  // editable.
  async save() {
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  // Keeps the record in Draft status (confirmed live) - Edit remains available from the View page.
  async saveToDraft() {
    await this.saveToDraftButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  rowBySeriesNumber(seriesNumber) {
    return this.page.locator('tr', { hasText: seriesNumber });
  }

  async openView(seriesNumber) {
    await this.gotoList();
    await this.page.getByText(seriesNumber, { exact: true }).first().click();
    await this.page.waitForURL('**/view-bill-of-material');
    await this.page.waitForLoadState('networkidle');
  }

  async openEdit(seriesNumber) {
    await this.openView(seriesNumber);
    await this.editButton.click();
    await this.page.waitForURL('**/edit-bill-of-material');
    await this.page.waitForLoadState('networkidle');
  }

  async openActions() {
    await this.actionsButton.click();
    await this.page.waitForTimeout(400);
  }

  async duplicate() {
    await this.openActions();
    await this.duplicateMenuItem.click();
    await this.page.waitForLoadState('networkidle');
  }

  async deleteRecord() {
    await this.openActions();
    await this.deleteMenuItem.click();
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  // Pending -> Submitted. Call from a record's own View page. `networkidle` alone isn't a
  // reliable signal here (confirmed live: the button's own loading spinner can still be spinning
  // well after networkidle resolves) - wait for the status chip to actually flip instead.
  async submitForApproval() {
    await this.submitButton.click();
    await expect(this.page.getByText('Submitted', { exact: true })).toBeVisible({ timeout: 15000 });
  }

  // Submitted -> Approved. Clicking Accept opens a confirmation dialog ("Approved request: Are
  // you sure you want to Approved Bill of Materials : <id> ?") whose OWN button is also labeled
  // "Submit" (confirmed live) - scope to the dialog to avoid colliding with the header's Submit.
  // Same "wait for the status chip, not just networkidle" reasoning as submitForApproval().
  async approve() {
    await this.acceptButton.click();
    await this.approveConfirmDialog.waitFor({ state: 'visible' });
    await this.approveConfirmDialog.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(this.page.getByText('Approved', { exact: true })).toBeVisible({ timeout: 15000 });
  }
}

module.exports = BillOfMaterialPage;
