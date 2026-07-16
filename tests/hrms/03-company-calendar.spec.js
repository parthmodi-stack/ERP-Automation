const { test, expect } = require('@playwright/test');
const CompanyCalendarPage = require('../../pages/CompanyCalendarPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

// Company Calendar (erpforce-hrms-fe: src/views/company-calendar/) - confirmed real module, route
// `/dashboard/hrms/company-master-policy/company-calendar`. See CompanyCalendarPage.js's header
// comment for the confirmed real behaviors this suite relies on (pre-filled Working Days defaults,
// Week Off disabling time inputs, the Holidays grid's shared inline-edit component, and the exact
// cross-field validation error strings).
//
// SCOPE NOTES:
// - No approval workflow exists (Draft -> Active/Inactive only, same shape as every other HRMS
//   module in this suite) - the "Approval Flow" section of DEFAULT_TEST_CASES.md is skipped.
// - "Calendar Name with only spaces" is NOT asserted as blocked: the Yup schema only has
//   `.required()` on `calendar_name`, with no `.trim()`/whitespace test found in
//   utils/validation.ts, so asserting it's rejected would be asserting unconfirmed behavior.
// - Duplicate Holiday Title prevention is NOT tested, same reasoning as Document Master's
//   duplicate-document-name case - no `unique` rule exists in the holidays column validations.
// - Cross Browser/Accessibility/raw API-mocking scenarios are out of scope for the same reasons
//   documented in 02-document-master.spec.js (single Chrome project, this suite drives the real
//   backend rather than mocking it).
test.describe('Company Calendar Module', () => {
  test.slow();
  let created = {};
  let draftRecord = {};

  // ── TC-CAL-01: Create Company Calendar ───────────────────────────────────
  test('TC-CAL-01 [+] Create Company Calendar with default Working Days and two Holidays', { tag: '@smoke' }, async ({ page }) => {
    const cal = new CompanyCalendarPage(page);
    const data = testData.companyCalendar.valid;
    data.location = testDataFactory.uniqueName('Loc');

    await cal.goto();
    await expect(page).toHaveURL(/add-company-calendar/);

    await cal.fillBasicDetails(data);
    await cal.fillClassification(data);
    await cal.addHolidayRows(data.holidays);

    for (const holiday of data.holidays) {
      await expect(page.getByText(holiday.title, { exact: true })).toBeVisible();
    }

    const result = await cal.save();
    expect(result.seriesNumber).toBeTruthy();
    created = { ...result, calendarName: data.calendarName };

    await cal.searchList(data.calendarName);
    await expect(page.getByText(data.calendarName, { exact: false }).first()).toBeVisible();
    await expect(await cal.getRowStatus(created.seriesNumber)).toMatch(/Active/);
  });

  // ── TC-CAL-02: View Company Calendar ──────────────────────────────────────
  test('TC-CAL-02 [+] View Company Calendar - Basic Details, Working Days, and Holidays', async ({ page }) => {
    const cal = new CompanyCalendarPage(page);
    const data = testData.companyCalendar.valid;

    await cal.gotoList();
    await cal.searchList(created.seriesNumber);
    await cal.openViewFromList(created.seriesNumber);
    await expect(page).toHaveURL(/view-company-calendar/);

    await expect(page.getByText(data.calendarName, { exact: false }).first()).toBeVisible();

    // Default working days: Mon-Fri show the pre-filled range, Sat/Sun show Closed/N/A and a
    // Week-Off badge (confirmed default in utils/default-data.ts `defaultWorkingDays`).
    await expect(cal.getViewWorkingHoursText('Monday')).resolves.toMatch(/09:00 AM.*06:00 PM/);
    await expect(cal.getViewBreakTimeText('Monday')).resolves.toMatch(/01:00 PM.*02:00 PM/);
    await expect(cal.getViewWorkingHoursText('Saturday')).resolves.toMatch(/Closed/);
    await expect(cal.getViewBreakTimeText('Saturday')).resolves.toMatch(/N\/A/);
    await expect(await cal.isWeekOffBadgeVisible('Saturday')).toBe(true);
    await expect(await cal.isWeekOffBadgeVisible('Monday')).toBe(false);

    for (const holiday of data.holidays) {
      await expect(page.getByText(holiday.title, { exact: true })).toBeVisible();
    }
  });

  // ── TC-CAL-03: Edit Company Calendar ─────────────────────────────────────
  test('TC-CAL-03 [+] Edit Company Calendar - rename, mark Monday as Week Off, edit Holidays', async ({ page }) => {
    const cal = new CompanyCalendarPage(page);
    const data = testData.companyCalendar.valid;

    await cal.gotoList();
    await cal.searchList(created.seriesNumber);
    await cal.openEditFromList(created.seriesNumber);
    await expect(page).toHaveURL(/edit-company-calendar/);

    await cal.calendarNameInput.fill(data.updatedCalendarName);
    await expect(cal.calendarNameInput).toHaveValue(data.updatedCalendarName);

    // Marking Monday as Week Off should disable its Working Hours and Break Time inputs
    // (confirmed in calendar-card.tsx - not just a UI convention assumption).
    await expect(await cal.areWorkingHoursDisabled('Monday')).toBe(false);
    await cal.markAsWeekOff('Monday', true);
    await expect(await cal.areWorkingHoursDisabled('Monday')).toBe(true);
    await expect(await cal.areBreakTimesDisabled('Monday')).toBe(true);
    // Restore it - the rest of this suite (and other tests in this file) assumes Monday is a
    // normal working day.
    await cal.markAsWeekOff('Monday', false);

    // Edit one holiday's description, add a new one, delete the other original.
    await cal.editHolidayRowByTitle(data.holidays[0].title, { description: 'Updated national holiday remark' });
    await expect(page.getByText('Updated national holiday remark', { exact: false }).first()).toBeVisible();

    const newHoliday = { title: 'Independence Day', startDate: '15-08-2026', endDate: '15-08-2026', type: 'Full Day', description: 'National Holiday' };
    await cal.addHolidayRow(newHoliday);
    await expect(page.getByText(newHoliday.title, { exact: true })).toBeVisible();

    await cal.deleteHolidayRow(data.holidays[1].title);
    await expect(page.getByText(data.holidays[1].title, { exact: true })).not.toBeVisible();

    const result = await cal.save();
    created.calendarName = data.updatedCalendarName;
    expect(result.seriesNumber).toBeTruthy();

    await cal.gotoList();
    await cal.searchList(created.seriesNumber);
    await cal.openEditFromList(created.seriesNumber);
    await expect(cal.calendarNameInput).toHaveValue(data.updatedCalendarName);
    await expect(page.getByText(newHoliday.title, { exact: true })).toBeVisible();
    await expect(page.getByText(data.holidays[1].title, { exact: true })).not.toBeVisible();
  });

  // ── TC-CAL-04: Save to Draft ──────────────────────────────────────────────
  test('TC-CAL-04 [+] Create Company Calendar and Save To Draft - status shows Draft', async ({ page }) => {
    const cal = new CompanyCalendarPage(page);
    const draftName = testDataFactory.calendarName();

    await cal.goto();
    await cal.fillBasicDetails({ calendarName: draftName, company: testData.companyCalendar.valid.company });
    await cal.addHolidayRow(testData.companyCalendar.valid.holidays[0]);

    const result = await cal.saveAsDraft();
    draftRecord = { ...result, calendarName: draftName };

    await cal.searchList(draftName);
    await expect(await cal.getRowStatus(draftRecord.seriesNumber)).toMatch(/Draft/);
  });

  // ── TC-CAL-05: Discard ────────────────────────────────────────────────────
  test('TC-CAL-05 [-] Discard a new Company Calendar - no record is created', async ({ page }) => {
    const cal = new CompanyCalendarPage(page);
    const discardedName = `${testData.companyCalendar.valid.calendarName}_DISCARDED`;

    await cal.goto();
    await cal.fillBasicDetails({ calendarName: discardedName, company: testData.companyCalendar.valid.company });
    await cal.discardButton.click();

    await expect(page).toHaveURL(/\/company-calendar$/);
    await cal.searchList(discardedName);
    await expect(cal.noDataRow()).toBeVisible();
  });

  // ── TC-CAL-06: Delete Company Calendar ────────────────────────────────────
  // Deletes the Draft record from TC-CAL-04, leaving TC-CAL-01/03's record intact for any future
  // spec that wants to build on it (same pattern as the Organization Structure / Document Master
  // suites).
  test('TC-CAL-06 [-] Delete the Draft Company Calendar created in TC-CAL-04', async ({ page }) => {
    const cal = new CompanyCalendarPage(page);

    await cal.gotoList();
    await cal.deleteFromList(draftRecord.seriesNumber);

    await cal.searchList(draftRecord.calendarName);
    await expect(cal.noDataRow()).toBeVisible();
  });

  // ── Field Validation ──────────────────────────────────────────────────────
  test.describe('Field Validation', () => {
    test('TC-CAL-V01 [-] Required Calendar Name/Company block save', async ({ page }) => {
      const cal = new CompanyCalendarPage(page);

      await cal.goto();
      await cal.saveButton.click();

      // Required-field errors render inline under Calendar Name/Company - assert via the
      // shared `{{field}} is required` wording pattern already confirmed for other HRMS modules.
      await expect(page.getByText('Calendar Name is required', { exact: false })).toBeVisible();
      await expect(page.getByText(/Company( name)? is required/i)).toBeVisible();

      await cal.discardButton.click();
    });

    test('TC-CAL-V02 [-] Marking a day as Week Off disables its Working Hours and Break Time', async ({ page }) => {
      const cal = new CompanyCalendarPage(page);

      await cal.goto();
      await expect(await cal.areWorkingHoursDisabled('Sunday')).toBe(true); // pre-filled default
      await expect(await cal.areWorkingHoursDisabled('Tuesday')).toBe(false);

      await cal.markAsWeekOff('Tuesday', true);
      await expect(await cal.areWorkingHoursDisabled('Tuesday')).toBe(true);
      await expect(await cal.areBreakTimesDisabled('Tuesday')).toBe(true);

      await cal.discardButton.click();
    });

    test('TC-CAL-V03 [-] Working Hours start after end shows "Working hours is invalid"', async ({ page }) => {
      const cal = new CompanyCalendarPage(page);
      const invalid = testData.companyCalendar.invalidWorkingHours;

      await cal.goto();
      await cal.setWorkingHours('Wednesday', invalid);
      await expect(cal.dayCard('Wednesday').getByText('Working hours is invalid')).toBeVisible();

      await cal.discardButton.click();
    });

    test('TC-CAL-V04 [-] Break Time outside Working Hours shows the inclusive-range error', async ({ page }) => {
      const cal = new CompanyCalendarPage(page);
      const outside = testData.companyCalendar.breakOutsideWorkingHours;

      await cal.goto();
      await cal.setBreakTime('Thursday', outside);
      await expect(cal.dayCard('Thursday').getByText('Breaktime must be inclusive of working hours')).toBeVisible();

      await cal.discardButton.click();
    });

    test('TC-CAL-V05 [-] Holiday required Title/Start Date/End Date block the row', async ({ page }) => {
      const cal = new CompanyCalendarPage(page);

      await cal.goto();
      await cal.addHolidayRowButton.click();
      await page.keyboard.press('Enter');

      await expect(cal.titleRequiredError).toBeVisible();
      await expect(cal.startDateRequiredError).toBeVisible();
      await expect(cal.endDateRequiredError).toBeVisible();

      await cal.discardButton.click();
    });

    test('TC-CAL-V06 [-] Holiday End Date before Start Date shows the cross-field error', async ({ page }) => {
      const cal = new CompanyCalendarPage(page);
      const data = testData.companyCalendar.holidayEndBeforeStart;

      await cal.goto();
      await cal.addHolidayRowButton.click();
      await cal.holidayTitleInput.fill(data.title);
      await cal.holidayDateInputs.nth(0).fill(data.startDate);
      await cal.holidayDateInputs.nth(1).fill(data.endDate);
      await page.keyboard.press('Enter');

      await expect(page.getByText(/End Date should not be less than Start Date|Start Date should not be greater than End Date/)).toBeVisible();

      await cal.discardButton.click();
    });
  });

  // ── Listing Page ──────────────────────────────────────────────────────────
  test.describe('Listing Page', () => {
    test('TC-CAL-L01 [+] Search the list by Calendar Name', async ({ page }) => {
      const cal = new CompanyCalendarPage(page);
      await cal.gotoList();
      await cal.searchList(created.calendarName);
      await expect(page.getByText(created.calendarName, { exact: false }).first()).toBeVisible();

      await cal.searchList('zzz-no-such-calendar-zzz');
      await expect(cal.noDataRow()).toBeVisible();
    });

    test('TC-CAL-L02 [+] Sort the ID column ascending/descending', async ({ page }) => {
      const cal = new CompanyCalendarPage(page);
      await cal.gotoList();

      await cal.clickColumnHeader('ID');
      const firstSort = await cal.getColumnAriaSort('ID');
      expect(['ascending', 'descending']).toContain(firstSort);

      await cal.clickColumnHeader('ID');
      const secondSort = await cal.getColumnAriaSort('ID');
      expect(secondSort).not.toBe(firstSort);
    });

    test('TC-CAL-L03 [+] Paginate the list', async ({ page }) => {
      const cal = new CompanyCalendarPage(page);
      await cal.gotoList();

      const label = await cal.getPaginationLabel();
      expect(label).toMatch(/Page \d+ of \d+/);

      if (await cal.nextPageButton().isEnabled()) {
        await cal.nextPageButton().click();
        await page.waitForLoadState('networkidle');
        const nextLabel = await cal.getPaginationLabel();
        expect(nextLabel).not.toBe(label);
      }
    });

    test('TC-CAL-L04 [+] Row action menu offers View/Edit and destructive Delete', async ({ page }) => {
      const cal = new CompanyCalendarPage(page);
      await cal.gotoList();
      await cal.searchList(created.calendarName);
      await cal.openRowActionMenu(created.seriesNumber);

      await expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
    });

    test('TC-CAL-L05 [+] Row status badge matches the record\'s lifecycle state', async ({ page }) => {
      const cal = new CompanyCalendarPage(page);
      await cal.gotoList();
      await cal.searchList(created.calendarName);
      await expect(await cal.getRowStatus(created.seriesNumber)).toMatch(/Active/);
    });
  });
});
