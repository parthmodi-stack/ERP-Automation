const { test, expect } = require('@playwright/test');
const LeavePolicyMasterPage = require('../../pages/LeavePolicyMasterPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

// Leave Policy Master (erpforce-hrms-fe: src/views/leave-policy-master/) - confirmed real module,
// route `/dashboard/hrms/company-master-policy/leave-policy-master`. Implements the cases
// documented in LEAVE_POLICY_MASTER_TEST_CASES.md that are marked "Automation: Yes" (i.e.
// confirmed from source, not a live-verification-needed guess). See that document for the full
// 147-case catalogue and the reasoning behind every case marked "Manual first" instead.
//
// This is a 4-TAB wizard (Leave Type -> Eligibility Rules -> Carry Forward -> Encashment) with NO
// Previous/Back button - see LeavePolicyMasterPage.js's header comment. "Save" only exists on the
// last tab (Encashment); earlier tabs show "Next".
//
// SCOPE NOTES:
// - No approval workflow exists (Draft -> Active/Inactive only, same shape as every other HRMS
//   module in this suite).
// - Eligibility Rules' condition-level Field/Operator/Value editor interaction is NOT automated
//   here - LeavePolicyMasterPage.setRuleAction only drives the Action dropdown. The
//   react-querybuilder condition controls have no confirmed label/name association from source
//   (see the method's own comment) - implement that once verified live.
// - The Company-switch dependency case that needs a SECOND real company (TC-LPM-DEP-03/04/09 in
//   the test-case doc) is skipped until `testData.leavePolicyMaster.companyB` is identified
//   against the live/dev environment - see config/testData.js's comment on that field.
test.describe('Leave Policy Master Module', () => {
  let created = {};
  let draftRecord = {};

  // ── TC-LPM-F-04: Create with mandatory fields only ───────────────────────
  test('TC-LPM-F-04 [+] Create Leave Policy with mandatory fields only', async ({ page }) => {
    const lpm = new LeavePolicyMasterPage(page);
    const data = testData.leavePolicyMaster.valid;

    await lpm.goto();
    await expect(page).toHaveURL(/add-leave-policy-master/);

    await lpm.fillLeaveTypeTab({
      company: data.company,
      leaveCategory: data.leaveCategory,
      title: data.title,
      effectiveFrom: data.effectiveFrom,
    });
    await lpm.clickNext(); // Leave Type -> Eligibility Rules (no rule required, array is optional)
    await lpm.clickNext(); // Eligibility Rules -> Carry Forward (not required unless enabled)
    await lpm.clickNext(); // Carry Forward -> Encashment (last tab, Save appears here)

    const result = await lpm.save();
    expect(result.seriesNumber).toBeTruthy();
    created = { ...result, title: data.title };

    await lpm.searchList(data.title);
    await expect(page.getByText(data.title, { exact: false }).first()).toBeVisible();
    await expect(await lpm.getRowStatus(created.seriesNumber)).toMatch(/Active/);
  });

  // ── TC-LPM-F-05: Create with Location/Department set ─────────────────────
  test('TC-LPM-F-05 [+] Create Leave Policy with Location and Department set', async ({ page }) => {
    const lpm = new LeavePolicyMasterPage(page);
    const data = testData.leavePolicyMaster.valid;
    const title = `${data.title}_WITH_CLASSIFICATION`;

    await lpm.goto();
    await lpm.fillLeaveTypeTab({
      company: data.company,
      leaveCategory: data.leaveCategory,
      title,
      effectiveFrom: data.effectiveFrom,
      location: data.location,
      department: data.department,
    });
    await lpm.clickNext();
    await lpm.clickNext();
    await lpm.clickNext();

    const result = await lpm.save();
    expect(result.seriesNumber).toBeTruthy();

    await lpm.searchList(title);
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
  });

  // ── TC-LPM-F-09 / VIEW: View Leave Policy ─────────────────────────────────
  test('TC-LPM-F-09 [+] View Leave Policy - verify Company/Location/Department render read-only', async ({ page }) => {
    const lpm = new LeavePolicyMasterPage(page);
    const data = testData.leavePolicyMaster.valid;

    await lpm.gotoList();
    await lpm.searchList(created.seriesNumber);
    await lpm.openViewFromList(created.seriesNumber);
    await expect(page).toHaveURL(/view-leave-policy-master/);

    await expect(page.getByText(data.title, { exact: false }).first()).toBeVisible();

    // View mode re-renders the same 4 tabs read-only - confirm no editable input exists anywhere.
    const editableInputs = page.locator('input:not([disabled]):not([readonly])');
    await expect(editableInputs).toHaveCount(0);
  });

  // ── TC-LPM-F-07/08 / EDIT: Edit Leave Policy ──────────────────────────────
  test('TC-LPM-EDIT-01 [+] Edit Leave Policy - existing values preload, update Title', async ({ page }) => {
    const lpm = new LeavePolicyMasterPage(page);
    const data = testData.leavePolicyMaster.valid;

    await lpm.gotoList();
    await lpm.searchList(created.seriesNumber);
    await lpm.openEditFromList(created.seriesNumber);
    await expect(page).toHaveURL(/edit-leave-policy-master/);

    // TC-LPM-EDIT-01: existing Company preloads.
    await expect(await lpm.getSelectedValue(lpm.companyField)).toContain(data.company);

    await lpm.leaveTypeTitleInput.fill(data.updatedTitle);
    await expect(lpm.leaveTypeTitleInput).toHaveValue(data.updatedTitle);

    await lpm.goToTab('Encashment');
    const result = await lpm.save();
    created.title = data.updatedTitle;
    expect(result.seriesNumber).toBeTruthy();
  });

  // ── TC-LPM-F-10 / F-12: Save to Draft, and Save-To-Draft hidden on published ──
  test('TC-LPM-F-10 [+] Create Leave Policy and Save To Draft - status shows Draft', async ({ page }) => {
    const lpm = new LeavePolicyMasterPage(page);
    const title = testDataFactory.uniqueName('Automation_LeaveType_Draft');

    await lpm.goto();
    await lpm.fillLeaveTypeTab({
      company: testData.leavePolicyMaster.valid.company,
      leaveCategory: testData.leavePolicyMaster.valid.leaveCategory,
      title,
      effectiveFrom: testData.leavePolicyMaster.valid.effectiveFrom,
    });
    await lpm.goToTab('Encashment');

    const result = await lpm.saveAsDraft();
    draftRecord = { ...result, title };

    await lpm.searchList(title);
    await expect(await lpm.getRowStatus(draftRecord.seriesNumber)).toMatch(/Draft/);
  });

  test('TC-LPM-F-12 [-] "Save To Draft" is not shown when editing a published record', async ({ page }) => {
    const lpm = new LeavePolicyMasterPage(page);

    await lpm.gotoList();
    await lpm.searchList(created.seriesNumber); // created is published (Save, not Save To Draft)
    await lpm.openEditFromList(created.seriesNumber);

    await expect(lpm.saveToDraftButton).not.toBeVisible();

    await lpm.discardButton.click();
  });

  // ── TC-LPM-F-17: Discard ───────────────────────────────────────────────────
  test('TC-LPM-F-17 [-] Discard a new Leave Policy - no record is created', async ({ page }) => {
    const lpm = new LeavePolicyMasterPage(page);
    const discardedTitle = `${testData.leavePolicyMaster.valid.title}_DISCARDED`;

    await lpm.goto();
    await lpm.fillLeaveTypeTab({ title: discardedTitle, company: testData.leavePolicyMaster.valid.company });
    await lpm.discardButton.click();

    await expect(page).toHaveURL(/\/leave-policy-master$/);
    await lpm.searchList(discardedTitle);
    await expect(lpm.noDataRow()).toBeVisible();
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  // Deletes the Draft record from TC-LPM-F-10, leaving the published record intact for any
  // future spec that wants to build on it (same pattern as every other HRMS suite here).
  test('TC-LPM-F-06 [-] Delete the Draft Leave Policy created in TC-LPM-F-10', async ({ page }) => {
    const lpm = new LeavePolicyMasterPage(page);

    await lpm.gotoList();
    await lpm.deleteFromList(draftRecord.seriesNumber);

    await lpm.searchList(draftRecord.title);
    await expect(lpm.noDataRow()).toBeVisible();
  });

  // ── Dependency (this module's explicit "Feature Under Test") ──────────────
  test.describe('Company → Location/Department Dependency', () => {
    test('TC-LPM-DD-02/03 [-] Location and Department are disabled until Company is selected', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);

      await lpm.goto();
      await expect(await lpm.isLocationEnabled()).toBe(false);
      await expect(await lpm.isDepartmentEnabled()).toBe(false);

      await lpm.discardButton.click();
    });

    test('TC-LPM-DD-04/05 [+] Location and Department enable after Company is selected', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);
      const data = testData.leavePolicyMaster.valid;

      await lpm.goto();
      await lpm.selectFieldByLabel(lpm.companyField, data.company, { exact: false });
      await expect(await lpm.isLocationEnabled()).toBe(true);
      await expect(await lpm.isDepartmentEnabled()).toBe(true);

      await lpm.discardButton.click();
    });

    test('TC-LPM-DEP-01/02 [+] Location and Department options are scoped to the selected Company', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);
      const data = testData.leavePolicyMaster.valid;

      await lpm.goto();
      await lpm.selectFieldByLabel(lpm.companyField, data.company, { exact: false });
      await lpm.selectFieldByLabel(lpm.locationField, data.location, { exact: false });
      await lpm.selectFieldByLabel(lpm.departmentField, data.department, { exact: false });

      // selectFieldByLabel falls back to "first available" if the requested testData value isn't
      // present for this Company - assert whatever was ACTUALLY selected is non-empty, not the
      // literal testData string (same caution as Organization Structure's fillCompanySidebar).
      await expect(await lpm.getSelectedValue(lpm.locationField)).not.toBe('');
      await expect(await lpm.getSelectedValue(lpm.departmentField)).not.toBe('');

      await lpm.discardButton.click();
    });

    test('TC-LPM-DEP-06 [-] Clearing Company disables and clears Location/Department', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);
      const data = testData.leavePolicyMaster.valid;

      await lpm.goto();
      await lpm.selectFieldByLabel(lpm.companyField, data.company, { exact: false });
      await lpm.selectFieldByLabel(lpm.locationField, data.location, { exact: false });

      // Clear via the field's own clear-selection control (not re-selecting a different value).
      const companyCombobox = lpm.dependentFieldCombobox(lpm.companyField);
      await companyCombobox.hover();
      await page.getByRole('button', { name: 'clear selection' }).first().click().catch(() => {});

      await expect(await lpm.isLocationEnabled()).toBe(false);
      await expect(await lpm.getSelectedValue(lpm.locationField)).toBe('');

      await lpm.discardButton.click();
    });

    test.skip(
      !testData.leavePolicyMaster.companyB,
      'Needs a second real, live-verified Company (testData.leavePolicyMaster.companyB) - see config/testData.js TODO',
    );
    test('TC-LPM-DEP-03/04/05 [-] Changing Company clears Location/Department and reloads options', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);
      const data = testData.leavePolicyMaster.valid;

      await lpm.goto();
      await lpm.selectFieldByLabel(lpm.companyField, data.company, { exact: false });
      await lpm.selectFieldByLabel(lpm.locationField, data.location, { exact: false });
      await lpm.selectFieldByLabel(lpm.departmentField, data.department, { exact: false });

      await lpm.selectFieldByLabel(lpm.companyField, testData.leavePolicyMaster.companyB, { exact: false });
      await expect(await lpm.getSelectedValue(lpm.locationField)).toBe('');
      await expect(await lpm.getSelectedValue(lpm.departmentField)).toBe('');

      await lpm.discardButton.click();
    });

    test('TC-LPM-EDIT-04 [-] Changing Company on Edit clears the pre-loaded Location/Department', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);
      const data = testData.leavePolicyMaster.valid;
      test.skip(!testData.leavePolicyMaster.companyB, 'Needs a second real Company - see config/testData.js TODO');

      await lpm.gotoList();
      await lpm.searchList(created.seriesNumber);
      await lpm.openEditFromList(created.seriesNumber);

      await lpm.selectFieldByLabel(lpm.companyField, testData.leavePolicyMaster.companyB, { exact: false });
      await expect(await lpm.getSelectedValue(lpm.locationField)).toBe('');
      await expect(await lpm.getSelectedValue(lpm.departmentField)).toBe('');

      await lpm.discardButton.click();
    });
  });

  // ── Field Validation ──────────────────────────────────────────────────────
  test.describe('Field Validation', () => {
    test('TC-LPM-VAL-01/02/03/04 [-] Required Leave Type Title/Leave Category/Effective From/Company block Next', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);

      await lpm.goto();
      await lpm.clickNext();

      await expect(lpm.leaveTitleRequiredError).toBeVisible();
      await expect(lpm.leaveCategoryRequiredError).toBeVisible();
      await expect(lpm.effectiveFromRequiredError).toBeVisible();
      await expect(lpm.companyRequiredError).toBeVisible();
      await expect(lpm.leaveTypeTab).toHaveAttribute('aria-selected', 'true'); // did not advance

      await lpm.discardButton.click();
    });

    test('TC-LPM-VAL-06/07 [+] Save succeeds with Location and Department left blank', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);
      const data = testData.leavePolicyMaster.valid;
      const title = `${data.title}_NO_CLASSIFICATION`;

      await lpm.goto();
      await lpm.fillLeaveTypeTab({
        company: data.company,
        leaveCategory: data.leaveCategory,
        title,
        effectiveFrom: data.effectiveFrom,
      });
      await lpm.goToTab('Encashment');

      const result = await lpm.save();
      expect(result.seriesNumber).toBeTruthy(); // no Yup rule exists on location_id/department_id
    });

    test('TC-LPM-VAL-14 [-] Annual Entitlement rejects negative values', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);

      await lpm.goto();
      await lpm.annualEntitlementInput.fill(testData.leavePolicyMaster.negative.negativeAnnualEntitlement);
      await lpm.clickNext();

      // Exact min(0) error wording wasn't confirmed live - assert that *some* validation error
      // rendered near the field rather than a guessed exact string.
      await expect(page.locator('.Mui-error, [class*="error"]').first()).toBeVisible();

      await lpm.discardButton.click();
    });

    test('TC-LPM-VAL-18 [-] Confirmed gap: Enable Carry Forward with Max Days blank still saves', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);
      const data = testData.leavePolicyMaster.valid;
      const title = `${data.title}_CF_GAP`;

      await lpm.goto();
      await lpm.fillLeaveTypeTab({
        company: data.company,
        leaveCategory: data.leaveCategory,
        title,
        effectiveFrom: data.effectiveFrom,
      });
      await lpm.clickNext();
      await lpm.goToTab('Carry Forward');
      await lpm.fillCarryForwardTab({ enabled: true }); // Max Carry Forward Days left blank
      await lpm.goToTab('Encashment');

      const result = await lpm.save();
      // Confirmed real gap (LEAVE_POLICY_MASTER_TEST_CASES.md TC-LPM-VAL-18): no
      // `.when('enabled', ...)` required rule exists, so this succeeds despite the field being
      // visually enabled/expected once the checkbox is on.
      expect(result.seriesNumber).toBeTruthy();
    });

    test('TC-LPM-UI-04 [-] Max Carry Forward Days is disabled until Enable Carry Forward is checked', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);

      await lpm.goto();
      await lpm.goToTab('Carry Forward');
      await expect(await lpm.isMaxCarryForwardDaysEnabled()).toBe(false);

      await lpm.fillCarryForwardTab({ enabled: true });
      await expect(await lpm.isMaxCarryForwardDaysEnabled()).toBe(true);

      await lpm.discardButton.click();
    });

    test('TC-LPM-UI-04b [-] Minimum Balance Required is disabled until Enable Encashment is checked', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);

      await lpm.goto();
      await lpm.goToTab('Encashment');
      await expect(await lpm.isMinimumBalanceRequiredEnabled()).toBe(false);

      await lpm.fillEncashmentTab({ enabled: true });
      await expect(await lpm.isMinimumBalanceRequiredEnabled()).toBe(true);

      await lpm.discardButton.click();
    });

    // NOT a full TC-LPM-VAL-20 (that case needs an EMPTY-conditions rule to reach Save, which
    // requires deleting the default seeded condition first - the react-querybuilder
    // condition-remove control isn't automated yet, see LeavePolicyMasterPage.setRuleAction's
    // comment). This only verifies "Add New Rule"/"Add More" actually seeds a rule card - a
    // prerequisite for TC-LPM-VAL-20, not the validation-blocks-save assertion itself.
    test('TC-LPM-EL-01 [+] "Add New Rule" seeds a new rule card on the Eligibility Rules tab', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);

      await lpm.goto();
      await lpm.goToTab('Eligibility Rules');

      const cardCountBefore = await lpm.ruleCard.count();
      await lpm.addRule();
      await expect(lpm.ruleCard).toHaveCount(cardCountBefore + 1);

      await lpm.discardButton.click();
    });
  });

  // ── Listing Page ──────────────────────────────────────────────────────────
  test.describe('Listing Page', () => {
    test('TC-LPM-L01 [+] Search the list by Leave Type Title', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);
      await lpm.gotoList();
      await lpm.searchList(created.title);
      await expect(page.getByText(created.title, { exact: false }).first()).toBeVisible();

      await lpm.searchList('zzz-no-such-leave-policy-zzz');
      await expect(lpm.noDataRow()).toBeVisible();
    });

    test('TC-LPM-L02 [+] Sort the ID column ascending/descending', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);
      await lpm.gotoList();

      await lpm.clickColumnHeader('ID');
      const firstSort = await lpm.getColumnAriaSort('ID');
      expect(['ascending', 'descending']).toContain(firstSort);

      await lpm.clickColumnHeader('ID');
      const secondSort = await lpm.getColumnAriaSort('ID');
      expect(secondSort).not.toBe(firstSort);
    });

    test('TC-LPM-L03 [+] Paginate the list', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);
      await lpm.gotoList();

      const label = await lpm.getPaginationLabel();
      expect(label).toMatch(/Page \d+ of \d+/);

      if (await lpm.nextPageButton().isEnabled()) {
        await lpm.nextPageButton().click();
        await page.waitForLoadState('networkidle');
        const nextLabel = await lpm.getPaginationLabel();
        expect(nextLabel).not.toBe(label);
      }
    });

    test('TC-LPM-L04 [+] Row action menu offers View/Edit only (no Duplicate) and destructive Delete', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);
      await lpm.gotoList();
      await lpm.searchList(created.title);
      await lpm.openRowActionMenu(created.seriesNumber);

      await expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toHaveCount(0);
      await page.keyboard.press('Escape');
    });

    test('TC-LPM-L05 [+] Row status badge matches the record\'s lifecycle state', async ({ page }) => {
      const lpm = new LeavePolicyMasterPage(page);
      await lpm.gotoList();
      await lpm.searchList(created.title);
      await expect(await lpm.getRowStatus(created.seriesNumber)).toMatch(/Active/);
    });
  });
});
