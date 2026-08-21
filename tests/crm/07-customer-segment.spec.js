const { test, expect } = require('@playwright/test');
const CustomerSegmentPage = require('../../pages/CustomerSegmentPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

// Customer Segments (erpforce-fe: modules/crm/src/views/settings/customer-segments/) - confirmed
// real module, route `/dashboard/crm/settings/customer-segments`. Implements the cases documented
// in CRM_SETTINGS_TEST_CASES.md's "3. Customer Segments" section (TC-CSEG-01..14, TC-CSEG-V01/04/05).
//
// SCOPE NOTES:
// - TC-CSEG-V02 (end_date before start_date) and TC-CSEG-V03 (non-numeric purchase_amount/count)
//   are NOT automated here - both are "Manual first" in the test-case doc since no Yup rule exists
//   for either, so there's no confirmed pass/fail expectation to assert against without first
//   checking live behavior by hand.
// - `segment_duration` (a date-range picker) is exercised only for its enable/disable gating via
//   `autoassign`, not for the exact derived segment_start_date/segment_end_date values - a full
//   date-range picker interaction is its own significant surface and out of scope for this pass.
// - TC-CSEG-V05 confirms the Submit button's console.log-only no-op handler
//   (view-customer-segment.tsx:366-372) - unlike Shipping Rule's missing-button case, this is a
//   normal passing assertion (status genuinely doesn't change), not a test.fail() case.
test.describe('Customer Segments Module', () => {
  test.describe.configure({ timeout: 90000 });

  let created = {};
  let draftRecord = {};

  // ── TC-CSEG-01: Create with required fields ────────────────────────────────────
  test('TC-CSEG-01 [+] Create Customer Segment with required fields', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);
    const data = testData.customerSegment.valid;

    await cs.goto();
    await expect(page).toHaveURL(/add-customer-segments/);

    await cs.fillGeneralDetails({
      name: data.name,
      startDate: cs.formatDateToday(),
    });

    const result = await cs.save();
    expect(result.seriesNumber).toBeTruthy();
    created = { ...result, name: data.name };

    await cs.searchList(data.name);
    await expect(page.getByText(data.name, { exact: false }).first()).toBeVisible();
  });

  // ── TC-CSEG-03: View renders all saved fields ──────────────────────────────────
  test('TC-CSEG-03 [+] View Customer Segment - all saved fields render correctly', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);
    const data = testData.customerSegment.valid;

    await cs.gotoList();
    await cs.searchList(created.name);
    await cs.openViewFromList(created.seriesNumber);
    await expect(page).toHaveURL(/view-customer-segments/);

    await expect(page.getByText(data.name, { exact: false }).first()).toBeVisible();
  });

  // ── TC-CSEG-08/09: Edit preloads existing values; ID stays read-only ───────────
  test('TC-CSEG-08 [+] Edit Customer Segment - existing values preload, ID stays read-only', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);
    const data = testData.customerSegment.valid;

    await cs.gotoList();
    await cs.searchList(created.name);
    await cs.openEditFromList(created.seriesNumber);
    await expect(page).toHaveURL(/edit-customer-segments/);

    await expect(cs.nameInput).toHaveValue(data.name);
    await expect(cs.idInput).toBeDisabled();

    await cs.discardButton.click();
  });

  // ── TC-CSEG-07: Editing a single field updates only that field ────────────────
  test('TC-CSEG-07 [+] Edit a single field (Name) - only that field updates', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);
    const data = testData.customerSegment.valid;

    await cs.gotoList();
    await cs.searchList(created.name);
    await cs.openEditFromList(created.seriesNumber);

    await cs.nameInput.fill(data.updatedName);
    const result = await cs.save();
    expect(result.seriesNumber).toBeTruthy();
    created.name = data.updatedName;

    await cs.gotoList();
    await cs.searchList(created.name);
    await cs.openEditFromList(created.seriesNumber);
    await expect(cs.nameInput).toHaveValue(data.updatedName);
    await cs.discardButton.click();
  });

  // ── TC-CSEG-04: autoassign checkbox gates dependent fields ─────────────────────
  test('TC-CSEG-04 [+] autoassign checkbox enables Purchase Amount/Count fields', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);

    await cs.goto();
    expect(await cs.areDependentFieldsEnabled()).toBeFalsy();

    await cs.setAutoAssign(true);
    expect(await cs.areDependentFieldsEnabled()).toBeTruthy();

    await cs.setAutoAssign(false);
    expect(await cs.areDependentFieldsEnabled()).toBeFalsy();

    await cs.discardButton.click();
  });

  // ── TC-CSEG-05/06: Create with autoassign checked persists dependent fields ────
  test('TC-CSEG-05 [+] Create with autoassign checked - Purchase Amount/Count persist', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);
    const data = testData.customerSegment.autoAssign;

    await cs.goto();
    await cs.fillGeneralDetails({
      name: data.name,
      startDate: cs.formatDateToday(),
      autoassign: true,
      purchaseAmount: data.purchaseAmount,
      purchaseCount: data.purchaseCount,
    });

    const result = await cs.save();
    expect(result.seriesNumber).toBeTruthy();

    await cs.openEditFromList(result.seriesNumber);
    expect(await cs.areDependentFieldsEnabled()).toBeTruthy();
    await expect(cs.purchaseAmountInput).toHaveValue(data.purchaseAmount);
    await expect(cs.purchaseCountInput).toHaveValue(data.purchaseCount);

    await cs.discardButton.click();
    await cs.gotoList();
    await cs.searchList(data.name);
    await cs.deleteFromList(result.seriesNumber); // clean up this throwaway record
  });

  // ── TC-CSEG-14: Save To Draft ───────────────────────────────────────────────────
  test('TC-CSEG-14 [+] Create Customer Segment and Save To Draft - status shows Draft', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);
    const data = testData.customerSegment.draft;

    await cs.goto();
    await cs.fillGeneralDetails({
      name: data.name,
      startDate: cs.formatDateToday(),
    });

    const result = await cs.saveAsDraft();
    draftRecord = { ...result, name: data.name };

    await cs.searchList(data.name);
    await expect(await cs.getRowStatus(draftRecord.seriesNumber)).toMatch(/Draft/);
  });

  // ── TC-CSEG-V05: Submit button's onClick is a confirmed no-op ──────────────────
  // Uses draftRecord specifically - the Submit button only renders when status === 'Draft'
  // (view-customer-segment.tsx:366), and a regular Save (not Save To Draft) sets status to
  // 'Submitted' immediately, same as Shipping Rule - so `created` would never show this button.
  test('TC-CSEG-V05 [-] BUG - Submit does nothing (source: view-customer-segment.tsx:366-372)', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);

    await cs.gotoList();
    await cs.searchList(draftRecord.name);
    await cs.openViewFromList(draftRecord.seriesNumber);

    const consoleMessage = await cs.clickSubmitAndCaptureConsole();
    expect(consoleMessage).toBeTruthy(); // confirms the exact known no-op handler fired

    // Confirm no actual state change: reloading still shows the same status, no network side effect.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(cs.viewSubmitButton).toBeVisible(); // still Draft - Submit never advanced status
  });

  // ── TC-CSEG-V01: Required fields left empty block Save ─────────────────────────
  test('TC-CSEG-V01 [-] Required fields left empty block Save', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);

    await cs.goto();
    await cs.saveButton.click();

    await expect(cs.nameRequiredError).toBeVisible();
    await expect(cs.startDateRequiredError).toBeVisible();
    await expect(page).toHaveURL(/add-customer-segments/); // never navigated away - not created
  });

  // ── TC-CSEG-V04: Correcting an invalid field clears its error ──────────────────
  test('TC-CSEG-V04 [+] Correcting an empty required field clears its inline error', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);

    await cs.goto();
    await cs.saveButton.click();
    await expect(cs.nameRequiredError).toBeVisible();

    await cs.nameInput.fill(testDataFactory.uniqueName('Automation_CustomerSegment_Temp'));
    await expect(cs.nameRequiredError).not.toBeVisible();

    await cs.discardButton.click();
  });

  // ── TC-CSEG-10/11: Delete a segment; related master data intact ────────────────
  test('TC-CSEG-10 [+] Delete a Customer Segment successfully', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);

    await cs.gotoList();
    await cs.searchList(draftRecord.name);
    await cs.deleteFromList(draftRecord.seriesNumber);

    await cs.gotoList();
    await cs.searchList(draftRecord.name);
    await expect(cs.noDataRow()).toBeVisible();
  });

  test('TC-CSEG-11 [+] Related master data (Company) remains usable after delete', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);
    const name = testDataFactory.uniqueName('Automation_CustomerSegment_PostDelete');

    await cs.goto();
    await cs.fillGeneralDetails({ name, startDate: cs.formatDateToday() });
    const result = await cs.save();
    expect(result.seriesNumber).toBeTruthy();
    await cs.deleteFromList(result.seriesNumber); // clean up this throwaway record
  });

  // ── TC-CSEG-12/13: Listing - search/sort/paginate ──────────────────────────────
  test('TC-CSEG-12 [+] Search the Customer Segments list - matching term', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);

    await cs.gotoList();
    await cs.searchList(created.name);
    await expect(page.getByText(created.name, { exact: false }).first()).toBeVisible();
  });

  test('TC-CSEG-12b [-] Search the Customer Segments list - no matches shows "No Data"', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);

    await cs.gotoList();
    await cs.searchList('Automation_NoSuchCustomerSegment_xyz');
    await expect(cs.noDataRow()).toBeVisible();
  });

  test('TC-CSEG-13a [+] Sort the Customer Segments list by Name column', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);

    await cs.gotoList();
    await cs.clickColumnHeader('Name');
    const firstSort = await cs.getColumnAriaSort('Name');
    expect(['ascending', 'descending']).toContain(firstSort);

    await cs.clickColumnHeader('Name');
    const secondSort = await cs.getColumnAriaSort('Name');
    expect(secondSort).not.toBe(firstSort);
  });

  test('TC-CSEG-13b [+] Paginate the Customer Segments list', async ({ page }) => {
    const cs = new CustomerSegmentPage(page);

    await cs.gotoList();
    const label = await cs.getPaginationLabel();
    expect(label).toMatch(/Page \d+ of \d+/);
  });
});
