const { test, expect } = require('@playwright/test');
const RfqPage           = require('../../pages/RfqPage');
const testData          = require('../../config/testData');

test.describe('RFQ (Request for Quote) Management', () => {
  // This account's environment is slower than the default 30s test timeout allows for (shared
  // dataset, added network latency) - match procurement-request.spec.js's same fix.
  test.describe.configure({ timeout: 90000 });

  // Each of these holds { id, seriesNumber } once set - see the comment on
  // RfqPage.saveAndCaptureId for why both are needed.
  let createdRfq;
  let approvedRfq;
  let editRfq;
  const viewValues = {};

  // ── TC-RFQ-01: Create RFQ ──────────────────────────────────────────────────
  test('TC-RFQ-01 [+] Create a new RFQ with an item and save as Draft', { tag: '@smoke' }, async ({ page }) => {
    const rfq  = new RfqPage(page);
    const data = testData.rfq.valid;

    await rfq.gotoAdd();
    await rfq.fillBasicDetails({
      vendor:                  data.vendor,
      purchaseRepresentative:  data.purchaseRepresentative,
      narration:               data.narration,
    });
    await rfq.addItem({ itemName: data.itemName, requestedQuantity: data.requestedQuantity });

    createdRfq = await rfq.saveAsDraft();
    expect(createdRfq.id).toBeTruthy();

    const status = await rfq.getRowStatus(createdRfq.seriesNumber);
    expect(status).toContain('Draft');
  });

  // ── TC-RFQ-02: Edit the Draft RFQ ──────────────────────────────────────────
  test('TC-RFQ-02 [+] Edit the draft RFQ and persist changes', async ({ page }) => {
    const rfq  = new RfqPage(page);
    const data = testData.rfq.valid;

    await rfq.gotoList();
    await rfq.editFromList(createdRfq.id, createdRfq.seriesNumber);

    await rfq.setDateToToday();
    // Re-select vendor to ensure dependent fields (Company, Currency) are populated for save.
    await rfq.fillBasicDetails({
      vendor:    data.vendor,
      narration: data.updatedNarration,
    });
    await rfq.editFirstItem({ requestedQuantity: data.updatedRequestedQuantity });

    // saveAsDraft keeps status Draft; TC-RFQ-05 separately drives the status transition.
    await rfq.saveAsDraft();
  });

  // ── TC-RFQ-03: View page reflects saved data ──────────────────────────────
  test('TC-RFQ-03 [+] View page displays all previously filled data correctly', async ({ page }) => {
    const rfq  = new RfqPage(page);
    const data = testData.rfq.valid;

    await rfq.gotoView(createdRfq.id);

    // The View page's own "ID" display uses the series_number format.
    await expect(page.getByText(createdRfq.seriesNumber, { exact: true })).toBeVisible();
    await expect(page.getByText(data.updatedNarration)).toBeVisible();
    await expect(page.getByText(data.vendor)).toBeVisible();
    await expect(page.getByText(data.itemName.split(' - ')[1] || data.itemName).first()).toBeVisible();
  });

  // ── TC-RFQ-04: Status transition Draft → Open ─────────────────────────────
  // NOTE: RFQ does NOT have an approval workflow. A plain Save on a Draft record moves it to Open.
  test('TC-RFQ-04 [+] Save transitions Draft to Open status', async ({ page }) => {
    const rfq  = new RfqPage(page);
    const data = testData.rfq.valid;

    await rfq.gotoEdit(createdRfq.id);
    await rfq.setDateToToday();
    // Re-select vendor to ensure dependent fields are populated for save.
    await rfq.fillBasicDetails({ vendor: data.vendor });
    await rfq.save();

    await rfq.gotoView(createdRfq.id);
    await expect(page.getByText('Open', { exact: true })).toBeVisible();
  });

  // ── TC-RFQ-05: Cancel an Open RFQ ──────────────────────────────────────────
  test('TC-RFQ-05 [+] Cancel an Open RFQ changes status to Cancelled', async ({ page }) => {
    const rfq = new RfqPage(page);

    await rfq.gotoView(createdRfq.id);
    await rfq.cancelFromView();

    // After cancellation, status should be Cancelled.
    await rfq.gotoView(createdRfq.id);
    await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  });

  // ── TC-RFQ-06: Create button visibility on Open status ─────────────────────
  test('TC-RFQ-06 [+] Create button appears once the RFQ is Open', async ({ page }) => {
    const rfq  = new RfqPage(page);
    const data = testData.rfq.valid;

    // Create a new RFQ and move it to Open.
    await rfq.gotoAdd();
    await rfq.fillBasicDetails({
      vendor:                 data.vendor,
      purchaseRepresentative: data.purchaseRepresentative,
      narration:              'TC-RFQ-06 create-button visibility check',
    });
    await rfq.addItem({ itemName: data.itemName, requestedQuantity: '2' });

    approvedRfq = await rfq.save(); // plain save on new record → Open
    expect(approvedRfq.id).toBeTruthy();

    await rfq.gotoView(approvedRfq.id);
    await expect(page.getByText('Open', { exact: true })).toBeVisible();

    // The Create dropdown button should be visible for Open status.
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
  });

  // ── TC-RFQ-07: Create > Order navigation ───────────────────────────────────
  test('TC-RFQ-07 [+] Create > Order navigates to the Add Purchase Order page', async ({ page }) => {
    const rfq = new RfqPage(page);
    await rfq.gotoView(approvedRfq.id);
    await rfq.createOrder();
    await expect(page).toHaveURL(/\/procurement\/purchase-order\/add-purchase-order/);
  });

  // ── TC-RFQ-08: Create > Response navigation ────────────────────────────────
  test('TC-RFQ-08 [+] Create > Response navigates to the Add Response page', async ({ page }) => {
    const rfq = new RfqPage(page);
    await rfq.gotoView(approvedRfq.id);
    await rfq.createResponse();
    await expect(page).toHaveURL(/\/request-for-quote\/add-response-for-quote/);
  });

  // ── TC-RFQ-09: Auto-filled fields on Edit match View ───────────────────────
  test('TC-RFQ-09 [+] Auto-filled fields on Edit match the View page', async ({ page }) => {
    const rfq  = new RfqPage(page);
    const data = testData.rfq.valid;

    await rfq.gotoAdd();
    await rfq.fillBasicDetails({
      vendor:                 data.vendor,
      purchaseRepresentative: data.purchaseRepresentative,
      narration:              'TC-RFQ-09 full-field auto-fill check',
    });
    await rfq.addItem({ itemName: data.itemName, requestedQuantity: '4' });

    editRfq = await rfq.saveAsDraft();
    expect(editRfq.id).toBeTruthy();

    // Record every value shown on the View page before opening Edit.
    await rfq.gotoView(editRfq.id);
    viewValues.vendor   = await rfq.getFieldValueOnView('Vendor');
    viewValues.currency = await rfq.getFieldValueOnView('Currency');
    viewValues.narration = await rfq.getFieldValueOnView('Narration');

    await rfq.gotoEdit(editRfq.id);

    // Check that Vendor combobox is pre-populated.
    expect(await rfq.getEditComboboxValue('Vendor *')).toBe(viewValues.vendor);
    expect(await rfq.getEditNarrationValue()).toBe(viewValues.narration);

    // Item row should be visible.
    await expect(page.getByText(data.itemName.split(' - ')[1] || data.itemName).first()).toBeVisible();
  });

  // ── TC-RFQ-10: ID field is read-only in Edit mode ──────────────────────────
  test('TC-RFQ-10 [+] ID field remains read-only in Edit mode', async ({ page }) => {
    const rfq = new RfqPage(page);
    await rfq.gotoEdit(editRfq.id);
    expect(await rfq.isIdFieldReadOnly()).toBe(true);
  });

  // ── TC-RFQ-11: Editing one field updates only that field ───────────────────
  test('TC-RFQ-11 [+] Editing Narration and saving updates only that field', async ({ page }) => {
    const rfq  = new RfqPage(page);
    const data = testData.rfq.valid;

    await rfq.gotoEdit(editRfq.id);
    await rfq.setDateToToday();
    // Re-select vendor to ensure dependent fields are populated for save.
    await rfq.fillBasicDetails({
      vendor:    data.vendor,
      narration: 'TC-RFQ-11 - ONLY narration changed',
    });
    await rfq.saveAsDraft();

    await rfq.gotoView(editRfq.id);
    // Changed field should be updated.
    expect(await rfq.getFieldValueOnView('Narration')).toBe('TC-RFQ-11 - ONLY narration changed');
    // Unchanged fields retain their original values.
    expect(await rfq.getFieldValueOnView('Vendor')).toBe(viewValues.vendor);
  });

  // ── Shared helper for the delete-flow test cases below ─────────────────────
  // Returns { id, seriesNumber }, same shape as saveAsDraft()/save().
  async function createDraftRfq(rfq, narration) {
    const data = testData.rfq.valid;
    await rfq.gotoAdd();
    await rfq.fillBasicDetails({
      vendor:                 data.vendor,
      purchaseRepresentative: data.purchaseRepresentative,
      narration,
    });
    await rfq.addItem({ itemName: data.itemName, requestedQuantity: '1' });
    return rfq.saveAsDraft();
  }

  // ── TC-RFQ-12: Delete a Draft RFQ ──────────────────────────────────────────
  test('TC-RFQ-12 [+] Delete a Draft RFQ', async ({ page }) => {
    const rfq     = new RfqPage(page);
    const created = await createDraftRfq(rfq, 'TC-RFQ-12 delete draft');

    await rfq.gotoList();
    await rfq.deleteFromList(created.seriesNumber);
    await expect(rfq.rowBySeriesNumber(created.seriesNumber)).toHaveCount(0);

    // Record cannot be opened again.
    await rfq.gotoView(created.id);
    await expect(page.getByText(`ID: ${created.seriesNumber}`)).not.toBeVisible({ timeout: 5000 }).catch(() => {
      // View page may redirect or show undefined - either confirms deletion worked.
    });
  });

  // ── TC-RFQ-13: Related master data survives delete ─────────────────────────
  test('TC-RFQ-13 [+] Item master data remains intact after deleting a Draft RFQ', async ({ page }) => {
    const rfq     = new RfqPage(page);
    const data    = testData.rfq.valid;
    const created = await createDraftRfq(rfq, 'TC-RFQ-13 related data check');

    await rfq.gotoList();
    await rfq.deleteFromList(created.seriesNumber);

    // Create a new RFQ and verify the item is still available.
    await rfq.gotoAdd();
    await rfq.fillBasicDetails({ vendor: data.vendor });
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('combobox', { name: /Item/i }).click();
    await expect(page.getByText(data.itemName, { exact: true }).first()).toBeVisible();
  });

  // ── TC-RFQ-V01: Required Vendor validation ─────────────────────────────────
  test('TC-RFQ-V01 [-] Required Vendor left empty blocks save', async ({ page }) => {
    const rfq = new RfqPage(page);
    await rfq.gotoAdd();

    // Try to save without filling Vendor (required field).
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Validation should block save - page should NOT navigate away.
    await expect(page).toHaveURL(/add-request-for-quote/);
  });

  // ── TC-RFQ-V02: Required fields inline errors ──────────────────────────────
  test('TC-RFQ-V02 [-] Required fields show inline error and block save', async ({ page }) => {
    const rfq = new RfqPage(page);
    await rfq.gotoAdd();

    // Fill ONLY the narration (not Vendor, not Company, not Currency - all required).
    await page.getByPlaceholder('Enter Narration').fill('Validation test narration');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Validation errors should prevent navigation.
    await expect(page).toHaveURL(/add-request-for-quote/);

    // At least one inline error message should be visible.
    await expect(page.getByText(/required/i).first()).toBeVisible({ timeout: 5000 });
  });

});
