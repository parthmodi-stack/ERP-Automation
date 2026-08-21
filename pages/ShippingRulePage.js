const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Shipping Rule (erpforce-fe: modules/crm/src/views/settings/shipping-rules/) - confirmed real
// module, route `/dashboard/crm/settings/shippment-rules` (frontend route/folder name keeps the
// "shippment" typo; the backend API resource is `shipping-rules`, WITHOUT the typo - same class of
// frontend/backend naming drift documented on Loan Configuration). Implements the cases in
// CRM_SETTINGS_TEST_CASES.md's Shipping Rule section.
//
// CONFIRMED SOURCE BUG (edit-shippment-rules.tsx:43): `company_id.typeError('Name is required')` -
// the wrong message copy-pasted onto the wrong field. See triggerCompanyTypeError() below.
//
// CONFIRMED SOURCE BUG (view-shippment-rules.tsx:403-406): the Submit button is commented out of
// the JSX entirely - a Draft record can never be moved to Submitted via the UI, even though the
// redux/Quick-Approval plumbing behind it still exists. Do not attempt to automate a working
// Submit -> Quick Approval -> Accept/Reject path here; see submitButtonExists() below, which
// documents the gap instead of assuming it's automatable.
//
// `company_id` is a MULTISELECT (`is_multiselect` on its DynamicSearchSelect) - its popover does
// NOT auto-close on selection (same class of behavior as LoanConfigurationPage's Eligible
// Departments/Grades fields), so selectCompany() presses Escape itself afterward.
//
// Status toggle: `is_active`'s own adjacent label is a FIXED word ("Active", `common.active`), not
// a dynamic Active/Inactive string like Loan Configuration's Status toggle - but it's still located
// via the "Status" section heading two DOM levels up (same structural pattern), since a bare
// `toggleByLabel('Active')` risks colliding with the word "Active" appearing elsewhere on the page.
class ShippingRulePage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.listAddButton = page.getByRole('button', { name: 'Add' }).first();

    this.idInput = this.fieldInputByLabel('ID');
    this.nameInput = this.fieldInputByLabel('Name');
    // CONFIRMED LIVE (not en.ts, which declares "Company"): this field's real rendered label is
    // "Entity", and it comes pre-filled with this environment's one real company ("erp-force")
    // selected by default - the combobox's own displayed text is a count badge ("1 Companies
    // Selected"), never the company name itself, so selectCompany() is only for a test that
    // deliberately wants to change/verify the selection, not required for a plain Create flow.
    this.companyField = 'Entity';
    this.locationField = 'Location';
    this.shippingCostInput = this.fieldInputByLabel('Shipping Cost');
    this.handlingCostInput = this.fieldInputByLabel('Handling Cost');
    this.shippingAccountField = 'Shipping Account';
    this.handlingAccountField = 'Handling Account';
    this.narrationInput = this.fieldTextareaByLabel('Narration');

    this.discardButton = page.getByRole('button', { name: 'Discard' });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    this.viewActionsButton = page.getByRole('button', { name: 'Actions' });

    this.nameRequiredError = page.getByText(/^Name is required$/i);
    this.companyRequiredError = page.getByText(/^Company is Required$/i);
    this.shippingCostRequiredError = page.getByText(/^Shipiping cost is required$/i); // sic - matches source typo
    this.handlingCostRequiredError = page.getByText(/^Handling cost is required$/i);
    this.shippingAccountRequiredError = page.getByText(/^Shipiping account is required$/i); // sic
    this.handlingAccountRequiredError = page.getByText(/^Handling account is required$/i);
  }

  async gotoList() {
    await this.page.goto('/dashboard/crm/settings/shippment-rules');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.listAddButton.click();
    await this.page.waitForURL('**/add-shippment-rules');
    await this.page.waitForLoadState('networkidle');
  }

  // ---------- Textarea fields (is_multiline DynamicInput renders a <textarea>, not <input>) ----------
  fieldTextareaByLabel(labelText, { scope = this.page.getByRole('main') } = {}) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`);
    return scope.getByText(labelRegex).first().locator('xpath=..').locator('textarea').first();
  }

  // ---------- Status toggle (fixed "Active" title, located via the "Status" heading) ----------
  statusToggle() {
    return this.page
      .getByText('Status', { exact: true })
      .locator('xpath=../..')
      .getByRole('checkbox')
      .first();
  }

  async setStatus(active = true) {
    const toggle = this.statusToggle();
    const isChecked = await toggle.isChecked();
    if (isChecked !== active) {
      await toggle.click();
    }
  }

  // ---------- Company (multiselect - popover doesn't auto-close on selection) ----------
  async selectCompany(companyName = 'Trootech') {
    await this.selectFieldByLabel(this.companyField, companyName, { exact: false });
    await this.page.keyboard.press('Escape');
  }

  // ---------- Location (LocationSearchSelect, dependent on company_id) ----------
  dependentFieldCombobox(labelText) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
    return this.page
      .locator('main')
      .getByText(labelRegex)
      .first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
  }

  async isLocationEnabled() {
    return !(await this.dependentFieldCombobox(this.locationField).isDisabled());
  }

  async selectFirstLocation() {
    await this.selectFirstOptionByLabel(this.locationField);
  }

  async getSelectedValue(labelText) {
    const combobox = this.dependentFieldCombobox(labelText);
    const text = ((await combobox.textContent()) || '').replace(/[​﻿]/g, '').trim();
    return text || (await combobox.inputValue().catch(() => ''));
  }

  // ---------- Fill helpers ----------
  async fillGeneralDetails({
    name,
    company,
    pickFirstLocation,
    shippingCost,
    handlingCost,
    shippingAccount,
    pickFirstShippingAccount,
    handlingAccount,
    pickFirstHandlingAccount,
    active,
    narration,
  } = {}) {
    if (name !== undefined) {
      await this.nameInput.fill(name);
    }
    if (company) {
      await this.selectCompany(company);
    }
    if (pickFirstLocation) {
      await this.selectFirstLocation();
    }
    if (shippingCost !== undefined) {
      await this.shippingCostInput.fill(String(shippingCost));
    }
    if (handlingCost !== undefined) {
      await this.handlingCostInput.fill(String(handlingCost));
    }
    if (shippingAccount) {
      await this.selectFieldByLabel(this.shippingAccountField, shippingAccount, { exact: false });
    } else if (pickFirstShippingAccount) {
      await this.selectFirstOptionByLabel(this.shippingAccountField);
    }
    if (handlingAccount) {
      await this.selectFieldByLabel(this.handlingAccountField, handlingAccount, { exact: false });
    } else if (pickFirstHandlingAccount) {
      await this.selectFirstOptionByLabel(this.handlingAccountField);
    }
    if (active !== undefined) {
      await this.setStatus(active);
    }
    if (narration !== undefined) {
      await this.narrationInput.fill(narration);
    }
  }

  // ---------- Bug repro helpers ----------
  // TC-SHIP-V05: edit-shippment-rules.tsx:43 keys company_id's typeError to the wrong message.
  // Triggering it requires an invalid (non-array) company_id value, which isn't reachable through
  // normal UI interaction with the multiselect - documented here as a known limitation rather than
  // forced through an unrealistic interaction.
  async triggerCompanyTypeError() {
    // Clear any selected company then blur, which is the closest realistic UI trigger for the
    // field's own validation re-run.
    await this.page.keyboard.press('Escape');
  }

  // TC-SHIP-V07: view-shippment-rules.tsx:403-406 - the Submit button's whole JSX block is
  // commented out, so it should never be found on the page at all.
  submitButton() {
    return this.page.getByRole('button', { name: 'Submit', exact: true });
  }

  // ---------- Save actions ----------
  // CONFIRMED LIVE: the list's ID column renders a formatted series number ("SHR-2026-000020"),
  // NOT the bare numeric id the redux payload carries - read it back from the freshly-created
  // row's own DOM text (same class of fallback as LoanConfigurationPage.saveAndCaptureId) rather
  // than guessing the API JSON's exact field name for it.
  async saveAndCaptureId(buttonLocator) {
    await buttonLocator.click();
    // Confirm the Save actually navigated away from the Add/Edit form before looking for a list
    // row - a validation failure or a slow in-flight request can otherwise leave the page on the
    // form, where "table tbody tr" would never appear and any wait on it just times out unhelpfully.
    await this.page.waitForURL((url) => !/\/(add|edit)-shippment-rules/.test(url.pathname), {
      timeout: 20000,
    });
    await this.page.waitForLoadState('networkidle');
    // The list briefly renders MUI Skeleton placeholder rows even after the network settles - read
    // the real row text only once those have cleared (same class of wait as BasePage.getPaginationLabel).
    await this.page
      .locator('.MuiSkeleton-root')
      .first()
      .waitFor({ state: 'detached', timeout: 10000 })
      .catch(() => {});

    const rowText = await this.page.locator('table tbody tr').first().innerText();
    const match = rowText.match(/SHR-\d{4}-\d+/);
    const seriesNumber = match ? match[0] : rowText.split('\n')[0];
    return { id: seriesNumber, seriesNumber };
  }

  async save() {
    return this.saveAndCaptureId(this.saveButton);
  }

  async saveAsDraft() {
    return this.saveAndCaptureId(this.saveToDraftButton);
  }

  // ---------- Row status / navigation ----------
  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Draft|Active|Inactive|Submitted/);
  }

  async openEditFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await this.page.waitForURL('**/edit-shippment-rules');
    await this.page.waitForLoadState('networkidle');
    // form.tsx resets the whole form (`reset({ shippmentRules: data })`) whenever its fetched
    // `data` changes - CONFIRMED LIVE that a fill can land, pass an immediate assertion, and then
    // still get silently wiped back to the server value if that reset fires a beat late. Wait for
    // the Shipping Cost field to actually show its persisted (non-empty) value before returning,
    // so callers that fill it right after don't race that reset.
    await expect(this.shippingCostInput).not.toHaveValue('', { timeout: 10000 });
  }

  async openViewFromList(seriesNumber) {
    await this.rowBySeriesNumber(seriesNumber).getByText(/Draft|Active|Inactive|Submitted/).first().click();
    await this.page.waitForURL('**/view-shippment-rules');
    await this.page.waitForLoadState('networkidle');
  }

  async openEditFromView() {
    await this.viewActionsButton.click();
    await this.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await this.page.waitForURL('**/edit-shippment-rules');
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = ShippingRulePage;
