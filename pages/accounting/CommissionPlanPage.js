const SettingsEntityPage = require('../base/SettingsEntityPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Commission Plan (Accounting > Commissions > Commission Plan) - master data with no approval
 * workflow (list Status column is a plain Active/Inactive toggle, not Draft/Pending/Approved).
 * Source: erpforce-fe modules/accounting/src/views/commissions/commission-plan/*
 * Routes confirmed against the running app:
 *   list  /dashboard/accounting/commissions/commission-plan
 *   add   /dashboard/accounting/commissions/add-commission-plan
 *
 * Extends SettingsEntityPage (not AccountingDocumentPage) since there is no Submit/Accept/Reject
 * anywhere on this module's View page - confirmed live.
 *
 * Field-array prefix is `commissionPlan` (NOT `add_commission_plan`/`edit_commission_plan` like
 * every other Settings-entity module - confirmed live the Add form's own field `name` attributes
 * are literally `commissionPlan.title`, `commissionPlan.type`, etc., with no add_/edit_ prefix at
 * all). `entityKey: 'commissionPlan'` still works with SettingsEntityPage's own
 * `editEntityKey = entityKey.replace(/^add_/, 'edit_')` derivation - since there's no `add_`
 * prefix to strip, `editEntityKey` just equals `entityKey` unchanged, which matches this module's
 * real (single, unprefixed) field-array name on both Add and Edit.
 *
 * FORMERLY BLOCKED, NOW FIXED (do not resurrect the old workarounds below without re-confirming
 * the bug is back): the Add form used to render THREE overlapping, simultaneously-visible sections
 * stacked on one page - the real form plus two dead duplicate sections (a "Basic Detail" singular
 * with its own stray `company_id`/`item_id`/`eligibility_type`/`target_amount`/`attachment_url`
 * fields, and a second "Commission Rate"/"Tiers" block). The stray singular `company_id` field
 * broke every Save with a 400 "Unknown column 'company_id' in field list". Confirmed live
 * (re-checked field/select counts on the Add page) that both duplicate sections are now gone
 * entirely - the form has exactly one of each field again. Save works normally now; there is no
 * `company_id`/`item_id`/`eligibility_type`/`target_amount`/`attachment_url` field anywhere on
 * this form anymore, real or dead.
 *
 * Confirmed against the running app - the (now single, unambiguous) form's own fields:
 *   commissionPlan.title (Commission Title *), commissionPlan.type (Commission Type *: Fixed
 *   Rate/Percentage/Tiered), commissionPlan.company_ids (Entity *, a multi-select - pre-filled
 *   with "1 Item Selected"/"Trootech" by default on a blank Add form, confirmed live),
 *   commissionPlan.description (optional), status (Status toggle, defaults Active),
 *   commissionPlan.item_ids (Eligibility Criteria > Item, optional), an "Apply on" radio group
 *   (Sales Amount/Collection Amount/Quantity), a "Give Commission when Target is achieved" toggle,
 *   then a Commission Rate sub-section whose shape depends on Commission Type: `commission_amount`
 *   (Fixed Rate), `commission_percentage` (Percentage), or a repeatable Tier table with its own
 *   per-tier Percentage-or-Fixed-Rate choice (Tiered - not yet supported by this page object),
 *   then Attachments (optional), then Classification (`location_id`/`department_id`, both optional).
 */
class CommissionPlanPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'commissionPlan',
      listPath: '/dashboard/accounting/commissions/commission-plan',
      addPath: '/dashboard/accounting/commissions/add-commission-plan',
      displayNameField: 'title',
    });

    this.addButton = page.getByRole('button', { name: /^Add$/i }).or(page.getByText(/^Add$/i)).first();
    this.saveButton = page.getByRole('button', { name: /^Save$/i }).last();
  }

  /**
   * Overrides SettingsEntityPage's own fieldLocator() to always take `.first()` - defensive
   * safety net left in place after the dead-duplicate-section bug (see class doc comment) was
   * fixed: harmless no-op against today's single-match form, but avoids reintroducing the old
   * strict-mode-violation crash if a duplicate section ever comes back.
   */
  fieldLocator(fieldName) {
    return super.fieldLocator(fieldName).first();
  }

  headerSelectTrigger(fieldFragment) {
    return this.page.locator(`[id*="mui-component-select-commissionPlan.${fieldFragment}"]`).first();
  }

  async selectHeaderDropdown(fieldFragment, optionText, opts = {}) {
    await selectDropdown(this.page, this.headerSelectTrigger(fieldFragment), optionText, optionText, opts);
  }

  async fillTitle(value) {
    await this.fieldLocator('title').fill(String(value));
  }

  async selectType(name) {
    await this.selectHeaderDropdown('type', name);
  }

  async fillDescription(value) {
    await this.fieldLocator('description').fill(String(value));
  }

  async selectItem(name) {
    await this.selectHeaderDropdown('item_ids', name, { optional: true });
  }

  /**
   * "Apply on" radio group - Sales Amount/Collection Amount/Quantity. No asterisk was seen next
   * to this field's label (unconfirmed whether it's truly required or just defaults to one
   * option). Confirm the real locator/behavior against a live save before relying on this heavily.
   */
  async selectApplyOn(label) {
    await this.page.getByRole('radio', { name: label }).click();
  }

  async selectLocation(name) {
    await this.selectHeaderDropdown('location_id', name, { optional: true });
  }

  async selectDepartment(name) {
    await this.selectHeaderDropdown('department_id', name, { optional: true });
  }

  /** Fixed Rate type's own required Commission Rate field. */
  async fillCommissionAmount(value) {
    await this.fieldLocator('commission_amount').first().fill(String(value));
  }

  /** Percentage type's own required Commission Rate field. */
  async fillCommissionPercentage(value) {
    await this.fieldLocator('commission_percentage').first().fill(String(value));
  }

  /**
   * @param {{title?: string, type?: string, description?: string, item?: string,
   *   applyOn?: string, location?: string, department?: string, commissionAmount?: string|number,
   *   commissionPercentage?: string|number}} data
   */
  async fillHeader({ title, type, description, item, applyOn, location, department, commissionAmount, commissionPercentage } = {}) {
    if (title !== undefined) await this.fillTitle(title);
    if (type) await this.selectType(type);
    if (description !== undefined) await this.fillDescription(description);
    if (item) await this.selectItem(item);
    if (applyOn) await this.selectApplyOn(applyOn);
    if (commissionAmount !== undefined) await this.fillCommissionAmount(commissionAmount);
    if (commissionPercentage !== undefined) await this.fillCommissionPercentage(commissionPercentage);
    if (location) await this.selectLocation(location);
    if (department) await this.selectDepartment(department);
  }

  /** Plain Save click - used by Edit (a PUT request, not matched by saveAndCaptureId's POST filter) and by any caller that doesn't need the created id/seriesNumber back. */
  async save() {
    await this.saveButton.click();
  }

  /**
   * Create-only: captures `{ id, seriesNumber }` from the save response - the API's own create
   * endpoint is plural (`POST /accounting/v1/commission-plans/`) while listPath's last segment is
   * singular (`commission-plan`), same singular/add-path-vs-plural-api-path mismatch confirmed on
   * Asset Transfer - pass the plural fragment explicitly rather than relying on the default
   * derivation. Don't use this for Edit's own Save - that's a PUT, not a POST, so this would just
   * time out waiting for a request that never happens.
   */
  async saveAndCapture() {
    return this.saveAndCaptureId(this.saveButton, ['type', 'commission_amount'], 'commission-plans');
  }

  /** @param {object} data - see fillHeader() */
  async createCommissionPlan(data) {
    await this.openAdd();
    await this.fillHeader(data || {});
  }
}

module.exports = CommissionPlanPage;
