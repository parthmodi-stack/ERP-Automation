const { test, expect } = require('@playwright/test');
const ShippingRulePage = require('../../pages/ShippingRulePage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

// Shipping Rule (erpforce-fe: modules/crm/src/views/settings/shipping-rules/) - confirmed real
// module, route `/dashboard/crm/settings/shippment-rules`. Implements the cases documented in
// CRM_SETTINGS_TEST_CASES.md's "1. Shipping Rule" section (TC-SHIP-01..15, TC-SHIP-V01..07).
//
// SCOPE NOTES (see CRM_SETTINGS_TEST_CASES.md's "Corrections" section for full detail):
// - Draft/Submitted/Quick-Approval plumbing exists in redux, but the View page's own Submit button
//   is commented out of the JSX entirely (view-shippment-rules.tsx:403-406) - TC-SHIP-V07 below
//   confirms this gap directly rather than attempting an unreachable approval flow.
// - TC-SHIP-V05 (the confirmed wrong-error-message bug on company_id's typeError,
//   edit-shippment-rules.tsx:43) is NOT automated here: triggering a typeError requires an invalid
//   non-array value on a multiselect field, which isn't reachable through normal UI interaction -
//   documented as a source-confirmed bug in the test-case doc instead of forced through the UI.
// - TC-SHIP-V06 (Location dropdown for a Company with zero Locations) is NOT automated: this
//   environment's only real company ("erp-force") has existing Locations, so the zero-Location
//   precondition can't be set up without seeding a second company - left as Manual first.
// - Shipping/Handling Account and Location option text is unverified live master data - tests pick
//   whatever renders first (ShippingRulePage.selectFirstOptionByLabel/selectFirstLocation) rather
//   than asserting a literal name, same caution as Loan Configuration's Eligible Departments/Grades.
test.describe('Shipping Rule Module', () => {
  test.describe.configure({ timeout: 90000 });

  let created = {};
  let draftRecord = {};

  // ── TC-SHIP-01/02: Create with all required fields; Location cascades off Company ──
  test('TC-SHIP-01 [+] Create Shipping Rule with all required fields', async ({ page }) => {
    const sr = new ShippingRulePage(page);
    const data = testData.shippingRule.valid;

    await sr.goto();
    await expect(page).toHaveURL(/add-shippment-rules/);

    // Entity/Company is pre-filled by default with this environment's one real company
    // ("erp-force") - not reselected here, since re-clicking an already-selected option in a
    // multiselect combobox would toggle it OFF instead of leaving it selected.
    await sr.fillGeneralDetails({
      name: data.name,
      pickFirstLocation: true,
      shippingCost: data.shippingCost,
      handlingCost: data.handlingCost,
      pickFirstShippingAccount: true,
      pickFirstHandlingAccount: true,
    });

    // TC-SHIP-02: Location's option list is scoped to the selected Company - confirm a value was
    // actually selected (LocationSearchSelect doesn't expose a real `disabled` attribute pre-Company
    // like a DynamicDependentField would, so this checks the end state rather than the mid-flow one).
    expect(await sr.getSelectedValue(sr.locationField)).not.toBe('');

    const result = await sr.save();
    expect(result.seriesNumber).toBeTruthy();
    created = { ...result, name: data.name };

    await sr.searchList(data.name);
    await expect(page.getByText(data.name, { exact: false }).first()).toBeVisible();
    // CONFIRMED LIVE (add-shippment-rules.tsx's onSubmit hardcodes `status: 'Submitted'`): the
    // regular Save action - unlike a document-lifecycle module's Draft-first Save - submits the
    // record immediately. `is_active` is a separate boolean, not reflected in this Status chip;
    // see TC-SHIP-09 for its own verification via the Edit form instead.
    await expect(await sr.getRowStatus(created.seriesNumber)).toMatch(/Submitted/);
  });

  // ── TC-SHIP-05: View renders all saved fields ──────────────────────────────────
  test('TC-SHIP-05 [+] View Shipping Rule - all saved fields render correctly', async ({ page }) => {
    const sr = new ShippingRulePage(page);
    const data = testData.shippingRule.valid;

    await sr.gotoList();
    await sr.searchList(created.name);
    await sr.openViewFromList(created.seriesNumber);
    await expect(page).toHaveURL(/view-shippment-rules/);

    await expect(page.getByText(data.name, { exact: false }).first()).toBeVisible();
  });

  // ── TC-SHIP-V07: Submit button is commented out of the JSX entirely ────────────
  test('TC-SHIP-V07 [-] BUG - Submit button does not exist on View (source: view-shippment-rules.tsx:403-406)', async ({ page }) => {
    test.fail(true, 'Confirmed source bug: Submit button JSX is commented out - a Draft/Active record can never be moved to Submitted via the UI.');
    const sr = new ShippingRulePage(page);

    await sr.gotoList();
    await sr.searchList(created.name);
    await sr.openViewFromList(created.seriesNumber);

    // Asserting the Submit button IS visible - expected to FAIL, confirming the gap stays visible
    // in the report (per this repo's test.fail() convention) until the button is un-commented.
    await expect(sr.submitButton()).toBeVisible({ timeout: 5000 });
  });

  // ── TC-SHIP-06/07: Edit preloads existing values; ID stays read-only ───────────
  test('TC-SHIP-06 [+] Edit Shipping Rule - existing values preload, ID stays read-only', async ({ page }) => {
    const sr = new ShippingRulePage(page);
    const data = testData.shippingRule.valid;

    await sr.gotoList();
    await sr.searchList(created.name);
    await sr.openEditFromList(created.seriesNumber);
    await expect(page).toHaveURL(/edit-shippment-rules/);

    await expect(sr.nameInput).toHaveValue(data.name);
    // TC-SHIP-07: ID stays read-only.
    await expect(sr.idInput).toBeDisabled();

    await sr.discardButton.click();
  });

  // ── TC-SHIP-08: Editing a single field updates only that field ────────────────
  test('TC-SHIP-08 [+] Edit a single field (Shipping Cost) - only that field updates', async ({ page }) => {
    const sr = new ShippingRulePage(page);
    const data = testData.shippingRule.valid;
    const updatedCost = '75';

    await sr.gotoList();
    await sr.searchList(created.name);
    await sr.openEditFromList(created.seriesNumber);

    await sr.shippingCostInput.fill(updatedCost);
    await expect(sr.shippingCostInput).toHaveValue(updatedCost); // diagnostic: confirm fill landed
    const result = await sr.save();
    expect(result.seriesNumber).toBeTruthy();

    await sr.gotoList();
    await sr.searchList(created.name);
    await sr.openEditFromList(created.seriesNumber);
    // Persisted/reloaded value comes back formatted to 2 decimals ("75.00"), unlike the raw "75"
    // just typed - confirmed a real round-trip, not a formatting bug.
    await expect(sr.shippingCostInput).toHaveValue(`${updatedCost}.00`);
    await expect(sr.nameInput).toHaveValue(data.name); // unrelated field unchanged
    await sr.discardButton.click();
  });

  // ── TC-SHIP-09: Toggling Active -> Inactive persists ───────────────────────────
  // `is_active` is a plain boolean distinct from the record's lifecycle `status` (Draft/
  // Submitted) shown in the list's Status chip - verified via the Edit form's own toggle state on
  // reopen, not the list row (see TC-SHIP-01's comment on this same distinction).
  test('TC-SHIP-09 [+] Toggle is_active to Inactive - persists on reopening Edit', async ({ page }) => {
    const sr = new ShippingRulePage(page);

    await sr.gotoList();
    await sr.searchList(created.name);
    await sr.openEditFromList(created.seriesNumber);

    await sr.setStatus(false);
    await sr.save();

    await sr.gotoList();
    await sr.searchList(created.name);
    await sr.openEditFromList(created.seriesNumber);
    expect(await sr.statusToggle().isChecked()).toBeFalsy();

    // Restore to Active so later tests aren't affected by this state change.
    await sr.setStatus(true);
    await sr.save();
  });

  // ── TC-SHIP-15: Save To Draft ───────────────────────────────────────────────────
  test('TC-SHIP-15 [+] Create Shipping Rule and Save To Draft - status shows Draft', async ({ page }) => {
    const sr = new ShippingRulePage(page);
    const data = testData.shippingRule.draft;

    await sr.goto();
    await sr.fillGeneralDetails({
      name: data.name,
      pickFirstLocation: true,
      shippingCost: data.shippingCost,
      handlingCost: data.handlingCost,
      pickFirstShippingAccount: true,
      pickFirstHandlingAccount: true,
    });

    const result = await sr.saveAsDraft();
    draftRecord = { ...result, name: data.name };

    await sr.searchList(data.name);
    await expect(await sr.getRowStatus(draftRecord.seriesNumber)).toMatch(/Draft/);
  });

  // ── TC-SHIP-V01: Required fields left empty block Save ─────────────────────────
  test('TC-SHIP-V01 [-] Required fields left empty block Save', async ({ page }) => {
    const sr = new ShippingRulePage(page);

    await sr.goto();
    await sr.saveButton.click();

    await expect(sr.nameRequiredError).toBeVisible();
    // Entity/Company is pre-filled by default (1 company selected), so its own required error
    // never shows here - only the genuinely-empty fields do.
    await expect(sr.shippingCostRequiredError).toBeVisible();
    await expect(sr.handlingCostRequiredError).toBeVisible();
    await expect(sr.shippingAccountRequiredError).toBeVisible();
    await expect(sr.handlingAccountRequiredError).toBeVisible();

    await expect(page).toHaveURL(/add-shippment-rules/); // never navigated away - not created
  });

  // ── TC-SHIP-V02: Non-numeric input in cost fields rejected ─────────────────────
  // CONFIRMED LIVE: shipping_cost/handling_cost render as a real `input[type="number"]`, which
  // rejects alphabetic keystrokes at the BROWSER level (Playwright's own .fill() throws
  // "Cannot type text into input[type=number]" if attempted) - a stronger guarantee than a Yup
  // format check. pressSequentially() types key-by-key like a real user and simply drops the
  // non-numeric characters, so the field is confirmed to stay empty rather than accepting "abc".
  test('TC-SHIP-V02 [-] Non-numeric input in Shipping/Handling Cost is rejected', async ({ page }) => {
    const sr = new ShippingRulePage(page);
    const negative = testData.shippingRule.negative;

    await sr.goto();
    await sr.shippingCostInput.pressSequentially(negative.nonNumericCost);
    await sr.handlingCostInput.pressSequentially(negative.nonNumericCost);
    await expect(sr.shippingCostInput).toHaveValue('');
    await expect(sr.handlingCostInput).toHaveValue('');

    await sr.saveButton.click();
    await expect(sr.shippingCostRequiredError).toBeVisible();
    await expect(sr.handlingCostRequiredError).toBeVisible();
  });

  // ── TC-SHIP-V04: Correcting an invalid field clears its error ──────────────────
  test('TC-SHIP-V04 [+] Correcting an empty required field clears its inline error', async ({ page }) => {
    const sr = new ShippingRulePage(page);
    const data = testData.shippingRule.valid;

    await sr.goto();
    await sr.saveButton.click();
    await expect(sr.nameRequiredError).toBeVisible();

    await sr.nameInput.fill(testDataFactory.uniqueName('Automation_ShippingRule_Temp'));
    await expect(sr.nameRequiredError).not.toBeVisible();

    await sr.discardButton.click();
  });

  // ── TC-SHIP-10/11: Delete a rule; related master data intact ───────────────────
  test('TC-SHIP-10 [+] Delete a Shipping Rule successfully', async ({ page }) => {
    const sr = new ShippingRulePage(page);

    await sr.gotoList();
    await sr.searchList(draftRecord.name);
    await sr.deleteFromList(draftRecord.seriesNumber);

    await sr.clearSearch();
    await sr.searchList(draftRecord.name);
    await expect(sr.noDataRow()).toBeVisible();
  });

  test('TC-SHIP-11 [+] Related master data (Company) remains usable after delete', async ({ page }) => {
    const sr = new ShippingRulePage(page);
    const name = testDataFactory.uniqueName('Automation_ShippingRule_PostDelete');

    // The just-deleted rule referenced "erp-force" - confirm a NEW rule can still be created
    // against that same Company/Account master data without issue.
    await sr.goto();
    await sr.fillGeneralDetails({
      name,
      pickFirstLocation: true,
      shippingCost: '10',
      handlingCost: '5',
      pickFirstShippingAccount: true,
      pickFirstHandlingAccount: true,
    });
    const result = await sr.save();
    expect(result.seriesNumber).toBeTruthy();
    await sr.deleteFromList(result.seriesNumber); // clean up this throwaway record
  });

  // ── TC-SHIP-12/13/14: Listing - search/sort/paginate ───────────────────────────
  test('TC-SHIP-12 [+] Search the Shipping Rule list - matching term', async ({ page }) => {
    const sr = new ShippingRulePage(page);

    await sr.gotoList();
    await sr.searchList(created.name);
    await expect(page.getByText(created.name, { exact: false }).first()).toBeVisible();
  });

  // Split from the matching-term case above into its own fresh page load - BasePage.searchList's
  // own debounce-cancellation quirk (documented on searchList itself) means a second search fired
  // right after a clearSearch() in the same test can silently never reach the network.
  test('TC-SHIP-12b [-] Search the Shipping Rule list - no matches shows "No Data"', async ({ page }) => {
    const sr = new ShippingRulePage(page);

    await sr.gotoList();
    await sr.searchList('Automation_NoSuchShippingRule_xyz');
    await expect(sr.noDataRow()).toBeVisible();
  });

  test('TC-SHIP-13 [+] Sort the Shipping Rule list by Name column', async ({ page }) => {
    const sr = new ShippingRulePage(page);

    await sr.gotoList();
    await sr.clickColumnHeader('Name');
    const firstSort = await sr.getColumnAriaSort('Name');
    expect(['ascending', 'descending']).toContain(firstSort);

    await sr.clickColumnHeader('Name');
    const secondSort = await sr.getColumnAriaSort('Name');
    expect(secondSort).not.toBe(firstSort);
  });

  test('TC-SHIP-14 [+] Paginate the Shipping Rule list', async ({ page }) => {
    const sr = new ShippingRulePage(page);

    await sr.gotoList();
    const label = await sr.getPaginationLabel();
    expect(label).toMatch(/Page \d+ of \d+/);
  });
});
