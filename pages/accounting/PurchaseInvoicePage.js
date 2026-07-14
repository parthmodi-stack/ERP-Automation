const AccountingDocumentPage = require('../base/AccountingDocumentPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Purchase Invoice (Invoice > Purchase Invoices).
 * Source: erpforce-fe modules/accounting/src/views/purchase-invoice/*
 * Routes: pathname.accounting.ts PathnameAccounting.{PURCHASE_INVOICES,ADD_PURCHASE_INVOICE,
 * EDIT_PURCHASE_INVOICE,VIEW_PURCHASE_INVOICE}.
 *
 * Header and item-modal fields are backend-schema-driven (FormParser), and this form's exact
 * field-array prefix has not been confirmed the way Settings-entity forms have (see
 * pages/base/SettingsEntityPage.js's header comment) - tests/accounting/purchase-invoice.spec.js
 * and 08-purchase-invoice-payment-pdc.spec.js instead locate every control by partial
 * id/name/role match, confirmed working against the running app. This Page Object reuses those
 * same confirmed locators rather than SettingsEntityPage's entityKey-prefixed fieldLocator()/
 * selectField() helpers, which assume a naming convention that hasn't been verified here.
 *
 * Confirmed against the running app (see the two spec files above):
 * - The list "Add" control is a split button; a plain click defaults to Item mode and lands on
 *   add-purchase-invoice with "Item Entries" visible - the secondary option ("Fixed Asset")
 *   requires opening the "select merge strategy" menu first.
 * - "Save" (creates Pending) and "Save As Draft"/"Save to Draft" (creates Draft) are plain
 *   getByRole(button) matches, not a form="<entityKey>" submit like Settings entities use.
 * - Row/View status chips carry class `purchaseInvoice--StatusChip--<status>`; a row can carry
 *   TWO such chips (Payment Status, then Status) - the approval status chip is always last.
 * - Edit/Delete are direct header buttons on the View page (not nested in a menu) for Draft
 *   invoices; non-Draft invoices route Delete/Duplicate/Submit/etc. behind an "Actions" menu.
 */
class PurchaseInvoicePage extends AccountingDocumentPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_purchase_invoice',
      listPath: '/dashboard/accounting/invoice/purchase-invoices',
      addPath: '/dashboard/accounting/invoice/purchase-invoices/add-purchase-invoice',
      statusCssSlug: 'purchaseInvoice',
    });

    // Overridden from the generic SettingsEntityPage versions: this form's controls are plain
    // text buttons, not form="<entityKey>" submits.
    this.addButton = page.getByRole('button', { name: /^Add$/i }).or(page.getByText(/^Add$/i)).first();
    this.splitMenuTrigger = page.getByRole('button', { name: /select merge strategy/i });
    this.saveButton = page.getByRole('button', { name: /^Save$/i }).last();
    this.saveDraftButton = page.getByRole('button', { name: /Save As Draft|Save to Draft/i }).first();
    this.editButton = page.getByRole('button', { name: /^Edit$/i }).first();
    this.deleteButton = page.getByRole('button', { name: /^Delete$/i }).first();
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: /^Delete$/i });
    this.cancelDeleteButton = page.getByRole('dialog').getByRole('button', { name: /^Cancel$/i });

    this.itemModal = page.getByRole('dialog');
    this.itemModalSaveButton = this.itemModal.getByRole('button', { name: /^Save$/i });
    // Confirmed against the running app: BOTH the Item Entries and Expense Entries "Add" buttons
    // are plain-text "Add" (class `table--AddButton`, same shared table component JournalEntryPage
    // documents) - not "Add Item"/"Add Entry" as their section headings might suggest. Item
    // Entries renders first in the DOM, so `.first()` is the item-entry Add button.
    this.addItemButton = page.locator('button.table--AddButton').first();
    this.addressContactTab = page.getByRole('tab', { name: 'Address & Contact' });
  }

  /**
   * Overridden from AccountingDocumentPage: confirmed against the running app that the View
   * page's status chip uses a DIFFERENT class prefix (`viewPurchaseInvoice--StatusChip--<status>`)
   * than list rows (`purchaseInvoice--StatusChip--<status>`, which statusCssSlug/statusChipOnRow
   * still target correctly) - they are two distinct components, not the same one reused.
   */
  statusChipOnView() {
    return this.page.locator('[class*="viewPurchaseInvoice--StatusChip"]');
  }

  /**
   * The View page's real approval-status chip. Confirmed against the running app: unlike a list
   * row (where `.last()` is correct - see purchase-invoice.spec.js), the View page renders a
   * SECOND element that coincidentally carries the exact same
   * `viewPurchaseInvoice--StatusChip--<status>` class but whose actual text is unrelated (e.g. it
   * read "Disabled" on a Draft invoice) - `.first()` is the real one in every case observed.
   */
  approvalStatusChipOnView() {
    return this.statusChipOnView().first();
  }

  headerSelectTrigger(fieldFragment) {
    return this.page.locator(`[id*="mui-component-select-"][id*="${fieldFragment}"]`).first();
  }

  /**
   * `helpers/dropdown.js`'s retry loop only reliably resolves to the real option when the typed
   * search text is the SAME string as the option's exact accessible name (every existing caller
   * in this codebase - JE, Payment Entry, Chart of Accounts - follows that convention). Confirmed
   * against the running app that splitting a multi-word name into just its first token (as this
   * method used to) makes the exact-match count stay at 1 forever, which the helper only ever
   * treats as "not found" and silently substitutes an arbitrary fallback option instead of the
   * intended one - so always pass the option's full text as both the search and the match target.
   */
  async selectHeaderDropdown(fieldFragment, optionText) {
    await selectDropdown(this.page, this.headerSelectTrigger(fieldFragment), optionText, optionText);
  }

  async selectVendor(name) {
    await this.selectHeaderDropdown('vendor', name);
  }

  /** Currency pre-defaults per company - re-selecting an already-selected option triggers a stale MUI backdrop, so only act when it actually differs. */
  async selectCurrencyIfNeeded(currency) {
    const trigger = this.headerSelectTrigger('currency');
    const currentText = (await trigger.textContent().catch(() => '')) || '';
    if (!currentText.includes(currency)) {
      await this.selectHeaderDropdown('currency', currency);
    }
  }

  async selectPaymentTerm(term) {
    await this.selectHeaderDropdown('payment_term', term);
  }

  async openAddressContactTab() {
    await this.addressContactTab.click();
    await this.page.waitForTimeout(500);
  }

  /** Required only for a full "Save" (Save-to-Draft skips this validation) - confirmed against the running app: "Shipping Address is required" blocks Save until this is set, even though Vendor Address/Contact Person auto-fill from the vendor's own saved address. */
  async selectShippingAddress(name) {
    await selectDropdown(this.page, this.headerSelectTrigger('shipping'), name, name);
  }

  vendorInvoiceNoField() {
    return this.page.locator(
      '[name*="supplier_invoice_number"], [name*="vendor_invoice_no"], [placeholder*="Invoice No"]'
    ).first();
  }

  async fillVendorInvoiceNo(value) {
    const field = this.vendorInvoiceNoField();
    if (await field.isVisible({ timeout: 3000 }).catch(() => false)) {
      await field.fill(value);
    }
  }

  /** @param {{vendor?: string, currency?: string, paymentTerm?: string, vendorInvoiceNo?: string}} header */
  async fillHeader({ vendor, currency, paymentTerm, vendorInvoiceNo } = {}) {
    if (vendor) await this.selectVendor(vendor);
    if (currency) await this.selectCurrencyIfNeeded(currency);
    if (paymentTerm) await this.selectPaymentTerm(paymentTerm);
    if (vendorInvoiceNo) await this.fillVendorInvoiceNo(vendorInvoiceNo);
  }

  async openAddItemModal() {
    await this.addItemButton.waitFor({ state: 'visible', timeout: 15000 });
    await this.addItemButton.click();
    await this.itemModal.waitFor({ state: 'visible' });
  }

  /**
   * @param {{item?: string, quantity?: string|number, rate?: string|number, taxTemplate?: string}} entry
   *
   * Confirmed against the running app (inspecting the actual save-draft request payload): picking
   * an Item pre-fills Rate from the item master (e.g. 750) - selecting Tax Template afterwards
   * recomputes Gross/Net/Total from whatever Quantity/Rate the form currently holds, so it MUST
   * run after Quantity/Rate are set, not before. Just as important, Quantity/Rate must be
   * committed with a blur (`.press('Tab')`), not left after a bare `.fill()` - `.fill()` alone set
   * the input's value but never fired the row's recalculation, so the backend rejected the save
   * with "Mismatch found in details" because gross_amount/net_amount/total_amount were still 0
   * even though quantity/rate looked correct in the DOM.
   */
  async fillItemEntry({ item, quantity, rate, taxTemplate } = {}) {
    if (item) {
      const itemTrigger = this.itemModal.locator('[id*="mui-component-select-"][id*="item"]').first();
      await selectDropdown(this.page, itemTrigger, item, item);
      await this.page.waitForTimeout(1000);
    }
    if (quantity !== undefined) {
      const quantityField = this.itemModal.locator('[name*="quantity"], [placeholder*="Quantity"]').first();
      await quantityField.fill(String(quantity));
      await quantityField.press('Tab');
      await this.page.waitForTimeout(300);
    }
    if (rate !== undefined) {
      const rateField = this.itemModal.locator('[name*="rate"], [placeholder*="Rate"]').first();
      await rateField.fill(String(rate));
      await rateField.press('Tab');
      await this.page.waitForTimeout(300);
    }
    if (taxTemplate) {
      const taxTrigger = this.itemModal.locator('[id*="mui-component-select-"][id*="tax"]').first();
      if (await taxTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectDropdown(this.page, taxTrigger, taxTemplate, taxTemplate);
        // The Gross/Tax/Net recompute triggered by this selection is not instant - saving before
        // it settles sends a stale tax_amount (confirmed live: a bare ~500ms gap after selection
        // still produced tax_amount=10 in the request instead of the correct 50, which the
        // backend's cross-check against tax_code_data.tax_amount then rejected as a "Mismatch
        // found in details" 400). 1200ms reliably lets it settle.
        await this.page.waitForTimeout(1200);
      }
    }
  }

  async saveItemEntry() {
    await this.itemModalSaveButton.click();
    await this.itemModal.waitFor({ state: 'hidden', timeout: 10000 });
    // Same re-render race documented in JournalEntryPage.js's saveLineItem - give the table a
    // moment to settle before the next modal interaction.
    await this.page.waitForTimeout(500);
  }

  async addItemEntry(entry) {
    await this.openAddItemModal();
    await this.fillItemEntry(entry);
    await this.saveItemEntry();
  }

  /** The row's pencil (Edit) icon button - reopens the item modal pre-filled with that row's values. */
  itemRowEditButton(rowText) {
    return this.page.locator('table tbody tr').filter({ hasText: rowText }).first().locator('button').first();
  }

  async editItemEntry(rowText, changes) {
    await this.itemRowEditButton(rowText).click();
    await this.itemModal.waitFor({ state: 'visible' });
    await this.fillItemEntry(changes);
    await this.saveItemEntry();
  }

  async save() {
    await this.saveButton.click();
  }

  async saveAsDraft() {
    await this.saveDraftButton.click();
  }

  /**
   * Fills the Add form (header + item entries + optional shipping address) but does not save -
   * callers choose save() or saveAsDraft() themselves so tests can assert pre/post-save state,
   * same convention as SettingsEntityPage-based Page Objects. `shippingAddress` is only required
   * by a full "Save" (Save-to-Draft skips that validation) - see selectShippingAddress().
   * @param {{vendor?: string, currency?: string, paymentTerm?: string, vendorInvoiceNo?: string, shippingAddress?: string}} header
   * @param {Array<object>} items
   */
  async createItemInvoice(header, items = []) {
    const { shippingAddress, ...rest } = header || {};
    await this.openAdd();
    await this.fillHeader(rest);
    for (const entry of items) {
      await this.addItemEntry(entry);
    }
    if (shippingAddress) {
      await this.openAddressContactTab();
      await this.selectShippingAddress(shippingAddress);
    }
  }

  /** Opens the newest (list is sorted newest-first) row's View page - used to recover a just-created invoice's real id/URL, the same pattern 06-journal-entry.spec.js uses since Save redirects to the plain list rather than to a per-record URL. */
  async openNewestRow() {
    await this.gotoList();
    await this.page.waitForTimeout(500);
    const firstRow = this.page.locator('table tbody tr').first();
    await firstRow.waitFor({ state: 'visible', timeout: 10000 });
    await firstRow.locator('a').first().click();
    await this.page.waitForURL(/view-purchase-invoice/, { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    // networkidle can fire a beat before the "ID: BILL-2026-000239" heading actually renders -
    // confirmed flaky against the running app without this, readSeriesNumber() would
    // intermittently read the page before that text existed.
    await this.page.waitForTimeout(800);
  }

  /** Extracts the invoice's display ID (e.g. "BILL-2026-000239" - confirmed against the running app, NOT a "PI-..." prefix) from the currently-open View page. */
  async readSeriesNumber() {
    const pageText = await this.page.locator('main').innerText();
    const match = pageText.match(/[A-Z]{2,6}-\d{4}-\d+/);
    return match?.[0] ?? null;
  }

  /** Header Delete button + confirm dialog, available on the View page (Draft invoices only). */
  async deleteFromView() {
    await this.deleteButton.click();
    await this.confirmDeleteButton.waitFor({ state: 'visible' });
    await this.confirmDeleteButton.click();
  }

  async cancelDeleteFromView() {
    await this.deleteButton.click();
    await this.cancelDeleteButton.waitFor({ state: 'visible' });
    await this.cancelDeleteButton.click();
  }
}

module.exports = PurchaseInvoicePage;
