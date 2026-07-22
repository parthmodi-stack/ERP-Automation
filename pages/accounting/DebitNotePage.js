const AccountingDocumentPage = require('../base/AccountingDocumentPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Debit Note (Accounting > Credits > Debit Note) - raised against a Vendor (or Customer) either
 * standalone or tied to an existing approved bill (Purchase Invoice).
 * Source: erpforce-fe modules/accounting/src/views/debit-note/*
 * Routes confirmed against the running app (the list's own "Add" is a plain button, not a split
 * button like Purchase/Sales Invoice's Item/Fixed-Asset menu):
 *   list  /dashboard/accounting/credits/debit-note
 *   add   /dashboard/accounting/credits/add-debit-note
 *
 * Confirmed against the running app:
 * - Add form field-array prefix is `add_debit_note`. Header fields: party (party TYPE - options
 *   "Customer"/"Vendor"), party_id (the actual Customer/Vendor, filtered by whichever `party`
 *   type is selected), journal_type_id (only real option observed: "Journal Voucher"),
 *   salesperson_id (optional), invoice_id ("Bills" - lists that party's own APPROVED bills;
 *   "No data available" when the selected party has none), reason_id (optional), company_id
 *   (Entity, pre-filled "Trootech"), currency_id, region_id ("Emirate", optional), location
 *   (optional), department (optional), reference (free text, optional), amount ("Amount *"),
 *   exchange_rate (optional).
 * - Same Item Entries / Expense Entries tables as Purchase/Sales Invoice (shared table
 *   component, `button.table--AddButton` "Add" trigger, Item Entries renders first in the DOM).
 * - Same ApprovalWrapper-driven Submit/Accept/Reject flow as every other document module.
 */
class DebitNotePage extends AccountingDocumentPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_debit_note',
      listPath: '/dashboard/accounting/credits/debit-note',
      addPath: '/dashboard/accounting/credits/add-debit-note',
      statusCssSlug: 'debitNote',
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

  /**
   * Confirmed against the running app: unlike Sales/Purchase Invoice, the Debit Note View page's
   * status indicator is a plain `<p>` next to the "ID: <series>" breadcrumb with no distinct
   * `--StatusChip` CSS class to hook - matched by its own known text content instead.
   */
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
    await this.selectHeaderDropdown('add_debit_note.party', type);
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
   * APPROVED bills (Purchase Invoices for a Vendor) - "No data available" if that party has
   * none, with no inline "Create New" fallback, so `optional: true` here just skips gracefully
   * instead of blocking the rest of the form when there's genuinely nothing to pick.
   */
  async selectBill(seriesNumber) {
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

  /**
   * Confirmed against the running app: "Amount" is a disabled, auto-computed field (from Item
   * Entries and/or the selected Bill), never directly editable - skip gracefully instead of
   * timing out waiting for it to become enabled.
   */
  async fillAmount(value) {
    const field = this.fieldLocator('amount');
    if (await field.isEditable().catch(() => false)) {
      await field.fill(String(value));
    }
  }

  /**
   * @param {{partyType?: 'Customer'|'Vendor', partyName?: string, journalType?: string,
   *   bill?: string, currency?: string, reference?: string, amount?: string|number}} header
   */
  async fillHeader({ partyType, partyName, journalType, bill, currency, reference, amount } = {}) {
    if (partyType) await this.selectPartyType(partyType);
    if (partyName) await this.selectPartyName(partyName);
    if (journalType) await this.selectJournalType(journalType);
    if (bill) await this.selectBill(bill);
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
   * @param {{partyType?: string, partyName?: string, journalType?: string, bill?: string,
   *   currency?: string, reference?: string, amount?: string|number}} header
   * @param {Array<object>} items
   * @returns {Promise<{actualPartyName: string|undefined, actualItems: Array<string|undefined>}>}
   */
  async createDebitNote(header, items = []) {
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

  /** Navigates straight to the debit note's View page by id - same pattern as PurchaseInvoicePage.gotoView. */
  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`${this.listPath}/${id}/view-debit-note`);
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
    await this.page.waitForURL(/view-debit-note/, { timeout: 15000 });
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

module.exports = DebitNotePage;
