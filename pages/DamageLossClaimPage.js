const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Read in full from erpforce-hrms-fe source (report-damage-loss/form/form.tsx,
// add-report-damage-loss.hrms.tsx, view-report-damage-loss.hrms.tsx, approve-claim-modal.tsx,
// utils/validation-schemas.ts) and the backend (damage-loss-claims.service.js,
// update.damage-loss-claim.status.js validator) before writing any locator here. Known facts:
// - The Add form is only ever reached via MyAssetsPage.reportDamageLoss() (real in-app
//   navigation) - the Serial Number field's options come entirely from router state, not a live
//   fetch. Never `page.goto()` the add-damage-loss-claim URL directly.
// - The pre-selected asset's row in the "Damage-Loss Details" table is ALREADY in inline edit
//   mode on load (same auto-open pattern as the Receive-Handover table) - Condition/Severity are
//   MRT `select` comboboxes, Date of Incident is a date input, Description is plain text.
//   CONFIRMED LIVE these need the SAME "select option, then press Enter to commit" sequence
//   AssetTransferPage.acceptTransfer() already had to discover for the shared
//   material-editable-table.tsx component - applying it proactively here rather than
//   rediscovering the same bug.
// - Condition options: exactly "Damaged" / "Loss" (a disabled "No" option also exists in source,
//   never selectable). Severity options: "High"/"Medium"/"Low", required UNLESS Condition is
//   "Loss" (both the Yup schema and the column's own `disable`/`validate` callbacks agree on
//   this). Description is optional (its Yup rule is commented out).
// - Evidence attachment is REQUIRED (Yup `.min(1)`) - CONFIRMED LIVE error text "Evidence
//   attachment is required". The upload input is a plain (visually hidden) `input[type="file"]
//   multiple accept="application/pdf,...,image/jpeg,image/png,..."` - same structural pattern
//   AccrualsAndBenefitPage.js already uses for its own attachment upload.
// - Submitting creates the claim in status "Submitted" via `POST /hrms/v1/damage-loss-claims`.
// - Approve/Reject only render when `canApprove` (backend's `approver_details` on THIS specific
//   claim) AND status is one of Submitted/Pending/Requested/"In Review". Reject opens a
//   ConfirmPopUp with NO reason field (an empty string is sent regardless). Approve opens
//   ApproveClaimModal.
// - ApproveClaimModal ("Approve Claim" title, "Approve & Claim" submit button): Estimated Repair
//   Cost / Replacement Cost are cross-required (at least one, Yup-enforced both ways -
//   `required={!hasReplacementCost}`/`required={!hasEstimatedCost}`); Liable To Pay is two
//   mutually-exclusive checkboxes defaulting Employee=true; Deduction Source + Recovery Amount
//   are required ONLY when Employee is liable (a pre-fetched local list, not a live search - use
//   selectFirstOptionByLabel-style "pick whatever renders first"); Split Duration is optional.
//   Submits via `PATCH /v1/damage-loss-claims/:id/status` with `status: 'Approved'`.
// - IMPORTANT: a single "Approve & Claim" submission only reaches status "Approved", NOT a
//   terminal/"Completed" state - the backend's `completeClaim` is a SEPARATE, later confirmation
//   (its own "Complete" button, only shown once already Approved) not exercised here.
class DamageLossClaimPage extends BasePage {
  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create step likely failed.`);
    await this.page.goto(`/dashboard/hrms/damage-loss-claim/${id}/view-damage-loss-claim`);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  // ---------- Create (called after MyAssetsPage.reportDamageLoss() lands on the Add form) -------
  // `condition` is 'Damaged' | 'Loss'; `severity` is only applied when condition !== 'Loss'.
  // CONFIRMED LIVE: the page's OWN first combobox is the "Basic Details" Serial Number
  // multiselect (it renders BEFORE the Damage-Loss Details table in DOM order) - an unscoped
  // `page.getByRole('combobox').first()` grabs that instead of Condition. Everything here must
  // be scoped to the Damage-Loss Details `<table>` specifically.
  async fillClaimDetails({ condition, severity, dateOfIncident, description }) {
    const table = this.page.locator('table').first();

    // CONFIRMED LIVE via source (erpforce-common-hub-fe's material-editable-table.tsx +
    // erpforce-hrms-fe's report-damage-loss/form/form.tsx) - this table passes
    // `hideSaveButton={true}`, which CSS-hides (display:none) the row's Save/Cancel icon buttons
    // entirely (confirmed via getComputedStyle - they exist in the DOM but are unclickable, not
    // just hard to find). The only two real commit paths are (1) Enter, which the row's own
    // onKeyUp calls `saveEditingRow(table)` for, or (2) a genuine click OUTSIDE the whole
    // `.MRT-TableWrapper`, handled by a global document click-listener that's DEBOUNCED 200ms and
    // SUPPRESSED for 300ms after any click on a MuiFormControl/MuiInputBase/MuiButtonBase element
    // - i.e. almost any interaction with the row itself, which is exactly why a plain
    // click-outside kept losing the race against Submit and left the row's REAL commit still
    // pending (looked filled on screen, reverted to blank by Submit time). Enter DOES "re-open
    // the combobox" when focus is on a Select (Condition/Severity) - CONFIRMED LIVE - but pressing
    // it while focus is in the plain Description TEXT field commits cleanly (CONFIRMED LIVE via
    // tests/tmp/inspect-damage-loss-enter-on-description.spec.js - a full create succeeded this
    // way). So: fill Description LAST and press Enter there. Only the validation tests that
    // deliberately leave the row incomplete (no description) skip this and fall back to a plain
    // outside click - that failure path doesn't need a clean commit, it needs the row's own
    // validation error to render, which happens either way.
    const row = table.locator('tbody tr, [role="row"]').first();

    // CONFIRMED LIVE (screenshot): unlike the Receive-Handover table, this row does NOT auto-open
    // in edit mode on load (Condition/Severity/Date all render blank/"-", no visible combobox) - a
    // plain cell click triggers material-editable-table.tsx's own "set row editable if not already
    // editing" handler. Column order confirmed live: [delete icon, Serial Number, Asset
    // Specification, Condition, Severity, Date of Incident, Description] - index 3 is Condition.
    await row.locator('td, [role="cell"]').nth(3).click();
    await this.page.waitForTimeout(300);

    const conditionCombobox = table.getByRole('combobox').first();
    await conditionCombobox.click();
    await this.page.getByRole('option', { name: condition, exact: true }).click();
    await expect(conditionCombobox).toHaveText(condition, { timeout: 5000 });

    if (condition !== 'Loss' && severity) {
      const severityCombobox = table.getByRole('combobox').nth(1);
      await severityCombobox.click();
      await this.page.getByRole('option', { name: severity, exact: true }).click();
      await expect(severityCombobox).toHaveText(severity, { timeout: 5000 });
    }

    // CONFIRMED LIVE (tests/tmp/inspect-damage-loss-condition.spec.js): unlike Asset Request's
    // date field, this one has NO default - it's genuinely blank until filled, and is required.
    // Default to today (`dateOfIncident === null` is the explicit opt-out, used by TC-DL-V03's
    // "leave it empty" case). Also CONFIRMED LIVE: `table.locator('input').first()` does NOT
    // reliably resolve to this field - the Condition/Severity comboboxes each render their OWN
    // hidden/internal `<input>` earlier in DOM order (type=null, placeholder=null) - the date
    // field's own placeholder ("Select Date of Incident") is the only reliable way to find it.
    // The field's mask is "DD-MM-YYYY" (dashes) - a slash-separated string doesn't parse.
    if (dateOfIncident !== null) {
      const dateInput = table.getByPlaceholder('Select Date of Incident');
      const value = dateOfIncident || this.todayDdMmYyyy();
      await dateInput.fill(value);
      await expect(dateInput).toHaveValue(value, { timeout: 5000 });
    }

    if (description) {
      const descriptionInput = table.getByPlaceholder(/add reason/i);
      await descriptionInput.click();
      await descriptionInput.fill(description);
      await expect(descriptionInput).toHaveValue(description, { timeout: 5000 });
      // Commit via Enter with focus still in this plain text field - see the class-level comment
      // above for why this (and not a click-outside) is the reliable path.
      await descriptionInput.press('Enter');
      await this.page.waitForTimeout(400);
    } else {
      // No description to safely focus for Enter - this only happens on the deliberately
      // incomplete validation cases (e.g. TC-DL-V03), which just need the row's own validation
      // error to render, not a clean commit.
      await this.saveEditableTableRow();
    }
  }

  async uploadEvidence(filePath) {
    await this.page.locator('input[type="file"]').first().setInputFiles(filePath);
  }

  // DD/MM/YYYY - matches the displayed format confirmed live (screenshot showed "29/07/2026" for
  // 29th July); the field's own max_date is today, so this is always a valid value to type.
  // CONFIRMED LIVE (tests/tmp/inspect-damage-loss-condition.spec.js): the field's own mask is
  // "DD-MM-YYYY" (DASHES) - filling a slash-separated string like "29/07/2026" doesn't parse,
  // leaving the field showing the raw mask text (or clearing entirely on later interaction). The
  // displayed value screenshots showed ("29-07-2026") already used dashes; the bug was purely in
  // this generator using the wrong separator.
  todayDdMmYyyy() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }

  async attemptSubmit() {
    await this.page.getByRole('button', { name: 'Submit', exact: true }).click();
  }

  // Returns the create-claim POST response if one fires within `timeout`, or null if none does -
  // the reliable way to check whether Submit was actually blocked client-side (see
  // AssetRequestPage.attemptSubmitExpectingBlock, same convention).
  async attemptSubmitExpectingBlock({ timeout = 5000 } = {}) {
    const createResponse = this.page
      .waitForResponse((r) => r.url().includes('damage-loss-claims') && r.request().method() === 'POST', { timeout })
      .catch(() => null);
    await this.attemptSubmit();
    return createResponse;
  }

  async submitClaim(data) {
    await this.fillClaimDetails(data);
    if (data.attachmentPath) {
      await this.uploadEvidence(data.attachmentPath);
    }
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes('damage-loss-claims') && r.request().method() === 'POST',
    );
    await this.attemptSubmit();
    const response = await responsePromise;
    await this.page.waitForURL(/\/dashboard\/hrms\/damage-loss-claim(\?|$)/, { timeout: 15000 });
    return response.json().catch(() => null);
  }

  async expectValidationError(message) {
    await expect(this.page.getByText(message, { exact: false }).first()).toBeVisible({ timeout: 5000 });
  }

  // ---------- Listing ----------
  rowByAssetName(assetName) {
    return this.page.locator('tr', { hasText: assetName });
  }

  async gotoList() {
    await this.page.goto('/dashboard/hrms/damage-loss-claim');
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  async getStatus(id) {
    await this.gotoView(id);
    const chip = this.page.locator('[class*="StatusChip"]').first();
    return (await chip.textContent().catch(() => '')) ?? '';
  }

  // ---------- Approve / Reject (shared ApproveRejectButton + ApproveClaimModal) ----------
  async openApproveModal(id) {
    await this.gotoView(id);
    const approveButton = this.page.getByRole('button', { name: 'Approve', exact: true });
    await expect(approveButton).toBeEnabled({ timeout: 10000 });
    await approveButton.click();
    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Approve Claim' });
    await expect(dialog).toBeVisible({ timeout: 10000 });
    return dialog;
  }

  async fillApproveClaimForm(dialog, { estimatedRepairCost, replacementCost, liableTo = 'Employee', deductionSource, recoveryAmount }) {
    // CONFIRMED LIVE: "Estimated Repair Cost"/"Replacement Cost"/"Recovery Amount" render as plain
    // text above their inputs with no `for`/`aria-labelledby` association - `getByLabel()` never
    // matches these (same pattern BasePage.fieldInputByLabel's own comment documents for Leave
    // Policy Master), even though the field is clearly visible on screen. Use the structural
    // lookup instead.
    if (estimatedRepairCost !== undefined) {
      await this.fieldInputByLabel('Estimated Repair Cost', { scope: dialog }).fill(String(estimatedRepairCost));
    }
    if (replacementCost !== undefined) {
      await this.fieldInputByLabel('Replacement Cost', { scope: dialog }).fill(String(replacementCost));
    }

    if (liableTo === 'Organisation' || liableTo === 'Organization') {
      await dialog.getByRole('checkbox', { name: /Organization|Organisation/i }).check();
    }

    if (liableTo === 'Employee') {
      if (deductionSource) {
        await this.selectFieldByLabel('Deduction Source', deductionSource, { exact: false, scope: dialog });
      } else {
        await this.selectFirstOptionByLabel('Deduction Source', { scope: dialog });
      }
      if (recoveryAmount !== undefined) {
        await this.fieldInputByLabel('Recovery Amount', { scope: dialog }).fill(String(recoveryAmount));
      }
    }
  }

  async submitApproveClaim(dialog) {
    const submitButton = dialog.getByRole('button', { name: 'Approve & Claim', exact: true });
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes('damage-loss-claims') && r.url().includes('/status') && r.request().method() === 'PATCH',
    );
    await submitButton.click();
    const response = await responsePromise;
    return response.json().catch(() => null);
  }

  async approveClaim(id, data) {
    const dialog = await this.openApproveModal(id);
    await this.fillApproveClaimForm(dialog, data);
    return this.submitApproveClaim(dialog);
  }

  async rejectClaim(id) {
    await this.gotoView(id);
    const rejectButton = this.page.getByRole('button', { name: 'Reject', exact: true });
    await expect(rejectButton).toBeEnabled({ timeout: 10000 });
    await rejectButton.click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes('damage-loss-claims') && r.url().includes('/status') && r.request().method() === 'PATCH',
    );
    await dialog.getByRole('button', { name: /Reject/i }).click();
    const response = await responsePromise;
    return response.json().catch(() => null);
  }
}

module.exports = DamageLossClaimPage;
