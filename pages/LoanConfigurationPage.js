const { expect } = require("@playwright/test");
const BasePage = require("./BasePage");

// Loan Configuration (erpforce-hrms-fe: src/views/loan-configuration/) - confirmed real module,
// route `/dashboard/hrms/loan-configuration`. Backend module/API path is `loan-master`, NOT
// `loan-configuration` - the frontend route name and the backend resource name genuinely differ
// (confirmed in redux/actionCreator.tsx: getV1LoanMaster/postV1LoanMaster/etc., and
// reducer.tsx's `action.payload.data.loan_master`). Implements the cases documented in
// LOAN_CONFIGURATION_TEST_CASES.md marked "Automation: Yes"; see that doc for the full 278-case
// catalogue, the "Manual first" cases NOT automated here, and the confirmed cross-stack bugs this
// suite specifically exercises.
//
// This is a SINGLE scrolling form (5 accordions: Basic Details / Loan Limits / Repayment
// Configuration / Eligibility Criteria / Classification), NOT a tab wizard like Leave Policy
// Master - confirmed via form.tsx's plain stacked <Accordion> sections, all defaultExpanded.
//
// CONFIRMED SOURCE BUG (utils/validator.tsx:38 vs form/form.tsx:313): the Yup schema's
// required-when-Flat-selected rule for the Late Payment Penalty amount is keyed
// `late_payment_penalty_value`/`late_payment_penalty_type`, but the form's REAL field names are
// `late_penalty_value`/`late_penalty_type`. Since the watched field never matches, the "required"
// rule never fires - a blank Flat Amount penalty is never blocked. The Percentage sub-field
// (`late_penalty_percentage`, validator.tsx:46) uses the CORRECT field name and DOES validate
// properly - only the Flat path is broken. See lateAmountBugAllowsBlankSave() below.
//
// CONFIRMED SOURCE FIX (add-loan-configuration.tsx/edit-loan-configuration.tsx's own
// "MAX LOAN AMOUNT FIX"/"LATE PAYMENT PENALTY FIX" comments): on read-back (Edit preload), both
// Max Loan Amount and Late Payment Penalty correctly re-split the backend's single stored value
// back into the FE's two-field (amount vs percentage) representation based on the saved *_type -
// so Edit/View round-tripping these values is NOT buggy, only the Flat-required-validation is.
//
// CONFIRMED SOURCE BUG (view-loan-configuration.tsx:409): `data?.[LOCATION_DATA].name` has NO
// optional-chaining before `.name` (every other field on this page uses `?.`) - viewing a record
// that was saved with Location left blank should throw and crash the View page's render. See
// viewCrashesWhenLocationBlank() below - a genuinely high-value regression case, not a guess.
//
// `enablePages={false}` is this shared ListingComponent's own DEFAULT value (confirmed in
// erpforce-hrms-fe/src/components/listing/listing.tsx:42) - Leave Policy Master doesn't even pass
// it explicitly and its pagination bar works fine (TC-LPM-L03), so this prop does NOT disable
// pagination; LOAN_CONFIGURATION_TEST_CASES.md's PAGE-01 "discrepancy" is resolved: it controls
// something unrelated (likely a dynamic-page-template feature), not row pagination.
//
// Status/Auto Deduct EMIs/Allow Pre-Closure/Limited are all `DynamicToggleButton` (a native
// checkbox-role input, MUI Switch under the hood) whose adjacent label Typography is a SIBLING,
// not a wrapping <label> (confirmed in toggle-switch.tsx - same non-association bug already known
// from Leave Policy Master's checkboxes) - located structurally, not by accessible name. The
// Status toggle is a special case: its own adjacent label text is the DYNAMIC "Active"/"Inactive"
// string (form.tsx:154), not a fixed word, so it's located via the fixed "Status" section heading
// above it instead of via toggleByLabel().
//
// Max Loan Amount/Late Payment Penalty's four numeric sub-inputs all render with an EMPTY
// `label=''` (form.tsx) - only a shared placeholder ("Amount"/"Percentage", `common.placeholders.*`)
// distinguishes them, and that placeholder repeats across both sections. Confirmed DOM order from
// form.tsx (not live-verified): Max Loan Amount's Fixed/Percentage inputs render BEFORE Late
// Payment Penalty's Flat/Percentage inputs, so `.nth(0)` is Max Loan Amount's, `.nth(1)` is Late
// Payment Penalty's, for each placeholder group.
class LoanConfigurationPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.listAddButton = page.getByRole("button", { name: "Add" }).first();

    // ---------- Basic Details ----------
    this.companyField = "Company";
    this.loanNameInput = this.fieldInputByLabel("Loan Name");
    this.categoryField = "Category"; // list column header is "Loan Type" for this SAME field - form label is "Category"
    this.descriptionInput = this.fieldTextareaByLabel("Description");
    // A generic label-text lookup for "Company" is ambiguous on this page: the Listing page's own
    // "Company" column header (confirmed live via DOM dump - Mui-TableHeadCell-Content classes)
    // can still be present/matched by a bare getByText("Company") even on the Add form, so this
    // targets the field's own stable `data-name` attribute (set by the shared FormParser) instead.
    this.companyClearButton = page
      .locator('[data-name="loanConfiguration.company_id"]')
      .locator("xpath=following-sibling::*[1]")
      .getByRole("button", { name: "clear selection" });

    // ---------- Loan Limits ----------
    this.maxLoanAmountFixedRadio = page.getByRole("radio", {
      name: "Fixed Amount",
      exact: true,
    });
    this.maxLoanAmountPercentageRadio = page.getByRole("radio", {
      name: "% of CTC",
      exact: true,
    });
    this.maxLoanAmountValueInput = page
      .getByPlaceholder("Amount", { exact: true })
      .nth(0);
    this.maxLoanAmountPercentageInput = page
      .getByPlaceholder("Percentage", { exact: true })
      .nth(0);
    this.maxTenureInput = this.fieldInputByLabel("Maximum Tenure (In Months)");
    this.interestTypeField = "Interest Type";
    this.interestRateInput = this.fieldInputByLabel("Interest Rate");
    this.latePenaltyFlatRadio = page.getByRole("radio", {
      name: "Flat Amount",
      exact: true,
    });
    this.latePenaltyPercentageRadio = page.getByRole("radio", {
      name: "In %",
      exact: true,
    });
    this.latePenaltyValueInput = page
      .getByPlaceholder("Amount", { exact: true })
      .nth(1);
    this.latePenaltyPercentageInput = page
      .getByPlaceholder("Percentage", { exact: true })
      .nth(1);

    // ---------- Repayment Configuration ----------
    // Fixed titles (unlike Status), so toggleByLabel() works directly.
    this.autoDeductEmisLabel = "Auto Deduct EMIs";
    this.allowPreClosureLabel = "Allow Pre-Closure";

    // ---------- Eligibility Criteria ----------
    this.limitedToggleLabel = "Limited";
    this.minServiceDurationInput = this.fieldInputByLabel(
      "Minimum Service Duration",
    );
    this.eligibleDepartmentsField = "Eligible Departments";
    this.eligibleGradesField = "Eligible Grades";
    this.minCtcRequiredInput = this.fieldInputByLabel("Minimum CTC Required");
    this.maxActiveLoansAllowedInput = this.fieldInputByLabel(
      "Maximum Active Loans Allowed",
    );
    this.remarksInput = this.fieldTextareaByLabel("Remarks");

    // ---------- Classification ----------
    this.locationField = "Location";

    // ---------- Required-field errors (common.validation.required = "{{field}} is required") ----------
    this.companyRequiredError = page.getByText(/^Company is required$/i);
    this.loanNameRequiredError = page.getByText(/^Loan Name is required$/i);
    this.categoryRequiredError = page.getByText(/^Category is required$/i);

    // ---------- Page-level actions (same shared i18n keys as every HRMS module in this suite) ----------
    this.discardButton = page.getByRole("button", { name: "Discard" });
    this.saveToDraftButton = page.getByRole("button", {
      name: "Save To Draft",
    });
    this.saveButton = page.getByRole("button", { name: "Save", exact: true });

    this.viewActionsButton = page.getByRole("button", { name: "Actions" });
  }

  async gotoList() {
    await this.page.goto("/dashboard/hrms/loan-configuration");
    await this.page.waitForLoadState("networkidle");
  }

  async goto() {
    await this.gotoList();
    // This click itself triggers the SPA navigation to the Add form, so clickWithDialogRetry's
    // blind "any error -> retry" is actively harmful here: once attempt 1 has already navigated
    // away, "Add" no longer exists on the new page, so every further attempt fails fast on a
    // locator that will never appear again - confirmed live, this regressed several tests that
    // used to pass with a bare click(). Only retry if we're demonstrably still stuck on the list.
    try {
      await this.listAddButton.click();
    } catch (e) {
      if (!this.page.url().includes("add-loan-configuration")) throw e;
    }
    await this.page.waitForURL("**/add-loan-configuration");
    await this.page.waitForLoadState("networkidle");
    await this.recoverFromStuckLoadingFields();
  }

  // ---------- Textarea fields (is_multiline DynamicInput renders a <textarea>, not <input>) ----------
  fieldTextareaByLabel(
    labelText,
    { scope = this.page.getByRole("main") } = {},
  ) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`);
    return scope
      .getByText(labelRegex)
      .first()
      .locator("xpath=..")
      .locator("textarea")
      .first();
  }

  // ---------- Toggle fields (same non-associated-label structural pattern as LPM's checkboxes) ----------
  toggleByLabel(labelText) {
    return this.page
      .getByText(labelText, { exact: true })
      .locator("xpath=..")
      .getByRole("checkbox")
      .first();
  }

  async setToggle(labelText, checked = true) {
    const toggle = this.toggleByLabel(labelText);
    const isChecked = await toggle.isChecked();
    if (isChecked !== checked) {
      await toggle.click();
    }
  }

  // Status's own adjacent label is the DYNAMIC "Active"/"Inactive" word, not a fixed string - it's
  // reached via the fixed "Status" section heading two DOM levels up instead.
  statusToggle() {
    return this.page
      .getByText("Status", { exact: true })
      .locator("xpath=../..")
      .getByRole("checkbox")
      .first();
  }

  async setStatus(active = true) {
    const toggle = this.statusToggle();
    const isChecked = await toggle.isChecked();
    if (isChecked !== active) {
      await toggle.click();
    }
  }

  // ---------- Loan Limits radios ----------
  async selectMaxLoanAmountType(type) {
    if (type === "fixed") {
      await this.maxLoanAmountFixedRadio.check();
    } else {
      await this.maxLoanAmountPercentageRadio.check();
    }
  }

  async selectLatePenaltyType(type) {
    if (type === "flat") {
      await this.latePenaltyFlatRadio.check();
    } else {
      await this.latePenaltyPercentageRadio.check();
    }
  }

  // ---------- Eligible Departments/Grades (multiselect - option text unverified live, so pick
  // whatever renders first rather than guessing a literal string, same caution as Salary
  // Structure Master's Grade field). Multiselect popovers typically stay open after a click
  // (unlike single-select), so this closes it explicitly via Escape rather than relying on
  // BasePage.selectOptionFromListbox's single-select-oriented auto-close wait. ----------
  async selectFirstMultiSelectOption(labelText) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, "i");
    const combobox = this.page
      .getByRole("main")
      .getByText(labelRegex)
      .first()
      .locator("xpath=..")
      .getByRole("combobox")
      .first();
    await combobox.click();
    const listbox = this.page.getByRole("listbox");
    const firstOption = listbox
      .getByRole("option")
      .filter({ hasNotText: /Select|No data available/ })
      .first();
    await firstOption.waitFor({ state: "visible", timeout: 7000 });
    await firstOption.click();
    await this.page.keyboard.press("Escape");
    await this.page.waitForTimeout(500);
    // Escape doesn't reliably close this MUI multi-select popover on the first press (confirmed
    // live: TC-LOAN-ELIG-12 left "Eligible Departments" expanded, whose overlay then blocked the
    // click on "Eligible Grades"' combobox until the 15s action timeout) - fall back to clicking a
    // neutral area of the page, same dismiss pattern BasePage.searchList() already relies on.
    const stillOpen = await listbox
      .first()
      .isVisible()
      .catch(() => false);
    if (stillOpen) {
      await this.page
        .locator("body")
        .click({ position: { x: 300, y: 10 }, force: true })
        .catch(() => {});
      await listbox
        .first()
        .waitFor({ state: "hidden", timeout: 3000 })
        .catch(() => {});
    }
  }

  // ---------- Fill helpers ----------
  async fillBasicDetails({
    company,
    loanName,
    category,
    active,
    description,
  } = {}) {
    if (company) {
      await this.selectFieldByLabel(this.companyField, company, {
        exact: false,
      });
    }
    if (loanName !== undefined) {
      await this.loanNameInput.fill(loanName);
    }
    if (category) {
      await this.selectFieldByLabel(this.categoryField, category, {
        exact: false,
      });
    }
    if (active !== undefined) {
      await this.setStatus(active);
    }
    if (description !== undefined) {
      await this.descriptionInput.fill(description);
    }
  }

  async fillLoanLimits({
    maxLoanAmountType,
    maxLoanAmountValue,
    maxLoanAmountPercentage,
    maxTenureMonths,
    interestType,
    interestRate,
    latePenaltyType,
    latePenaltyValue,
    latePenaltyPercentage,
  } = {}) {
    if (maxLoanAmountType) {
      await this.selectMaxLoanAmountType(maxLoanAmountType);
    }
    if (maxLoanAmountValue !== undefined) {
      await this.maxLoanAmountValueInput.fill(String(maxLoanAmountValue));
    }
    if (maxLoanAmountPercentage !== undefined) {
      await this.maxLoanAmountPercentageInput.fill(
        String(maxLoanAmountPercentage),
      );
    }
    if (maxTenureMonths !== undefined) {
      await this.maxTenureInput.fill(String(maxTenureMonths));
    }
    if (interestType) {
      await this.selectFieldByLabel(this.interestTypeField, interestType, {
        exact: false,
      });
    }
    if (interestRate !== undefined) {
      await this.interestRateInput.fill(String(interestRate));
    }
    if (latePenaltyType) {
      await this.selectLatePenaltyType(latePenaltyType);
    }
    if (latePenaltyValue !== undefined) {
      await this.latePenaltyValueInput.fill(String(latePenaltyValue));
    }
    if (latePenaltyPercentage !== undefined) {
      await this.latePenaltyPercentageInput.fill(String(latePenaltyPercentage));
    }
  }

  async fillRepaymentConfiguration({ autoDeductEmis, allowPreClosure } = {}) {
    if (autoDeductEmis !== undefined) {
      await this.setToggle(this.autoDeductEmisLabel, autoDeductEmis);
    }
    if (allowPreClosure !== undefined) {
      await this.setToggle(this.allowPreClosureLabel, allowPreClosure);
    }
  }

  async fillEligibilityCriteria({
    limited,
    minServiceDurationMonths,
    minCtcRequired,
    maxActiveLoansAllowed,
    remarks,
    pickFirstDepartment,
    pickFirstGrade,
  } = {}) {
    if (limited !== undefined) {
      await this.setToggle(this.limitedToggleLabel, limited);
    }
    if (minServiceDurationMonths !== undefined) {
      await this.minServiceDurationInput.fill(String(minServiceDurationMonths));
    }
    if (pickFirstDepartment) {
      await this.selectFirstMultiSelectOption(this.eligibleDepartmentsField);
    }
    if (pickFirstGrade) {
      await this.selectFirstMultiSelectOption(this.eligibleGradesField);
    }
    if (minCtcRequired !== undefined) {
      await this.minCtcRequiredInput.fill(String(minCtcRequired));
    }
    if (maxActiveLoansAllowed !== undefined) {
      await this.maxActiveLoansAllowedInput.fill(String(maxActiveLoansAllowed));
    }
    if (remarks !== undefined) {
      await this.remarksInput.fill(remarks);
    }
  }

  // ---------- Classification (Location) - DynamicDependentField, filtered by company_id, same
  // mechanism confirmed for Leave Policy Master/Salary Structure Master's Location field. ----------
  async isLocationEnabled() {
    return !(await this.dependentFieldCombobox(
      this.locationField,
    ).isDisabled());
  }

  dependentFieldCombobox(labelText) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, "i");
    return this.page
      .locator("main")
      .getByText(labelRegex)
      .first()
      .locator("xpath=..")
      .getByRole("combobox")
      .first();
  }

  async getSelectedValue(labelText) {
    const combobox = this.dependentFieldCombobox(labelText);
    // The combobox briefly shows its own "Search {Label}" placeholder right after navigating to
    // Edit, while the preloaded value resolves asynchronously - reading immediately can race that
    // and capture the placeholder instead (confirmed live: TC-LOAN-EDIT-01 intermittently read
    // back "Search Company" instead of the saved Company). Same race BasePage.getEditComboboxValue
    // already guards against for other modules' fields.
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const placeholderRegex = new RegExp(
      `^(Loading\\.\\.\\.|Search ${escapedLabel})$`,
      "i",
    );
    await expect(combobox)
      .not.toHaveText(placeholderRegex, { timeout: 8000 })
      .catch(() => {});
    const text = ((await combobox.textContent()) || "")
      .replace(/[​﻿]/g, "")
      .trim();
    return text || (await combobox.inputValue().catch(() => ""));
  }

  // ---------- Save actions ----------
  // Same reasoning as every other HRMS page object in this suite - capture the just-created/
  // updated record from the list's own refetch JSON. CONFIRMED shape (reducer.tsx):
  // `{ data: { loan_master: [...], count } }` - keyed `loan_master` (the BACKEND resource name),
  // NOT `loan_configuration` (the frontend route name) - and the network URL itself contains
  // "loan-master", not "loan-configuration" (actionCreator.tsx's getV1LoanMaster/etc.).
  async saveAndCaptureId(buttonLocator) {
    const listResponsePromise = this.page.waitForResponse(
      (r) => r.url().includes("loan-master") && r.request().method() === "GET",
    );
    await buttonLocator.click();
    const listResponse = await listResponsePromise;
    await this.page.waitForLoadState("networkidle");
    const body = await listResponse.json().catch(() => null);
    const record = body?.data?.loan_master?.[0];

    const id = record?.id !== undefined ? String(record.id) : undefined;
    let seriesNumber = record?.series_number;
    if (!seriesNumber) {
      seriesNumber = await this.page
        .locator("table tbody tr")
        .first()
        .innerText();
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
    await this.page
      .getByRole("menuitem", { name: "Edit", exact: true })
      .click();
    await this.page.waitForURL("**/edit-loan-configuration");
    await this.page.waitForLoadState("networkidle");
    // Same shared DynamicSelect "stuck on Loading..." bug BasePage documents for RFQ's Edit page
    // (TC-RFQ-09) - confirmed live here too: Company preloaded as the literal string "Loading..."
    // instead of resolving, with no interaction needed to trigger it.
    await this.recoverFromStuckLoadingFields();
  }

  // The row menu's "Duplicate" action is commented out in source (loan-configuration.tsx) -
  // unlike Leave Policy Master (which never had one), this module's rowActionMenu literally has
  // it disabled/removed in code, confirmed at loan-configuration.tsx:70-77.
  async openViewFromList(seriesNumber) {
    // Row click (not a menu item - View has no dedicated row-menu entry; the whole row/status
    // chip links to View, confirmed via loan-configuration.tsx's `redirectionLink`/Chip Link).
    await this.rowBySeriesNumber(seriesNumber)
      .getByText(/Draft|Active|Inactive/)
      .first()
      .click();
    await this.page.waitForURL("**/view-loan-configuration");
    await this.page.waitForLoadState("networkidle");
  }

  async openEditFromView() {
    await this.viewActionsButton.click();
    await this.page
      .getByRole("menuitem", { name: "Edit", exact: true })
      .click();
    await this.page.waitForURL("**/edit-loan-configuration");
    await this.page.waitForLoadState("networkidle");
  }
}

module.exports = LoanConfigurationPage;
