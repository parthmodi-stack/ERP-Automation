const AccountingDocumentPage = require('../base/AccountingDocumentPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Budget (Accounting > Budget) - document with an approval workflow, same archetype as Journal
 * Entry/Debit Note/Credit Note (Draft/Pending/Submitted/Approved/Rejected statuses seen live in
 * the listing; View page shows Edit/Actions/Compare/Submit plus the "select merge strategy" caret
 * for Quick Approval, same split-button pattern AccountingDocumentPage already models).
 * Source: erpforce-fe modules/accounting/src/views/budget/*
 * Routes confirmed against the running app (no singular/plural mismatch this time):
 *   list  /dashboard/accounting/budget
 *   add   /dashboard/accounting/budget/add-budget
 *   view  /dashboard/accounting/budget/:id/view-budget
 * The API's own create endpoint is POST /accounting/v1/budget/ (singular, matches addPath's own
 * last segment), response shaped `{ data: { budget: { id, series_number, budget_name, ... } } }`.
 *
 * CONFIRMED STATUS MODEL (same as Asset Transfer, differs from Commission modules and most other
 * document modules): clicking the single "Save" button does NOT create a Draft - the record is
 * created directly in "Pending" status (Submit button already visible on first View); there is no
 * separate "Save to Draft" action for this module.
 *
 * Confirmed against the running app - Add form field list (entityKey `add_budget`):
 *   budget_name (Budget Name *, text, required), budget_type_id (Budget Type *, required dropdown:
 *   Production/Manufacturing/Sales budget/Purchase budget/Company budget), financial_year_id
 *   (Financial Year *, required dropdown, real Financial Year records), total_amount (Total
 *   Amount *, required numeric - a plain user-entered value, NOT auto-computed from selected
 *   accounts), company_id (Entity *, pre-filled "Trootech"), budget_period (Budget Period *,
 *   required dropdown: Monthly/Quarterly/Half-Yearly/Yearly/Custom), budget_months (Budget
 *   Months *, required MULTI-select: January-December), location_id/department_id (both optional).
 *
 * "Select Account *" is a required, multi-step account picker, NOT a simple single click-to-open
 * modal - confirmed live the real flow is:
 *   1. Click the "Select Account" button - opens a small popover listing top-level account
 *      categories (Assets, Expense, Income, Liabilities, Equity).
 *   2. Click a category (e.g. "Assets") - the popover closes and that category appears as its own
 *      selected tab/pill below the form, alongside a newly-revealed "Add Accounts" button.
 *   3. Click "Add Accounts" - opens a REAL modal dialog (role="dialog", title "Add Accounts") with
 *      a checkbox per category tab currently selected (just one checkbox, "Assets", when only
 *      that one category tab is selected) and a search input.
 *   4. Check the checkbox(es) for the categories to include, click "Update" - the dialog closes
 *      and the category's own real sub-accounts (e.g. Assets -> Stock, Fixed Assets, Bank, Cash,
 *      Receivable, ...) populate as a real line-items table below, with one column per selected
 *      Budget Month. The "Add Accounts" button becomes "Add or Remove Accounts" for further edits.
 * Confirmed live a full create succeeds with just this category-level selection (checking "Assets"
 * as a whole) - no need to fill an amount per individual sub-account row for a basic save, matching
 * the "simple CRUD, not advanced budget workflows" scope this page object targets.
 */
class BudgetPage extends AccountingDocumentPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_budget',
      listPath: '/dashboard/accounting/budget',
      addPath: '/dashboard/accounting/budget/add-budget',
      statusCssSlug: 'budget',
    });

    this.addButton = page.getByRole('button', { name: /^Add$/i }).or(page.getByText(/^Add$/i)).first();
    this.saveButton = page.getByRole('button', { name: /^Save$/i }).last();
    this.selectAccountButton = page.getByRole('button', { name: /Select Account/i });
    this.addAccountsButton = page.getByRole('button', { name: /Add(?: or Remove)? Accounts/i });
  }

  /** Same "plain <p> next to breadcrumb, no --StatusChip class" quirk DebitNotePage.js/CreditNotePage.js/ExpenseReimbursementPage.js/CashExpensePage.js/AssetTransferPage.js document. */
  statusChipOnView() {
    return this.page.locator('p').filter({ hasText: /^(Draft|Pending|Submitted|Approved|Rejected|Void)$/ });
  }

  approvalStatusChipOnView() {
    return this.statusChipOnView().first();
  }

  headerSelectTrigger(fieldFragment) {
    return this.page.locator(`[id="mui-component-select-add_budget.${fieldFragment}"]`).first();
  }

  async selectHeaderDropdown(fieldFragment, optionText, opts = {}) {
    await selectDropdown(this.page, this.headerSelectTrigger(fieldFragment), optionText, optionText, opts);
  }

  async fillBudgetName(value) {
    await this.fieldLocator('budget_name').fill(String(value));
  }

  async selectBudgetType(name) {
    await this.selectHeaderDropdown('budget_type_id', name);
  }

  async selectFinancialYear(name) {
    await this.selectHeaderDropdown('financial_year_id', name);
  }

  async fillTotalAmount(value) {
    await this.fieldLocator('total_amount').fill(String(value));
  }

  async selectBudgetPeriod(name) {
    await this.selectHeaderDropdown('budget_period', name);
  }

  async selectBudgetMonths(name) {
    await this.selectHeaderDropdown('budget_months', name);
  }

  async selectLocation(name) {
    await this.selectHeaderDropdown('location_id', name, { optional: true });
  }

  async selectDepartment(name) {
    await this.selectHeaderDropdown('department_id', name, { optional: true });
  }

  /**
   * Runs the full multi-step account picker (see class doc comment): opens the category popover,
   * picks `categoryName` as a tab, opens the resulting "Add Accounts" dialog, checks that
   * category's own checkbox, and clicks "Update" to populate the real line-items table.
   */
  async selectAccountCategory(categoryName) {
    await this.selectAccountButton.click();
    await this.page.waitForTimeout(800);
    await this.page.getByText(categoryName, { exact: true }).click();
    await this.page.waitForTimeout(800);

    await this.addAccountsButton.click();
    await this.page.waitForTimeout(800);
    const dialog = this.page.getByRole('dialog');
    // Index 0 is the table's own "select all" header checkbox; the category's own row checkbox
    // is the first real data row - confirmed live only one such row exists when just one category
    // tab has been selected so far.
    await dialog.locator('input[type="checkbox"]').nth(1).click();
    await this.page.waitForTimeout(300);
    await dialog.getByRole('button', { name: 'Update', exact: true }).click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * @param {{budgetName?: string, budgetType?: string, financialYear?: string,
   *   totalAmount?: string|number, budgetPeriod?: string, budgetMonths?: string,
   *   location?: string, department?: string, accountCategory?: string}} data
   */
  async fillHeader({ budgetName, budgetType, financialYear, totalAmount, budgetPeriod, budgetMonths, location, department, accountCategory } = {}) {
    if (budgetName !== undefined) await this.fillBudgetName(budgetName);
    if (budgetType) await this.selectBudgetType(budgetType);
    if (financialYear) await this.selectFinancialYear(financialYear);
    if (totalAmount !== undefined) await this.fillTotalAmount(totalAmount);
    if (budgetPeriod) await this.selectBudgetPeriod(budgetPeriod);
    if (budgetMonths) await this.selectBudgetMonths(budgetMonths);
    if (location) await this.selectLocation(location);
    if (department) await this.selectDepartment(department);
    if (accountCategory) await this.selectAccountCategory(accountCategory);
  }

  /** Plain Save click - used by Edit (a PUT request, not matched by saveAndCaptureId's POST filter). */
  async save() {
    await this.saveButton.click();
  }

  /** Create-only: captures `{ id, seriesNumber }` from the save response. */
  async saveAndCapture() {
    return this.saveAndCaptureId(this.saveButton, ['budget_type_id', 'financial_year_id'], 'budget');
  }

  /** @param {object} data - see fillHeader() */
  async createBudget(data) {
    await this.openAdd();
    await this.fillHeader(data || {});
  }

  /** Navigates straight to the Budget's View page by id - no singular/plural route mismatch here (unlike Asset Transfer/Commission Target). */
  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`${this.listPath}/${id}/view-budget`);
    await this.page.waitForLoadState('networkidle');
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  /**
   * CONFIRMED LIVE APP BUG: a direct `page.goto()` straight to the edit-budget URL breaks the
   * page's own record-id state - the breadcrumb shows a literal "ID: Draft" placeholder instead
   * of the real series number, and Save then fails with a genuine backend error ("Unknown column
   * 'NaN' in 'where clause'"), even though every field still renders correctly pre-filled. Reached
   * via the View page's own real "Edit" button (a client-side SPA navigation, not a hard reload),
   * the exact same URL works fine and the breadcrumb shows the real ID - so this method routes
   * through View first rather than deep-linking, working around the bug rather than tripping it.
   */
  async gotoEdit(id) {
    if (!id) throw new Error(`gotoEdit() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.gotoView(id);
    await this.editButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = BudgetPage;
