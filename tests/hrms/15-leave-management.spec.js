const { test, expect } = require('@playwright/test');
const LeaveManagementPage = require('../../pages/LeaveManagementPage');
const LoginPage = require('../../pages/LoginPage');
const testData = require('../../config/testData');

const { employee } = testData.leaveManagement.users;
const { valid, negative } = testData.leaveManagement;

// Formats a JS Date as DD-MM-YYYY, matching this form's DynamicDate placeholder/mask (see
// leave-management/utils/constants.ts FIELDS.START_DATE/END_DATE.placeholder).
function formatDdMmYyyy(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${date.getFullYear()}`;
}

function daysFromToday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

// A wide, randomized day offset - CONFIRMED LIVE that the backend rejects a real Save (not
// Save-to-Draft) with "Leave request already exists for date range" against ANY prior leave for
// the same category whose range overlaps, even a Cancelled/Draft one from an earlier test run.
// Fixed offsets (e.g. always "+30 days") collide across repeated runs of this suite against this
// shared, cumulative dev dataset - a wide random spread makes that collision negligible.
function randomOffset(min = 100, max = 3000) {
  return min + Math.floor(Math.random() * (max - min));
}

// Leave Management (employee "apply for my own leave" module) - runs as a single real login,
// Kashyap Jivani, in a FRESH context (storageState reset) since the shared auth.json session
// from global-setup.js is logged in as Dipen Modi (the admin/approver account used by every other
// suite in this repo by default).
//
// Leave Type is pinned to "Sick Leave" throughout (testData.leaveManagement.valid.leaveType) -
// CONFIRMED LIVE that "Casual Leave" (whatever renders first in this account's dropdown) is
// rejected server-side with a 400 on any real Save: "Employee is no longer eligible for this
// leave type... employee_contracts.probation_period does not meet criteria." Save-as-Draft
// bypasses that eligibility check entirely, so a Casual Leave Draft "works" right up until any
// real Save is attempted - see config/testData.js's own comment for the full finding.
test.describe.serial('Leave Management - CRUD, Validation, Cancel, Listing', () => {
  test.describe.configure({ timeout: 150000 });

  let page;
  let loginPage;
  let leaveManagementPage;

  // Captured from TC-LM-01, reused across the rest of this file. This record is deliberately
  // NEVER put through a real Edit-Save (see TC-LM-02's own comment for why that's currently
  // broken) so it stays a genuine Draft all the way to TC-LM-13's cleanup.
  let draftId;
  let draftSeriesNumber;
  // Captured from TC-LM-09, reused by TC-LM-10/11.
  let pendingId;
  let pendingSeriesNumber;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    page = await context.newPage();
    loginPage = new LoginPage(page);
    leaveManagementPage = new LeaveManagementPage(page);

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(employee.email, employee.password);
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test('TC-LM-01 [+] Create a leave and Save To Draft', async () => {
    const base = randomOffset();
    const startDate = daysFromToday(base);
    const endDate = daysFromToday(base + 2);

    await leaveManagementPage.gotoAdd();
    await leaveManagementPage.fillForm({
      leaveType: valid.leaveType,
      duration: 'Full Day',
      startDate: formatDdMmYyyy(startDate),
      endDate: formatDdMmYyyy(endDate),
      leaveReason: valid.leaveReason,
    });

    const noOfDays = await leaveManagementPage.getNoOfDaysValue();
    expect(Number(noOfDays)).toBe(3); // (end - start in days) + 1, per form.tsx's calculation useEffect

    const captured = await leaveManagementPage.saveAsDraft();
    draftId = captured.id;
    draftSeriesNumber = captured.seriesNumber;
    expect(draftId, 'Save To Draft should return a captured leave id').toBeTruthy();

    const status = await leaveManagementPage.getRowStatus(draftSeriesNumber);
    expect(status).toMatch(/Draft/i);
  });

  test('TC-LM-03 [+] View page displays previously saved data correctly', async () => {
    expect(draftSeriesNumber, 'TC-LM-01 must run first').toBeTruthy();

    // Navigate via the listing row (matched by the unique, human-readable series number) rather
    // than gotoViewById(draftId) - the numeric `id` captured from the list's own refetch JSON
    // assumes its first entry is the just-created record, which is not reliable against this
    // shared, actively-used dev dataset (see DEFAULT_TEST_CASES.md's own "never assume first row"
    // caution). The series-number-based row match is unique and authoritative regardless of sort
    // order, so this is the trustworthy path.
    await leaveManagementPage.gotoList();
    await leaveManagementPage.openViewFromList(draftSeriesNumber);

    // Sanity-check the captured draftId against the URL the app itself navigated to, so any
    // future direct-by-id navigation (e.g. the approver-side dual-login suite) can trust it.
    expect(page.url()).toContain(`/${draftId}/view-leave-management`);

    const idOnView = await leaveManagementPage.getFieldValueOnView('ID');
    expect(idOnView).toBe(draftSeriesNumber);

    const reasonOnView = await leaveManagementPage.getFieldValueOnView('Leave Reason');
    expect(reasonOnView).toBe(valid.leaveReason);

    const leaveTypeOnView = await leaveManagementPage.getFieldValueOnView('Leave Type');
    expect(leaveTypeOnView).toBe(valid.leaveType);
  });

  test('TC-LM-04 [-] Known gap: View page Duration shows a computed day-count, not "Full Day"/"Half Day"', async () => {
    test.fail(
      true,
      'Known gap: view-leave-management.hrms.tsx getValue() has a `name === "duration"` branch that ' +
        're-derives end_date.diff(start_date, "day") + 1 instead of returning the literal duration text ' +
        '- CONFIRMED LIVE in this exact deployment (View Leave Management shows "1" for a 1-day Sick ' +
        'Leave instead of "Full Day").',
    );

    expect(draftSeriesNumber, 'TC-LM-01 must run first').toBeTruthy();
    await leaveManagementPage.gotoList();
    await leaveManagementPage.openViewFromList(draftSeriesNumber);

    const durationOnView = await leaveManagementPage.getFieldValueOnView('Duration');
    expect(durationOnView).toBe('Full Day');
  });

  test('TC-LM-05 [-] Required field validation blocks Save when Leave Type/Duration/Start/End Date are empty', async () => {
    await leaveManagementPage.gotoAdd();
    await leaveManagementPage.saveButton.click();

    await expect(leaveManagementPage.requiredError('Leave Type')).toBeVisible();
    await expect(leaveManagementPage.requiredError('Duration')).toBeVisible();
    await expect(leaveManagementPage.requiredError('Start Date')).toBeVisible();
    await expect(leaveManagementPage.requiredError('End Date')).toBeVisible();
  });

  test('TC-LM-06 [+] Leave Reason has no required-field validation - an empty reason still saves', async () => {
    const singleDay = randomOffset();
    const startDate = daysFromToday(singleDay);
    const endDate = daysFromToday(singleDay);

    await leaveManagementPage.gotoAdd();
    await leaveManagementPage.fillForm({
      leaveType: valid.leaveType,
      duration: 'Full Day',
      startDate: formatDdMmYyyy(startDate),
      endDate: formatDdMmYyyy(endDate),
      // leaveReason intentionally omitted
    });

    const { seriesNumber } = await leaveManagementPage.saveAsDraft();
    expect(seriesNumber, 'saving with an empty Leave Reason should still succeed').toBeTruthy();

    await leaveManagementPage.gotoList();
    await leaveManagementPage.deleteFromList(seriesNumber); // cleanup - this record isn't reused later
  });

  test('TC-LM-07 [+] XSS/SQL injection payload in Leave Reason is stored as inert text, not executed', async () => {
    const xssDay = randomOffset();
    const startDate = daysFromToday(xssDay);
    const endDate = daysFromToday(xssDay);
    const payload = `${negative.xssReason} ${negative.sqlInjectionReason}`;

    await leaveManagementPage.gotoAdd();
    await leaveManagementPage.fillForm({
      leaveType: valid.leaveType,
      duration: 'Full Day',
      startDate: formatDdMmYyyy(startDate),
      endDate: formatDdMmYyyy(endDate),
      leaveReason: payload,
    });
    const { seriesNumber } = await leaveManagementPage.saveAsDraft();

    // Scoped tightly around the ONE navigation that actually renders the injected payload as page
    // content - registering this any earlier risks a false positive from an unrelated native
    // dialog (e.g. a "leave site, unsaved changes?" prompt during an unrelated retried navigation
    // elsewhere in this same test), which would wrongly read as "XSS executed".
    let dialogFired = false;
    page.once('dialog', (dialog) => {
      dialogFired = true;
      dialog.dismiss();
    });
    await leaveManagementPage.openViewFromList(seriesNumber);
    expect(dialogFired, 'an XSS payload must never trigger a real browser dialog').toBe(false);

    const reasonOnView = await leaveManagementPage.getFieldValueOnView('Leave Reason');
    expect(reasonOnView).toContain('<script>alert(1)</script>');

    await leaveManagementPage.gotoList();
    await leaveManagementPage.deleteFromList(seriesNumber); // cleanup
  });

  test('TC-LM-08 [-] Known gap: Half Day duration does not reduce No. Of Days to 0.5', async () => {
    test.fail(
      true,
      'Known gap: leave-management/form/form.tsx\'s No. Of Days useEffect only computes ' +
        '(end - start in days) + 1 - it has no branch at all for Duration === "Half Day".',
    );

    const sameDay = daysFromToday(randomOffset());

    await leaveManagementPage.gotoAdd();
    await leaveManagementPage.fillForm({
      leaveType: valid.leaveType,
      duration: 'Half Day',
      startDate: formatDdMmYyyy(sameDay),
      endDate: formatDdMmYyyy(sameDay),
      leaveReason: valid.leaveReason,
    });

    const noOfDays = await leaveManagementPage.getNoOfDaysValue();
    expect(Number(noOfDays)).toBe(0.5);
  });

  test('TC-LM-09 [+] Full Save (not draft) creates the leave with Pending status', async () => {
    const pendingBase = randomOffset();
    const startDate = daysFromToday(pendingBase);
    const endDate = daysFromToday(pendingBase + 1);

    await leaveManagementPage.gotoAdd();
    await leaveManagementPage.fillForm({
      leaveType: valid.leaveType,
      duration: 'Full Day',
      startDate: formatDdMmYyyy(startDate),
      endDate: formatDdMmYyyy(endDate),
      leaveReason: valid.leaveReason,
    });

    const captured = await leaveManagementPage.save();
    pendingId = captured.id;
    pendingSeriesNumber = captured.seriesNumber;
    expect(pendingId, 'Save should return a captured leave id').toBeTruthy();

    const status = await leaveManagementPage.getRowStatus(pendingSeriesNumber);
    expect(status).toMatch(/Pending/i);
  });

  test('TC-LM-10 [+] Cancel a Pending leave via the listing menu', async () => {
    expect(pendingSeriesNumber, 'TC-LM-09 must run first').toBeTruthy();

    await leaveManagementPage.gotoList();
    await leaveManagementPage.cancelFromList(pendingSeriesNumber);

    const status = await leaveManagementPage.getRowStatus(pendingSeriesNumber);
    expect(status).toMatch(/Cancelled/i);
  });

  test('TC-LM-11 [-] Row menu Edit/Cancel are disabled for an already-Cancelled leave', async () => {
    expect(pendingSeriesNumber, 'TC-LM-09/10 must run first').toBeTruthy();

    await leaveManagementPage.gotoList();
    const editDisabled = await leaveManagementPage.isRowActionDisabled(pendingSeriesNumber, 'Edit');
    expect(editDisabled).toBe(true);

    const cancelDisabled = await leaveManagementPage.isRowActionDisabled(pendingSeriesNumber, 'Cancel');
    expect(cancelDisabled).toBe(true);
  });

  test('TC-LM-L01 [+] Search finds the created record by its series number', async () => {
    expect(draftSeriesNumber, 'TC-LM-01 must run first').toBeTruthy();

    await leaveManagementPage.gotoList();
    await leaveManagementPage.searchList(draftSeriesNumber);

    await expect(leaveManagementPage.rowBySeriesNumber(draftSeriesNumber)).toBeVisible();
    await leaveManagementPage.clearSearch();
  });

  test('TC-LM-12 [+] Row menu Edit is enabled for a Draft leave', async () => {
    expect(draftSeriesNumber, 'TC-LM-01 must run first').toBeTruthy();

    await leaveManagementPage.gotoList();
    const editDisabled = await leaveManagementPage.isRowActionDisabled(draftSeriesNumber, 'Edit');
    expect(editDisabled).toBe(false);
  });

  test('TC-LM-13 [+] Delete the Draft record', async () => {
    expect(draftSeriesNumber, 'TC-LM-01 must run first').toBeTruthy();

    await leaveManagementPage.gotoList();
    await leaveManagementPage.deleteFromList(draftSeriesNumber);

    await leaveManagementPage.searchList(draftSeriesNumber);
    await expect(leaveManagementPage.rowBySeriesNumber(draftSeriesNumber)).toHaveCount(0);
    await leaveManagementPage.clearSearch();
  });
});
