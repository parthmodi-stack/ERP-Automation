const AccountingDocumentPage = require('../base/AccountingDocumentPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Asset Transfer (Accounting > Assets > Asset Transfer) - moves an existing Asset from its
 * current (Source) Location/Department to a new (Destination) Location/Department, going through
 * the same Submit -> Quick Approval -> Accept workflow as every other approval-gated document
 * module in this suite.
 * Source: erpforce-fe modules/accounting/src/views/assets/asset-transfer/*
 *
 * Routes confirmed against the running app - NOTE the singular/plural mismatch, confirmed live
 * this isn't a typo on either side, both route families are real and distinct:
 *   list  /dashboard/accounting/assets/asset-transfer                     (singular "asset")
 *   add   /dashboard/accounting/assets/asset-transfer/add-asset-transfer  (singular)
 *   view  /dashboard/accounting/assets/assets-transfer/:id/view-asset-transfer  (PLURAL "assets")
 * The API's own create endpoint is also plural: POST /accounting/v1/assets-transfer/.
 *
 * Confirmed against the running app - full add-form field list (entityKey `add_asset_transfer`):
 *   asset_id (Asset *), reference_number, original_value, cumulative_depreciation_amount (Asset
 *     Details section - only asset_id is required; original_value/cumulative_depreciation_amount
 *     are plain optional text fields, NOT auto-filled from the selected Asset despite the section
 *     heading suggesting otherwise - confirmed live),
 *   transfer_name (Transfer Name *), transfer_date (Transfer Date *, DD-MM-YYYY),
 *   source_company_id (Current Entity *, pre-filled "Trootech"),
 *   destination_company_id (Transfer to Entity *, pre-filled "Trootech"),
 *   source_location_id (Current Location - NOT required, DISABLED, auto-populated from the
 *     selected Asset's own Location - confirmed live selecting an Asset located in "Navi Mumbai"
 *     immediately fills this field with "Navi Mumbai"),
 *   destination_location_id (Transfer to Location *, required, real independent option list),
 *   source_department_id (Current Department - NOT required, DISABLED, same auto-populate-from-
 *     Asset behavior as source_location_id, renders blank if that Asset has no Department),
 *   destination_department_id (Transfer to Department *, required, real option list + an inline
 *     "Create New Transfer to Department" fallback),
 *   narration (optional).
 * A read-only "Summary" section (Computation Method, Depreciation Method, Not depreciable value,
 * Duration, Current asset value after depreciation, Insurance amount) mirrors the source Asset's
 * own depreciation figures - not user-editable, not asserted on beyond presence.
 *
 * CONFIRMED BUSINESS RULE (core to this module - verified live via a full create+approve cycle):
 * approving an Asset Transfer actually updates the underlying Asset's own Location AND Department
 * fields (visible on AssetManagementPage's own View page) to the transfer's Destination values -
 * this is not just a historical record of the transfer, it's a live mutation of the Asset.
 *
 * CONFIRMED STATUS MODEL (differs from every other document module in this suite): clicking the
 * single "Save" button does NOT create a Draft - the record is created directly in "Pending"
 * status (Submit button already visible on first View), confirmed live across separate create
 * cycles. There is no separate "Save to Draft" action for this module.
 *
 * Confirmed live: the Edit button is present while Pending and disappears once Approved (properly
 * gated). The Actions menu's "Delete" item, however, remains present regardless of status
 * (including on an Approved record) - same confirmed app-wide gap as Purchase Agreement's
 * TC-PAGR-11/12 (no server-side or full UI enforcement blocking delete of a non-Draft record).
 */
class AssetTransferPage extends AccountingDocumentPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_asset_transfer',
      listPath: '/dashboard/accounting/assets/asset-transfer',
      addPath: '/dashboard/accounting/assets/asset-transfer/add-asset-transfer',
      statusCssSlug: 'assetTransfer',
    });

    this.addButton = page.getByRole('button', { name: /^Add$/i }).or(page.getByText(/^Add$/i)).first();
    this.saveButton = page.getByRole('button', { name: /^Save$/i }).last();
  }

  /** Same "plain <p> next to breadcrumb, no --StatusChip class" quirk DebitNotePage.js/CreditNotePage.js/ExpenseReimbursementPage.js/CashExpensePage.js document. */
  statusChipOnView() {
    return this.page.locator('p').filter({ hasText: /^(Draft|Pending|Submitted|Approved|Rejected|Void)$/ });
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

  async selectAsset(name) {
    await this.selectHeaderDropdown('asset_id', name);
  }

  /**
   * Destination Location's option list rots the same way Procurement Request's own Location field
   * does (see ProcurementRequestPage.selectLocation's extensive comment for the full mechanism) -
   * this environment's dropdown only surfaces a limited, ever-shifting window with no reliable
   * search filter, so a pinned literal ("Baroda") eventually gets evicted by OTHER specs' own
   * auto-created Locations account-wide. Confirmed live: selectDropdown()'s exact-match search for
   * "Baroda" found nothing, and since the (non-empty) unfiltered list still had other real
   * options, it silently fell back to whichever one happened to render first - some unrelated
   * spec's leftover "Dhule_..." record - instead of failing loudly.
   *
   * UNLIKE Procurement Request's own Location field, this one has NO "+ Create New Location"
   * footer option at all (confirmed live via its listbox snapshot - just a flat list of existing
   * records, no footer action), so the "always create a fresh one" fix used there doesn't apply
   * here. Instead: pass a deliberately-nonexistent namePrefix so selectDropdown's exact-match
   * search always misses and falls through to its own "pick the first real available option"
   * fallback (which is guaranteed to succeed - this list is never actually empty, just full of
   * OTHER specs' leftover records), then read back whichever real option it actually landed on
   * via getDestinationLocationText() rather than asserting against a value we never controlled.
   */
  async selectDestinationLocation(namePrefix) {
    const uniqueMiss = `${namePrefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await this.selectHeaderDropdown('destination_location_id', uniqueMiss);
    return this.getDestinationLocationText();
  }

  async getDestinationLocationText() {
    const text = await this.headerSelectTrigger('destination_location_id').textContent();
    return (text || '').replace(/[​﻿]/g, '').trim();
  }

  async selectDestinationDepartment(name) {
    await this.selectHeaderDropdown('destination_department_id', name, { allowCreateNew: true });
  }

  async fillReferenceNumber(value) {
    await this.fieldLocator('reference_number').fill(String(value));
  }

  async fillTransferName(value) {
    await this.fieldLocator('transfer_name').fill(String(value));
  }

  async fillTransferDate(value) {
    await this.fieldLocator('transfer_date').fill(String(value));
  }

  async fillNarration(value) {
    await this.fieldLocator('narration').fill(String(value));
  }

  /** Current Location/Department are DISABLED selects auto-populated from the selected Asset - read their text rather than trying to select into them. */
  async getSourceLocationText() {
    const text = await this.headerSelectTrigger('source_location_id').textContent();
    return (text || '').replace(/[​﻿]/g, '').trim();
  }

  async getSourceDepartmentText() {
    const text = await this.headerSelectTrigger('source_department_id').textContent();
    return (text || '').replace(/[​﻿]/g, '').trim();
  }

  formatDateToday() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }

  /**
   * @param {{asset?: string, referenceNumber?: string|number, transferName?: string,
   *   transferDate?: string, destinationLocation?: string, destinationDepartment?: string,
   *   narration?: string}} header
   */
  async fillHeader({ asset, referenceNumber, transferName, transferDate, destinationLocation, destinationDepartment, narration } = {}) {
    if (asset) await this.selectAsset(asset);
    if (referenceNumber !== undefined) await this.fillReferenceNumber(referenceNumber);
    if (transferName !== undefined) await this.fillTransferName(transferName);
    if (transferDate !== undefined) await this.fillTransferDate(transferDate);
    if (destinationLocation) await this.selectDestinationLocation(destinationLocation);
    if (destinationDepartment) await this.selectDestinationDepartment(destinationDepartment);
    if (narration !== undefined) await this.fillNarration(narration);
  }

  /**
   * Captures `{ id, seriesNumber }` from the save response - confirmed live shape:
   * `{ data: { assets: { id, asset_id, transfer_name, series_number, ... } } }`. Passes an
   * explicit urlFragment since the API's own endpoint ("assets-transfer") is plural while
   * listPath's last segment ("asset-transfer") is singular - the default derivation in
   * AccountingDocumentPage.saveAndCaptureId would otherwise never match the real request.
   */
  async save() {
    return this.saveAndCaptureId(this.saveButton, ['asset_id', 'transfer_name'], 'assets-transfer');
  }

  /** @param {object} header - see fillHeader() */
  async createAssetTransfer(header) {
    await this.openAdd();
    await this.fillHeader(header || {});
  }

  /**
   * View URL uses the PLURAL "assets-transfer" segment, unlike list/add's singular
   * "asset-transfer" - see the class doc comment. Confirmed live navigating here directly (not
   * via a list-row click) works fine, same as every other module's own gotoView(id).
   */
  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/accounting/assets/assets-transfer/${id}/view-asset-transfer`);
    await this.page.waitForLoadState('networkidle');
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  /** Row status text for a given series number - same plain-text (not CSS-chip) pattern as the record's own View page status. */
  async getRowStatus(seriesNumber) {
    return (await this.row(seriesNumber).getByText(/^(Draft|Pending|Submitted|Approved|Rejected|Void)$/).first().textContent()) ?? '';
  }
}

module.exports = AssetTransferPage;
