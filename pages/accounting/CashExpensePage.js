const AccountingDocumentPage = require('../base/AccountingDocumentPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Cash Expense (Invoice > Cash Expenses) - similar to Purchase Invoice (same Vendor/Payment
 * Terms/Currency/Item Entries shape), raised for an expense paid directly rather than tied to a
 * PO/GRN flow.
 * Source: erpforce-fe modules/accounting/src/views/cash-expense/*
 * Routes confirmed against the running app:
 *   list  /dashboard/accounting/invoice/cash-expenses
 *   add   /dashboard/accounting/invoice/cash-expenses/add-cash-expense
 *
 * Confirmed against the running app - same shape as PurchaseInvoicePage.js:
 * - Add form field-array prefix is `add_cash_expense`. Header fields: vendor_id,
 *   payment_term_id, supplier_currency_id, company_id (Entity, pre-filled Trootech),
 *   account_payable_id ("Account"), location/department (optional), incoterm_id (optional),
 *   additional_discount_on/round_off_option (optional). Unlike Purchase Invoice, "Vendor Invoice
 *   No" is required here (marked with *), not optional.
 * - Tabs: Basic Details, Address & Contact - same as Purchase Invoice.
 * - Has BOTH an Item Entries and an Expense Entries table (Purchase Invoice only has Item
 *   Entries) - `button.table--AddButton` "Add" trigger, Item Entries renders first in the DOM.
 * - "Save" is a plain getByRole(button) match, not a form="<entityKey>" submit - same as every
 *   other Invoice-archetype module in this suite.
 */
