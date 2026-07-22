const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Accruals and Benefit Master (erpforce-hrms-fe: src/views/accruals-and-benefit/) - confirmed real
// module, route `/dashboard/hrms/company-master-policy/accruals-and-benefit`. Backend
// module/API resource is `accrual-master` (confirmed in redux/actionCreators.ts:
// getV1AccrualMaster/postV1AccrualMaster/etc., and reducer.ts's `action.payload.data` shape
// `{ accrual_master: [...] }`) - the frontend route slug and backend resource name differ, same
// class of naming split already seen on Loan Configuration/loan-master in this suite. Implements
// the cases documented in ACCRUALS_AND_BENEFIT_TEST_CASES.md marked "Automation Candidate: Yes";
// see that doc for the full 256-case catalogue, the "Manual first" cases NOT automated here, and
// the confirmed cross-stack bugs this suite specifically exercises.
//
// This is a SINGLE scrolling form (4 accordions: Basic Details / Calculation Methods /
// Classifications / Attachments, form/form.tsx), all defaultExpanded - same shape as Loan
// Configuration, not a tab wizard.
//
// CONFIRMED SOURCE FACT (utils/constants.ts, utils/commons.ts): "Methods" has exactly 2 real
// values - `fixed_value` ("Fixed Value") and `variable_salary_component` ("Variable Salary
// Component"). There is NO "Formula" method. "Type" (Allowance/Deduction) is a hardcoded 2-option
// FE enum (form.tsx:181-184), never sourced from the backend's separate `accrual-type` module
// (that lookup only feeds Leave Policy Master/Approval Dashboard).
//
// CONFIRMED SOURCE BUG (accrual-master.service.js): `amount`/`value` of exactly `0` pass the
// JSON-schema's `minimum:0` but are rejected by a stricter service-layer check
// ("Amount/Value must be a positive number"). `cap_limit = 0` bypasses BOTH of its own service
// guard clauses because they test `cap_limit` itself for truthiness - a real `0` is falsy in JS,
// so it silently skips the "must be positive" and "must be >= value" checks. See
// TC-ACC-CALC-07/19/21 in the test-case doc - these are deliberate bug-repro cases, not
// green-path assertions.
//
// CONFIRMED SOURCE FACT (utils/commons.ts's Yup schema): required-field error messages are
// distinct custom strings per field ("Please select company", "Please enter name", etc.), NOT
// the "{{field}} is required" pattern Loan Configuration/Leave Policy Master use - do not reuse
// those modules' error-locator regexes here.
//
// CONFIRMED SOURCE BUG (add/edit -accruals-and-benefit.hrms.tsx, form/form.tsx): `UploadMedia` is
// configured with `multiple={true}`, but every submit path only keeps `allUploadedFiles[0]` -
// uploading 2+ files silently drops everything after the first, with no user-facing warning. The
// backend column is a single `VARCHAR(255)` URL string, confirming this is a real storage
// constraint the picker UI doesn't communicate.
//
// CONFIRMED SOURCE FACT (edit-accruals-and-benefit.hrms.tsx:105 vs view-accruals-and-benefit.hrms.tsx:157/363):
// the Edit page's breadcrumb/ID field reads the raw numeric `id`, while View's breadcrumb and its
// own "ID" ValueField both read `accrual_id` (the `ACC0xx`-formatted business id) - a confirmed
// display inconsistency between the two pages for the exact same record.
//
// Row action menu (accruals-and-benefit.hrms.tsx:114-142): "View" and "Edit" render via
// `rowActionMenu` (permission-gated by canViewById/canEdit); "Delete" is a separate
// `destructiveActionMenu` entry (permission-gated by canDelete) - a "Duplicate" entry exists in
// source but is commented out, confirmed absent from the live menu, same as Loan Configuration.
//
// Company/Type/Methods/Frequency/Base Component/Operator are all `DynamicSelect` (single-select,
// same combobox mechanism as every other module's dropdown in this suite - use
// BasePage.selectFieldByLabel). Location/Department are `DynamicDependentField` with
// `is_multiselect`, both filtered on `company_id` (disabled until Company is selected, same
// mechanism as Loan Configuration's Location field) - Department additionally carries `required`.
class AccrualsAndBenefitPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.listAddButton = page.getByRole('button', { name: 'Add' }).first();

    // ---------- Basic Details ----------
    this.companyField = 'Company';
    this.nameInput = this.fieldInputByLabel('Name');
    this.typeField = 'Type';
    this.instructionsInput = this.fieldTextareaByLabel('Instructions');
    // CONFIRMED LIVE: Company auto-populates with the logged-in user's default company ("erp-force")
    // shortly after the Add page loads - same behavior already documented on DepartmentMasterPage's
    // own Company field. To exercise the disabled-until-Company state on Location/Department, the
    // auto-populated value must be actively cleared via this button, not just left unselected.
    this.clearCompanyButton = page.getByRole('button', { name: 'clear selection' }).first();

    // ---------- Calculation Methods ----------
    this.methodsField = 'Methods';
    // Fixed Value sub-fields
    this.amountInput = this.fieldInputByLabel('Amount');
    this.frequencyField = 'Frequency';
    // Variable Salary Component sub-fields
    this.baseComponentField = 'Base Component';
    this.operatorField = 'Operator';
    this.valueInput = this.fieldInputByLabel('Value');
    // Confirmed real label is "Cap/Limit" (with a slash), not "Cap Limit" - translations.json:
    // hrms.accruals_and_benefit.fields.cap_limit_label.
    this.capLimitInput = this.fieldInputByLabel('Cap/Limit');

    // ---------- Classifications ----------
    this.locationField = 'Location';
    this.departmentField = 'Department';

    // ---------- Required-field errors (utils/commons.ts's own custom Yup messages - NOT the
    // shared "{{field}} is required" pattern other HRMS modules in this suite use) ----------
    this.companyRequiredError = page.getByText(/^Please select company$/i);
    this.nameRequiredError = page.getByText(/^Please enter name$/i);
    this.typeRequiredError = page.getByText(/^Please select type$/i);
    this.methodRequiredError = page.getByText(/^Please select method$/i);
    this.amountRequiredError = page.getByText(/^Please enter amount$/i);
    this.frequencyRequiredError = page.getByText(/^Please select frequency$/i);
    this.baseComponentRequiredError = page.getByText(/^Please select base component$/i);
    this.operatorRequiredError = page.getByText(/^Please select operator$/i);
    this.valueRequiredError = page.getByText(/^Please enter value$/i);
    this.departmentRequiredError = page.getByText(/^Please select department$/i);

    // ---------- Page-level actions (same shared i18n keys as every HRMS module in this suite -
    // confirmed via erpforce-be/translations.json: common.buttons.{discard,saveAsDraft,save}_label) ----------
    this.discardButton = page.getByRole('button', { name: 'Discard' });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    this.viewActionsButton = page.getByRole('button', { name: 'Actions' });
  }

  async gotoList() {
    await this.page.goto('/dashboard/hrms/company-master-policy/accruals-and-benefit');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.listAddButton.click();
    await this.page.waitForURL('**/add-accruals-and-benefit');
    await this.page.waitForLoadState('networkidle');
  }

  // ---------- Textarea fields (is_multiline DynamicInput renders a <textarea>, not <input>) ----------
  fieldTextareaByLabel(labelText, { scope = this.page.getByRole('main') } = {}) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`);
    return scope.getByText(labelRegex).first().locator('xpath=..').locator('textarea').first();
  }

  // ---------- Calculation Methods ----------
  async selectMethod(method) {
    const label = method === 'fixed_value' ? 'Fixed Value' : 'Variable Salary Component';
    await this.selectFieldByLabel(this.methodsField, label, { exact: true });
  }

  async selectType(type) {
    const label = type === 'allowance' ? 'Allowance' : 'Deduction';
    await this.selectFieldByLabel(this.typeField, label, { exact: true });
  }

  async selectFrequency(frequency) {
    // Confirmed FE dropdown only offers these 3 (form.tsx:261-265) - `daily`/`weekly`/`quarterly`
    // are BE-enum-valid but UI-unreachable, see TC-ACC-CALC-11.
    const label = { monthly: 'Monthly', yearly: 'Annual', one_time: 'One-Time' }[frequency];
    await this.selectFieldByLabel(this.frequencyField, label, { exact: true });
  }

  async selectBaseComponent(baseComponent) {
    await this.selectFieldByLabel(this.baseComponentField, baseComponent, { exact: true });
  }

  async selectOperator(operator) {
    // Confirmed exact option labels include the symbol prefix (form.tsx:296-300).
    const label = {
      '+': '+ (Add)',
      '-': '- (Subtract)',
      '*': '* (Multiply)',
      '/': '/ (Divide)',
      '%': '% (Percentage)',
    }[operator];
    await this.selectFieldByLabel(this.operatorField, label, { exact: true });
  }

  // ---------- Location/Department (multiselect, company-scoped DynamicDependentField, same
  // mechanism confirmed for Loan Configuration's Location field) - option text is unverified live
  // master data, so pick whatever renders first rather than guessing a literal string. ----------
  async selectFirstMultiSelectOption(labelText) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
    const combobox = this.page
      .getByRole('main')
      .getByText(labelRegex)
      .first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    await combobox.click();
    const firstOption = this.page
      .getByRole('listbox')
      .getByRole('option')
      .filter({ hasNotText: /Select|No data available/ })
      .first();
    await firstOption.waitFor({ state: 'visible', timeout: 7000 });
    await firstOption.click();
    await this.page.keyboard.press('Escape');
  }

  // Selects a SPECIFIC, known option by exact text - used for Department, where a test creates
  // its own fresh Department record first instead of picking whatever pre-existing option happens
  // to render first. Picking first is unsafe for Department specifically: the live list is
  // large/shared/cumulative (hundreds of "Automation_*"/"SQLI_*" records accumulated across every
  // suite's past runs, confirmed live), so "first" drifts across runs and can land on a Department
  // scoped to a different Company than the one just selected, silently filtered out by this
  // field's own `filterFields=company_id` dependency.
  //
  // CONFIRMED LIVE: the popover's option list only renders its first fetched page (infinite-scroll
  // pagination) - a just-created record isn't reliably present in that unfiltered first page, so
  // scanning without filtering times out. Every popover of this type renders its own live search
  // textbox with accessible name `Search {label}` (confirmed: "Search Department"/"Search
  // Methods") - type into that first so the (debounced, server-side) filter narrows the list down
  // to just the target option before scanning for it.
  async selectMultiSelectOptionByText(labelText, optionText) {
    const combobox = this.dependentFieldCombobox(labelText);
    await combobox.click();

    const searchInput = this.page.getByPlaceholder(`Search ${labelText}`, { exact: true });
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill(optionText);
      await this.page.waitForTimeout(700); // debounced filter request
    }

    const found = await this.selectOptionFromListbox(optionText, { timeout: 8000 });
    if (!found) {
      throw new Error(`selectMultiSelectOptionByText("${labelText}"): option "${optionText}" never appeared`);
    }
    await this.page.keyboard.press('Escape');
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

  async isFieldEnabled(labelText) {
    return !(await this.dependentFieldCombobox(labelText).isDisabled());
  }

  async getSelectedValue(labelText) {
    const combobox = this.dependentFieldCombobox(labelText);
    const text = ((await combobox.textContent()) || '').replace(/[​﻿]/g, '').trim();
    return text || (await combobox.inputValue().catch(() => ''));
  }

  // ---------- Department "Create New Department" footer quick-add ----------
  // CONFIRMED SOURCE (erpforce-common-hub-fe/src/components/searchable-select.tsx): the popover's
  // footer MenuItem renders "Create New {field.label}" whenever `enable_footer || addType` is set
  // - `DynamicDependentField` (this form's Location/Department wrapper) always passes
  // `addType={apiType}`, so this fires for Department here exactly like it already does for
  // Location elsewhere in this suite (BasePage.createLocationFromFooter). `select-configuration.tsx`
  // maps `addType='department'` to `DepartmentAddModal`
  // (erpforce-common-hub-fe/src/components/department-add-modal.tsx): Company, Department Code,
  // and Department Name are required; Company is NOT pre-filled from the parent form (no
  // `initialValues`/`modalComponentProps` passed by this module's form.tsx), so it must be
  // selected inside the dialog explicitly.
  //
  // CONFIRMED SOURCE BUG (searchable-select.tsx's own `handleModalSave`): after a successful
  // create, it computes a `newValue` (existing selection + the new id) but never actually calls
  // `onChange`/`setValue` with it - the new Department is NOT auto-selected into the field, only
  // the option list is refetched. Every caller must manually re-select the just-created option by
  // name afterward, which this method does.
  async createDepartmentFromFooter(departmentName, departmentCode, companyName) {
    const combobox = this.dependentFieldCombobox(this.departmentField);
    await combobox.click();

    await this.page.getByText('Create New Department', { exact: false }).click();

    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });

    await this.selectFieldByLabel('Company', companyName, { exact: false, scope: dialog });
    await dialog.getByPlaceholder('Enter Department Code').fill(departmentCode);
    await dialog.getByPlaceholder('Enter Department Name').fill(departmentName);

    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });

    // Confirmed bug above: the new Department isn't auto-selected. The popover that was open
    // before the modal appeared is left in an indeterminate state once the dialog closes
    // (confirmed live: still "expanded", unfiltered) - force it fully closed before reopening
    // fresh, then let selectMultiSelectOptionByText's own search-box filtering find the new
    // option reliably regardless of the shared/cumulative list's size or sort order.
    await this.page.locator('body').click({ position: { x: 300, y: 10 }, force: true }).catch(() => {});
    await this.page.locator('.MuiPopover-root, .MuiMenu-root').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

    await this.selectMultiSelectOptionByText(this.departmentField, departmentName);
  }

  // ---------- Fill helpers ----------
  async fillBasicDetails({ company, name, type, instructions } = {}) {
    if (company) {
      await this.selectFieldByLabel(this.companyField, company, { exact: false });
    }
    if (name !== undefined) {
      await this.nameInput.fill(name);
    }
    if (type) {
      await this.selectType(type);
    }
    if (instructions !== undefined) {
      await this.instructionsInput.fill(instructions);
    }
  }

  async fillCalculationMethods({
    method,
    amount,
    frequency,
    baseComponent,
    operator,
    value,
    capLimit,
  } = {}) {
    if (method) {
      await this.selectMethod(method);
    }
    if (amount !== undefined) {
      await this.amountInput.fill(String(amount));
    }
    if (frequency) {
      await this.selectFrequency(frequency);
    }
    if (baseComponent) {
      await this.selectBaseComponent(baseComponent);
    }
    if (operator) {
      await this.selectOperator(operator);
    }
    if (value !== undefined) {
      await this.valueInput.fill(String(value));
    }
    if (capLimit !== undefined) {
      await this.capLimitInput.fill(String(capLimit));
    }
  }

  // `department`/`location` (exact name) is the preferred path - pass the name of a Department/
  // Location record the test just created itself (see AccrualsAndBenefitPage's spec-level
  // helper), so the selection is deterministic instead of depending on shared/cumulative live
  // master data. `pickFirstLocation`/`pickFirstDepartment` remain for callers that only care that
  // *something* got selected (e.g. asserting the field isn't blank on View).
  async fillClassifications({ pickFirstLocation, pickFirstDepartment, location, department } = {}) {
    if (location) {
      await this.selectMultiSelectOptionByText(this.locationField, location);
    } else if (pickFirstLocation) {
      await this.selectFirstMultiSelectOption(this.locationField);
    }
    if (department) {
      await this.selectMultiSelectOptionByText(this.departmentField, department);
    } else if (pickFirstDepartment) {
      await this.selectFirstMultiSelectOption(this.departmentField);
    }
  }

  // ---------- Attachments ----------
  // UploadMedia (@erpsquad/common) is a pre-built shared component with no accessible source in
  // this checkout - its actual file input is located structurally via the standard hidden
  // <input type="file"> pattern rather than by any component-specific selector.
  async uploadAttachment(filePath) {
    await this.page.locator('input[type="file"]').first().setInputFiles(filePath);
  }

  // ---------- Save actions ----------
  // Same reasoning as every other HRMS page object in this suite - capture the just-created/
  // updated record from the list's own refetch JSON. CONFIRMED shape (reducer.ts/actionCreators.ts):
  // `{ data: { accrual_master: [...] } }` - keyed `accrual_master` (the BACKEND resource name), and
  // the network URL itself contains "accrual-master", not "accruals-and-benefit" (the FE route slug).
  async saveAndCaptureId(buttonLocator) {
    const listResponsePromise = this.page.waitForResponse((r) =>
      r.url().includes('accrual-master') && r.request().method() === 'GET',
    );
    await buttonLocator.click();
    const listResponse = await listResponsePromise;
    await this.page.waitForLoadState('networkidle');
    const body = await listResponse.json().catch(() => null);
    const record = body?.data?.accrual_master?.[0];

    const id = record?.id !== undefined ? String(record.id) : undefined;
    let accrualId = record?.accrual_id;
    if (!accrualId) {
      accrualId = await this.page.locator('table tbody tr').first().innerText();
    }
    return { id, seriesNumber: accrualId };
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

  // Confirmed via accruals-and-benefit.hrms.tsx's own rowActionMenu (lines 114-142): "View" and
  // "Edit" are both row-menu items (unlike Loan Configuration, which has no "View" menu item and
  // instead navigates via a row/chip click) - use the menu for both, same pattern as
  // LeavePolicyMasterPage.
  async openViewFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'View', exact: true }).click();
    await this.page.waitForURL('**/view-accruals-and-benefit');
    await this.page.waitForLoadState('networkidle');
  }

  async openEditFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await this.page.waitForURL('**/edit-accruals-and-benefit');
    await this.page.waitForLoadState('networkidle');
  }

  async openEditFromView() {
    await this.viewActionsButton.click();
    await this.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await this.page.waitForURL('**/edit-accruals-and-benefit');
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = AccrualsAndBenefitPage;
