const SettingsEntityPage = require('../base/SettingsEntityPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Commission Assignment (Accounting > Commissions > Commission Assignment) - master data with no
 * approval workflow, same archetype as Commission Plan/Commission Target (View page has only an
 * "Actions" button, no Submit/Accept/Reject/status chip - confirmed live).
 * Source: erpforce-fe modules/accounting/src/views/commissions/commission-assignment/*
 * Routes confirmed against the running app:
 *   list  /dashboard/accounting/commissions/assignment
 *   add   /dashboard/accounting/commissions/add-commission-assignment
 * The API's own create endpoint is POST /accounting/v1/commission-assignment/ (singular, matches
 * the addPath's own last segment), response shaped `{ data: { commission_assignment: { id,
 * series_number, title, description, is_draft, ... } } }`.
 *
 * Extends SettingsEntityPage, same reasoning as CommissionPlanPage/CommissionTargetPage.
 *
 * Header field-array prefix is `commissionAssignment` (title, description) - same no-add_/edit_-
 * prefix pattern as the sibling Commission modules.
 *
 * The "Salesperson" section is a repeatable INLINE-EDITABLE table row (NOT a modal dialog like
 * most other item-entry patterns in this suite - confirmed live clicking its own "Add" button
 * appends a directly-editable row to the table itself). Each row's own fields are NOT prefixed by
 * the header's entityKey (confirmed live: `name="salesperson"`, `name="commission_plan"`,
 * `name="target"`, `name="start_date"`, `name="end_date"`, `name="allow_subordinate_commission"`
 * - bare field names).
 *
 * Confirmed against the running app - line item row fields:
 *   salesperson (Salesperson Name *, required, real dropdown of actual users e.g. "Dipen Modi"),
 *   commission_plan (Commission Plan *, required, real dropdown of actual Commission Plan
 *   records), target (Target - despite rendering with NO asterisk, confirmed live it's actually
 *   REQUIRED: leaving it blank shows its own "Target is required" inline error and blocks the
 *   row from confirming, a genuine label/validation mismatch in the app, not a hint that it's
 *   optional; real dropdown of actual Commission Target records e.g. "CMT-2025-000039" -
 *   cross-references that sibling module), start_date (Start Date *, required but auto-defaults
 *   to today and its own "Choose date" calendar-icon button disappears once Salesperson is
 *   selected - confirmed live via direct reproduction; do not attempt to set it manually) and
 *   end_date (End Date *, required, user-settable via its own
 *   calendar picker - the field that actually needs filling, the reverse of what its position
 *   next to Start Date might suggest), allow_subordinate_commission (optional checkbox).
 *
 * Both date fields use a MASKED text input (`type="text"`, placeholder "MM/DD/YYYY") that does
 * NOT reliably accept `.fill()` or raw keystrokes - confirmed live that both produced garbled/
 * wrong values (including one case where the field silently reverted to today's date). The
 * reliable method is the field's own calendar-icon button ("Choose date") + clicking a day
 * gridcell in the currently-displayed month - see fillLineItemStartDate().
 */
class CommissionAssignmentPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'commissionAssignment',
      listPath: '/dashboard/accounting/commissions/assignment',
      addPath: '/dashboard/accounting/commissions/add-commission-assignment',
      displayNameField: 'title',
    });

    this.addButton = page.getByRole('button', { name: /^Add$/i }).or(page.getByText(/^Add$/i)).first();
    // CONFIRMED LIVE: a plain `getByRole('button', { name: /^Save$/i })` also matches each
    // Salesperson row's own icon-only "Save" button (a floppy-disk MuiIconButton with
    // aria-label="Save") - `.last()` was picking that row-level icon button instead of the real
    // page-level Save button. That row-level button is NOT a decoy, though (unlike the Accept/
    // Reject split-button pattern elsewhere in this suite) - it's the required action that
    // commits a row's in-progress edits into the form's actual submitted data; skipping it left
    // the row LOOKING filled in the DOM while the underlying array stayed empty, so the page-level
    // Save always failed validation ("Please add atleast one salesperson") with zero network
    // requests fired. Icon buttons render an <svg> and no visible text; the real page-level Save
    // button doesn't, so exclude any match containing one here - see confirmLineItemRow() for the
    // row-level counterpart.
    this.saveButton = page.getByRole('button', { name: /^Save$/i }).filter({ hasNot: page.locator('svg') }).last();
    this.addLineItemButton = page.getByRole('button', { name: /^Add$/i }).last();
  }

  async fillTitle(value) {
    await this.fieldLocator('title').fill(String(value));
  }

  async fillDescription(value) {
    await this.fieldLocator('description').fill(String(value));
  }

  /** Appends a new, directly-editable row to the Salesperson table - not a modal. Returns the new row's own locator (the first/only row when called once). */
  async addLineItemRow() {
    await this.addLineItemButton.click();
    await this.page.waitForTimeout(1000);
    return this.page.locator('table tbody tr').first();
  }

  lineItemSelectTrigger(row, fieldFragment) {
    return row.locator(`[id*="mui-component-select-"][id*="${fieldFragment}"]`).first();
  }

  async selectLineItemSalesperson(row, name) {
    await selectDropdown(this.page, this.lineItemSelectTrigger(row, 'salesperson'), name, name);
  }

  async selectLineItemCommissionPlan(row, name) {
    await selectDropdown(this.page, this.lineItemSelectTrigger(row, 'commission_plan'), name, name);
  }

  /**
   * Despite rendering with no asterisk, this is actually REQUIRED (confirmed live: "Target is
   * required" blocks the row from confirming if left blank) - cross-references an existing
   * Commission Target record. Not marked `optional: true` since skipping it is never valid here.
   */
  async selectLineItemTarget(row, name) {
    await selectDropdown(this.page, this.lineItemSelectTrigger(row, 'target'), name, name);
  }

  /**
   * Confirmed live: Start Date auto-defaults to today once Salesperson is selected and its own
   * "Choose date" calendar-icon button disappears at that point (read-only helper, not a setter -
   * same auto-compute pattern CommissionTargetPage.js's own end_date documents, just on the
   * opposite field here).
   */
  async getLineItemStartDateValue(row) {
    return row.locator('input[name="start_date"]').first().inputValue();
  }

  /**
   * Sets End Date via the calendar picker (the masked text input doesn't reliably accept
   * `.fill()`/keystrokes - confirmed live both produced garbled/wrong values, including one case
   * where the field silently reverted to today's date). Picks `day` in whichever month is
   * currently displayed (defaults to the current month) - pass a day number that exists in that
   * month. Dismisses any lingering dropdown backdrop first (this row's own Salesperson/Commission
   * Plan/Target selects can leave one behind, blocking the calendar icon's click otherwise), and
   * explicitly closes the calendar popper afterward so it can't intercept a later Save click.
   */
  async fillLineItemEndDate(row, day) {
    const calendarBtn = row.locator('button[aria-label="Choose date"]').first();
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.mouse.click(2, 2);
    await this.page.waitForTimeout(300);
    await calendarBtn.click();
    await this.page.waitForTimeout(800);
    await this.page.getByRole('gridcell', { name: String(day), exact: true }).first().click();
    await this.page.waitForTimeout(500);
    // The MUI date-picker popper doesn't always fully unmount on its own after a day is picked -
    // confirmed live it can linger and intercept a subsequent Save click. Close it explicitly.
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.mouse.click(2, 2);
    await this.page.waitForTimeout(300);
  }

  async toggleAllowSubordinateCommission(row) {
    await row.locator('input[name="allow_subordinate_commission"]').first().click();
  }

  /**
   * Commits this row's in-progress edits into the form's actual submitted data - REQUIRED after
   * filling a row's fields, confirmed live: without this, the row still visually shows its
   * selected values but the page-level Save fails validation with "Please add atleast one
   * salesperson" (zero network requests fired) because the underlying array never received the
   * row. This is the row's own icon-only "Save" button (aria-label="Save", a floppy-disk icon) -
   * see the constructor's own comment on why this isn't the same button as `this.saveButton`.
   */
  async confirmLineItemRow(row) {
    await row.getByRole('button', { name: /^Save$/i }).first().click();
    await this.page.waitForTimeout(500);
  }

  /**
   * @param {{salesperson: string, commissionPlan: string, target?: string, endDateDay: number,
   *   allowSubordinateCommission?: boolean}} entry
   *   (no startDateDay - Start Date auto-defaults to today, see getLineItemStartDateValue())
   */
  async addLineItem({ salesperson, commissionPlan, target, endDateDay, allowSubordinateCommission } = {}) {
    const row = await this.addLineItemRow();
    if (salesperson) await this.selectLineItemSalesperson(row, salesperson);
    if (commissionPlan) await this.selectLineItemCommissionPlan(row, commissionPlan);
    if (target) await this.selectLineItemTarget(row, target);
    if (endDateDay !== undefined) await this.fillLineItemEndDate(row, endDateDay);
    if (allowSubordinateCommission) await this.toggleAllowSubordinateCommission(row);
    await this.confirmLineItemRow(row);
    return row;
  }

  /** @param {{title?: string, description?: string}} header */
  async fillHeader({ title, description } = {}) {
    if (title !== undefined) await this.fillTitle(title);
    if (description !== undefined) await this.fillDescription(description);
  }

  /** Plain Save click - used by Edit (a PUT request, not matched by saveAndCaptureId's POST filter). */
  async save() {
    await this.saveButton.click();
  }

  /** Create-only: captures `{ id, seriesNumber }` from the save response. */
  async saveAndCapture() {
    return this.saveAndCaptureId(this.saveButton, ['title'], 'commission-assignment');
  }

  /**
   * @param {object} header - see fillHeader()
   * @param {Array<object>} lineItems - see addLineItem()
   */
  async createCommissionAssignment(header, lineItems = []) {
    await this.openAdd();
    await this.fillHeader(header || {});
    for (const entry of lineItems) {
      await this.addLineItem(entry);
    }
  }
}

module.exports = CommissionAssignmentPage;
