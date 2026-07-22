const AccountingDocumentPage = require('../base/AccountingDocumentPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Expense Reimbursement (Accounting > Expense > Expense Reimbursement), approved and paid via a
 * separate "Expense Report" listing (Accounting > Expense > Expense Report - same sidebar
 * section, a sibling nav item, not a submenu of the Add/List screen itself).
 * Source: erpforce-fe modules/accounting/src/views/expense-reimbursement/*
 * Routes confirmed against the running app:
 *   list        /dashboard/accounting/expense/expense-reimbursement
 *   add         /dashboard/accounting/expense/expense-reimbursement/add-expense-reimbursement
 *   report list /dashboard/accounting/expense/expense-report
 *
 * Confirmed against the running app:
 * - Add form field-array prefix is `add_expense_reimbursement`. Header fields: date
 *   (Transaction Date), company_id (Entity, pre-filled "Trootech"), employee_id, manager_id
 *   (optional), journal_id, currency_id, exchange_rate, description (optional),
 *   expense_entry_type, location_id (optional), department_id (optional).
 * - "Total Amount" (`add_expense_reimbursement.total_amount`) is a disabled, auto-computed field
 *   - it only becomes non-zero once an Expense Entry line is added, same as Debit/Credit Note's
 *   own "Amount" field.
 * - Expense Entries modal field-array prefix is `expense_item`: date, category_id, ref_number
 *   (optional), tax_template_id (optional), amount, tax_amount (computed), total_amount
 *   (computed), location_id (optional), department_id (optional), attachment_url (optional).
 *   Same Quantity/Rate-before-recompute pattern as every other Item Entry modal in this suite:
 *   `amount` must be committed with a blur (Tab) and a settle wait before Save, or tax_amount/
 *   total_amount save as stale zeros.
 */
class ExpenseReimbursementPage extends AccountingDocumentPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_expense_reimbursement',
      listPath: '/dashboard/accounting/expense/expense-reimbursement',
      addPath: '/dashboard/accounting/expense/expense-reimbursement/add-expense-reimbursement',
      statusCssSlug: 'expenseReimbursement',
    });

    this.reportListPath = '/dashboard/accounting/expense/expense-report';

    this.addButton = page.getByRole('button', { name: /^Add$/i }).or(page.getByText(/^Add$/i)).first();
    this.saveButton = page.getByRole('button', { name: /^Save$/i }).last();

    this.itemModal = page.getByRole('dialog');
    this.itemModalSaveButton = this.itemModal.getByRole('button', { name: /^Save$/i });
    this.addItemButton = page.locator('button.table--AddButton').first();
  }

  /** Same "plain <p> next to breadcrumb, no --StatusChip class" quirk DebitNotePage.js/CreditNotePage.js document. */
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

  async selectEmployee(name) {
    await this.selectHeaderDropdown('employee_id', name);
  }

  async selectManager(name) {
    await this.selectHeaderDropdown('manager_id', name, { optional: true });
  }

  async selectJournal(name) {
    await this.selectHeaderDropdown('journal_id', name);
  }

  async selectCurrencyIfNeeded(currency) {
    const trigger = this.headerSelectTrigger('currency');
    const currentText = (await trigger.textContent().catch(() => '')) || '';
    if (!currentText.includes(currency)) {
      await this.selectHeaderDropdown('currency', currency);
    }
  }

  async selectExpenseEntryType(name) {
    await this.selectHeaderDropdown('expense_entry_type', name);
  }

  /** Disabled until Expense Entry Type is selected (see fillHeader's own field ordering) - guarded defensively in case it's still pre-filled/disabled for some currency/type combination. */
  async fillExchangeRate(value) {
    const field = this.fieldLocator('exchange_rate');
    if (await field.isEditable().catch(() => false)) {
      await field.fill(String(value));
    }
  }

  async fillDescription(value) {
    await this.fieldLocator('description').fill(String(value));
  }

  /**
   * @param {{date?: string, employee?: string, manager?: string, journal?: string,
   *   currency?: string, exchangeRate?: string|number, description?: string,
   *   expenseEntryType?: string}} header
   */
  async fillHeader({ employee, manager, journal, currency, exchangeRate, description, expenseEntryType } = {}) {
    if (employee) await this.selectEmployee(employee);
    if (manager) await this.selectManager(manager);
    if (journal) await this.selectJournal(journal);
    // Expense Entry Type selected BEFORE Currency/Exchange Rate: confirmed live that Exchange
    // Rate is disabled until Expense Entry Type is set.
    if (expenseEntryType) await this.selectExpenseEntryType(expenseEntryType);
    if (currency) await this.selectCurrencyIfNeeded(currency);
    if (exchangeRate !== undefined) await this.fillExchangeRate(exchangeRate);
    if (description !== undefined) await this.fillDescription(description);
  }

  async openAddItemModal() {
    await this.addItemButton.waitFor({ state: 'visible', timeout: 15000 });
    await this.addItemButton.click();
    await this.itemModal.waitFor({ state: 'visible' });
  }

  /** @param {{category?: string, taxTemplate?: string, amount?: string|number, refNumber?: string}} entry */
  async fillItemEntry({ category, taxTemplate, amount, refNumber } = {}) {
    if (category) {
      const categoryTrigger = this.itemModal.locator('[id*="mui-component-select-"][id*="category"]').first();
      await selectDropdown(this.page, categoryTrigger, category, category);
      await this.page.waitForTimeout(500);
    }
    if (refNumber !== undefined) {
      await this.itemModal.locator('[name="expense_item.ref_number"]').fill(String(refNumber));
    }
    if (taxTemplate) {
      const taxTrigger = this.itemModal.locator('[id*="mui-component-select-"][id*="tax_template"]').first();
      if (await taxTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectDropdown(this.page, taxTrigger, taxTemplate, taxTemplate);
        await this.page.waitForTimeout(800);
      }
    }
    if (amount !== undefined) {
      const amountField = this.itemModal.locator('[name="expense_item.amount"]').first();
      await amountField.fill(String(amount));
      await amountField.press('Tab');
      // Same recompute-settle requirement PurchaseInvoicePage.js's fillItemEntry documents -
      // tax_amount/total_amount are debounced-computed from amount, not instant.
      await this.page.waitForTimeout(1000);
    }
  }

  async saveItemEntry() {
    await this.itemModalSaveButton.click();
    await this.itemModal.waitFor({ state: 'hidden', timeout: 10000 });
    await this.page.waitForTimeout(500);
  }

  async addItemEntry(entry) {
    await this.openAddItemModal();
    await this.fillItemEntry(entry);
    await this.saveItemEntry();
  }

  /**
   * Captures `{ id, seriesNumber }` straight from the save response instead of navigating to the
   * View page afterward - confirmed live that View page (view-expense-reimbursement.tsx) throws
   * `data.tax_code_data?.map is not a function` and renders fully blank whenever the record's
   * Expense Entry line has a Tax Template (mandatory field, so this hits every record): the
   * backend returns `tax_code_data: 0` for every tax template option this environment has, not
   * an array. Confirmed as a genuine, deterministic backend/frontend bug, not flakiness - same
   * category of confirmed app gap as Cash Expense's Save no-op (see ACCOUNTING_FINDINGS.md).
   * The separate Expense Report detail page (openNewestReportRow) does NOT hit this crash, since
   * it's a different view component that doesn't render tax_code_data - safe to keep using there.
   */
  async save() {
    return this.saveAndCaptureId(this.saveButton, ['employee_id', 'expense_entry_type']);
  }

  /**
   * @param {object} header - see fillHeader()
   * @param {Array<object>} items - see fillItemEntry()
   */
  async createExpenseReimbursement(header, items = []) {
    await this.openAdd();
    await this.fillHeader(header || {});
    for (const entry of items) {
      await this.addItemEntry(entry);
    }
  }

  /**
   * Navigates straight to the Expense Reimbursement's View page by id.
   * KNOWN APP BUG: this page (view-expense-reimbursement.tsx) throws
   * `data.tax_code_data?.map is not a function` and renders fully blank for any record whose
   * Expense Entry line has a Tax Template - see save()'s own doc comment. Don't call this (or
   * openNewestRow() below) to verify a just-created record; use save()'s captured
   * id/seriesNumber instead, or the Expense Report detail page (openNewestReportRow), which does
   * not hit this crash.
   */
  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`${this.listPath}/${id}/view-expense-reimbursement`);
    await this.page.waitForLoadState('networkidle');
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  /** Opens the newest (list is sorted newest-first) row's View page. See gotoView()'s known-bug warning above. */
  async openNewestRow() {
    await this.gotoList();
    await this.page.waitForTimeout(500);
    const firstRow = this.page.locator('table tbody tr').first();
    await firstRow.waitFor({ state: 'visible', timeout: 10000 });
    await firstRow.locator('a').first().click();
    await this.page.waitForURL(/view-expense-reimbursement/, { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(800);
  }

  /** Navigates to the Expense Report listing (a sibling nav item under Accounting > Expense, not a submenu of this list). */
  async gotoReportList() {
    await this.page.goto(this.reportListPath);
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);
  }

  /** Opens the newest (list is sorted newest-first) row's Detail page from the Expense Report listing. */
  async openNewestReportRow() {
    await this.gotoReportList();
    await this.page.waitForTimeout(500);
    const firstRow = this.page.locator('table tbody tr').first();
    await firstRow.waitFor({ state: 'visible', timeout: 10000 });
    await firstRow.locator('a').first().click();
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(800);
  }
}

module.exports = ExpenseReimbursementPage;
