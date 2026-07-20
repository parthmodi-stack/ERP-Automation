const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Leave Policy Master (erpforce-hrms-fe: src/views/leave-policy-master/) - a 4-TAB wizard form
// (Leave Type -> Eligibility Rules -> Carry Forward -> Encashment), confirmed via MUI Lab
// TabContext/TabList/TabPanel in form.tsx. There is NO Previous/Back button between tabs - the
// only way back is clicking an earlier tab's label directly (confirmed: add-leave-policy.hrms.tsx
// only renders Discard/Save-To-Draft/Next-or-Save). "Save" only renders once the LAST tab
// (Encashment) is active; every earlier tab shows "Next" instead.
//
// Company -> Location/Department dependency (this module's explicit test-under-focus, per
// LEAVE_POLICY_MASTER_TEST_CASES.md) uses the exact same `DynamicDependentField` component as
// Company Calendar: Location/Department are disabled until Company is selected, filtered by
// company_id, and reset when Company changes.
//
// Checkboxes (Requires Document Upload, Allowed on Holidays, Allow During Probation, Allowed As
// Half Day, Enable Carry Forward, Include Balance Display, Enable Encashment, Allow on
// Resignation, Allow Advance Pay, Payroll Integration) are all `DynamicCheckBox` instances that do
// NOT get a `name` attribute forwarded to the underlying MUI Checkbox (confirmed pattern already
// hit in Organization Structure's "Mark as Week Off" and Company Calendar's own checkboxes) - they
// are located structurally via their adjacent label text, not by name/label association.
class LeavePolicyMasterPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.listAddButton = page.getByRole('button', { name: 'Add' }).first();

    // Tabs (MUI Tabs, className 'form--Tab' on Add/Edit, 'viewLeavePolicyEntry--Tab' on View -
    // role="tab" works for both since it's the same MUI component underneath).
    this.leaveTypeTab = page.getByRole('tab', { name: 'Leave Type' });
    this.eligibilityRulesTab = page.getByRole('tab', { name: 'Eligibility Rules' });
    this.carryForwardTab = page.getByRole('tab', { name: 'Carry Forward' });
    this.encashmentTab = page.getByRole('tab', { name: 'Encashment' });

    // Leave Type tab fields - CONFIRMED LIVE: unlike Document Master/Company Calendar, this
    // form's field "label" is a plain <p> paragraph, NOT a real MUI-associated <label> (page
    // snapshot: `paragraph: Leave Type Title *` sits beside `textbox "Enter Leave title"` with no
    // ARIA association) - getByLabel() never matches. Plain text/number/date inputs are located
    // structurally via fieldInputByLabel() instead; Annual Entitlement's spinbutton doesn't even
    // have a placeholder, so getByPlaceholder wouldn't fully cover this either.
    this.companyField = 'Company';
    this.leaveCategoryField = 'Leave Category';
    this.leaveTypeTitleInput = this.fieldInputByLabel('Leave Type Title');
    this.annualEntitlementInput = this.fieldInputByLabel('Annual Entitlement');
    this.accrualTypeField = 'Accrual Type';
    this.effectiveFromInput = this.fieldInputByLabel('Effective From');
    this.locationField = 'Location';
    this.departmentField = 'Department';

    // Carry Forward tab
    this.maxCarryForwardDaysInput = this.fieldInputByLabel('Max Carry Forward Days');
    this.carryForwardTypeField = 'Carry Forward Type';

    // Encashment tab
    this.minimumBalanceRequiredInput = this.fieldInputByLabel('Minimum Balance Required');
    this.maximumDaysPerYearInput = this.fieldInputByLabel('Maximum Days Per Year');
    this.encashmentFormulaField = 'Encashment Formula';
    this.encashmentValueInput = this.fieldInputByLabel('Value');

    // Eligibility Rules tab (react-querybuilder based, NOT a MaterialEditableTable grid)
    this.addNewRuleButton = page.getByText('Add New Rule', { exact: true });
    this.addMoreRuleButton = page.getByText('Add More', { exact: true });
    this.clearAllRulesButton = page.getByText('Clear All Rules', { exact: true });
    this.ruleCard = page.locator('.elegibilityRuleBuilder--RuleCard');

    // Required-field error text - "{{field}} is required" template, field names confirmed from
    // translations/hrms.json.
    this.leaveTitleRequiredError = page.getByText(/Leave Type Title is required/i);
    this.leaveCategoryRequiredError = page.getByText(/Leave Category is required/i);
    this.effectiveFromRequiredError = page.getByText(/Effective From is required/i);
    this.companyRequiredError = page.getByText(/Company is required/i);

    // Page-level actions - same shared i18n keys/wording confirmed across every HRMS module in
    // this suite (Document Master, Company Calendar, Organization Structure).
    this.discardButton = page.getByRole('button', { name: 'Discard' });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.nextButton = page.getByRole('button', { name: 'Next', exact: true });

    this.viewActionsButton = page.getByRole('button', { name: 'Actions' });
  }

  async gotoList() {
    await this.page.goto('/dashboard/hrms/company-master-policy/leave-policy-master');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.listAddButton.click();
    await this.page.waitForURL('**/add-leave-policy-master');
    await this.page.waitForLoadState('networkidle');
  }

  // fieldInputByLabel() now lives on BasePage (shared - the same plain-paragraph-label pattern
  // showed up beyond just this module) - see BasePage.js.

  // Structural lookup for DynamicCheckBox instances - see class comment on why this can't use
  // getByLabel/name. Finds the label text, then the nearest checkbox in the same row container.
  checkboxByLabel(labelText) {
    return this.page
      .getByText(labelText, { exact: true })
      .locator('xpath=..')
      .getByRole('checkbox')
      .first();
  }

  async setCheckbox(labelText, checked = true) {
    const checkbox = this.checkboxByLabel(labelText);
    const isChecked = await checkbox.isChecked();
    if (isChecked !== checked) {
      await checkbox.click();
    }
  }

  // ---------- Leave Type tab ----------
  async fillLeaveTypeTab({
    company,
    leaveCategory,
    title,
    annualEntitlement,
    accrualType,
    effectiveFrom,
    location,
    department,
    requiresDocumentUpload,
    allowedOnHolidays,
    allowDuringProbation,
    allowedAsHalfDay,
  } = {}) {
    if (company) {
      await this.selectFieldByLabel(this.companyField, company, { exact: false });
    }
    if (leaveCategory) {
      await this.selectFieldByLabel(this.leaveCategoryField, leaveCategory, { exact: false });
    }
    if (title !== undefined) {
      await this.leaveTypeTitleInput.fill(title);
    }
    if (annualEntitlement !== undefined) {
      await this.annualEntitlementInput.fill(String(annualEntitlement));
    }
    if (accrualType) {
      await this.selectFieldByLabel(this.accrualTypeField, accrualType, { exact: false });
    }
    if (effectiveFrom !== undefined) {
      await this.effectiveFromInput.fill(effectiveFrom);
    }
    if (requiresDocumentUpload !== undefined) {
      await this.setCheckbox('Requires Document Upload', requiresDocumentUpload);
    }
    if (allowedOnHolidays !== undefined) {
      await this.setCheckbox('Allowed on Holidays', allowedOnHolidays);
    }
    if (allowDuringProbation !== undefined) {
      await this.setCheckbox('Allow During Probation', allowDuringProbation);
    }
    if (allowedAsHalfDay !== undefined) {
      await this.setCheckbox('Allowed As Half Day', allowedAsHalfDay);
    }
    if (location) {
      // Confirmed live: this account's Location master data doesn't contain a stable/pinnable
      // set of real city names, and selectFieldByLabel does NOT fall back to "first available"
      // on its own (only selectFirstOptionByLabel does) - it throws instead. Always create a
      // fresh Location via the dropdown's own "Create New Location" footer rather than guessing
      // an existing name (see BasePage.createLocationFromFooter).
      await this.createLocationFromFooter(location, company || 'erp-force');
    }
    if (department) {
      await this.selectFieldByLabel(this.departmentField, department, { exact: false });
    }
  }

  async isLocationEnabled() {
    return !(await this.dependentFieldCombobox(this.locationField).isDisabled());
  }

  async isDepartmentEnabled() {
    return !(await this.dependentFieldCombobox(this.departmentField).isDisabled());
  }

  dependentFieldCombobox(labelText) {
    return this.page
      .getByText(labelText, { exact: false })
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

  // ---------- Carry Forward tab ----------
  async fillCarryForwardTab({ enabled, maxDays, carryForwardType, includeBalanceDisplay } = {}) {
    if (enabled !== undefined) {
      await this.setCheckbox('Enable Carry Forward', enabled);
    }
    if (maxDays !== undefined) {
      await this.maxCarryForwardDaysInput.fill(String(maxDays));
    }
    if (carryForwardType) {
      await this.selectFieldByLabel(this.carryForwardTypeField, carryForwardType, { exact: false });
    }
    if (includeBalanceDisplay !== undefined) {
      await this.setCheckbox('Include Balance Display', includeBalanceDisplay);
    }
  }

  async isMaxCarryForwardDaysEnabled() {
    return !(await this.maxCarryForwardDaysInput.isDisabled());
  }

  // ---------- Encashment tab ----------
  async fillEncashmentTab({
    enabled,
    minimumBalance,
    maximumDaysPerYear,
    allowOnResignation,
    allowAdvancePay,
    encashmentFormula,
    value,
    payrollIntegration,
  } = {}) {
    if (enabled !== undefined) {
      await this.setCheckbox('Enable Encashment', enabled);
    }
    if (minimumBalance !== undefined) {
      await this.minimumBalanceRequiredInput.fill(String(minimumBalance));
    }
    if (maximumDaysPerYear !== undefined) {
      await this.maximumDaysPerYearInput.fill(String(maximumDaysPerYear));
    }
    if (allowOnResignation !== undefined) {
      await this.setCheckbox('Allow on Resignation', allowOnResignation);
    }
    if (allowAdvancePay !== undefined) {
      await this.setCheckbox('Allow Advance Pay', allowAdvancePay);
    }
    if (encashmentFormula) {
      await this.selectFieldByLabel(this.encashmentFormulaField, encashmentFormula, { exact: false });
    }
    if (value !== undefined) {
      await this.encashmentValueInput.fill(String(value));
    }
    if (payrollIntegration !== undefined) {
      await this.setCheckbox('Payroll Integration', payrollIntegration);
    }
  }

  async isMinimumBalanceRequiredEnabled() {
    return !(await this.minimumBalanceRequiredInput.isDisabled());
  }

  // ---------- Eligibility Rules tab ----------
  // Adding a rule always seeds one default empty condition (react-querybuilder's own default
  // behavior) - no separate "add condition" click is needed for the first condition of a new rule.
  async addRule() {
    const button = (await this.addNewRuleButton.isVisible().catch(() => false))
      ? this.addNewRuleButton
      : this.addMoreRuleButton;
    await button.click();
  }

  // Sets the Action dropdown for the rule at `ruleIndex` (0-based). Field/Operator/Value editor
  // interaction inside the condition row is NOT implemented here - the react-querybuilder
  // controls (field-select.tsx/operator-select.tsx/value-editor.tsx) are custom MUI Selects
  // without a confirmed label/name association from source; verify the exact selector live
  // before extending this method to fill a condition's Field/Operator/Value.
  async setRuleAction(ruleIndex, action) {
    const card = this.ruleCard.nth(ruleIndex);
    await this.selectFieldByLabel('Action', action, { exact: true, scope: card });
  }

  async deleteRule(ruleIndex) {
    await this.ruleCard.nth(ruleIndex).locator('.elegibilityRuleBuilder--ButtonGroup--DeleteButton').first().click();
  }

  // ---------- Navigation ----------
  async goToTab(tabName) {
    await this.page.getByRole('tab', { name: tabName, exact: true }).click();
  }

  async clickNext() {
    await this.nextButton.click();
  }

  // ---------- Save actions ----------
  // Same reasoning as every other HRMS page object in this suite - capture the just-created/
  // updated record from the list's own refetch JSON. Confirmed shape:
  // `{ data: { leave_policy_master: [...] } }` for the list, with `pagination` as a SIBLING of
  // `data`, not nested under it.
  async saveAndCaptureId(buttonLocator) {
    const listResponsePromise = this.page.waitForResponse((r) =>
      r.url().includes('leave-policy-master') && r.request().method() === 'GET',
    );
    await buttonLocator.click();
    const listResponse = await listResponsePromise;
    await this.page.waitForLoadState('networkidle');
    const body = await listResponse.json().catch(() => null);
    const record = body?.data?.leave_policy_master?.[0];

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
    await this.page.waitForURL('**/edit-leave-policy-master');
    await this.page.waitForLoadState('networkidle');
  }

  async openViewFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'View', exact: true }).click();
    await this.page.waitForURL('**/view-leave-policy-master');
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = LeavePolicyMasterPage;
