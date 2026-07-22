const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Salary Structure Master (erpforce-hrms-fe: src/views/salary-structure-master/) - route
// `/dashboard/hrms/company-master-policy/salary-structure-master`. Unlike Leave Policy Master's
// 4-tab wizard, this is a SINGLE scrolling form built from 4 always-expanded MUI Accordions:
// Basic Details / Components / Overtime / Classification (form/form.tsx). Every accordion is
// rendered at once, so there is no Next/Back stepper - Save/Discard/Save-To-Draft are the only
// footer actions (add-salary-structure.hrms.tsx). Draft vs Active/Inactive only - NO approval
// workflow (no Submit/Accept/Reject anywhere in the module).
//
// LABELS: all field labels below are the exact rendered English strings pulled from
// erpforce-be/translations/hrms.json (e.g. Grades, "Amount / Percentage", "Calculation Mathod"
// [sic - the app's own typo], "Is Taxable?"), NOT the prompt's assumed wording. The plain
// text/number inputs (Salary Structure Name, Minimum/Maximum Salary, ID) are DynamicInput fields
// whose visible label is a plain paragraph with no ARIA association - located structurally via
// BasePage.fieldInputByLabel(), same pattern already proven on Leave Policy Master.
//
// OVERTIME GOTCHA: the three overtime rows (Over Time Pay / Special Overtime Pay / Night Shift
// Pay) each render a "Salary Component" select and a "Value" input with IDENTICAL labels - a bare
// selectFieldByLabel('Salary Component') would always hit the first row. They are disambiguated by
// scoping the lookup to the row container that holds the row's own checkbox label (see
// overtimeRow()). Also confirmed from utils/validation.ts: overtime Salary Component / Value are
// NOT required-when-enabled (the prompt claims they are) - only a `max(100)` yup rule applies to
// each percentage. That gap is documented, not asserted as if it were enforced.
//
// COMPONENTS GRID: the Components accordion is a MaterialEditableTable that AUTO-SEEDS two
// undeletable rows on Add - "Basic Allowance" and "Gross Allowance" (form.tsx useEffect on
// mode==='add'); their Component Name cell is disabled and deleting them fires the snackbar
// "Cannot delete Basic or Gross allowance components". Inline row create/edit interaction on this
// grid is NOT automated here (same stance as Leave Policy Master's react-querybuilder controls) -
// the editable-cell selectors aren't verified live; the helpers below only cover the confirmed
// stable surface (default rows present, delete-guard snackbar).
class SalaryStructureMasterPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.listAddButton = page.getByRole('button', { name: 'Add' }).first();

    // ---------- Basic Details accordion ----------
    this.idField = this.fieldInputByLabel('ID');
    this.structureNameInput = this.fieldInputByLabel('Salary Structure Name');
    this.minSalaryInput = this.fieldInputByLabel('Minimum Salary');
    this.maxSalaryInput = this.fieldInputByLabel('Maximum Salary');
    // Combobox-based fields - driven via BasePage.selectFieldByLabel using these label strings.
    this.gradeField = 'Grades';
    this.employmentTypeField = 'Employment Type';
    this.companyField = 'Company';
    this.currencyField = 'Currency';
    this.locationField = 'Location';
    this.departmentField = 'Department';

    // ---------- Required-field inline errors ----------
    // Template `{{field}} is required` (common.validation.required), field = the exact label above.
    this.companyRequiredError = page.getByText(/Company is required/i);
    this.structureNameRequiredError = page.getByText(/Salary Structure Name is required/i);
    this.gradeRequiredError = page.getByText(/Grades is required/i);
    this.employmentTypeRequiredError = page.getByText(/Employment Type is required/i);
    this.maxSalaryRequiredError = page.getByText(/Maximum Salary is required/i);

    // ---------- Footer actions ----------
    // Add page: t('common.buttons.discard_label')/saveAsDraft_label/save_label. Edit page:
    // t('common.discard')/t('common.save') + Save-To-Draft only when the record is a Draft. Both
    // resolve to the same visible words, so one locator each covers Add and Edit.
    this.discardButton = page.getByRole('button', { name: 'Discard' });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    this.viewActionsButton = page.getByRole('button', { name: 'Actions' });
  }

  // ---------- Navigation ----------
  async gotoList() {
    await this.page.goto('/dashboard/hrms/company-master-policy/salary-structure-master');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.listAddButton.click();
    await this.page.waitForURL('**/add-salary-structure-master');
    await this.page.waitForLoadState('networkidle');
  }

  // ---------- Basic Details ----------
  // Every arg is optional so validation tests can fill an arbitrary subset. Company is selected
  // FIRST because Currency auto-fills from it and Location/Department are filtered by it - filling
  // them before Company would either no-op or race the company-scoped refetch (form.tsx).
  async fillBasicDetails({
    company,
    structureName,
    grade,
    employmentType,
    minSalary,
    maxSalary,
  } = {}) {
    if (company) {
      await this.selectFieldByLabel(this.companyField, company, { exact: false });
    }
    if (structureName !== undefined) {
      await this.structureNameInput.fill(structureName);
    }
    if (grade) {
      await this.selectFieldByLabel(this.gradeField, grade, { exact: false });
    } else if (grade === null) {
      // Explicit request for "whatever grade exists" when no literal is pinned in this account.
      await this.selectFirstOptionByLabel(this.gradeField);
    }
    if (employmentType) {
      await this.selectFieldByLabel(this.employmentTypeField, employmentType, { exact: false });
    }
    if (minSalary !== undefined) {
      await this.minSalaryInput.fill(String(minSalary));
    }
    if (maxSalary !== undefined) {
      await this.maxSalaryInput.fill(String(maxSalary));
    }
  }

  // ---------- Classification ----------
  async fillClassification({ location, company, department } = {}) {
    if (location) {
      // Same reasoning as Leave Policy Master: this account has no stable pinnable Location, and
      // selectFieldByLabel throws (rather than falling back) when the value isn't present - create
      // a fresh Location through the field's own "Create New Location" footer instead.
      await this.createLocationFromFooter(location, company || 'erp-force');
    }
    if (department) {
      await this.selectFieldByLabel(this.departmentField, department, { exact: false });
    }
  }

  // ---------- Currency (auto-filled, disabled) ----------
  currencyCombobox() {
    return this.dependentFieldCombobox(this.currencyField);
  }

  async getCurrencyValue() {
    const combobox = this.currencyCombobox();
    const text = ((await combobox.textContent()) || '').replace(/[​﻿]/g, '').trim();
    return text || (await combobox.inputValue().catch(() => ''));
  }

  // Structural combobox lookup by its label - handles fields whose value pre-populates on Edit or
  // that render disabled (Currency), where a name-based getByRole('combobox',{name}) wouldn't match.
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

  async isLocationEnabled() {
    return !(await this.dependentFieldCombobox(this.locationField).isDisabled());
  }

  async isDepartmentEnabled() {
    return !(await this.dependentFieldCombobox(this.departmentField).isDisabled());
  }

  // ---------- Overtime rows ----------
  // Locates the container for one overtime row by its own checkbox label, so the row-local
  // "Salary Component" select and "Value" input can be reached despite all three rows reusing the
  // exact same field labels. `.form--CheckboxSection` is the per-row wrapper (form.tsx).
  overtimeRow(checkboxLabel) {
    return this.page
      .getByText(checkboxLabel, { exact: true })
      .locator('xpath=ancestor::*[contains(@class,"form--CheckboxSection")][1]');
  }

  overtimeCheckbox(checkboxLabel) {
    return this.overtimeRow(checkboxLabel).getByRole('checkbox').first();
  }

  async setOvertimeEnabled(checkboxLabel, enabled = true) {
    const checkbox = this.overtimeCheckbox(checkboxLabel);
    if ((await checkbox.isChecked()) !== enabled) {
      await checkbox.click();
    }
  }

  overtimeValueInput(checkboxLabel) {
    return this.overtimeRow(checkboxLabel).locator('input[type="text"], input:not([type])').last();
  }

  async setOvertimeValue(checkboxLabel, value) {
    await this.overtimeValueInput(checkboxLabel).fill(String(value));
  }

  // ---------- Components grid ----------
  // Row matched by its (visible) component-name text within the editable table.
  componentRow(componentName) {
    return this.page.locator('tr', {
      has: this.page.getByText(componentName, { exact: true }),
    });
  }

  async componentRowCount() {
    return this.page.locator('.form--Accordion table tbody tr').count();
  }

  // ---------- Save / capture id ----------
  // Same shape as every other HRMS page object here - grab the just-created record off the list's
  // own refetch. List response confirmed (redux/actionCreators.ts): the GET on
  // `.../salary-structure-master` returns `{ data: { salary_structure_master: [...] }, pagination }`
  // (pagination is a SIBLING of data, not nested), newest row first.
  async saveAndCaptureId(buttonLocator) {
    const listResponsePromise = this.page.waitForResponse(
      (r) => r.url().includes('salary-structure-master') && r.request().method() === 'GET',
    );
    await buttonLocator.click();
    const listResponse = await listResponsePromise;
    await this.page.waitForLoadState('networkidle');
    const body = await listResponse.json().catch(() => null);
    const record = body?.data?.salary_structure_master?.[0];

    const id = record?.id !== undefined ? String(record.id) : undefined;
    let seriesNumber = record?.series_number;
    if (!seriesNumber) {
      seriesNumber = (await this.page.locator('table tbody tr').first().innerText().catch(() => '')).trim();
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
    await this.page.waitForURL('**/edit-salary-structure-master');
    await this.page.waitForLoadState('networkidle');
  }

  async openViewFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'View', exact: true }).click();
    await this.page.waitForURL('**/view-salary-structure-master');
    await this.page.waitForLoadState('networkidle');
  }

  // Convenience full-create for tests that only need a persisted record to act on, not the create
  // flow itself. Selects the first available Grade (no pinned literal in this account).
  async createSalaryStructure({ structureName, company = 'erp-force', employmentType = 'Unlimited' } = {}) {
    await this.goto();
    await this.fillBasicDetails({ company, structureName, grade: null, employmentType });
    return this.save();
  }
}

module.exports = SalaryStructureMasterPage;
