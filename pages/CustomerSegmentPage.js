const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Customer Segment (erpforce-fe: modules/crm/src/views/settings/customer-segments/) - confirmed
// real module, route `/dashboard/crm/settings/customer-segments`. Implements the cases documented
// in CRM_SETTINGS_TEST_CASES.md's "3. Customer Segments" section.
//
// CONFIRMED SOURCE BUG (view-customer-segment.tsx:366-372): the Submit button's own `onClick` is
// `(e) => console.log('Submit Clicked')` - a literal no-op. `setOpenQuickApprovalModal` is never
// called anywhere else in the file, so the rendered QuickApprovalModal is unreachable via any UI
// action. See submitClickIsNoOp() below - a genuine passing assertion that documents the gap
// (status never changes), not a test.fail() case like Shipping Rule's missing button.
//
// Only `name`, `company_id`, `start_date` are Yup-validated (add-customer-segment.tsx's inline
// schema) - `end_date`, `purchase_amount`, `purchase_count`, `segment_duration` have no rule at
// all, gated purely by the `autoassign` checkbox at the UI level.
//
// No is_active/status toggle exists in this module's UI (DynamicToggleButton is imported but never
// rendered in form.tsx) - unlike Shipping Rule, there's nothing to assert there.
class CustomerSegmentPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.listAddButton = page.getByRole('button', { name: 'Add' }).first();

    this.idInput = this.fieldInputByLabel('ID');
    this.nameInput = this.fieldInputByLabel('Name');
    // Confirmed on Shipping Rule that a `DynamicSearchSelect apiType='company'` field renders its
    // real live label as "Entity", not "Company" (en.ts's translation key name) - verified the same
    // way here before trusting it.
    this.companyField = 'Entity';
    this.startDateInput = this.fieldInputByLabel('Start Date');
    this.endDateInput = this.fieldInputByLabel('End Date');
    this.narrationInput = this.fieldTextareaByLabel('Narration');
    this.purchaseAmountInput = this.fieldInputByLabel('Purchase Amount');
    this.purchaseCountInput = this.fieldInputByLabel('Purchase Count');

    this.discardButton = page.getByRole('button', { name: 'Discard' });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    this.viewActionsButton = page.getByRole('button', { name: 'Actions' });
    this.viewSubmitButton = page.getByRole('button', { name: 'Submit', exact: true });

    this.nameRequiredError = page.getByText(/^Name is required$/i);
    this.companyRequiredError = page.getByText(/^Company is required$/i);
    this.startDateRequiredError = page.getByText(/^Start date is required$/i);
  }

  async gotoList() {
    await this.page.goto('/dashboard/crm/settings/customer-segments');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.listAddButton.click();
    await this.page.waitForURL('**/add-customer-segments');
    await this.page.waitForLoadState('networkidle');
  }

  fieldTextareaByLabel(labelText, { scope = this.page.getByRole('main') } = {}) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`);
    return scope.getByText(labelRegex).first().locator('xpath=..').locator('textarea').first();
  }

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

  async getSelectedValue(labelText) {
    const combobox = this.dependentFieldCombobox(labelText);
    const text = ((await combobox.textContent()) || '').replace(/[​﻿]/g, '').trim();
    return text || (await combobox.inputValue().catch(() => ''));
  }

  // ---------- autoassign checkbox (title prop, label='') ----------
  autoAssignCheckbox() {
    return this.page
      .getByText('Auto Assign', { exact: true })
      .locator('xpath=..')
      .getByRole('checkbox')
      .first();
  }

  async setAutoAssign(checked = true) {
    const box = this.autoAssignCheckbox();
    const isChecked = await box.isChecked();
    if (isChecked !== checked) {
      await box.click();
    }
  }

  async areDependentFieldsEnabled() {
    return !(await this.purchaseAmountInput.isDisabled());
  }

  // ---------- Fill helpers ----------
  async fillGeneralDetails({
    name,
    startDate,
    endDate,
    narration,
    autoassign,
    purchaseAmount,
    purchaseCount,
  } = {}) {
    if (name !== undefined) {
      await this.nameInput.fill(name);
    }
    if (startDate !== undefined) {
      await this.startDateInput.fill(startDate);
    }
    if (endDate !== undefined) {
      await this.endDateInput.fill(endDate);
    }
    if (autoassign !== undefined) {
      await this.setAutoAssign(autoassign);
    }
    if (purchaseAmount !== undefined) {
      await this.purchaseAmountInput.fill(String(purchaseAmount));
    }
    if (purchaseCount !== undefined) {
      await this.purchaseCountInput.fill(String(purchaseCount));
    }
    if (narration !== undefined) {
      await this.narrationInput.fill(narration);
    }
  }

  // ---------- Save actions ----------
  async saveAndCaptureId(buttonLocator) {
    await buttonLocator.click();
    await this.page.waitForURL((url) => !/\/(add|edit)-customer-segments/.test(url.pathname), {
      timeout: 20000,
    });
    await this.page.waitForLoadState('networkidle');
    await this.page
      .locator('.MuiSkeleton-root')
      .first()
      .waitFor({ state: 'detached', timeout: 10000 })
      .catch(() => {});

    const rowText = await this.page.locator('table tbody tr').first().innerText();
    const match = rowText.match(/[A-Z]+-\d{4}-\d+/);
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
    return this.getRowStatusMatching(seriesNumber, /Draft|Submitted|Approved|Rejected/);
  }

  async openEditFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await this.page.waitForURL('**/edit-customer-segments');
    await this.page.waitForLoadState('networkidle');
    await expect(this.nameInput).not.toHaveValue('', { timeout: 10000 });
  }

  async openViewFromList(seriesNumber) {
    await this.rowBySeriesNumber(seriesNumber).getByText(/Draft|Submitted|Approved|Rejected/).first().click();
    await this.page.waitForURL('**/view-customer-segments');
    await this.page.waitForLoadState('networkidle');
  }

  // ---------- Bug repro: Submit button is a no-op ----------
  // Returns the console message text if 'Submit Clicked' was logged (confirming the exact known
  // no-op handler fired) - null if nothing logged, which would itself be worth re-investigating.
  async clickSubmitAndCaptureConsole() {
    let consoleMessage = null;
    const handler = (msg) => {
      if (msg.text().includes('Submit Clicked')) consoleMessage = msg.text();
    };
    this.page.on('console', handler);
    await this.viewSubmitButton.click();
    await this.page.waitForTimeout(1000);
    this.page.off('console', handler);
    return consoleMessage;
  }
}

module.exports = CustomerSegmentPage;
