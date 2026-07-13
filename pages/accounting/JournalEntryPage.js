const AccountingDocumentPage = require('../base/AccountingDocumentPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Journal Entry - the flagship "document with approval workflow" flow.
 * Source: erpforce-fe modules/accounting/src/views/journal-entry/*
 * Routes: pathname.accounting.ts PathnameAccounting.{JOURNAL_ENTRY,ADD_JOURNAL_ENTRY,
 * EDIT_JOURNAL_ENTRY,VIEW_JOURNAL_ENTRY}
 *
 * Header fields (company_id, journal_type_id, posting_date, currency_id, ...) are
 * backend-driven (FormParser under fieldArrayName='add_journal_entry') - confirm exact names
 * against the running app. Line-item modal fields are hardcoded in journal-item-modal.tsx under
 * fieldArrayName='journal_items' (account, partner, debit_amount, credit_amount, bill_no,
 * bill_date, reference_type_id, reference_date, is_advance, narration) and are used verbatim
 * below since they are stable across app versions (not schema-driven).
 */
class JournalEntryPage extends AccountingDocumentPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_journal_entry',
      listPath: '/dashboard/accounting/journal-entry',
      addPath: '/dashboard/accounting/journal-entry/add-journal-entry',
      statusCssSlug: 'journalEntry',
    });

    // Confirmed against the running app: the button is labeled just "Add" (class
    // `table--AddButton`), not "Add Item" - `getByRole('button', {name:'Add Item'})` never matches.
    this.addItemButton = page.locator('button.table--AddButton');
    this.itemModal = page.getByRole('dialog');
    this.itemModalSaveButton = this.itemModal.getByRole('button', { name: 'Save' });
    this.itemModalCancelButton = this.itemModal.getByRole('button', { name: 'Cancel' });

    this.seriesNumberChip = page.getByText(/series number/i).locator('..');
    this.totalDebitValue = page.locator('text=Total Debit').locator('..').locator('text=/[\\d.,]+/').last();
    this.totalCreditValue = page.locator('text=Total Credit').locator('..').locator('text=/[\\d.,]+/').last();
    this.differenceValue = page.locator('text=Difference').locator('..').locator('text=/[\\d.,]+/').last();
  }

  lineItemField(fieldName) {
    return this.itemModal.locator(`[name="journal_items.${fieldName}"]`);
  }

  /** account/partner are DynamicSearchSelect - same mui-component-select-<name> trigger pattern as settings-entity dropdowns, confirmed against the running app. */
  lineItemSelectTrigger(fieldName) {
    return this.itemModal.locator(`[id="mui-component-select-journal_items.${fieldName}"]`);
  }

  async openAddItemModal() {
    await this.addItemButton.click();
    await this.itemModal.waitFor({ state: 'visible' });
  }

  async selectLineItemDropdown(fieldName, searchText, optionText = searchText) {
    await selectDropdown(this.page, this.lineItemSelectTrigger(fieldName), searchText, optionText);
  }

  /**
   * @param {{account?: string, partner?: string, debitAmount?: string, creditAmount?: string,
   *   billNo?: string, narration?: string}} item
   */
  async fillLineItem(item) {
    if (item.account) await this.selectLineItemDropdown('account', item.account);
    if (item.partner) await this.selectLineItemDropdown('partner', item.partner);
    if (item.debitAmount !== undefined) await this.lineItemField('debit_amount').fill(String(item.debitAmount));
    if (item.creditAmount !== undefined) await this.lineItemField('credit_amount').fill(String(item.creditAmount));
    if (item.billNo !== undefined) await this.lineItemField('bill_no').fill(String(item.billNo));
    if (item.narration !== undefined) await this.lineItemField('narration').fill(String(item.narration));
  }

  async saveLineItem() {
    await this.itemModalSaveButton.click();
    await this.itemModal.waitFor({ state: 'hidden' });
    // The line-item table re-renders (new row added) right as the modal closes; opening the
    // next modal immediately can race that re-render and intermittently fail to register the
    // click on the "Add" button - confirmed flaky against the running app without this wait.
    await this.page.waitForTimeout(500);
  }

  async addLineItem(item) {
    await this.openAddItemModal();
    await this.fillLineItem(item);
    await this.saveLineItem();
  }

  lineItemAccountError() {
    return this.itemModal.getByText('Please select Account');
  }

  lineItemAmountError() {
    return this.itemModal.getByText('At least one amount (credit or debit) is required');
  }

  /** Rendered as an inline banner above the line-item table, not a toast - confirmed against the running app. */
  imbalanceError() {
    return this.page.getByText('Please ensure that the Debits and Credits are equal');
  }

  /**
   * The Attachment section uses a standalone UploadMedia component (like Payment Request's),
   * not a FormParser field - its file input has the bare name `attachment_url` with no
   * `add_journal_entry.` prefix, confirmed against the running app.
   */
  async attachFile(filePath) {
    await this.page.locator('input[type="file"][name="attachment_url"]').setInputFiles(filePath);
  }

  /**
   * @param {{companyId?: string, journalTypeId?: string, postingDate?: string, currencyId?: string}} header
   * @param {Array<object>} lineItems
   */
  async createJournalEntry(header, lineItems = []) {
    await this.openAdd();
    if (header.companyId) await this.selectField('company_id', header.companyId);
    if (header.journalTypeId) await this.selectField('journal_type_id', header.journalTypeId);
    if (header.currencyId) await this.selectField('currency_id', header.currencyId);
    if (header.postingDate) await this.fillField('posting_date', header.postingDate);
    for (const item of lineItems) {
      await this.addLineItem(item);
    }
    await this.save();
  }
}

module.exports = JournalEntryPage;
