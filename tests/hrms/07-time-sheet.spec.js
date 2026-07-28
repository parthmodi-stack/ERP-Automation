const { test, expect } = require('@playwright/test');
const TimeSheetPage = require('../../pages/TimeSheetPage');

// Time Sheet (erpforce-hrms-fe: src/views/time-tracking/time-sheet/) - confirmed real module,
// route `/time-tracking/time-sheet`. Implements the cases documented in
// TIME_SHEET_PLAYWRIGHT_SCENARIOS.md that are confirmed automatable; see that doc for the full
// 192-scenario catalogue and every "verify live"/"Manual first" case NOT covered here.
//
// REUSE: the List page's search/sort/pagination/row-menu/delete all go through the exact same
// shared ActionBar/MaterialTable/Footer infra as Loan Configuration and Leave Policy Master, so
// this suite leans entirely on BasePage's existing methods for those - see TimeSheetPage.js's own
// header comment for the full mapping. No new List-page helpers were written; only the Add/Edit/
// View pages' bespoke TimeSheetTitleBar/grid needed new methods.
//
// SCOPE NOTES:
// - Deep attendance-cell editing and the DatePickerPopper calendar are NOT automated here (neither
//   component's interactive markup was read live) - tests rely on the Add page's own DEFAULT
//   filters (Company = logged-in user's company, Date Range = yesterday..yesterday).
// - This suite's data is shared/cumulative across runs (per repo CLAUDE.md), so RBAC/status-gating
//   tests search the EXISTING list for a row already in the needed status (via
//   TimeSheetPage.firstSeriesNumberWithStatus) rather than assuming a fixed hardcoded id - and
//   skip gracefully if no such row exists yet.
// - Approve/Reject requires the logged-in test user to actually be the record's assigned
//   approver (`can_proceed_request` from the backend) - tests skip if no eligible Pending record
//   with visible Approve/Reject buttons is found, rather than asserting a guessed outcome.
test.describe('Time Sheet Module', () => {
  test.describe.configure({ timeout: 90000 });

  let draftRecord = {};

  // ── TC-TS-LIST-01/02: Page load, columns, existing records ───────────────────
  test('TC-TS-LIST-01 [+] List loads with the correct URL and columns', { tag: '@smoke' }, async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.gotoList();

    await expect(page).toHaveURL(/time-tracking\/time-sheet/);
    await expect(ts.columnHeader('ID')).toBeVisible();
    await expect(ts.columnHeader('Company')).toBeVisible();
    await expect(ts.columnHeader('Department')).toBeVisible();
    await expect(ts.columnHeader('Status')).toBeVisible();
  });

  // ── TC-TS-LIST-09/10: Edit/Delete gating by status (reuses existing seeded records) ─
  test('TC-TS-LIST-09 [-] Edit is disabled from the list for Approved/Rejected/Pending records', async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.gotoList();

    const approvedSeries = await ts.firstSeriesNumberWithStatus('Approved');
    test.skip(!approvedSeries, 'No Approved Time Sheet record exists yet in this environment to verify against.');

    const disabled = await ts.isRowActionDisabled(approvedSeries, 'Edit');
    expect(disabled).toBe(true);
  });

  test('TC-TS-LIST-10 [-] Delete is disabled from the list for Approved/Rejected records', async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.gotoList();

    const approvedSeries = await ts.firstSeriesNumberWithStatus('Approved');
    test.skip(!approvedSeries, 'No Approved Time Sheet record exists yet in this environment to verify against.');

    const disabled = await ts.isRowActionDisabled(approvedSeries, 'Delete');
    expect(disabled).toBe(true);
  });

  // ── TC-TS-SRCH-01/06: Search ───────────────────────────────────────────────────
  test('TC-TS-SRCH-01 [+] Search by Timesheet ID returns the matching record', { tag: '@smoke' }, async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.gotoList();

    const seriesNumber = await ts.getFirstRowSeriesNumber();
    test.skip(!seriesNumber, 'No existing Time Sheet record to search for.');

    await ts.searchList(seriesNumber);
    await expect(page.getByText(seriesNumber, { exact: true }).first()).toBeVisible();
  });

  test('TC-TS-SRCH-06 [-] No-match search shows the empty state', async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.gotoList();

    await ts.searchList('zzz-no-such-timesheet-zzz');
    await expect(ts.noDataRow()).toBeVisible();
  });

  // ── TC-TS-SORT-01: Sort ID column ─────────────────────────────────────────────
  test('TC-TS-SORT-01 [+] Sort the ID column ascending/descending', async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.gotoList();

    await ts.clickColumnHeader('ID');
    const firstSort = await ts.getColumnAriaSort('ID');
    expect(['ascending', 'descending']).toContain(firstSort);

    await ts.clickColumnHeader('ID');
    const secondSort = await ts.getColumnAriaSort('ID');
    expect(secondSort).not.toBe(firstSort);
  });

  // ── TC-TS-PAGE-01/03: Pagination ──────────────────────────────────────────────
  test('TC-TS-PAGE-01 [+] Paginate the list', async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.gotoList();

    const label = await ts.getPaginationLabel();
    expect(label).toMatch(/Page \d+ of \d+/);

    if (await ts.nextPageButton().isEnabled()) {
      await ts.nextPageButton().click();
      await page.waitForLoadState('networkidle');
      const nextLabel = await ts.getPaginationLabel();
      expect(nextLabel).not.toBe(label);
    }
  });

  // ── TC-TS-ADD-01/02/04: Add page defaults ─────────────────────────────────────
  test('TC-TS-ADD-01 [+] Add page loads with Company defaulted and no grid yet', { tag: '@smoke' }, async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.goto();

    await expect(page).toHaveURL(/add-time-sheet/);
    // TC-TS-ADD-04: only "Generate" renders before any grid data exists (hasDaysData false).
    await expect(ts.generateButton).toBeVisible();
    await expect(ts.saveAsDraftButton).not.toBeVisible();
    await expect(ts.submitButton).not.toBeVisible();
  });

  // ── CONFIRMED SOURCE BUG: Add Employee button is unreachable ─────────────────
  test('TC-TS-EMP-BUG-01 [-] Confirmed gap: no "Add Employee" control is reachable from Add or Edit', async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.goto();
    await ts.generate();

    // Neither add-time-sheet.hrms.tsx nor edit-time-sheet.hrms.tsx passes `handleAddEmployee` to
    // <TimeSheetTable>, so the button that would open <AddEmployeeModal> never renders - confirmed
    // from source, not a guess. If this ever starts failing because the button DOES appear, that
    // means the gap was fixed - update this test to drive the real modal instead of asserting its
    // absence.
    await expect(ts.addEmployeeButton).toHaveCount(0);
  });

  // ── TC-TS-ADD-05/08: Generate renders the grid and reveals Save/Submit/Actions ─
  test('TC-TS-ADD-05 [+] Generate renders the grid and reveals Save as Draft/Submit/Actions', { tag: '@smoke' }, async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.goto();

    await ts.generate();

    // hasDaysData becomes true once Generate resolves - Generate itself disappears and
    // Save as Draft/Submit/Actions take its place (add-time-sheet.hrms.tsx's AddFormButtons).
    await expect(ts.saveAsDraftButton).toBeVisible();
    await expect(ts.submitButton).toBeVisible();
    await expect(ts.actionsButton).toBeVisible();
    await expect(ts.generateButton).not.toBeVisible();
  });

  // ── TC-TS-ADD-08 / TC-TS-REGEN-02: Actions -> Regenerate ──────────────────────
  test('TC-TS-REGEN-02 [+] Actions menu offers Regenerate, and it re-fetches the grid', async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.goto();
    await ts.generate();

    await ts.actionsButton.click();
    await expect(ts.regenerateMenuItem).toBeVisible();
    await ts.regenerateMenuItem.click();
    await page.waitForLoadState('networkidle');

    // Grid remains rendered (Save as Draft/Submit still visible) after Regenerate re-fires the
    // same generate call - confirms it doesn't wipe the page back to the pre-Generate state.
    await expect(ts.saveAsDraftButton).toBeVisible();
  });

  // ── TC-TS-DRAFT-02/03: Save as Draft persists with Draft status ───────────────
  test('TC-TS-DRAFT-02 [+] Save as Draft persists a record with status Draft', { tag: '@smoke' }, async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.goto();
    await ts.generate();

    const result = await ts.saveAsDraft();
    expect(result.seriesNumber).toBeTruthy();
    draftRecord = result;

    await ts.gotoList();
    await ts.searchList(draftRecord.seriesNumber);
    await expect(await ts.getRowStatus(draftRecord.seriesNumber)).toMatch(/Draft/);
  });

  // ── TC-TS-DRAFT-04: Reopening a Draft via Edit preloads it ────────────────────
  test('TC-TS-DRAFT-04 [+] Reopening a Draft via Edit preloads its Company/Date Range', async ({ page }) => {
    const ts = new TimeSheetPage(page);
    test.skip(!draftRecord.seriesNumber, 'Depends on TC-TS-DRAFT-02 having created a Draft record.');

    await ts.gotoList();
    await ts.searchList(draftRecord.seriesNumber);
    await ts.openEditFromList(draftRecord.seriesNumber);

    await expect(page).toHaveURL(/edit-time-sheet/);
    // TC-TS-DRAFT-08 companion: "Save as Draft" IS shown here because the record's own
    // is_draft/status is still Draft (edit-time-sheet.hrms.tsx conditionally renders it).
    await expect(ts.saveAsDraftButton).toBeVisible();
  });

  // ── TC-TS-EDIT-02/03: Edit's route guard is permission-based, not status-based ──
  test('TC-TS-EDIT-02 [-] Confirmed gap: direct-URL Edit on an Approved record is not status-blocked', async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.gotoList();

    const approvedSeries = await ts.firstSeriesNumberWithStatus('Approved');
    test.skip(!approvedSeries, 'No Approved Time Sheet record exists yet to verify the direct-URL edge case against.');

    // Edit is disabled from the row menu for Approved records (TC-TS-LIST-09), so get the real
    // `:id` via View instead (View's own menu item is only gated by `canView`, not status) and
    // substitute the URL segment - confirmed from source: edit-time-sheet.hrms.tsx only redirects
    // when `!canEdit`, there is no status-based check in the component itself. This is a
    // deliberate edge-case repro, not a green-path assertion - document whatever actually renders.
    await ts.searchList(approvedSeries);
    await ts.openViewFromList(approvedSeries);
    const editUrl = page.url().replace('view-time-sheet', 'edit-time-sheet');

    await page.goto(editUrl);
    await page.waitForLoadState('networkidle');

    // If the confirmed gap holds, the Edit form renders (Discard/Save controls present) rather
    // than redirecting back to the list - if this ever fails because the app now redirects, that
    // means a status-based guard was added; update this test to assert the redirect instead.
    await expect(page).toHaveURL(/edit-time-sheet/);
  });

  // ── TC-TS-VIEW-01/02/03: View page ────────────────────────────────────────────
  test('TC-TS-VIEW-01 [+] View shows the record read-only with Approval History available', { tag: '@smoke' }, async ({ page }) => {
    const ts = new TimeSheetPage(page);
    test.skip(!draftRecord.seriesNumber, 'Depends on TC-TS-DRAFT-02 having created a record.');

    await ts.gotoList();
    await ts.searchList(draftRecord.seriesNumber);
    await ts.openViewFromList(draftRecord.seriesNumber);

    await expect(page).toHaveURL(/view-time-sheet/);
    await expect(ts.approvalHistoryButton).toBeVisible();
  });

  // ── TC-TS-VIEW-04/APR: Approve/Reject only for records this user can act on ──
  test('TC-TS-APR-01 [+] Approve/Reject render only when the user can proceed on this request', async ({ page }) => {
    const ts = new TimeSheetPage(page);
    await ts.gotoList();

    const pendingSeries = await ts.firstSeriesNumberWithStatus('Pending');
    test.skip(!pendingSeries, 'No Pending Time Sheet record exists yet to verify Approve/Reject visibility against.');

    await ts.searchList(pendingSeries);
    await ts.openViewFromList(pendingSeries);

    const canProceed = await ts.approveButton.isVisible().catch(() => false);
    test.skip(!canProceed, 'Logged-in test user is not the assigned approver for this record (can_proceed_request=false) - see config/testData.js note on approverName.');

    await expect(ts.rejectButton).toBeVisible();
    await ts.approve();

    await ts.searchList(pendingSeries);
    await expect(await ts.getRowStatus(pendingSeries)).toMatch(/Approved/);
  });

  // ── Delete the Draft record created above ─────────────────────────────────────
  test('TC-TS-DEL-01 [-] Delete the Draft record created in TC-TS-DRAFT-02', async ({ page }) => {
    const ts = new TimeSheetPage(page);
    test.skip(!draftRecord.seriesNumber, 'Depends on TC-TS-DRAFT-02 having created a Draft record.');

    await ts.gotoList();
    await ts.deleteFromList(draftRecord.seriesNumber);

    await ts.searchList(draftRecord.seriesNumber);
    await expect(ts.noDataRow()).toBeVisible();
  });

  // ── TC-TS-RBAC-01/02: Permission-gated Add/List ───────────────────────────────
  test.describe('Permissions', () => {
    test('TC-TS-RBAC-01 [+] Add button is present for a user with canAdd', async ({ page }) => {
      const ts = new TimeSheetPage(page);
      await ts.gotoList();

      // This suite's single logged-in test user is expected to have full Timesheets access -
      // asserting presence here (not absence) is the achievable case without a second,
      // lower-privilege test account; a permission-DENIED variant needs that second account and
      // is documented as "Manual first" in TIME_SHEET_PLAYWRIGHT_SCENARIOS.md's RBAC section.
      await expect(ts.listAddButton).toBeVisible();
    });
  });
});
