const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class RfqPage extends BasePage {
  // ---------- Navigation ----------
  async gotoList() {
    await this.page.goto('/dashboard/procurement/orders/request-for-quote', { timeout: 60000 });
    await this.page.waitForLoadState('networkidle');
    // networkidle can fire before the page has actually rendered anything under this
    // environment's latency (same class of issue documented on the sibling Procurement
    // Request/Purchase Agreement pages) - wait for the "Add" button, always present once ready.
    await this.page.getByRole('button', { name: 'Add' }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoAdd() {
    await this.gotoList();
    await this.page.getByRole('button', { name: 'Add' }).first().click();
    await this.page.waitForURL('**/add-request-for-quote');
    await this.page.waitForLoadState('networkidle');
    // Wait for the form to render by checking for a stable field like Date.
    await this.page.getByRole('textbox', { name: 'Select Date' }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoEdit(id) {
    if (!id) throw new Error(`gotoEdit() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/orders/request-for-quote/${id}/edit-request-for-quote`, { timeout: 60000 });
    await this.page.waitForLoadState('networkidle');
    await this.page.getByRole('textbox', { name: 'Select Date' }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/orders/request-for-quote/${id}/view-request-for-quote`);
    await this.page.waitForLoadState('networkidle');
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  // ---------- Generic helpers ----------
  // openDropdownAndPick()/selectFieldByLabel() now live on BasePage - "Search X" fields are
  // custom combobox triggers, not native inputs, so their visible prompt text is the accessible
  // name, not a real placeholder attribute. This module always attempts combobox.fill() (see the
  // `tryFill: true` passed at each call site below).

  // Selecting a Vendor in the RFQ form cascades: it auto-populates Entity, Currency, Exchange
  // Rate, and Payment Term from the vendor's master data. These fields are set asynchronously
  // via Redux after a customer-data fetch, so we must wait for the dependent Entity combobox to
  // update before interacting with other fields.
  // NOT "Company": the underlying field name is `company_id`, but its rendered paragraph label
  // is literally "Entity *" (confirmed live via ARIA snapshot) - same field-name-vs-label-text
  // mismatch already documented on the sibling Procurement Request/Purchase Agreement pages.
  async waitForVendorDependentFields() {
    const entityLabel = this.page.getByText('Entity', { exact: false }).first();
    const entityCombobox = entityLabel.locator('xpath=following::*[@role="combobox"][1]');
    await expect(entityCombobox).not.toHaveText('', { timeout: 15000 });
    // Additional settle time for Currency and Exchange Rate fields.
    await this.page.waitForTimeout(1500);
  }

  // KNOWN APP QUIRK, confirmed live: the Address & Contact tab's Shipping Address field only
  // populates its options once Entity is marked "dirty" via an explicit re-selection - even to
  // its own current value. Entity already holds a default value from page load (or from the
  // vendor cascade), but the location-fetch effect that feeds Shipping Address's options never
  // runs until the user actively re-selects it (confirmed via network capture: zero
  // location-fetch requests fire otherwise, and Shipping Address's option list stays empty).
  async reselectEntityToTriggerShippingAddress() {
    const entityCombobox = this.page.getByText('Entity', { exact: false }).first().locator('xpath=following::*[@role="combobox"][1]');
    const currentValue = ((await entityCombobox.textContent()) || '').replace(/[\u200B\uFEFF]/g, "").trim();

    // Same known DynamicSelect stuck-fetch/MuiBackdrop-intercept bug as every other dropdown in
    // this suite - retry with an Escape + settle in between.
    for (let attempt = 1; attempt <= 6; attempt++) {
      await entityCombobox.click({ force: true });
      try {
        const found = await this.selectOptionFromListbox(currentValue);
        if (found) {
          await this.page.waitForTimeout(1500);
          return;
        }
        throw new Error(`Option "${currentValue}" not found in listbox`);
      } catch (e) {
        if (attempt === 6) throw e;
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(500);
      }
    }
  }

  // Editing a record on a later day than it was created leaves its stored Date in the past,
  // which the form rejects on save ("Date cannot be in the past") - reset it to today first.
  async setDateToToday() {
    await this.page.getByRole('textbox', { name: 'Select Date' }).first().fill(this.formatDateToday());
  }

  // ---------- Basic Details ----------
  async fillBasicDetails({ vendor, purchaseRepresentative, narration } = {}) {
    if (vendor) {
      await this.openDropdownAndPick(/Vendor/i, vendor, { tryFill: true });
      // Wait for vendor-dependent fields (Entity, Currency, Exchange Rate) to cascade.
      await this.waitForVendorDependentFields();
    }
    if (purchaseRepresentative) {
      await this.openDropdownAndPick(/Representative/i, purchaseRepresentative, { tryFill: true });
    }
    if (narration) {
      await this.page.getByPlaceholder('Enter Narration').fill(narration);
    }
  }

  // ---------- Address & Contact ----------
  // Contact Person and Shipping Address are BOTH required fields on this tab that Vendor
  // selection does NOT auto-populate (confirmed live: only Vendor Address auto-fills) - Save
  // fails validation without them. Must be called after fillBasicDetails's vendor selection,
  // while still on the Basic Details tab (re-selecting Entity happens there), before this
  // method switches to the Address & Contact tab itself.
  async fillAddressContact({ contactPerson, shippingAddress, vendorAddress } = {}) {
    await this.reselectEntityToTriggerShippingAddress();
    await this.page.getByText('Address & Contact', { exact: true }).click();
    await this.page.waitForTimeout(1000);
    if (vendorAddress) {
      await this.selectFieldByLabel('Vendor Address *', vendorAddress);
    }
    if (contactPerson) {
      await this.selectFieldByLabel('Contact Person *', contactPerson);
    }
    if (shippingAddress) {
      await this.selectFieldByLabel('Shipping Address *', shippingAddress);
    }
    // The Items accordion (addItem()) lives on Basic Details, not this tab - switch back so
    // callers can chain straight into addItem() without needing to know about tabs themselves.
    // KNOWN APP QUIRK: selectFieldByLabel uses `force: true` to click the Shipping Address
    // option (bypassing the MUI Backdrop's pointer-event interception), but the underlying
    // MuiMenu/Popover component (`menu-rfq_contacts.shipping_address`) can remain mounted in
    // the DOM with its invisible Backdrop still intercepting pointer events on the rest of the
    // page - Escape explicitly closes it before we attempt the tab switch.
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
    await this.page.getByText('Basic Details', { exact: true }).click();
    await this.page.waitForTimeout(500);
  }

  // ---------- Items ----------
  async addItem({ itemName, requestedQuantity }) {
    // exact: true avoids matching the "Items*Please add atleast one Item" accordion header.
    // .first(): the Basic Details tab also has a "Call For Tender" accordion with its own
    // identically-labeled "Add" button further down the page - Items comes first in DOM order.
    await this.page.getByRole('button', { name: 'Add', exact: true }).first().click();

    const modal = this.page.getByRole('dialog');
    let combobox = modal.getByRole('combobox', { name: /Item/i }).first();
    if (await combobox.count() === 0) {
      const labelElement = modal.getByText('Item', { exact: false }).first();
      combobox = labelElement.locator('xpath=following::*[@role="combobox"][1]');
    }
    await combobox.click();
    await this.page.getByText(itemName, { exact: true }).first().click();

    // Wait for item defaults (Vendor Item Name, UOM) to populate from the async item-data fetch.
    await this.page.waitForTimeout(2000);

    if (requestedQuantity) {
      await modal.locator('text=Requested Quantity').locator('xpath=following::input[1]').fill(requestedQuantity);
    }

    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();
  }

  async editFirstItem({ requestedQuantity } = {}) {
    // Scoped to tbody rows to target the row's edit icon, not column header buttons.
    await this.page.locator('table tbody tr').first().locator('button').first().click();
    const modal = this.page.getByRole('dialog');

    if (requestedQuantity) {
      await modal.locator('text=Requested Quantity').locator('xpath=following::input[1]').fill(requestedQuantity);
    }

    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();
  }

  // ---------- Save actions ----------
  // The saved record has TWO distinct identifiers that are NOT derivable from one another:
  // `id` (the raw DB primary key, used in edit/view URLs) and `series_number` (the formatted
  // string actually rendered in the list's ID column). Callers need `id` for gotoEdit/gotoView
  // and `seriesNumber` for anything that finds the row in the list.
  async saveAndCaptureId(buttonName, exact) {
    const [, listResponse] = await Promise.all([
      this.page.getByRole('button', { name: buttonName, exact }).click(),
      this.page.waitForResponse((r) => r.url().includes('/purchase/v1/rfq/?')),
    ]);
    await this.page.waitForLoadState('networkidle');
    const record = (await listResponse.json()).data.rfqs[0];
    return { id: String(record.id), seriesNumber: record.series_number };
  }

  async saveAsDraft() {
    return this.saveAndCaptureId(/Save.*Draft/i, false);
  }

  async save() {
    return this.saveAndCaptureId('Save', true);
  }

  // ---------- List actions ----------
  async editFromList(id, seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByText('Edit', { exact: true }).click();
    await this.page.waitForURL(new RegExp(`${id}/edit-request-for-quote`));
  }

  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Draft|Open|RFQ Sent|Response Received|Pending Order|Order|Completed|Cancelled/);
  }

  // ---------- Edit page value readers ----------
  async isIdFieldReadOnly() {
    // The RFQ ID field is a disabled text input.
    const idField = this.page.locator('input[name="rfq.id"]');
    if (await idField.count() > 0) {
      return idField.isDisabled();
    }
    // Fallback: try via role
    return this.page.getByRole('textbox', { name: /ID/i }).first().isDisabled();
  }

  // ---------- Delete ----------
  // confirmDelete() now lives on BasePage unchanged.

  // ---------- Status actions (RFQ-specific) ----------
  // The RFQ module does NOT have an approval workflow. Instead, it has:
  // - Save (Draft → Open)
  // - Cancel (Open/Draft → Cancelled)
  // - Create (Order/Response/Agreement) — available on Open/RFQ Sent/Response Received

  async cancelFromView() {
    await this.page.getByRole('button', { name: 'Actions' }).click();
    await this.page.getByText('Cancel', { exact: true }).click();
    // Confirmation dialog
    const dialog = this.page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).not.toBeVisible();
  }

  // ---------- Create Order / Response / Agreement ----------
  // "Create" is a DropdownButton that only renders for certain statuses, but reuses the exact
  // same "select merge strategy" caret pattern as the approval-workflow modules' submit menu -
  // this is just a semantically-named alias for BasePage.openSubmitMenu().
  async openCreateMenu() {
    await this.openSubmitMenu();
  }

  async createOrder() {
    await this.openCreateMenu();
    await this.page.getByRole('menuitem', { name: /Order/i }).first().click();
  }

  async createResponse() {
    await this.openCreateMenu();
    await this.page.getByRole('menuitem', { name: /Response/i }).first().click();
  }

  // ---------- Module-level business method ----------
  // Matches the spec file's own local createDraftRfq() helper body exactly.
  async createDraft(data) {
    await this.gotoAdd();
    await this.fillBasicDetails({
      vendor: data.vendor,
      purchaseRepresentative: data.purchaseRepresentative,
      narration: data.narration,
    });
    await this.fillAddressContact({
      contactPerson: data.contactPerson,
      shippingAddress: data.shippingAddress,
      vendorAddress: data.vendorAddress,
    });
    await this.addItem({ itemName: data.itemName, requestedQuantity: data.requestedQuantity });
    return this.saveAsDraft();
  }
}

module.exports = RfqPage;
