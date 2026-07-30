const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// The full create -> submit -> approve flow below is CONFIRMED LIVE (tests/hrms/
// 09-asset-request-flow.spec.js passes end-to-end against a running app), not just authored
// from erpforce-hrms-fe source. One confirmed-live quirk to keep in mind when extending this
// page: some breadcrumb/section-title strings genuinely render as raw i18n keys (e.g.
// "common.add_new", "common.basic_details") instead of friendly text - those specific keys are
// missing from the live translation backend, matching the risk already flagged for
// `hrms.employee_assets.*`/`hrms.damage_loss.*` keys. Field-level labels/placeholders actually
// used by the locators here (Enter Name, Enter Quantity, Asset Category Needed, etc.) DO render
// correctly, so this only matters if you add a new locator against a title/breadcrumb string.
class AssetRequestPage extends BasePage {
  // ---------- Navigation ----------
  async gotoList() {
    await this.page.goto('/dashboard/hrms/asset-request');
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.getByRole('button', { name: 'Add' }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoAdd() {
    await this.gotoList();
    await this.page.getByRole('button', { name: 'Add' }).first().click();
    await this.page.waitForURL('**/add-asset-request', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.getByPlaceholder('Enter Name').waitFor({ state: 'visible', timeout: 15000 });
    await this.recoverFromStuckLoadingFields();
  }

  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create step likely failed.`);
    await this.page.goto(`/dashboard/hrms/asset-request/${id}/view-asset-request`);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  // ---------- Form (asset-request-form.tsx) ----------
  // asset_category_id is a live, backend-fetched DynamicSearchSelect (apiType='assetTypes') -
  // its real option text isn't pinned in config/testData.js, same reasoning testDataFactory.js
  // documents for every other FK-reference field in this repo: pick whatever renders first
  // rather than guess a category name that may not exist in this account's master data.
  // `categoryOptionIndex` is an explicit opt-out of that default for callers that have already hit
  // the FIRST category's depleted available/in-use pool (see the Damage/Loss suite's own setup) -
  // it selects the nth option instead, still without guessing any real category name.
  async fillRequestForm({ assetName, quantity, reason, requiredFromDate, categoryOptionIndex = 0 }) {
    await this.page.getByPlaceholder('Enter Name').fill(assetName);
    if (categoryOptionIndex === 0) {
      await this.selectFirstOptionByLabel('Asset Category Needed');
    } else {
      const labelRegex = /^Asset Category Needed\s*\*?$/i;
      const combobox = this.page
        .getByRole('main')
        .getByText(labelRegex)
        .first()
        .locator('xpath=..')
        .getByRole('combobox')
        .first();
      await combobox.click();
      const option = this.page
        .getByRole('listbox')
        .getByRole('option')
        .filter({ hasNot: this.page.locator('input') })
        .filter({ hasNotText: /Select|No data available|Create New/ })
        .nth(categoryOptionIndex);
      await option.waitFor({ state: 'visible', timeout: 7000 });
      await option.click();
    }
    await this.page.getByPlaceholder(/enter quantity/i).fill(String(quantity));

    // CONFIRMED LIVE (DOM dump): this field arrives PRE-FILLED with today's date the instant
    // the Add form loads (e.g. value="28-07-2026") - its own "MM/DD/YYYY" placeholder is
    // misleading, the real accepted/stored format is "DD-MM-YYYY" (same format BasePage's own
    // formatDateToday() already produces). Two earlier attempts (placeholder guess, then a
    // structural xpath traversal) both "succeeded" without error yet silently invalidated this
    // already-correct default by writing an unparseable format into it. Same fix TimeSheetPage.js
    // already documents for its own date picker: rely on the form's default instead of fighting
    // the picker, and only touch the field when a test explicitly needs a different date.
    if (requiredFromDate) {
      const dateInput = this.page.locator('input[name="asset_request.required_from_date"]');
      await dateInput.fill(requiredFromDate);
    }

    await this.page.getByPlaceholder(/add reason/i).fill(reason);
  }

  // ---------- Save ----------
  // Every other document-style module in this repo redirects back to its own list page after
  // Submit/Save (Procurement Request, Employee Master, etc.) - assumed true here too since the
  // Add form shares the same generic form-container/header-button pattern; verify live and
  // adjust if this module's Submit instead auto-navigates straight to the View page.
  async submitRequest(data) {
    await this.fillRequestForm(data);
    await this.page.getByRole('button', { name: 'Submit' }).click();
    await this.page.waitForURL(/\/dashboard\/hrms\/asset-request(\?|$)/, { timeout: 15000 });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  // ---------- Validation (asset-request-form.tsx's Yup schema, validation-schemas.ts) ----------
  // React Hook Form + Yup blocks the submit handler client-side before any network call, so
  // clicking Submit on an invalid form is always safe - it never creates a record. Exact messages
  // read from `assetRequestValidationSchema` (validation-schemas.ts), not guessed:
  //   asset_category_id: "Asset category is required"
  //   asset_name: "Asset name is required" / "Asset name must be at least 2 characters"
  //   quantity_needed: "Quantity is required" / "Quantity must be at least 1"
  //   required_from_date: "Required from date is required" (won't trigger via UI - pre-filled by
  //     default, see fillRequestForm's own comment)
  //   reason_purpose: "Reason/Purpose is required" / "Reason must be at least 10 characters"
  // `requested_for_employee_id` is also required in the schema but is silently auto-filled from
  // the logged-in employee (asset-request-form.tsx's own useEffect) - not reachable via the UI,
  // so there's no corresponding test case for it.
  async attemptSubmit() {
    await this.page.getByRole('button', { name: 'Submit' }).click();
  }

  // Returns the create-request POST response if one fires within `timeout`, or null if none does
  // - the reliable way to check whether Submit was actually blocked client-side. A `toHaveURL`
  // check made right after the click is racy here (it can pass the instant it's checked, before
  // an async navigation actually lands) - this asserts on the real network signal instead, same
  // convention this repo already uses for save/approve verification.
  async attemptSubmitExpectingBlock({ timeout = 5000 } = {}) {
    const createResponse = this.page
      .waitForResponse((r) => r.url().includes('asset-request') && r.request().method() === 'POST', { timeout })
      .catch(() => null);
    await this.attemptSubmit();
    return createResponse;
  }

  async expectValidationError(message) {
    await expect(this.page.getByText(message, { exact: false }).first()).toBeVisible({ timeout: 5000 });
  }

  async expectNoValidationError(message) {
    await expect(this.page.getByText(message, { exact: false }).first()).not.toBeVisible({ timeout: 5000 });
  }

  // ---------- Listing ----------
  // Keyed by asset name (not series_number/Request ID, which we don't know until the row exists)
  // - same shared Listing/action-bar component every other module uses, so BasePage.searchList()
  // applies unchanged.
  rowByAssetName(assetName) {
    return this.page.locator('tr', { hasText: assetName });
  }

  async getRequestStatus(assetName) {
    await this.gotoList();
    await this.searchList(assetName);
    const row = this.rowByAssetName(assetName);
    await expect(row).toBeVisible();
    // Real status vocabulary (source-confirmed, utils/constants.ts): Requested | Approved |
    // Rejected | Pending - NOT the generic "Pending Approval" business wording a spec/ticket
    // might use; a freshly created request is expected to land on "Requested".
    return (await row.getByText(/Requested|Approved|Rejected|Pending/i).first().textContent()) ?? '';
  }

  // Opens the request from the list (row click navigates to the View page, same
  // redirectionLink pattern every other module's Listing wires up) and returns its numeric id
  // straight from the resulting URL - avoids guessing the API response's JSON shape or the
  // Request ID's display format (e.g. "AR-2026-000001"), neither of which is confirmed live.
  async openRequestByAssetName(assetName) {
    await this.gotoList();
    await this.searchList(assetName);
    await this.rowByAssetName(assetName).first().click();
    await this.page.waitForURL(/\/asset-request\/(\d+)\/view-asset-request/, { timeout: 15000 });
    const match = this.page.url().match(/\/asset-request\/(\d+)\/view-asset-request/);
    return match ? match[1] : null;
  }

  // Row "..." action menu (source-confirmed, asset-request-list.tsx's rowActionMenu): Edit /
  // Duplicate / View, with Edit's own `disabled: (row) => !canEdit || row?.status == 'Approved'`
  // - same aria-disabled-not-omitted convention BasePage.isRowActionDisabled already documents
  // for every other module, just keyed by asset name here instead of series number (we don't
  // reliably know the Request ID's display format up front).
  async isEditDisabledForAsset(assetName) {
    await this.gotoList();
    await this.searchList(assetName);
    const row = this.rowByAssetName(assetName).first();
    await row.locator('button').last().click();
    const editItem = this.page.getByRole('menuitem', { name: 'Edit', exact: true });
    const ariaDisabled = await editItem.getAttribute('aria-disabled');
    await this.page.keyboard.press('Escape');
    return ariaDisabled === 'true';
  }

  // ---------- Approval (shared src/components/approve-reject/apporve-reject.tsx) ----------
  async approve(id) {
    await this.gotoView(id);
    await this.page.getByRole('button', { name: 'Approve', exact: true }).click();
    await this.confirmIfPrompted('Approve');
    await expect(this.page.getByText(/Approved/i).first()).toBeVisible({ timeout: 10000 });
  }

  async reject(id) {
    await this.gotoView(id);
    await this.page.getByRole('button', { name: 'Reject', exact: true }).click();
    await this.confirmIfPrompted('Reject');
    await expect(this.page.getByText(/Rejected/i).first()).toBeVisible({ timeout: 10000 });
  }

  // Approve/Reject may or may not open a confirmation dialog depending on whether this view
  // reuses the same ConfirmPopUp the Approval Dashboard wiring does (unconfirmed live) - handle
  // both so the test doesn't hang waiting on a dialog that never appears.
  async confirmIfPrompted(actionName) {
    const dialog = this.page.getByRole('dialog');
    const isOpen = await dialog.isVisible({ timeout: 3000 }).catch(() => false);
    if (!isOpen) return;
    await dialog.getByRole('button', { name: new RegExp(actionName, 'i') }).click();
  }
}

module.exports = AssetRequestPage;
