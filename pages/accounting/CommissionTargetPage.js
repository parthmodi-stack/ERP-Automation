const SettingsEntityPage = require('../base/SettingsEntityPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Commission Target (Accounting > Commissions > Target) - master data with no approval workflow
 * (View page has only an "Actions" button, no Submit/Accept/Reject/status chip - confirmed live).
 * Source: erpforce-fe modules/accounting/src/views/commissions/target/*
 * Routes confirmed against the running app - NOTE the view path shape doesn't share ANY segment
 * with list/add beyond "commissions" (not just a singular/plural mismatch like Asset Transfer's
 * own asset-transfer/assets-transfer split - confirmed live, don't assume one from the others):
 *   list  /dashboard/accounting/commissions/target
 *   add   /dashboard/accounting/commissions/add-commission-target
 *   view  /dashboard/accounting/commissions/:id/view-commission-target
 * The API's own create endpoint is plural: POST /accounting/v1/commission-targets/.
 *
 * Extends SettingsEntityPage (not AccountingDocumentPage), same reasoning as CommissionPlanPage.
 *
 * Field-array prefix is `commissionTarget` (no add_/edit_ prefix, same pattern as
 * CommissionPlanPage's own `commissionPlan`).
 *
 * Confirmed against the running app - full add-form field list:
 *   commissionTarget.series_number (ID - disabled, auto-generated, confirmed live), salesperson_id
 *   (Sales Person *, required, real dropdown of actual users e.g. "Dipen Modi"), type (Type *,
 *   required: Monthly/Quarterly/Yearly), start_date (Start Date *, required, DD-MM-YYYY),
 *   end_date (End Date - also DISABLED, confirmed live: auto-computed from Start Date + Type,
 *   e.g. Monthly + 2026-07-01 produced 2026-08-01 in the actual save response - not user-fillable
 *   despite rendering right next to Start Date with no visual disabled styling difference caught
 *   in an earlier pass), company_ids (Entity *, multi-select, pre-filled "1 Item Selected"/
 *   "Trootech" by default same as Commission Plan), an Amount/Quantity radio group ("Target" section - which of
 *   the two the Target Amount field below represents), amount (Target Amount *, required numeric),
 *   then Classification (location_id/department_id, both optional, real option lists).
 * A read-only "Summary" tab/sidebar mirrors ID/Sales Person/Type/Start Date/End Date/Entity.
 */
class CommissionTargetPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'commissionTarget',
      listPath: '/dashboard/accounting/commissions/target',
      addPath: '/dashboard/accounting/commissions/add-commission-target',
      displayNameField: 'series_number',
    });

    this.addButton = page.getByRole('button', { name: /^Add$/i }).or(page.getByText(/^Add$/i)).first();
    this.saveButton = page.getByRole('button', { name: /^Save$/i }).last();
  }

  headerSelectTrigger(fieldFragment) {
    return this.page.locator(`[id="mui-component-select-commissionTarget.${fieldFragment}"]`).first();
  }

  async selectHeaderDropdown(fieldFragment, optionText, opts = {}) {
    await selectDropdown(this.page, this.headerSelectTrigger(fieldFragment), optionText, optionText, opts);
  }

  async selectSalesperson(name) {
    await this.selectHeaderDropdown('salesperson_id', name);
  }

  async selectType(name) {
    await this.selectHeaderDropdown('type', name);
  }

  async fillStartDate(value) {
    await this.fieldLocator('start_date').fill(String(value));
  }

  /**
   * End Date is DISABLED (confirmed live) - auto-computed from Start Date + Type (e.g. Type
   * "Monthly" + Start Date 2026-07-01 produced End Date 2026-08-01 in the actual save response,
   * exactly one month later), not a field a caller fills in directly. This method is kept only
   * for reading it back on Detail/Edit; do not call it to set a value on the Add form.
   */
  async getEndDateValue() {
    return this.fieldLocator('end_date').inputValue();
  }

  /** "Target" section's Amount/Quantity radio - which of the two `fillTargetAmount()`'s value represents. Defaults to Amount if never called. */
  async selectTargetOption(label) {
    await this.page.getByRole('radio', { name: label }).click();
  }

  async fillTargetAmount(value) {
    await this.fieldLocator('amount').fill(String(value));
  }

  async selectLocation(name) {
    await this.selectHeaderDropdown('location_id', name, { optional: true });
  }

  async selectDepartment(name) {
    await this.selectHeaderDropdown('department_id', name, { optional: true });
  }

  /**
   * @param {{salesperson?: string, type?: string, startDate?: string,
   *   targetOption?: string, targetAmount?: string|number, location?: string, department?: string}} data
   *   (no `endDate` - it's disabled/auto-computed from startDate+type, see getEndDateValue())
   */
  async fillHeader({ salesperson, type, startDate, targetOption, targetAmount, location, department } = {}) {
    if (salesperson) await this.selectSalesperson(salesperson);
    if (type) await this.selectType(type);
    if (startDate !== undefined) await this.fillStartDate(startDate);
    if (targetOption) await this.selectTargetOption(targetOption);
    if (targetAmount !== undefined) await this.fillTargetAmount(targetAmount);
    if (location) await this.selectLocation(location);
    if (department) await this.selectDepartment(department);
  }

  /** Plain Save click - used by Edit (a PUT request, not matched by saveAndCaptureId's POST filter). */
  async save() {
    await this.saveButton.click();
  }

  /**
   * Create-only: captures `{ id, seriesNumber }` from the save response. The API's own create
   * endpoint is plural (`commission-targets`) and shares no segment with listPath's own last
   * segment (`target`) - pass it explicitly rather than relying on the default derivation.
   */
  async saveAndCapture() {
    return this.saveAndCaptureId(this.saveButton, ['salesperson_id', 'type'], 'commission-targets');
  }

  /** @param {object} data - see fillHeader() */
  async createCommissionTarget(data) {
    await this.openAdd();
    await this.fillHeader(data || {});
  }

  /**
   * View URL shares no segment with list/add beyond "commissions" (see class doc comment) -
   * confirmed live navigating here directly works fine, same as every other module's gotoView(id).
   */
  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/accounting/commissions/${id}/view-commission-target`);
    await this.page.waitForLoadState('networkidle');
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }
}

module.exports = CommissionTargetPage;
