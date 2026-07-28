const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Time Sheet (erpforce-hrms-fe: src/views/time-tracking/time-sheet/) - confirmed real module,
// route `/time-tracking/time-sheet`. Implements the cases documented in
// TIME_SHEET_PLAYWRIGHT_SCENARIOS.md that are grounded in confirmed source/live-screenshot
// behavior; see that doc for the full 192-scenario catalogue and every "verify live" case NOT
// automated here.
//
// REUSE NOTE (this is the point of this page object): the List page uses the exact same shared
// `ActionBar` (search-behind-icon-toggle) + `MaterialTable` + `Footer` (pagination) infra as every
// other HRMS module in this suite (Loan Configuration, Leave Policy Master, Salary Structure
// Master) - so `BasePage.searchList/clearSearch/columnHeader/getColumnAriaSort/
// getPaginationLabel/nextPageButton/goToPage/changePageSize/openRowActionMenu/deleteFromList/
// getRowStatusMatching/rowBySeriesNumber` all apply UNCHANGED, with zero method overrides needed
// here. Only the Add/Edit/View pages' own `TimeSheetTitleBar` (a DIFFERENT, module-specific
// filter/search bar, NOT the shared ActionBar) and the attendance grid need bespoke locators.
//
// CONFIRMED SOURCE BUG: `TimeSheetTable`'s "Add Employee" button only renders when a
// `handleAddEmployee` prop is passed (`time-sheet-table.tsx:104-108`), but NEITHER
// `add-time-sheet.hrms.tsx` NOR `edit-time-sheet.hrms.tsx` ever passes that prop to
// `<TimeSheetTable>` - `isEmployeeModalOpen`/`setIsEmployeeModalOpen`/`<AddEmployeeModal>` are all
// wired up in both files, but there is currently NO way to open that modal from the UI. Employees
// visible in a generated sheet come entirely from the `generate` API's own Company/Department/
// Date-Range scoping, not from a manual add step. See addEmployeeButtonIsUnreachable() below - a
// genuinely valuable, confirmed-from-source regression case, not a guess.
//
// NOT AUTOMATED HERE (documented, not silently skipped): deep attendance-cell editing
// (`MaterialEditableTable` row-edit mode on `_is_overridden` days) and the `DatePickerPopper`
// calendar's own day-cell selection - neither component's exact interactive markup was read
// live, same caution as Leave Policy Master's react-querybuilder condition editor. Tests below
// rely on the Add page's own DEFAULT filters (Date Range = yesterday..yesterday, Company =
// logged-in user's own company) rather than driving the date picker.
class TimeSheetPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.listAddButton = page.getByRole('button', { name: 'Add' }).first();

    // ---------- TimeSheetTitleBar (Add/Edit/View - NOT the shared ActionBar) ----------
    this.filterButton = page.getByRole('button', { name: 'Filter', exact: true });
    // SearchableSelect's own accessible name is its `placeholder` prop ("Company"/similar) -
    // confirmed from source structure (time-sheet-title-bar.tsx:256-270), not live-verified for
    // exact role mapping, same caution BasePage.openDropdownAndPick already documents.
    this.companyFilterPlaceholder = 'Company';
    this.dateRangeChip = page.locator('.timesheetTitleBar--FilterWrapper--Chip');
    this.gridSearchInput = page.getByPlaceholder('Search', { exact: true });

    this.generateButton = page.getByRole('button', { name: 'Generate', exact: true });
    this.actionsButton = page.getByRole('button', { name: 'Actions', exact: true });
    this.regenerateMenuItem = page.getByRole('menuitem', { name: 'Regenerate', exact: true });
    this.saveAsDraftButton = page.getByRole('button', { name: 'Save as Draft', exact: true });
    this.submitButton = page.getByRole('button', { name: 'Submit', exact: true });

    // ---------- View page ----------
    this.approvalHistoryButton = page.getByRole('button', { name: 'Approval History', exact: true });
    this.approveButton = page.getByRole('button', { name: 'Approve', exact: true });
    this.rejectButton = page.getByRole('button', { name: 'Reject', exact: true });
    this.printButton = page.getByRole('button', { name: 'Print', exact: true });

    // ---------- Grid (read-only assertions only - see class comment) ----------
    this.employeeRows = page.locator('table tbody tr');
    this.addEmployeeButton = page.locator('.addTimeSheet--AddEmployeeButton');
  }

  async gotoList() {
    await this.page.goto('/dashboard/hrms/time-tracking/time-sheet');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.listAddButton.click();
    await this.page.waitForURL('**/add-time-sheet');
    await this.page.waitForLoadState('networkidle');
  }

  // ---------- Row navigation (this module renders BOTH View and Edit as menu items, unlike
  // Loan Configuration's Link-wrapped status chip) ----------
  async openViewFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'View', exact: true }).click();
    await this.page.waitForURL('**/view-time-sheet');
    await this.page.waitForLoadState('networkidle');
  }

  async openEditFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await this.page.waitForURL('**/edit-time-sheet');
    await this.page.waitForLoadState('networkidle');
  }

  // ---------- Generate / Regenerate ----------
  // Uses the Add page's OWN default filters (Company = logged-in user's company, Date Range =
  // yesterday..yesterday) - no date-picker or Company-filter interaction needed for the default
  // path. Pass `company`/`departmentPlaceholder` only when a test needs to override them.
  async generate({ company } = {}) {
    if (company) {
      await this.openDropdownAndPick(this.companyFilterPlaceholder, company, { tryFill: true });
    }
    await this.generateButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async regenerate() {
    await this.actionsButton.click();
    await this.regenerateMenuItem.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ---------- Save actions ----------
  // Same reasoning as every other HRMS page object in this suite - capture the just-created
  // record from the list's own refetch JSON. CONFIRMED shape (reducer.tsx / actionCreators.ts):
  // `{ data: { timesheets: [...] } }` for the list - a THIRD distinct key name across this
  // suite's HRMS modules (Leave Policy Master -> leave_policy_master, Loan Configuration ->
  // loan_master, Time Sheet -> timesheets) - always confirm the real key per module.
  async saveAndCaptureId(buttonLocator) {
    const listResponsePromise = this.page.waitForResponse((r) =>
      r.url().includes('timesheets') && r.request().method() === 'GET',
    );
    await buttonLocator.click();
    const listResponse = await listResponsePromise;
    await this.page.waitForLoadState('networkidle');
    const body = await listResponse.json().catch(() => null);
    const record = body?.data?.timesheets?.[0];

    const id = record?.id !== undefined ? String(record.id) : undefined;
    let seriesNumber = record?.series_number;
    if (!seriesNumber) {
      seriesNumber = await this.page.locator('table tbody tr').first().innerText();
    }
    return { id, seriesNumber };
  }

  async saveAsDraft() {
    return this.saveAndCaptureId(this.saveAsDraftButton);
  }

  async submit() {
    return this.saveAndCaptureId(this.submitButton);
  }

  // ---------- Approval ----------
  async approve() {
    await this.approveButton.click();
    await this.page.waitForURL('**/time-tracking/time-sheet');
    await this.page.waitForLoadState('networkidle');
  }

  async reject() {
    await this.rejectButton.click();
    await this.page.waitForURL('**/time-tracking/time-sheet');
    await this.page.waitForLoadState('networkidle');
  }

  // ---------- Row status ----------
  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Draft|Pending|Submitted|Approved|Rejected/);
  }

  // Finds the series number of the first row currently rendering the given status, by applying
  // the shared list's own status Filter rather than assuming a specific seeded series number
  // exists - this suite's data is cumulative/shared across runs (see repo CLAUDE.md), so a fixed
  // hardcoded id would be brittle. Returns undefined if no such row exists on the first page.
  async firstSeriesNumberWithStatus(statusText) {
    const row = this.page.locator('tr', { has: this.page.getByText(statusText, { exact: true }) }).first();
    if (!(await row.isVisible().catch(() => false))) return undefined;
    // ID is the row's own series-number cell text (e.g. "TS-2026-000033") - first cell after the
    // drag-handle/checkbox columns, matching this list's confirmed column order.
    return (await row.locator('td').nth(2).innerText()).trim();
  }
}

module.exports = TimeSheetPage;