class CashExpensePage extends AccountingDocumentPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_cash_expense',
      listPath: '/dashboard/accounting/invoice/cash-expenses',
      addPath: '/dashboard/accounting/invoice/cash-expenses/add-cash-expense',
      statusCssSlug: 'cashExpense',
    });

    this.addButton = page.getByRole('button', { name: /^Add$/i }).or(page.getByText(/^Add$/i)).first();
    this.saveButton = page.getByRole('button', { name: /^Save$/i }).last();
    this.saveDraftButton = page.getByRole('button', { name: /Save As Draft|Save to Draft/i }).first();
    this.editButton = page.getByRole('button', { name: /^Edit$/i }).first();
    this.deleteButton = page.getByRole('button', { name: /^Delete$/i }).first();
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: /^Delete$/i });
    this.cancelDeleteButton = page.getByRole('dialog').getByRole('button', { name: /^Cancel$/i });

    this.itemModal = page.getByRole('dialog');
    this.itemModalSaveButton = this.itemModal.getByRole('button', { name: /^Save$/i });
    // Item Entries renders first in the DOM (same convention JournalEntryPage/PurchaseInvoicePage document).
    this.addItemButton = page.locator('button.table--AddButton').first();
    this.addressContactTab = page.getByRole('tab', { name: 'Address & Contact' });
  }

  /** Same "plain <p> next to breadcrumb, no --StatusChip class" quirk DebitNotePage.js/CreditNotePage.js/ExpenseReimbursementPage.js document - confirmed live no `viewCashExpense--StatusChip` class exists here either. */
  statusChipOnView() {
    return this.page.locator('p').filter({ hasText: /^(Draft|Pending|Approved|Rejected|Void)$/ });
  }

  approvalStatusChipOnView() {
    return this.statusChipOnView().first();
  }

  headerSelectTrigger(fieldFragment) {
    return this.page.locator(`[id*="mui-component-select-"][id*="${fieldFragment}"]`).first();
  }

  async selectHeaderDropdown(fieldFragment, optionText, opts = {}) {
    await selectDropdown(this.page, this.headerSelectTrigger(fieldFragment), optionText, optionText, opts);
  }

  async selectVendor(name) {
    await this.selectHeaderDropdown('vendor', name);
  }

  async selectCurrencyIfNeeded(currency) {
    const trigger = this.headerSelectTrigger('currency');
    const currentText = (await trigger.textContent().catch(() => '')) || '';
    if (!currentText.includes(currency)) {
      await this.selectHeaderDropdown('currency', currency);
    }
  }

  /** Same "Create New Payment Terms" inline-modal fallback as PurchaseInvoicePage.js's selectPaymentTerm. */
  async selectPaymentTerm(term) {
    await this.selectHeaderDropdown('payment_term', term, {
      allowCreateNew: true,
      createNewFields: {
        due_date_based_on: "Day's after Invoice date",
        credit_days: '30',
      },
    });
  }

  /**
   * Unlike Sales Invoice's own account_receivable_id (confirmed with ZERO real options in this
   * environment), this field is both required AND has real options here - confirmed live the
   * Save toast blocks with "Please fill all the required fields" when left unselected. Plain
   * selectDropdown() search+fallback, not marked optional.
   */
  async selectAccountPayable(name) {
    await this.selectHeaderDropdown('account_payable', name);
  }

  async openAddressContactTab() {
    await this.addressContactTab.click();
    await this.page.waitForTimeout(500);
  }

  async selectShippingAddress(name) {
    await selectDropdown(this.page, this.headerSelectTrigger('shipping'), name, name);
  }

  vendorInvoiceNoField() {
    return this.page.locator(
      '[name*="supplier_invoice_number"], [name*="vendor_invoice_no"], [placeholder*="Invoice No"]'
    ).first();
  }

  async fillVendorInvoiceNo(value) {
    await this.vendorInvoiceNoField().fill(value);
  }

  /** @param {{vendor?: string, currency?: string, paymentTerm?: string, vendorInvoiceNo?: string, accountPayable?: string}} header */
  async fillHeader({ vendor, currency, paymentTerm, vendorInvoiceNo, accountPayable } = {}) {
    if (vendor) await this.selectVendor(vendor);
    if (currency) await this.selectCurrencyIfNeeded(currency);
    if (paymentTerm) await this.selectPaymentTerm(paymentTerm);
    // "Vendor Invoice No" is required here (unlike Purchase Invoice) - fill unconditionally.
    await this.fillVendorInvoiceNo(vendorInvoiceNo);
    if (accountPayable) await this.selectAccountPayable(accountPayable);
  }

  async openAddItemModal() {
    await this.addItemButton.waitFor({ state: 'visible', timeout: 15000 });
    await this.addItemButton.click();
    await this.itemModal.waitFor({ state: 'visible' });
  }

  /**
   * @param {{item?: string, quantity?: string|number, rate?: string|number, taxTemplate?: string}} entry
   * Same Quantity/Rate-before-Tax ordering and settle-wait requirements PurchaseInvoicePage.js's
   * fillItemEntry documents (blur via Tab so the row's Gross/Tax/Net recompute before Save).
   */
  async fillItemEntry({ item, quantity, rate, taxTemplate } = {}) {
    let actualItem;
    if (item) {
      const itemTrigger = this.itemModal.locator('[id*="mui-component-select-"][id*="item"]').first();
      await selectDropdown(this.page, itemTrigger, item, item);
      await this.page.waitForTimeout(1000);
      const triggerText = (await itemTrigger.textContent())?.trim();
      const separatorIndex = triggerText?.indexOf(' - ') ?? -1;
      actualItem = separatorIndex >= 0 ? triggerText.slice(separatorIndex + 3) : triggerText;
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
        await this.page.waitForTimeout(1200);
      }
    }
    return actualItem;
  }

  async saveItemEntry() {
    await this.itemModalSaveButton.click();
    await this.itemModal.waitFor({ state: 'hidden', timeout: 10000 });
    await this.page.waitForTimeout(500);
  }

  /** @returns {Promise<string|undefined>} the item's actual display name. */
  async addItemEntry(entry) {
    await this.openAddItemModal();
    const actualItem = await this.fillItemEntry(entry);
    await this.saveItemEntry();
    return actualItem;
  }

  async save() {
    await this.saveButton.click();
  }

  /**
   * @param {{vendor?: string, currency?: string, paymentTerm?: string, vendorInvoiceNo?: string,
   *   accountPayable?: string, shippingAddress?: string}} header
   * @param {Array<object>} items
   * @returns {Promise<{actualVendor: string|undefined, actualItems: Array<string|undefined>}>}
   */
  async createItemInvoice(header, items = []) {
    const { shippingAddress, ...rest } = header || {};
    await this.openAdd();
    await this.fillHeader(rest);
    const actualVendor = rest.vendor
      ? (await this.headerSelectTrigger('vendor').textContent())?.trim()
      : undefined;
    const actualItems = [];
    for (const entry of items) {
      actualItems.push(await this.addItemEntry(entry));
    }
    if (shippingAddress) {
      await this.openAddressContactTab();
      await this.selectShippingAddress(shippingAddress);
    }
    return { actualVendor, actualItems };
  }

  /** Navigates straight to the cash expense's View page by id - same pattern as PurchaseInvoicePage.gotoView. */
  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`${this.listPath}/${id}/view-cash-expense`);
    await this.page.waitForLoadState('networkidle');
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  /** Opens the newest (list is sorted newest-first) row's View page. */
  async openNewestRow() {
    await this.gotoList();
    await this.page.waitForTimeout(500);
    const firstRow = this.page.locator('table tbody tr').first();
    await firstRow.waitFor({ state: 'visible', timeout: 10000 });
    await firstRow.locator('a').first().click();
    await this.page.waitForURL(/view-cash-expense/, { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(800);
  }

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

module.exports = CashExpensePage;
