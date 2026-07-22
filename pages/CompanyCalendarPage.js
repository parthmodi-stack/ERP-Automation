const BasePage = require('./BasePage');

// Company Calendar (erpforce-hrms-fe: src/views/company-calendar/) - a flat Add/Edit form (ID +
// Calendar Name + Company dropdown), a "Working Days" section with one CalendarCard per weekday
// (Mon-Sun), a repeatable Holidays grid (same MaterialEditableTable family as Document Master's
// Documents grid - see that page object's header comment for the shared inline-edit/Enter-to-
// commit model), and a Classification section (Location/Department dropdowns).
//
// Confirmed real behavior worth knowing before extending this file:
//   - New Add forms come pre-filled with Mon-Fri 09:00-18:00 working hours / 13:00-14:00 break,
//     and Sat/Sun already marked as Week Off (utils/default-data.ts `defaultWorkingDays`) - so a
//     "default" calendar needs NO working-day input at all, only Calendar Name + Company + at
//     least one holiday (the grid is required, min 1, per validation.ts / server schema).
//   - "Mark as Week Off" DOES disable that day's 4 time inputs client-side (calendar-card.tsx:
//     `disabled={Boolean(currentDay?.[IS_WEEK_OFF])}` on all 4 DynamicTime fields) - confirmed in
//     source, not guessed.
//   - View mode shows "Closed" for an empty Working Hours time and "N/A" for an empty Break Time,
//     and a "Week-Off" badge next to the day name when `is_week_off === 1` (calendar-card.tsx).
//   - Same-day cross-field time validation is NOT part of the Yup schema - it's imperative state
//     in calendar-card.tsx with these exact messages: "Working hours is invalid", "Breaktime is
//     invalid", "Breaktime must be inclusive of working hours".
//   - Holiday Type is a SELECT with exactly two options - "Full Day" / "Half Day" - not free text,
//     and not the "Multiple Days" wording sometimes used informally for a holiday spanning several
//     calendar days (which is still just "Full Day" or "Half Day" per row; only Start/End Date
//     span multiple days).
//   - Time inputs (DynamicTime, placeholder "HH:mm aa") don't get a `label`/`name` DOM attribute
//     forwarded per calendar-card.tsx's actual props - they're located structurally (scoped to a
//     day's card + row), not by label/name, unlike Calendar Name (uses MUI TextField's real
//     `label` prop, so `getByLabel` works for it).
//   - Location/Department (Classification) are BOTH optional - validation.ts has no rule for
//     either - and single-select (DynamicDependentField, not multi-select), confirmed in form.tsx.
//   - The View page has its own "Actions" button + Menu (Edit/Delete, gated by canEdit/canDelete),
//     separate from the list row's "..." menu - view-calendar.hrms.tsx.
//   - The View page's left Summary panel (summary.tsx) shows only ID/Calendar Name/Company Name
//     plus a "Activity" tab - no working-days/holiday counts despite the module having them.
//   - Calendar Name has no max-length/regex/uniqueness rule in validation.ts, and no per-field
//     save-in-flight disable exists on the Save button - so length-limit, special-character-
//     rejection, and duplicate-save-prevention scenarios would be asserting behavior the app does
//     not implement.
class CompanyCalendarPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.listAddButton = page.getByRole('button', { name: 'Add' }).first();

    // Basic Details - Calendar Name input does not have a correctly associated label element,
    // so locate it using its translation key placeholder.
    this.calendarNameInput = page.getByPlaceholder('hrms.company_calendar.fields.calendar_name_placeholder');
    this.companyField = 'Company name'; // exact label casing from translations/hrms.json - lowercase "name"
    this.locationField = 'Location';
    this.departmentField = 'Department';

    // Holidays grid (shared MaterialEditableTable, same interaction model as Document Master's
    // Documents grid: inline row edit, Enter-to-commit, no visible per-row Save button).
    this.addHolidayRowButton = page.locator('.add-row-btn');
    this.holidayTitleInput = page.locator('input[name="title"]');
    this.holidayDescriptionInput = page.locator('input[name="description"]');
    this.holidayDateInputs = page.getByPlaceholder('DD-MM-YYYY');

    this.titleRequiredError = page.getByText('Title is required');
    this.startDateRequiredError = page.getByText('Start Date is required');
    this.endDateRequiredError = page.getByText('End Date is required');
    this.startAfterEndError = page.getByText('Start Date should not be greater than End Date');
    this.endBeforeStartError = page.getByText('End Date should not be less than Start Date');

    this.discardButton = page.getByRole('button', { name: 'Discard' });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    this.viewActionsButton = page.getByRole('button', { name: 'Actions' });
  }

  async gotoList() {
    await this.page.goto('/dashboard/hrms/company-master-policy/company-calendar');
    await this.page.waitForLoadState('load');
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  async goto() {
    await this.gotoList();
    await this.listAddButton.click();
    await this.page.waitForURL('**/add-company-calendar');
    await this.page.waitForLoadState('load');
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  async fillBasicDetails({ calendarName, company }) {
    if (calendarName !== undefined) {
      await this.calendarNameInput.fill(calendarName);
    }
    if (company) {
      await this.selectFieldByLabel(this.companyField, company, { exact: false });
    }
  }


  async fillClassification({ location, department, company } = {}) {
    if (location) {
      await this.createLocationFromFooter(location, company || 'erp-force');
    }
    if (department) {
      await this.selectFieldByLabel(this.departmentField, department, { exact: false });
    }
  }

  // Location (and Department) on this Classification section is a `DynamicDependentField`,
  // which defaults `enable_footer` to `true` when the consumer doesn't override it (confirmed in
  // @erpsquad/common's compiled source - form.tsx's usage here passes no `enable_footer` prop at
  // all, so the default applies). That footer renders a "Create New Location" item which opens
  // `LocationAddModal` - a SEPARATE, smaller modal than the full standalone Location module
  // (pages/LocationPage.js): just Name/Short Code/Company, posting to the same
  // `postV1WarehouseLocation` endpoint. `createLocationFromFooter` itself now lives on BasePage
  // (shared across every page object, not just this one) - see BasePage.js.

  // ---------- Working Days (per-day-card scoping) ----------
  dayCard(dayName) {
    return this.page.locator('.calendarCard').filter({ hasText: dayName });
  }

  workingHoursRow(dayName) {
    return this.dayCard(dayName).locator('.calendarCard--row').filter({ hasText: 'Working Hours' });
  }

  breaktimeRow(dayName) {
    return this.dayCard(dayName).locator('.calendarCard--row').filter({ hasText: 'Breaktime' });
  }

  weekOffCheckbox(dayName) {
    return this.dayCard(dayName).locator('.calendarCard--week-off-checkbox').getByRole('checkbox');
  }

  async setWorkingHours(dayName, { start, end }) {
    const inputs = this.workingHoursRow(dayName).getByPlaceholder('HH:mm aa');
    if (start !== undefined) await inputs.nth(0).fill(start);
    if (end !== undefined) await inputs.nth(1).fill(end);
  }

  async setBreakTime(dayName, { start, end }) {
    const inputs = this.breaktimeRow(dayName).getByPlaceholder('HH:mm aa');
    if (start !== undefined) await inputs.nth(0).fill(start);
    if (end !== undefined) await inputs.nth(1).fill(end);
  }

  async markAsWeekOff(dayName, checked = true) {
    const checkbox = this.weekOffCheckbox(dayName);
    const isChecked = await checkbox.isChecked();
    if (isChecked !== checked) {
      await checkbox.click();
    }
  }

  async areWorkingHoursDisabled(dayName) {
    const inputs = this.workingHoursRow(dayName).getByPlaceholder('HH:mm aa');
    return (await inputs.nth(0).isDisabled()) && (await inputs.nth(1).isDisabled());
  }

  async areBreakTimesDisabled(dayName) {
    const inputs = this.breaktimeRow(dayName).getByPlaceholder('HH:mm aa');
    return (await inputs.nth(0).isDisabled()) && (await inputs.nth(1).isDisabled());
  }

  // View-mode text for a day's Working Hours / Breaktime range - reads "Closed"/"N/A" or the
  // formatted time range rendered by calendar-card.tsx's `mode === 'view'` branch.
  async getViewWorkingHoursText(dayName) {
    return (await this.workingHoursRow(dayName).locator('.calendarCard--time-range-view').innerText()).replace(/\s+/g, ' ').trim();
  }

  async getViewBreakTimeText(dayName) {
    return (await this.breaktimeRow(dayName).locator('.calendarCard--time-range-view').innerText()).replace(/\s+/g, ' ').trim();
  }

  async isWeekOffBadgeVisible(dayName) {
    return this.dayCard(dayName).getByText('Week-Off', { exact: true }).isVisible();
  }

  // ---------- Holidays grid ----------
  async addHolidayRow({ title, startDate, endDate, type, description }) {
    await this.addHolidayRowButton.click();
    if (title !== undefined) {
      await this.holidayTitleInput.fill(title);
    }
    if (startDate !== undefined) {
      await this.holidayDateInputs.nth(0).fill(startDate);
    }
    if (endDate !== undefined) {
      await this.holidayDateInputs.nth(1).fill(endDate);
    }
    if (type) {
      await this.openDropdownAndPick('Select Type', type);
    }
    if (description !== undefined) {
      await this.holidayDescriptionInput.fill(description);
    }
    await this.page.keyboard.press('Enter');
  }

  async addHolidayRows(holidays) {
    for (const holiday of holidays) {
      await this.addHolidayRow(holiday);
    }
  }

  async editHolidayRowByTitle(existingTitle, updates = {}) {
    const row = this.page.locator('tr', { has: this.page.getByText(existingTitle, { exact: true }) });
    await row.locator('td').nth(1).click();

    if (updates.title !== undefined) {
      await this.holidayTitleInput.fill(updates.title);
    }
    if (updates.description !== undefined) {
      await this.holidayDescriptionInput.fill(updates.description);
    }
    await this.page.keyboard.press('Enter');
  }

  async deleteHolidayRow(title) {
    const row = this.page.locator('tr', { has: this.page.getByText(title, { exact: true }) });
    await row.locator('.delete-row').click();
    await this.confirmDelete();
  }

  // ---------- Save actions ----------
  // Same reasoning as DocumentMasterPage.saveAndCaptureId - capture the just-created/updated
  // record from the list's own refetch JSON. List response shape per redux/actionCreators.ts:
  // `{ data: { company_calendar: [...] } }`.
  async saveAndCaptureId(buttonLocator) {
    const listResponsePromise = this.page.waitForResponse((r) =>
      r.url().includes('company-calendar') && r.request().method() === 'GET',
    );
    await buttonLocator.click();
    const listResponse = await listResponsePromise;
    await this.page.waitForLoadState('networkidle');
    const body = await listResponse.json().catch(() => null);
    const record = body?.data?.company_calendar?.[0];

    const id = record?.id !== undefined ? String(record.id) : undefined;
    let seriesNumber = record?.series_number;
    if (!seriesNumber) {
      seriesNumber = await this.page.locator('table tbody tr').first().innerText();
    }
    return { id, seriesNumber };
  }

  async save() {
    return this.saveAndCaptureId(this.saveButton);
  }

  async saveAsDraft() {
    return this.saveAndCaptureId(this.saveToDraftButton);
  }

  // ---------- Row status / navigation ----------
  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Draft|Active|Inactive/);
  }

  async openEditFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await this.page.waitForURL('**/edit-company-calendar');
    await this.page.waitForLoadState('load');
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  async openViewFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'View', exact: true }).click();
    await this.page.waitForURL('**/view-company-calendar');
    await this.page.waitForLoadState('load');
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  // ---------- View page: Actions menu / status badge ----------
  // View page has its OWN "Actions" button/menu (view-calendar.hrms.tsx) distinct from the list
  // row's "..." menu - same Edit/Delete MenuItem labels, gated by canEdit/canDelete permissions.
  async openViewActionsMenu() {
    await this.viewActionsButton.click();
  }

  async openEditFromView() {
    await this.openViewActionsMenu();
    await this.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await this.page.waitForURL('**/edit-company-calendar');
    await this.page.waitForLoadState('load');
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  // Status Chip in the View page's breadcrumb - class is literally
  // `viewCalendarEntry--StatusChip--Draft`/`--Active` (view-calendar.hrms.tsx breadCrumbPath).
  viewStatusBadge() {
    return this.page.locator('[class*="viewCalendarEntry--StatusChip--"]').first();
  }
}

module.exports = CompanyCalendarPage;
