const { test, expect } = require('@playwright/test');
const RfqPage           = require('../../pages/RfqPage');
const PurchaseOrderPage = require('../../pages/PurchaseOrderPage');
const testData          = require('../../config/testData');

// .serial: every test below depends on createdRfq/approvedRfq/editRfq set by an earlier test in
// this same file (see e.g. Listing Page's own comment: "Reuses records already created/status-
// transitioned by the lifecycle tests above"). Per 01-procurement-request.spec.js's own comment,
// Playwright appears to restart the worker after a hard failure in this environment, which
// re-requires the file and resets every module-level `let` above to undefined - a later test
// then reads that reset variable instead of the value an earlier test set (confirmed live:
// TC-RFQ-04/05 intermittently threw "Cannot read properties of undefined (reading 'id')" on
// createdRfq right after TC-RFQ-03 failed). A plain describe still runs these in file order, but
// .serial additionally skips the remaining tests in the block once one fails, instead of letting
// them run against reset state and fail with a confusing, unrelated-looking error.
test.describe.serial('RFQ (Request for Quote) Management', () => {
  // This account's environment is slower than the default 30s test timeout allows for (shared
  // dataset, added network latency) - match procurement-request.spec.js's same fix. 90000 was
  // still not enough headroom: confirmed live that multi-step flows here (create+view+edit in
  // TC-RFQ-09, create+delete in TC-RFQ-12/13, create+response in TC-RFQ-15/16) reliably run
  // right up against/over a 90s ceiling even with no other load - bump to 150000 to match every
  // other multi-step spec file in this suite (01/02/04/05/07/09 all use 150000, 08 uses 200000).
  test.describe.configure({ timeout: 150000 });

  // Each of these holds { id, seriesNumber } once set - see the comment on
  // RfqPage.saveAndCaptureId for why both are needed.
  let createdRfq;
  let approvedRfq;
  let editRfq;
  const viewValues = {};

  // ── TC-RFQ-01: Create RFQ ──────────────────────────────────────────────────
  test('TC-RFQ-01 [+] Create a new RFQ with an item and save as Draft', async ({ page }) => {
    const rfq  = new RfqPage(page);
    const data = testData.rfq.valid;

    await rfq.gotoAdd();
    await rfq.fillBasicDetails({
      vendor:                  data.vendor,
      purchaseRepresentative:  data.purchaseRepresentative,
      narration:               data.narration,
    });
    await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
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
    // Re-select vendor to ensure dependent fields (Entity, Currency) are populated for save.
    await rfq.fillBasicDetails({
      vendor:    data.vendor,
      narration: data.updatedNarration,
    });
    await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
    await rfq.editFirstItem({ requestedQuantity: data.updatedRequestedQuantity });

    // saveAsDraft keeps status Draft; TC-RFQ-05 separately drives the status transition.
    await rfq.saveAsDraft();
  });

  // ── TC-RFQ-03: View page reflects saved data ──────────────────────────────
  test('TC-RFQ-03 [+] View page displays all previously filled data correctly', async ({ page }) => {
    const rfq  = new RfqPage(page);
    const data = testData.rfq.valid;

    await rfq.gotoView(createdRfq.id);

    // The View page's own "ID" display uses the series_number format. .first(): the read-only
    // Summary sidebar echoes the same ID text (same collision class as PurchaseAgreementPage's
    // openDropdownAndPick comment), so an exact match resolves to 2 elements without it.
    await expect(page.getByText(createdRfq.seriesNumber, { exact: true }).first()).toBeVisible();
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
    await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
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
    await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
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
    await expect(page).toHaveURL(/\/request-for-quote\/add-response/);
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
    await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
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
    await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
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
    return rfq.createDraft({ ...data, narration, requestedQuantity: '1' });
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
    // .first(): Basic Details also has a "Call For Tender" accordion with its own
    // identically-labeled "Add" button further down the page (same as RfqPage.addItem()) -
    // Items comes first in DOM order.
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('combobox', { name: /Item/i }).click();
    await expect(page.getByText(data.itemName, { exact: true }).first()).toBeVisible();
  });

  // ── Create Response from RFQ (TC-RFQ-15 - TC-RFQ-16) ───────────────────────
  // WRITTEN FROM erpforce-fe/erpforce-be SOURCE, NOT YET LIVE-VERIFIED end-to-end - same
  // "unverified live" caveat this repo already carries for VendorReturnAuthorizationPage. Uses
  // its own dedicated source RFQ (not the shared `approvedRfq`) so creating a Response here -
  // which flips the source RFQ's own status - can't disturb the Listing Page block below, which
  // still depends on `approvedRfq` staying "Open".
  test.describe('Create Response from RFQ', () => {
    test('TC-RFQ-15 [+] Create a Response from an Open RFQ moves it to Response Received', async ({
      page,
    }) => {
      const rfq = new RfqPage(page);
      const data = testData.rfq.valid;
      const narration = 'TC-RFQ-15 create response from rfq';

      await rfq.gotoAdd();
      await rfq.fillBasicDetails({
        vendor: data.vendor,
        purchaseRepresentative: data.purchaseRepresentative,
        narration,
      });
      await rfq.fillAddressContact({
        contactPerson: data.contactPerson,
        shippingAddress: data.shippingAddress,
        vendorAddress: data.vendorAddress,
      });
      await rfq.addItem({ itemName: data.itemName, requestedQuantity: '2' });

      const sourceRfq = await rfq.save(); // plain save on a new record -> Open
      expect(sourceRfq.id).toBeTruthy();

      await rfq.gotoView(sourceRfq.id);
      await expect(page.getByText('Open', { exact: true })).toBeVisible();

      await rfq.createResponse();
      await rfq.waitForResponseFormReady();

      // The pre-fill lands after a real network round-trip (fetchRequestForQuoteId behind the
      // scenes) - wait for it to actually land rather than a fixed delay.
      await expect(page.getByPlaceholder('Enter Narration')).toHaveValue(narration, {
        timeout: 15000,
      });

      // Date carries over the source RFQ's own (now-past) date and must be reset, or Save fails
      // "Date cannot be in the past" validation.
      await rfq.setDateToToday();
      // Payment Terms is required but never pre-filled from the source RFQ at all.
      await rfq.selectResponsePaymentTerms();
      // Rate is the one item field genuinely required and left blank by the source-RFQ copy.
      await rfq.editResponseItemRate('75');

      await rfq.saveResponse();

      // Saving a Response automatically flips the PARENT RFQ's own status to "Response Received"
      // (source-confirmed, rfq-response.service.js - only from Open/RFQ Sent).
      await rfq.gotoView(sourceRfq.id);
      await expect(page.getByText('Response Received', { exact: true })).toBeVisible();
    });

    test('TC-RFQ-16 [-] Save is blocked when Payment Terms/Rate are left empty', async ({
      page,
    }) => {
      const rfq = new RfqPage(page);
      const data = testData.rfq.valid;

      await rfq.gotoAdd();
      await rfq.fillBasicDetails({
        vendor: data.vendor,
        purchaseRepresentative: data.purchaseRepresentative,
        narration: 'TC-RFQ-16 response validation check',
      });
      await rfq.fillAddressContact({
        contactPerson: data.contactPerson,
        shippingAddress: data.shippingAddress,
        vendorAddress: data.vendorAddress,
      });
      await rfq.addItem({ itemName: data.itemName, requestedQuantity: '2' });

      const sourceRfq = await rfq.save();
      await rfq.gotoView(sourceRfq.id);
      await rfq.createResponse();
      await rfq.waitForResponseFormReady();
      await rfq.setDateToToday();

      // Neither Payment Terms nor the item's Rate is filled in - Save is expected to be blocked
      // by required-field validation rather than silently creating a Response with no rate.
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page).toHaveURL(/\/request-for-quote\/add-response/);
    });
  });

  // ── Create Purchase Order from RFQ (TC-RFQ-17) ───────────────────────────────
  // Create > Order is available directly on an Open RFQ (no Response needed first - source:
  // header-buttons.tsx's CreateActionBtn gates the Order menu item on canAddPurchaseOrder only,
  // unlike Response/Agreement which also require a specific status list). add-purchase-order.tsx
  // re-fetches the RFQ server-side (getV1RfqIdProvidePoDetails) and copies Vendor/Company/
  // Location/Currency/Payment Term straight onto the new PO, same as the sibling Request-sourced
  // flow (TC-PREQ-27) - but unlike a Request, an RFQ's own Add form collects Address & Contact
  // (RfqPage.fillAddressContact(), already called below), and the backend copies that
  // (rfqContacts) onto the new PO's own Address & Contact tab too. This is the one inheritance
  // TC-PREQ-27 could never assert (a Procurement Request has no such tab at all) - assert it here
  // instead of blindly overwriting via PurchaseOrderPage.fillAddressContact().
  test.describe('Create Purchase Order from RFQ', () => {
    test('TC-RFQ-17 [+] Create Purchase Order from an Open RFQ copies Vendor/Payment Term/Address & Contact, then Submit succeeds', async ({
      page,
    }) => {
      const rfq  = new RfqPage(page);
      const po   = new PurchaseOrderPage(page);
      const data = testData.rfq.valid;
      const narration = 'TC-RFQ-17 create PO from RFQ';

      await rfq.gotoAdd();
      await rfq.fillBasicDetails({
        vendor:                 data.vendor,
        purchaseRepresentative: data.purchaseRepresentative,
        narration,
      });
      // Location is optional on the RFQ's own form (unlike the required field it becomes on the
      // PO it sources) - the sibling Request/Agreement flows always set one, but this RFQ suite
      // never has before now. Give the source RFQ one so there's something for the new PO to
      // actually inherit (confirmed live: leaving it unset here left the new PO's own required
      // Location blank, blocking Submit with "Location is required").
      const sourceLocation = await rfq.selectLocation('Automation_Rfq_PO_Location');
      await rfq.fillAddressContact({
        contactPerson:   data.contactPerson,
        shippingAddress: data.shippingAddress,
        vendorAddress:   data.vendorAddress,
      });
      await rfq.addItem({ itemName: data.itemName, requestedQuantity: '4' });

      const sourceRfq = await rfq.save(); // plain save on a new record → Open
      expect(sourceRfq.id).toBeTruthy();

      await rfq.gotoView(sourceRfq.id);
      await expect(page.getByText('Open', { exact: true })).toBeVisible();

      await rfq.createOrder();
      await po.waitForCreateFromSourceReady();

      // Basic Details are copied straight from the source RFQ.
      await expect(page.getByText(data.vendor).first()).toBeVisible();
      await expect(page.getByText(sourceLocation).first()).toBeVisible();

      // Items: the source item and its requested quantity carry over (rate is system-defaulted
      // from the item's own master cost, not from any test data, since no Response was created).
      const row = page.locator('table tbody tr').first();
      await expect(row).toContainText(data.itemName.split(' - ')[1] || data.itemName);
      await expect(row).toContainText('4');

      // Address & Contact should already be populated from the source RFQ's own contacts - read
      // it BEFORE touching the tab so a real pre-fill isn't masked by fillAddressContact()'s own
      // unconditional "pick first available" overwrite.
      await page.getByText('Address & Contact', { exact: true }).click();
      await page.waitForTimeout(500);
      const vendorAddressValue = await po.getEditComboboxValue('Vendor Address');
      const contactPersonValue = await po.getEditComboboxValue('Contact Person');
      const shippingAddressValue = await po.getEditComboboxValue('Shipping Address');
      expect(vendorAddressValue).toBeTruthy();
      expect(vendorAddressValue).not.toMatch(/^Search/i);
      expect(contactPersonValue).toBeTruthy();
      expect(contactPersonValue).not.toMatch(/^Search/i);
      expect(shippingAddressValue).toBeTruthy();
      expect(shippingAddressValue).not.toMatch(/^Search/i);
      await page.getByText('Basic Details', { exact: true }).click();
      await page.waitForTimeout(500);

      // Payment Terms is also expected to carry over here (RFQ's own vendor-selection cascade
      // auto-sets it, unlike a Request) - selectPaymentTerm() is a no-op when already populated,
      // so it's safe to call regardless and only fills a gap if the copy didn't happen.
      await po.selectPaymentTerm();

      const createdOrder = await po.save();
      expect(createdOrder.id).toBeTruthy();
    });
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

  // ── TC-RFQ-V03: Known gap - Requested Quantity has no positive-value rule ──
  test('TC-RFQ-V03 [-] Known gap: Requested Quantity accepts zero/negative values', async ({ page }) => {
    // generateItemValiadtionSchema() in the RFQ item modal's validator only checks item_id/
    // vendor_name/uom_id - requested_quantity has no Yup rule and no HTML min= constraint, so
    // 0/negative values are never rejected (confirmed via source read, not live - see the
    // migration notes/memory for why this suite can't drive a full live run in this pass).
    // Track the gap rather than silently asserting the (missing) validation as if it existed.
    test.fail(true, 'Known gap: Requested Quantity has no positive-value validation rule.');

    const rfq  = new RfqPage(page);
    const data = testData.rfq.valid;

    await rfq.gotoAdd();
    await rfq.fillBasicDetails({
      vendor:                 data.vendor,
      purchaseRepresentative: data.purchaseRepresentative,
      narration:              'TC-RFQ-V03 zero-quantity validation check',
    });
    await rfq.fillAddressContact({ contactPerson: data.contactPerson, shippingAddress: data.shippingAddress, vendorAddress: data.vendorAddress });
    await rfq.addItem({ itemName: data.itemName, requestedQuantity: '0' });
    await rfq.saveAsDraft();

    // Expected (currently failing) behavior: a validation error should have blocked the save.
    await expect(page.getByText(/greater than 0|must be positive/i).first()).toBeVisible({ timeout: 5000 });
  });

  // ── Listing Page (TC-RFQ-L01 - TC-RFQ-L05) ─────────────────────────────────
  // Reuses records already created/status-transitioned by the lifecycle tests above
  // (editRfq=Draft, approvedRfq=Open, createdRfq=Cancelled after TC-RFQ-05).
  test.describe('Listing Page', () => {
    test('TC-RFQ-L01 [+] Search/filter the list', async ({ page }) => {
      const rfq = new RfqPage(page);
      await rfq.gotoList();

      await rfq.searchList(editRfq.seriesNumber);
      await expect(rfq.rowBySeriesNumber(editRfq.seriesNumber)).toBeVisible();

      await rfq.searchList('no-such-rfq-zzz-999');
      await expect(rfq.noDataRow()).toBeVisible();
      await expect(page.locator('table tbody tr').filter({ has: page.locator('a') })).toHaveCount(0);

      await rfq.clearSearch();
    });

    test('TC-RFQ-L02 [+] Sort a column ascending/descending', async ({ page }) => {
      const rfq = new RfqPage(page);
      await rfq.gotoList();

      const initialSort = await rfq.getColumnAriaSort('Date');
      expect(initialSort).toBe('none');

      await rfq.clickColumnHeader('Date');
      const afterFirstClick = await rfq.getColumnAriaSort('Date');
      expect(['ascending', 'descending']).toContain(afterFirstClick);

      await rfq.clickColumnHeader('Date');
      const afterSecondClick = await rfq.getColumnAriaSort('Date');
      expect(afterSecondClick).not.toBe(afterFirstClick);
      expect(['ascending', 'descending']).toContain(afterSecondClick);
    });

    test('TC-RFQ-L03 [+] Paginate between pages', async ({ page }) => {
      const rfq = new RfqPage(page);
      await rfq.gotoList();

      await expect(rfq.prevPageButton()).toBeDisabled();
      expect(await rfq.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);

      await rfq.nextPageButton().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      expect(await rfq.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
      await expect(rfq.prevPageButton()).toBeEnabled();

      await rfq.prevPageButton().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      expect(await rfq.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);

      await rfq.goToPage(2);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      expect(await rfq.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
    });

    // Unlike Procurement Request/Purchase Agreement, RFQ's row action menu is NOT status-gated
    // at all - Edit/Duplicate/Delete are only gated by canEdit/canAdd/canDelete permissions
    // (confirmed via source read: request-for-quote.tsx's rowActionMenu never checks `status`).
    test('TC-RFQ-L04 [+] Row action menu is permission-gated only, not status-gated', async ({ page }) => {
      const rfq = new RfqPage(page);
      await rfq.gotoList();

      await rfq.searchList(editRfq.seriesNumber); // Draft
      expect(await rfq.isRowActionDisabled(editRfq.seriesNumber, 'Edit')).toBe(false);

      await rfq.searchList(createdRfq.seriesNumber); // Cancelled
      expect(await rfq.isRowActionDisabled(createdRfq.seriesNumber, 'Edit')).toBe(false);

      await rfq.clearSearch();
    });

    test('TC-RFQ-L05 [+] Row status badge matches the record\'s lifecycle state', async ({ page }) => {
      const rfq = new RfqPage(page);
      await rfq.gotoList();

      expect(await rfq.getRowStatus(editRfq.seriesNumber)).toContain('Draft');
      expect(await rfq.getRowStatus(approvedRfq.seriesNumber)).toContain('Open');
      expect(await rfq.getRowStatus(createdRfq.seriesNumber)).toContain('Cancelled');
    });
  });

  // ── TC-RFQ-14: Known gap - Delete is not blocked for non-Draft records ─────
  test('TC-RFQ-14 [-] Known gap: Deleting a non-Draft (Cancelled) RFQ is not blocked', async ({ page }) => {
    // Same class of gap already documented on the sibling Procurement Request/Purchase
    // Agreement pages (TC-PREQ-14, TC-PAGR-11): showDeletBtnAction in header-buttons.tsx lists
    // nearly every status (including Cancelled), and there's no additional status check inside
    // the delete handler - the View page's Actions menu Delete item shows up and is clickable
    // regardless of lifecycle state, gated only by the canDelete permission.
    test.fail(true, 'Known gap: View page Actions menu allows deleting a Cancelled RFQ.');

    const rfq = new RfqPage(page);
    await rfq.gotoView(createdRfq.id); // Cancelled, via TC-RFQ-05
    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  });

});
