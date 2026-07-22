const AccountingDocumentPage = require('../base/AccountingDocumentPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Credit Note (Accounting > Credits > Credit Note) - the Sales-side mirror of DebitNotePage.js:
 * raised against a Customer (or Vendor) either standalone or tied to an existing approved Sales
 * Invoice.
 * Source: erpforce-fe modules/accounting/src/views/credit-note/*
 * Routes confirmed against the running app (the list's own "Add" is a plain button, same as
 * Debit Note - not a split button like Purchase/Sales Invoice's Item/Fixed-Asset menu):
 *   list  /dashboard/accounting/credits/credit-note
 *   add   /dashboard/accounting/credits/add-credit-note
 *
 * Confirmed against the running app - identical field structure to Debit Note (same `party`/
 * `party_id`/`journal_type_id`/`invoice_id`/`currency_id`/`reference`/`amount` fields under the
 * `add_credit_note` prefix instead of `add_debit_note`), with only cosmetic differences:
 * - The bill-reference field is labelled "Invoice" here (not "Bills"), still `invoice_id`,
 *   still a MULTI-select, still lists only that party's own APPROVED bills (Sales Invoices for
 *   a Customer) with no inline "Create New" fallback.
 * - "Amount" is disabled/auto-computed here too (from Item Entries - selecting an Invoice alone
 *   does not populate it, same as Debit Note).
 * - Same Item Entries / Expense Entries tables and ApprovalWrapper-driven Submit/Accept/Reject
 *   flow as every other document module.
 */
class CreditNotePage extends AccountingDocumentPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_credit_note',
      listPath: '/dashboard/accounting/credits/credit-note',
      addPath: '/dashboard/accounting/credits/add-credit-note',
      statusCssSlug: 'creditNote',
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
    this.addItemButton = page.locator('button.table--AddButton').first();
  }

  /** Same "plain <p> next to breadcrumb, no --StatusChip class" quirk DebitNotePage.js documents. */
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

  /** @param {'Customer'|'Vendor'} type */
  async selectPartyType(type) {
    await this.selectHeaderDropdown('add_credit_note.party', type);
  }

  /** Party Name options are filtered by whichever party TYPE was selected above - call selectPartyType() first. */
  async selectPartyName(name) {
    await this.selectHeaderDropdown('party_id', name);
  }

  async selectJournalType(name) {
    await this.selectHeaderDropdown('journal_type_id', name);
  }

  /**
   * Confirmed against the running app: this field only ever lists the selected party's own
   * APPROVED invoices (Sales Invoices for a Customer) - "No data available" if that party has
   * none, with no inline "Create New" fallback, so `optional: true` here just skips gracefully
   * instead of blocking the rest of the form when there's genuinely nothing to pick.
   */
  async selectInvoice(seriesNumber) {
    await this.selectHeaderDropdown('invoice_id', seriesNumber, { optional: true });
  }

  async selectCurrencyIfNeeded(currency) {
    const trigger = this.headerSelectTrigger('currency');
    const currentText = (await trigger.textContent().catch(() => '')) || '';
    if (!currentText.includes(currency)) {
      await this.selectHeaderDropdown('currency', currency);
    }
  }

  async fillReference(value) {
    await this.fieldLocator('reference').fill(String(value));
  }

  /** Confirmed against the running app: "Amount" is a disabled, auto-computed field - skip gracefully instead of timing out waiting for it to become enabled. */
  async fillAmount(value) {
    const field = this.fieldLocator('amount');
    if (await field.isEditable().catch(() => false)) {
      await field.fill(String(value));
    }
  }

  /**
   * @param {{partyType?: 'Customer'|'Vendor', partyName?: string, journalType?: string,
   *   invoice?: string, currency?: string, reference?: string, amount?: string|number}} header
   */
  async fillHeader({ partyType, partyName, journalType, invoice, currency, reference, amount } = {}) {
    if (partyType) await this.selectPartyType(partyType);
    if (partyName) await this.selectPartyName(partyName);
    if (journalType) await this.selectJournalType(journalType);
    if (invoice) await this.selectInvoice(invoice);
    if (currency) await this.selectCurrencyIfNeeded(currency);
    if (reference !== undefined) await this.fillReference(reference);
    if (amount !== undefined) await this.fillAmount(amount);
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

  async saveAsDraft() {
    await this.saveDraftButton.click();
  }

  /**
   * @param {{partyType?: string, partyName?: string, journalType?: string, invoice?: string,
   *   currency?: string, reference?: string, amount?: string|number}} header
   * @param {Array<object>} items
   * @returns {Promise<{actualPartyName: string|undefined, actualItems: Array<string|undefined>}>}
   */
  async createCreditNote(header, items = []) {
    await this.openAdd();
    await this.fillHeader(header || {});
    const actualPartyName = header?.partyName
      ? (await this.headerSelectTrigger('party_id').textContent())?.trim()
      : undefined;
    const actualItems = [];
    for (const entry of items) {
      actualItems.push(await this.addItemEntry(entry));
    }
    return { actualPartyName, actualItems };
  }

  /** Navigates straight to the credit note's View page by id - same pattern as PurchaseInvoicePage.gotoView. */
  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`${this.listPath}/${id}/view-credit-note`);
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
    await this.page.waitForURL(/view-credit-note/, { timeout: 15000 });
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

module.exports = CreditNotePage;
