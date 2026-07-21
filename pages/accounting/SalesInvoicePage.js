const AccountingDocumentPage = require('../base/AccountingDocumentPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Depth-first search for the first object in `node` that has both an `id` and at least one of
 * `distinguishingKeys` - used instead of a fixed path because this app's save-response shapes
 * for a given endpoint aren't consistent across requests (see SalesInvoicePage.saveAndCaptureId).
 */
function findRecordWithId(node, distinguishingKeys, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (!Array.isArray(node) && 'id' in node && distinguishingKeys.some((k) => k in node)) {
    return node;
  }
  for (const value of Array.isArray(node) ? node : Object.values(node)) {
    const found = findRecordWithId(value, distinguishingKeys, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * Sales Invoice (Invoice > Sales Invoices) - the Sales-side mirror of PurchaseInvoicePage.js.
 * Source: erpforce-fe modules/accounting/src/views/sales-invoice/*
 * Routes confirmed against the running app:
 *   list  /dashboard/accounting/invoice/sales-invoices
 *   add   /dashboard/accounting/invoice/sales-invoices/add-sales-invoice
 *   view  /dashboard/accounting/invoice/sales-invoices/:id/view-sales-invoice
 *
 * Confirmed against the running app (mirrors PurchaseInvoicePage.js's own confirmed facts):
 * - Add form field-array prefix is `add_sales_invoice` (fields: date, customer_id, due_date,
 *   payment_term_id, company_id, department_id, currency_id, exchange_rate,
 *   account_receivable_id, transaction_type, narration, region_id, location, department,
 *   incoterm_id, additional_discount_on/percentage/amount, round_off_option, attachment_url).
 *   Required (starred) fields: Posting Date, Customer, Entity (company_id, pre-filled), Account
 *   Receivable, Payment Terms, Transaction Type (defaults to "Credit").
 * - Tabs: Basic Details, Address & Contact, Shipping, Promotions - "Shipping" here is a cost/
 *   rule tab (shipping_rule_id, shipping_cost, handling_cost, ...), NOT an address selector like
 *   Purchase Invoice's Address & Contact tab.
 * - Item modal field-array prefix is `sales_item_entries` (item_id, uom_id, location, quantity,
 *   rate, item_discount_id, discount_rate/discount_amount, gross_amount, tax_code_id (NOT
 *   "tax_template_id" - a different field name than Purchase Invoice's item tax field, though
 *   both resolve to the same kind of Tax Template/Code record), tax_amount, net_amount,
 *   total_amount, department, narration).
 * - "Save" (creates Pending, Submit control then appears) and "Save To Draft" (creates Draft, no
 *   Submit control at all - confirmed live, unlike a quick assumption that Draft always shows
 *   one) are plain getByRole(button) matches, not a form="<entityKey>" submit.
 * - View page: Draft shows Edit + Actions (Edit/Delete only) but NO Submit button. Pending shows
 *   Edit + Actions + Submit. Approved (not yet fully paid) shows Add Credit Note/View Accounting
 *   Ledger/Mark as recurring/Actions, and Actions gains Collection Entry/Payment Request/
 *   Duplicate/Send Email/Download Report on top of Edit/Delete. "Collection Entry" is disabled
 *   once payment_status is already "Paid".
 * - Row/View status chips carry class `salesInvoice--StatusChip--<status>` (same naming
 *   convention as `purchaseInvoice--StatusChip--<status>`, confirmed via the shared component).
 */
class SalesInvoicePage extends AccountingDocumentPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_sales_invoice',
      listPath: '/dashboard/accounting/invoice/sales-invoices',
      addPath: '/dashboard/accounting/invoice/sales-invoices/add-sales-invoice',
      statusCssSlug: 'salesInvoice',
    });

    this.addButton = page.getByRole('button', { name: /^Add$/i }).or(page.getByText(/^Add$/i)).first();
    this.saveButton = page.getByRole('button', { name: /^Save$/i }).last();
    this.saveDraftButton = page.getByRole('button', { name: /Save As Draft|Save to Draft|Save To Draft/i }).first();
    this.editButton = page.getByRole('button', { name: /^Edit$/i }).first();
    // Confirmed live: unlike Purchase Invoice's Draft view (which has a standalone Delete
    // button), Sales Invoice's Draft view only shows Edit + Actions - Delete is a menuitem behind
    // Actions for every status, not a top-level button. See deleteFromView/cancelDeleteFromView.
    this.deleteMenuItem = page.getByRole('menuitem', { name: /^Delete$/i });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: /^Delete$/i });
    this.cancelDeleteButton = page.getByRole('dialog').getByRole('button', { name: /^Cancel$/i });

    this.itemModal = page.getByRole('dialog');
    this.itemModalSaveButton = this.itemModal.getByRole('button', { name: /^Save$/i });
    this.addItemButton = page.locator('button.table--AddButton').first();
  }

  /** Overridden - View page's status chip uses `viewSalesInvoice--StatusChip--<status>`, same "second decoy chip" quirk PurchaseInvoicePage.js documents (`.first()` is the real one). */
  statusChipOnView() {
    return this.page.locator('[class*="viewSalesInvoice--StatusChip"]');
  }

  approvalStatusChipOnView() {
    return this.statusChipOnView().first();
  }

  headerSelectTrigger(fieldFragment) {
    return this.page.locator(`[id*="mui-component-select-"][id*="${fieldFragment}"]`).first();
  }

  /** Same convention as PurchaseInvoicePage.js's selectHeaderDropdown - always pass the option's full text as both search and match target. */
  async selectHeaderDropdown(fieldFragment, optionText, opts = {}) {
    await selectDropdown(this.page, this.headerSelectTrigger(fieldFragment), optionText, optionText, opts);
  }

  /** Confirmed against the running app: this field's search+fallback always has at least one real customer to substitute (same as Purchase Invoice's own vendor field), so no create-fallback is needed. */
  async selectCustomer(name) {
    await this.selectHeaderDropdown('customer', name);
  }

  /** Currency pre-defaults per company - only act when it actually differs (same stale-backdrop reasoning as PurchaseInvoicePage.js's selectCurrencyIfNeeded). */
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
   * Confirmed against the running app (same finding as PartyPage.selectAccount): account_type_id
   * has ZERO options under every parent type in this environment, so ChartOfAccountsPage can't
   * create a new COA record at all right now, and this field has no inline "Create New" option
   * either - marked optional so a missing exact match here (falls back to whatever real COA-ish
   * record already exists) never blocks the rest of the form.
   */
  async selectAccountReceivable(name) {
    await this.selectHeaderDropdown('account_receivable', name, { optional: true });
  }

  /**
   * @param {{customer?: string, currency?: string, paymentTerm?: string, accountReceivable?: string}} header
   * Unlike Purchase Invoice, there's no free-text "invoice number" field to fill here - confirmed
   * against the running app: the invoice's own display ID/series (e.g. "INV-2026-000004") is
   * server-generated, not user-entered, unlike Purchase Invoice's supplier_invoice_number.
   */
  async fillHeader({ customer, currency, paymentTerm, accountReceivable } = {}) {
    if (customer) await this.selectCustomer(customer);
    if (currency) await this.selectCurrencyIfNeeded(currency);
    if (paymentTerm) await this.selectPaymentTerm(paymentTerm);
    if (accountReceivable) await this.selectAccountReceivable(accountReceivable);
  }

  async openAddItemModal() {
    await this.addItemButton.waitFor({ state: 'visible', timeout: 15000 });
    await this.addItemButton.click();
    await this.itemModal.waitFor({ state: 'visible' });
  }

  /**
   * @param {{item?: string, quantity?: string|number, rate?: string|number, taxCode?: string}} entry
   * Same Quantity/Rate-before-Tax ordering and settle-wait requirements PurchaseInvoicePage.js's
   * fillItemEntry documents (blur via Tab, then a settle wait after tax selection so Gross/Tax/Net
   * recompute before Save).
   */
  async fillItemEntry({ item, quantity, rate, taxCode } = {}) {
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
    if (taxCode) {
      // Confirmed against the running app: this field's own name is tax_code_id (NOT
      // tax_template_id like Purchase Invoice's item tax field) - it selects an individual Tax
      // Code record directly, and (like Customer above) its search+fallback always has a real
      // option to substitute, so no create-fallback is needed.
      const taxTrigger = this.itemModal.locator('[id*="mui-component-select-"][id*="tax"]').first();
      if (await taxTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectDropdown(this.page, taxTrigger, taxCode, taxCode);
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

  /** @returns {Promise<string|undefined>} the item's actual display name - see fillItemEntry's comment on why it can differ from the requested one. */
  async addItemEntry(entry) {
    await this.openAddItemModal();
    const actualItem = await this.fillItemEntry(entry);
    await this.saveItemEntry();
    return actualItem;
  }

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

  /**
   * Same save-request-response id capture as PurchaseInvoicePage.saveAndCaptureId, except
   * confirmed live that Sales Invoice's save responses are NOT consistently shaped: across
   * separate runs the same "Save" button has come back as `data.sales_invoice.invoice.data`,
   * `data.invoice` (no wrapper), and `data.invoice.data` - varying nesting depth and wrapper key
   * from one request to the next (seemingly this environment's own inconsistency, not something
   * tied to Draft vs non-Draft). Rather than chase each new shape, this walks the response body
   * looking for the first object that has both `id` and a sales-invoice-specific field
   * (`customer_id` or `total_invoice_amount`), regardless of where it's nested.
   * Also confirmed live: a Draft's `series_number` is null (never assigned yet), and non-Draft
   * "Save" responses can omit the field entirely (`undefined`) - callers must not assume
   * `seriesNumber` is truthy from this method; see getSeriesNumberFromList() for a reliable read.
   */
  async saveAndCaptureId(buttonName) {
    const saveTrigger = /draft/i.test(buttonName) ? this.saveDraftButton : this.saveButton;

    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('sales-invoices'),
        { timeout: 15000 }
      ),
      saveTrigger.click(),
    ]);
    await this.page.waitForLoadState('networkidle');

    const body = await response.json();
    const record = findRecordWithId(body?.data, ['customer_id', 'total_invoice_amount']);
    if (!record?.id) {
      throw new Error(
        `saveAndCaptureId: could not find a sales_invoice-shaped record in the save response (got: ${JSON.stringify(body?.data)})`
      );
    }
    return { id: String(record.id), seriesNumber: record.series_number };
  }

  async saveAsDraft() {
    return this.saveAndCaptureId('Save to Draft');
  }

  /**
   * Fills the Add form (header + item entries) but does not save - callers choose save()/
   * saveAsDraft()/saveAndCaptureId() themselves. Unlike Purchase Invoice, no shipping-address
   * selection is required here for a full Save (confirmed live: the "Shipping" tab is a cost/
   * rule tab, not an address requirement, and Save succeeded here without touching it).
   * @param {{customer?: string, currency?: string, paymentTerm?: string, accountReceivable?: string}} header
   * @param {Array<object>} items
   * @returns {Promise<{actualCustomer: string|undefined, actualItems: Array<string|undefined>}>}
   */
  async createItemInvoice(header, items = []) {
    await this.openAdd();
    await this.fillHeader(header || {});
    const actualCustomer = header?.customer
      ? (await this.headerSelectTrigger('customer').textContent())?.trim()
      : undefined;
    const actualItems = [];
    for (const entry of items) {
      actualItems.push(await this.addItemEntry(entry));
    }
    return { actualCustomer, actualItems };
  }

  /** Navigates straight to the invoice's View page by id - same pattern as PurchaseInvoicePage.gotoView. */
  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`${this.listPath}/${id}/view-sales-invoice`);
    await this.page.waitForLoadState('networkidle');
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  /**
   * Reads an invoice's own series number (e.g. "INV-2026-000014") from the GET response fired
   * when its View page loads, instead of from the list: confirmed live that scraping the list
   * row is unreliable in this shared/cumulative environment (the row can land off the default
   * page depending on sort order, and a row can carry more than one anchor - e.g. a Customer-name
   * link - so even finding the right row doesn't guarantee reading the right anchor's text). The
   * View page's own GET always returns the full record including `series_number`, even though
   * neither save endpoint's response includes it (see saveAndCaptureId's own comment) and the
   * page's own "ID:" breadcrumb never renders a value for any status (Draft/Pending/Approved
   * alike - a real app quirk).
   */
  async getSeriesNumber(id) {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        // Restricted to xhr/fetch, not just "not document": confirmed live that excluding only
        // 'document' still let a lazy-loaded JS chunk through (its URL coincidentally also
        // matched "sales-invoice" + the id), whose body is JS source, not JSON.
        (r) => r.request().method() === 'GET'
          && ['xhr', 'fetch'].includes(r.request().resourceType())
          && r.url().includes('sales-invoice')
          && r.url().includes(String(id)),
        { timeout: 15000 }
      ),
      this.page.goto(`${this.listPath}/${id}/view-sales-invoice`),
    ]);
    await this.page.waitForLoadState('networkidle');

    const body = await response.json();
    const record = findRecordWithId(body?.data, ['customer_id', 'total_invoice_amount']);
    if (!record || String(record.id) !== String(id)) {
      throw new Error(`getSeriesNumber: could not find a sales_invoice-shaped record with id ${id} in the view GET response (got: ${JSON.stringify(body?.data)})`);
    }
    return record.series_number;
  }

  /** Opens the newest (list is sorted newest-first) row's View page. */
  async openNewestRow() {
    await this.gotoList();
    await this.page.waitForTimeout(500);
    const firstRow = this.page.locator('table tbody tr').first();
    await firstRow.waitFor({ state: 'visible', timeout: 10000 });
    await firstRow.locator('a').first().click();
    await this.page.waitForURL(/view-sales-invoice/, { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(800);
  }

  async deleteFromView() {
    await this.actionsMenuButton.click();
    await this.deleteMenuItem.click();
    await this.confirmDeleteButton.waitFor({ state: 'visible' });
    await this.confirmDeleteButton.click();
  }

  async cancelDeleteFromView() {
    await this.actionsMenuButton.click();
    await this.deleteMenuItem.click();
    await this.cancelDeleteButton.waitFor({ state: 'visible' });
    await this.cancelDeleteButton.click();
  }
}

module.exports = SalesInvoicePage;
