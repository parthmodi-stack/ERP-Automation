const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// UNVERIFIED LIVE: this page object was written from FE source reading (validator.ts,
// basic-details-tab.tsx, header-buttons.tsx, purchase-order.tsx) rather than iterative live
// debugging like the sibling Procurement Request/Purchase Agreement/RFQ pages - it hasn't been
// run against dev.erpforce.co yet. Locators favor structural/regex lookups over guessed exact
// strings wherever the source wasn't unambiguous, to reduce (not eliminate) the risk of drift.
class PurchaseOrderPage extends BasePage {
  // ---------- Navigation ----------
  async gotoList() {
    await this.page.goto('/dashboard/procurement/purchase-order');
    await this.page.waitForLoadState('networkidle');
    await this.page.getByRole('button', { name: 'Add' }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoAdd() {
    await this.gotoList();
    // The Add button is a dropdown offering "Item"/"Fixed Asset" - this suite only exercises
    // the standard Item-based flow (Fixed Asset mode hides/disables several item-modal fields).
    await this.page.getByRole('button', { name: 'Add' }).first().click();
    const itemOption = this.page.getByRole('menuitem', { name: 'Item', exact: true });
    if (await itemOption.count() > 0) {
      await itemOption.click();
    }
    await this.page.waitForURL('**/add-purchase-order');
    await this.page.waitForLoadState('networkidle');
    await this.page.getByRole('textbox', { name: 'Purchase Order ID' }).waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoEdit(id) {
    if (!id) throw new Error(`gotoEdit() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/purchase-order/${id}/edit-purchase-order`);
    await this.page.waitForLoadState('networkidle');
    await this.page.getByRole('textbox', { name: 'Purchase Order ID' }).waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/purchase-order/${id}/view-purchase-order`);
    await this.page.waitForLoadState('networkidle');
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  // ---------- Generic helpers ----------
  // openDropdownAndPick()/selectFieldByLabel()/selectFirstOptionByLabel() now live on BasePage
  // (same DynamicSelect quirks documented on the sibling pages - this module always attempts
  // combobox.fill(), see the `tryFill: true` passed at each call site below).

  // Editing a record on a later day than it was created leaves its stored Date in the past,
  // which the form rejects on save - reset it to today first. Scoped to the exact "Date" label,
  // since "Confirmation Date"/"Expected Receipt Date" are separate fields sharing the same
  // "Select Date" placeholder.
  async setDateToToday() {
    const dateLabel = this.page.getByText('Date', { exact: true }).first();
    await dateLabel.locator('xpath=following::input[1]').fill(this.formatDateToday());
  }

  // ---------- Basic Details ----------
  async fillBasicDetails({ vendor, entity, currency, purchaseRepresentative, narration } = {}) {
    if (vendor) {
      await this.openDropdownAndPick(/Vendor/i, vendor, { tryFill: true });
    }
    if (entity) {
      await this.openDropdownAndPick(/Entity/i, entity, { tryFill: true });
    }
    if (currency) {
      await this.openDropdownAndPick(/Currency/i, currency, { tryFill: true });
    }
    if (purchaseRepresentative) {
      await this.openDropdownAndPick(/Representative/i, purchaseRepresentative, { tryFill: true });
    }
    if (narration) {
      await this.page.getByPlaceholder('Enter Narration').fill(narration);
    }
  }

  async selectLocation(locationName) {
    await this.selectFieldByLabel('Location', locationName);
  }

  async selectPaymentTerm() {
    await this.selectFirstOptionByLabel('Payment Terms');
  }

  // ---------- Address & Contact ----------
  // Vendor Address, Contact Person, and Shipping Address are all required on this tab.
  async fillAddressContact() {
    await this.page.getByText('Address & Contact', { exact: true }).click();
    await this.page.waitForTimeout(500);
    await this.selectFirstOptionByLabel('Vendor Address');
    await this.selectFirstOptionByLabel('Contact Person');
    await this.selectFirstOptionByLabel('Shipping Address');
    // The Items accordion lives on Basic Details - switch back so callers can chain straight
    // into addItem() without needing to know about tabs themselves.
    await this.page.getByText('Basic Details', { exact: true }).click();
    await this.page.waitForTimeout(500);
  }

  // ---------- Items ----------
  async addItem({ itemName, quantity, rate }) {
    await this.page.getByRole('button', { name: 'Add', exact: true }).first().click();

    const modal = this.page.getByRole('dialog').filter({ hasText: /Item/i });
    await modal.getByRole('combobox', { name: /Item/i }).click();
    await this.page.getByText(itemName, { exact: true }).first().click();

    // Selecting an item patches in defaults (Vendor Item Name, UOM) via an async fetch - wait
    // for the read-only Vendor Item Name field before filling anything, same pattern as the
    // sibling Purchase Agreement page's item modal.
    await expect(modal.getByRole('textbox', { name: 'Vendor Item Name' })).not.toHaveValue('', { timeout: 5000 });

    // "text=/^Quantity/" and "text=/^Rate/" match the label whether or not it renders with a
    // trailing required-field "*" - unconfirmed live which form this account uses.
    await modal.locator('text=/^Quantity/').locator('xpath=following::input[1]').fill(quantity);
    await modal.locator('text=/^Rate/').locator('xpath=following::input[1]').fill(rate);

    await this.waitForItemAmountsToSettle(modal);
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();
  }

  async editFirstItem({ quantity, rate } = {}) {
    await this.page.locator('table tbody tr').first().locator('button').first().click();
    const modal = this.page.getByRole('dialog').filter({ hasText: /Item/i });

    if (quantity) {
      await modal.locator('text=/^Quantity/').locator('xpath=following::input[1]').fill(quantity);
    }
    if (rate) {
      await modal.locator('text=/^Rate/').locator('xpath=following::input[1]').fill(rate);
    }
    if (quantity || rate) {
      await this.waitForItemAmountsToSettle(modal);
    }
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();
  }

  // ---------- Save actions ----------
  // Dual identifiers, same pattern documented on every sibling page: `id` (raw PK, used in
  // edit/view URLs) and `series_number` (the formatted string rendered in the list's ID column).
  async saveAndCaptureId(buttonName, exact) {
    const [, listResponse] = await Promise.all([
      this.page.getByRole('button', { name: buttonName, exact }).click(),
      this.page.waitForResponse((r) => r.url().includes('/purchase/v1/purchase-orders/?')),
    ]);
    await this.page.waitForLoadState('networkidle');
    const record = (await listResponse.json()).data.purchase_orders[0];
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
    await this.page.waitForURL(new RegExp(`${id}/edit-purchase-order`));
  }

  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Draft|Pending Approval|Pending|Approved|Received|Billed|Rejected|Cancelled|Closed/);
  }

  // ---------- Edit page value readers ----------
  isIdFieldReadOnly() {
    return this.page.getByRole('textbox', { name: 'Purchase Order ID' }).isDisabled();
  }

  // ---------- Delete / Approval flow ----------
  // confirmDelete()/quickApproval()/accept()/reject() now live on BasePage - this module's own
  // toast wording (procurement.purchaseOrder.msg.requestSubmitted/requestApproved/
  // requestRejected) already matches BasePage's default toast regexes, and Submit/Quick
  // Approval/Accept/Reject come from the same shared ApprovalWrapper component as Purchase
  // Agreement/Procurement Request, so no override is needed here.

  // ---------- Module-level business method ----------
  // Matches the spec file's own local createDraftWithItem() helper body exactly.
  async createDraft(data) {
    await this.gotoAdd();
    await this.fillBasicDetails({
      vendor: data.vendor,
      entity: data.entity,
      currency: data.currency,
      purchaseRepresentative: data.purchaseRepresentative,
      narration: data.narration,
    });
    await this.selectLocation(data.location);
    await this.selectPaymentTerm();
    await this.fillAddressContact();
    await this.addItem({ itemName: data.itemName, quantity: data.quantity, rate: data.rate });
    return this.saveAsDraft();
  }
}

module.exports = PurchaseOrderPage;
