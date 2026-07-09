const { expect } = require('@playwright/test');

class RfqPage {
  constructor(page) {
    this.page = page;
  }

  // ---------- Navigation ----------
  async gotoList() {
    await this.page.goto('/dashboard/procurement/orders/request-for-quote', { timeout: 60000 });
    await this.page.waitForLoadState('networkidle');
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
    // networkidle can fire before the form has actually finished rendering - wait for a field
    // that's always present once the form is ready.
    await this.page.getByRole('textbox', { name: 'Select Date' }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/orders/request-for-quote/${id}/view-request-for-quote`);
    await this.page.waitForLoadState('networkidle');
  }

  // ---------- Generic helpers ----------
  getComboboxByLabel(labelText) {
    // Matches the label text, optionally followed by an asterisk, case-insensitive.
    // e.g. "Company" or "Company *".
    const labelRegex = new RegExp(`^${labelText}\\s*\\*?$`, 'i');
    return this.page.locator('label, p, span, div').filter({ hasText: labelRegex }).first().locator('xpath=following::*[@role="combobox"][1]');
  }

  // "Search X" fields are custom combobox triggers, not native inputs - their visible
  // prompt text is the accessible name, not a real placeholder attribute.
  async openDropdownAndPick(labelOrName, optionText) {
    let combobox = this.page.getByRole('combobox', { name: labelOrName }).first();
    if (await combobox.count() === 0) {
      const labelText = typeof labelOrName === 'string' ? labelOrName : labelOrName.source || '';
      // Strip out regex delimiters and flags if regex was passed
      const cleanLabel = labelText.replace(/\\s\*\\\*\?/g, '').replace(/[\/\^i]/g, '').trim();
      combobox = this.getComboboxByLabel(cleanLabel);
    }
    await combobox.click();
    try {
      await combobox.fill(optionText);
    } catch (e) {
      // Ignore if not a text input
    }
    // Scope to the open listbox popover, not the whole page, to avoid clicking stray same-text
    // matches behind the backdrop (e.g. the Summary sidebar echoes field values).
    await this.page.getByRole('listbox').getByText(optionText, { exact: true }).first().click();
  }

  // Selecting a Vendor in the RFQ form cascades: it auto-populates Company, Currency,
  // Exchange Rate, and Payment Term from the vendor's master data. These fields are
  // set asynchronously via Redux after a customer-data fetch, so we must wait for the
  // dependent Company combobox to update before interacting with other fields.
  async waitForVendorDependentFields() {
    // Locate the Company combobox structurally starting from its label to avoid translation/name mismatch.
    const companyLabel = this.page.getByText('Company', { exact: false }).first();
    const companyCombobox = companyLabel.locator('xpath=following::*[@role="combobox"][1]');
    await expect(companyCombobox).not.toHaveText('', { timeout: 15000 });
    // Additional settle time for Currency and Exchange Rate fields.
    await this.page.waitForTimeout(1500);
  }

  // Editing a record on a later day than it was created leaves its stored Date in the past,
  // which the form rejects on save ("Date cannot be in the past") - reset it to today first.
  async setDateToToday() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    await this.page.getByRole('textbox', { name: 'Select Date' }).first().fill(`${dd}-${mm}-${yyyy}`);
  }

  // ---------- Basic Details ----------
  async fillBasicDetails({ vendor, purchaseRepresentative, narration } = {}) {
    if (vendor) {
      await this.openDropdownAndPick(/Vendor/i, vendor);
      // Wait for vendor-dependent fields (Company, Currency, Exchange Rate) to cascade.
      await this.waitForVendorDependentFields();
    }
    if (purchaseRepresentative) {
      await this.openDropdownAndPick(/Representative/i, purchaseRepresentative);
    }
    if (narration) {
      await this.page.getByPlaceholder('Enter Narration').fill(narration);
    }
  }

  // ---------- Items ----------
  async addItem({ itemName, requestedQuantity }) {
    // exact: true avoids matching the "Items*Please add atleast one Item" accordion header.
    await this.page.getByRole('button', { name: 'Add', exact: true }).click();

    const modal = this.page.getByRole('dialog');
    let combobox = modal.getByRole('combobox', { name: /Item/i }).first();
    if (await combobox.count() === 0) {
      const labelElement = modal.getByText('Item', { exact: false }).first();
      combobox = labelElement.locator('xpath=following::*[@role="combobox"][1]');
    }
    await combobox.click();
    await this.page.getByText(itemName, { exact: true }).first().click();

    // Wait for item defaults (Vendor Item Name, UOM) to populate from the async item-data fetch.
    // Vendor Item Name is a disabled text input that populates from the item selection response.
    await this.page.waitForTimeout(2000);

    if (requestedQuantity) {
      // Requested Quantity is a number input; locate via its label text.
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

  async discard() {
    await this.page.getByRole('button', { name: 'Discard' }).click();
  }

  // ---------- List actions ----------
  // seriesNumber is the exact text rendered in the list's ID column (e.g. "RFQ-2026-000149")
  rowBySeriesNumber(seriesNumber) {
    return this.page.locator('tr', { has: this.page.getByRole('link', { name: seriesNumber, exact: true }) });
  }

  async openRowActionMenu(seriesNumber) {
    if (!seriesNumber) throw new Error(`openRowActionMenu() called with a falsy seriesNumber (${seriesNumber}) - a prior create/save step likely failed.`);
    const row = this.rowBySeriesNumber(seriesNumber);
    await row.locator('button').first().click();
  }

  async editFromList(id, seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByText('Edit', { exact: true }).click();
    await this.page.waitForURL(new RegExp(`${id}/edit-request-for-quote`));
  }

  async getRowStatus(seriesNumber) {
    const row = this.rowBySeriesNumber(seriesNumber);
    return (
      (await row.getByText(/Draft|Open|RFQ Sent|Response Received|Pending Order|Order|Completed|Cancelled/).first().textContent()) ?? ''
    );
  }

  // ---------- View page ----------
  async getFieldValueOnView(label) {
    const text = (await this.page.getByText(label, { exact: true }).first().locator('xpath=following::*[1]').first().textContent()) ?? '';
    return text.trim().replace(/\s+/g, ' ');
  }

  // ---------- Edit page value readers ----------
  async getEditComboboxValue(label) {
    const text = await this.page.getByText(label, { exact: true }).first().locator('xpath=following-sibling::*[1]').innerText();
    return text.replace(/[\u200B\uFEFF]/g, '').trim();
  }

  async getEditNarrationValue() {
    return this.page.getByPlaceholder('Enter Narration').inputValue();
  }

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
  async confirmDelete() {
    const dialog = this.page.getByRole('dialog');
    const deleteBtn = dialog.getByRole('button', { name: /Delete|Confirm/i }).first();
    await deleteBtn.click();
    // No toast-text assertion here - the caller verifies the row/record is actually gone
    // afterward, which is the durable signal that the action took effect.
    await expect(dialog).not.toBeVisible();
  }

  async deleteFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();
    await this.confirmDelete();
  }

  async deleteFromView() {
    await this.page.getByRole('button', { name: 'Actions' }).click();
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();
    await this.confirmDelete();
  }

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
  // "Create" is a DropdownButton that only renders for certain statuses.
  async openCreateMenu() {
    await this.page.getByRole('button', { name: 'select merge strategy' }).click();
  }

  async createOrder() {
    await this.openCreateMenu();
    await this.page.getByRole('menuitem', { name: /Order/i }).first().click();
  }

  async createResponse() {
    await this.openCreateMenu();
    await this.page.getByRole('menuitem', { name: /Response/i }).first().click();
  }
}

module.exports = RfqPage;
