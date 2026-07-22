const { test, expect } = require('@playwright/test');
const PurchaseOrderPage         = require('../../pages/PurchaseOrderPage');
const GoodsReceiptNotePage      = require('../../pages/GoodsReceiptNotePage');
const VendorReturnAuthorizationPage = require('../../pages/VendorReturnAuthorizationPage');
const testData          = require('../../config/testData');

// NOTE ON VERIFICATION: unlike the sibling Procurement Request/Purchase Agreement/RFQ suites,
// this file was authored from FE source reading (validator.ts, header-buttons.tsx,
// basic-details-tab.tsx) rather than iterative live debugging against dev.erpforce.co - it has
// not been run live yet. Expect some locator/flow adjustments once it's first executed, the
// same way the sibling suites' many "confirmed live" comments accumulated over real runs.
test.describe('Purchase Order Management', () => {
  // This module's form is the richest of the four (two tabs, more required fields, an
  // approval workflow, plus a Payment Terms/Address/Contact set of required-but-unverified
  // fields resolved via selectFirstOptionByLabel) - give it the same headroom as the sibling
  // Purchase Agreement suite.
  test.describe.configure({ timeout: 150000 });

  let createdOrder;
  let editOrder;
  let rejectedOrder;
  const viewValues = {};

  // ── TC-PO-01: Create Order ────────────────────────────────────────────────
  test('TC-PO-01 [+] Create a new purchase order with an item and save as Draft', { tag: '@smoke' }, async ({ page }) => {
    const po   = new PurchaseOrderPage(page);
    const data = testData.purchaseOrder.valid;

    await po.gotoAdd();
    await po.fillBasicDetails({
      vendor:                 data.vendor,
      entity:                 data.entity,
      currency:               data.currency,
      purchaseRepresentative: data.purchaseRepresentative,
      narration:              data.narration,
    });
    await po.selectLocation(data.location);
    await po.selectPaymentTerm();
    await po.fillAddressContact();
    await po.addItem({ itemName: data.itemName, quantity: data.quantity, rate: data.rate });

    createdOrder = await po.saveAsDraft();
    expect(createdOrder.id).toBeTruthy();

    const status = await po.getRowStatus(createdOrder.seriesNumber);
    expect(status).toContain('Draft');
  });

  // ── TC-PO-02: Edit the Draft order ────────────────────────────────────────
  test('TC-PO-02 [+] Edit the draft order and persist changes', async ({ page }) => {
    const po   = new PurchaseOrderPage(page);
    const data = testData.purchaseOrder.valid;

    await po.gotoList();
    await po.editFromList(createdOrder.id, createdOrder.seriesNumber);

    await po.setDateToToday();
    // Re-select every required field explicitly rather than assuming any of them round-trip
    // onto the Edit form - every sibling module has at least one field (Location/Entity/
    // Currency) that silently doesn't, and this module's exact behavior is unverified.
    await po.fillBasicDetails({
      vendor:                 data.vendor,
      entity:                 data.entity,
      currency:               data.currency,
      narration:              data.updatedNarration,
    });
    await po.selectLocation(data.location);
    await po.selectPaymentTerm();
    await po.editFirstItem({ quantity: data.updatedQuantity });

    // saveAsDraft (not save) keeps status Draft - TC-PO-04 separately drives approval.
    await po.saveAsDraft();
  });

  // ── TC-PO-03: View page reflects saved data ───────────────────────────────
  test('TC-PO-03 [+] View page displays all previously filled data correctly', async ({ page }) => {
    const po   = new PurchaseOrderPage(page);
    const data = testData.purchaseOrder.valid;

    await po.gotoView(createdOrder.id);

    await expect(page.getByText(`ID: ${createdOrder.seriesNumber}`, { exact: false })).toBeVisible();
    await expect(page.getByText(data.updatedNarration).first()).toBeVisible();
    await expect(page.getByText(data.vendor).first()).toBeVisible();
    await expect(page.getByText(data.itemName.split(' - ')[1] || data.itemName).first()).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toContainText(data.updatedQuantity);
  });

  // ── TC-PO-04: Submit, Quick Approval, Accept ──────────────────────────────
  test('TC-PO-04 [+] Send Quick Approval to logged-in user and Accept it', async ({ page }) => {
    const po   = new PurchaseOrderPage(page);
    const data = testData.purchaseOrder.valid;

    // Move to Pending first via a plain Save - same Draft->Pending convention as every sibling
    // module's approval flow.
    await po.gotoEdit(createdOrder.id);
    await po.setDateToToday();
    await po.fillBasicDetails({ vendor: data.vendor, entity: data.entity, currency: data.currency });
    await po.selectLocation(data.location);
    await po.selectPaymentTerm();
    await po.save();

    await po.gotoView(createdOrder.id);
    await po.quickApproval(testData.purchaseOrder.approverName);
    await expect(page.getByText('Pending Approval')).toBeVisible();

    await po.accept();
    // Unlike Purchase Agreement (which has an extra Validate step landing on "In Progress"),
    // Purchase Order's STATUS constants go straight from Pending Approval to "Approved".
    await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  });

  // ── TC-PO-05: Second order, Reject ────────────────────────────────────────
  test('TC-PO-05 [+/-] Create a second order, send Quick Approval, and Reject it', async ({ page }) => {
    const po   = new PurchaseOrderPage(page);
    const data = testData.purchaseOrder.reject;

    await po.gotoAdd();
    await po.fillBasicDetails({
      vendor:                 data.vendor,
      entity:                 data.entity,
      currency:               data.currency,
      purchaseRepresentative: data.purchaseRepresentative,
      narration:              data.narration,
    });
    await po.selectLocation(data.location);
    await po.selectPaymentTerm();
    await po.fillAddressContact();
    await po.addItem({ itemName: data.itemName, quantity: data.quantity, rate: data.rate });

    rejectedOrder = await po.save(); // plain save on a new record goes straight to Pending

    await po.gotoView(rejectedOrder.id);
    await po.quickApproval(testData.purchaseOrder.approverName);
    await expect(page.getByText('Pending Approval')).toBeVisible();

    await po.reject();
    await expect(page.getByText('Rejected', { exact: true })).toBeVisible();
  });

  // ── TC-PO-06: Auto-filled fields on Edit match View ───────────────────────
  test('TC-PO-06 [+] Auto-filled fields on Edit match the View page', async ({ page }) => {
    const po   = new PurchaseOrderPage(page);
    const data = testData.purchaseOrder.valid;

    await po.gotoAdd();
    await po.fillBasicDetails({
      vendor:                 data.vendor,
      entity:                 data.entity,
      currency:               data.currency,
      purchaseRepresentative: data.purchaseRepresentative,
      narration:              'TC-PO-06 full-field auto-fill check',
    });
    await po.selectLocation(data.location);
    await po.selectPaymentTerm();
    await po.fillAddressContact();
    await po.addItem({ itemName: data.itemName, quantity: '4', rate: '25' });

    editOrder = await po.saveAsDraft();
    expect(editOrder.id).toBeTruthy();

    await po.gotoView(editOrder.id);
    viewValues.vendor    = await po.getFieldValueOnView('Vendor');
    viewValues.currency  = await po.getFieldValueOnView('Currency');
    viewValues.narration = await po.getFieldValueOnView('Narration');

    await po.gotoEdit(editOrder.id);
    expect(await po.getEditComboboxValue('Vendor')).toBe(viewValues.vendor);
    expect(await po.getEditNarrationValue()).toBe(viewValues.narration);

    await expect(page.getByText(data.itemName.split(' - ')[1] || data.itemName).first()).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toContainText('4');
  });

  // ── TC-PO-07: ID field is read-only in Edit mode ──────────────────────────
  test('TC-PO-07 [+] ID field remains read-only in Edit mode', async ({ page }) => {
    const po = new PurchaseOrderPage(page);
    await po.gotoEdit(editOrder.id);
    expect(await po.isIdFieldReadOnly()).toBe(true);
  });

  // ── TC-PO-08: Editing one field updates only that field ───────────────────
  test('TC-PO-08 [+] Editing Quantity and saving updates only that field', async ({ page }) => {
    const po   = new PurchaseOrderPage(page);
    const data = testData.purchaseOrder.valid;

    await po.gotoEdit(editOrder.id);
    await po.setDateToToday();
    await po.fillBasicDetails({ vendor: data.vendor, entity: data.entity, currency: data.currency });
    await po.selectLocation(data.location);
    await po.selectPaymentTerm();
    await po.editFirstItem({ quantity: '9' });
    await po.saveAsDraft();

    await po.gotoView(editOrder.id);
    await expect(page.locator('table tbody tr').first()).toContainText('9');

    // Unchanged fields retain their original values.
    expect(await po.getFieldValueOnView('Vendor')).toBe(viewValues.vendor);
    expect(await po.getFieldValueOnView('Narration')).toBe(viewValues.narration);
  });

  // ── Shared helper for the delete-flow test cases below ────────────────────
  async function createDraftWithItem(po, narration) {
    const data = testData.purchaseOrder.valid;
    return po.createDraft({ ...data, narration, quantity: '1', rate: '10' });
  }

  // ── TC-PO-09: Delete a Draft order ────────────────────────────────────────
  test('TC-PO-09 [+] Delete a Draft purchase order', async ({ page }) => {
    const po      = new PurchaseOrderPage(page);
    const created = await createDraftWithItem(po, 'TC-PO-09 delete draft');

    await po.gotoList();
    await po.deleteFromList(created.seriesNumber);
    await expect(po.rowBySeriesNumber(created.seriesNumber)).toHaveCount(0);
  });

  // ── TC-PO-10: Known gap - deleting a Pending order should be blocked ──────
  test('TC-PO-10 [-] Known gap: Deleting a Submitted (Pending) order should be blocked', async ({ page }) => {
    // Same class of gap already confirmed live on the sibling Procurement Request/Purchase
    // Agreement/RFQ pages: header-buttons.tsx renders the Actions menu's Delete item
    // unconditionally (disabled only by canDelete permission / fully-received receiving
    // status), with no status check for Pending specifically.
    test.fail(true, 'Known gap: View page Actions menu allows deleting a Pending purchase order.');

    const po      = new PurchaseOrderPage(page);
    const created = await createDraftWithItem(po, 'TC-PO-10 delete pending');
    const data    = testData.purchaseOrder.valid;

    await po.gotoEdit(created.id);
    await po.setDateToToday();
    await po.fillBasicDetails({ vendor: data.vendor, entity: data.entity, currency: data.currency });
    await po.selectLocation(data.location);
    await po.selectPaymentTerm();
    await po.save(); // Draft -> Pending

    await po.gotoView(created.id);
    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  });

  // ── TC-PO-11: Known gap - deleting an Approved order should be blocked ────
  test('TC-PO-11 [-] Known gap: Deleting an Approved order should be blocked', async ({ page }) => {
    test.fail(true, 'Known gap: View page Actions menu allows deleting an Approved purchase order.');

    const po      = new PurchaseOrderPage(page);
    const created = await createDraftWithItem(po, 'TC-PO-11 delete approved');
    const data    = testData.purchaseOrder.valid;

    await po.gotoEdit(created.id);
    await po.setDateToToday();
    await po.fillBasicDetails({ vendor: data.vendor, entity: data.entity, currency: data.currency });
    await po.selectLocation(data.location);
    await po.selectPaymentTerm();
    await po.save();

    await po.gotoView(created.id);
    await po.quickApproval(testData.purchaseOrder.approverName);
    await po.accept();
    await expect(page.getByText('Approved', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  });

  // ── TC-PO-12: Related master data survives delete ─────────────────────────
  test('TC-PO-12 [+] Item master data remains intact after deleting a Draft order', async ({ page }) => {
    const po      = new PurchaseOrderPage(page);
    const data    = testData.purchaseOrder.valid;
    const created = await createDraftWithItem(po, 'TC-PO-12 related data check');

    await po.gotoList();
    await po.deleteFromList(created.seriesNumber);

    await po.gotoAdd();
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    const modal = page.getByRole('dialog').filter({ hasText: /Item/i });
    // Exact 'Search Item' (not a bare /Item/i regex): the modal also has a "Search Discount Item"
    // combobox whose accessible name substring-matches the regex, causing a strict-mode violation
    // (same fix as PurchaseOrderPage.addItem).
    await modal.getByRole('combobox', { name: 'Search Item', exact: true }).click();
    // The popover's default (unfiltered) option list only shows a limited recent-N window and may
    // not include this specific item - narrow via its own filter textbox first (same fix as
    // PurchaseOrderPage.addItem).
    await page.getByPlaceholder('Search Item').fill(data.itemName).catch(() => {});
    await expect(page.getByRole('listbox').getByText(data.itemName, { exact: true }).first()).toBeVisible();
  });

  // ── TC-PO-V01: Required fields left empty block save ──────────────────────
  test('TC-PO-V01 [-] Required fields left empty block save', async ({ page }) => {
    const po = new PurchaseOrderPage(page);
    await po.gotoAdd();

    // CONFIRMED LIVE: the Add form's actual buttons are Discard/Save To Draft/Next/Submit - there
    // is NO plain "Save" button on this form (same distinction already documented on
    // PurchaseOrderPage.save()). No Vendor/Entity/Location/Currency/Payment Term/item filled in -
    // Submit should not navigate away from the Add form.
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page).toHaveURL(/add-purchase-order/);
    // CONFIRMED LIVE: Entity/Currency/Payment Terms arrive pre-filled with account defaults (see
    // fillBasicDetails), so with nothing else filled in, the Items array is the one validation
    // that actually fires - its real wording is "Please add at least one item or expense" (not
    // a generic "required" string, which never appears here at all).
    await expect(page.getByText(/add at least one item/i).first()).toBeVisible({ timeout: 5000 });
  });

  // ── Listing Page (TC-PO-L01 - TC-PO-L05) ──────────────────────────────────
  // Reuses records already created/status-transitioned by the lifecycle tests above
  // (editOrder=Draft, createdOrder=Approved, rejectedOrder=Rejected).
  test.describe('Listing Page', () => {
    test('TC-PO-L01 [+] Search/filter the list', async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();

      await po.searchList(editOrder.seriesNumber);
      await expect(po.rowBySeriesNumber(editOrder.seriesNumber)).toBeVisible();

      await po.searchList('no-such-purchase-order-zzz-999');
      // A second consecutive search on this page's narrow-viewport Menu-wrapped search input can
      // race the debounced re-fetch/dismiss sequence (BasePage.searchList's own waitForResponse
      // can catch an unrelated response before the real filtered one lands, and the grid reverts
      // to its full unfiltered state instead of showing "No Data") - retry once before asserting.
      if (!(await po.noDataRow().isVisible().catch(() => false))) {
        await po.searchList('no-such-purchase-order-zzz-999');
      }
      await expect(po.noDataRow()).toBeVisible({ timeout: 10000 });
      await expect(page.locator('table tbody tr').filter({ has: page.locator('a') })).toHaveCount(0);

      await po.clearSearch();
    });

    test('TC-PO-L02 [+] Sort a column ascending/descending', async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();

      // CONFIRMED LIVE: a bare 'Date' strict-mode-violates - this grid ALSO has "Confirmation
      // Date"/"Expected Receipt Date" columns that substring-match it, and the Date column's own
      // accessible name is actually "Date 0" (a sort-count badge baked into the header's text).
      // /^Date/i matches only that column (the other two don't start with "Date").
      const dateColumn = /^Date/i;
      const initialSort = await po.getColumnAriaSort(dateColumn);
      expect(initialSort).toBe('none');

      await po.clickColumnHeader(dateColumn);
      const afterFirstClick = await po.getColumnAriaSort(dateColumn);
      expect(['ascending', 'descending']).toContain(afterFirstClick);

      await po.clickColumnHeader(dateColumn);
      const afterSecondClick = await po.getColumnAriaSort(dateColumn);
      expect(afterSecondClick).not.toBe(afterFirstClick);
      expect(['ascending', 'descending']).toContain(afterSecondClick);
    });

    test('TC-PO-L03 [+] Paginate between pages', async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();

      await expect(po.prevPageButton()).toBeDisabled();
      expect(await po.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);

      await po.nextPageButton().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      expect(await po.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
      await expect(po.prevPageButton()).toBeEnabled();

      await po.prevPageButton().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      expect(await po.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);

      await po.goToPage(2);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      expect(await po.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
    });

    test('TC-PO-L04 [+] Row action menu shows only status-appropriate actions', async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();

      // Edit is disabled once an order reaches Cancelled/Closed, or is fully received - a
      // Draft row (editOrder) must still have it enabled.
      await po.searchList(editOrder.seriesNumber);
      expect(await po.isRowActionDisabled(editOrder.seriesNumber, 'Edit')).toBe(false);

      await po.clearSearch();
    });

    test('TC-PO-L05 [+] Row status badge matches the record\'s lifecycle state', async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();

      expect(await po.getRowStatus(editOrder.seriesNumber)).toContain('Draft');
      expect(await po.getRowStatus(createdOrder.seriesNumber)).toContain('Approved');
      expect(await po.getRowStatus(rejectedOrder.seriesNumber)).toContain('Rejected');
    });
  });

  // ── Create Vendor Return from Purchase Order (TC-PO-R01) ─────────────────
  // CONFIRMED LIVE: "Return" (header-buttons.tsx's Action menu) only appears once the PO has
  // actually been received AND that receipt validated - plain GRN creation/save alone is NOT
  // enough (receiving_status stays short of Partially/Fully Received until the GRN's own
  // Validate succeeds, which itself is disabled until every item has traceability added,
  // regardless of the item's tracking type in this account). The real precondition chain is
  // therefore PO Approved -> Receive -> GRN -> add traceability -> Validate -> PO Actions ▸
  // Return - not a simple "Approved PO" alone. Also confirmed live: unlike the RFQ->PO flow,
  // Vendor/Currency/Entity/Location/Payment Terms/Purchase Representative AND the whole Address &
  // Contact tab all copy straight from the source PO, but Items do NOT (the source PO's own item
  // never appears in the grid - "No Data") - the user must pick what's actually being returned,
  // so addItem() below is required, not optional.
  test.describe('Create Vendor Return from Purchase Order', () => {
    test('TC-PO-R01 [+] Create Vendor Return from a received Purchase Order copies Vendor/Location/Address & Contact, then Submit succeeds', async ({
      page,
    }) => {
      const po  = new PurchaseOrderPage(page);
      const grn = new GoodsReceiptNotePage(page);
      const vra = new VendorReturnAuthorizationPage(page);
      const data = testData.purchaseOrder.valid;

      await po.gotoAdd();
      await po.fillBasicDetails({
        vendor:                 data.vendor,
        entity:                 data.entity,
        currency:               data.currency,
        purchaseRepresentative: data.purchaseRepresentative,
        narration:              'TC-PO-R01 source PO for Vendor Return conversion',
      });
      const sourceLocation = await po.selectLocation('Automation_PO_Return_Location');
      await po.selectPaymentTerm();
      await po.fillAddressContact();
      // NOT poData's own 5/100 (confirmed live elsewhere in this suite: that total makes the
      // backend reject a direct create+Submit with an accounting-mismatch 400) - 3/50 is the
      // same proven-safe combination the sibling GRN suite already uses.
      await po.addItem({ itemName: data.itemName, quantity: '3', rate: '50' });

      const sourcePo = await po.save(); // brand-new record -> straight to Pending
      expect(sourcePo.id).toBeTruthy();

      await po.gotoView(sourcePo.id);
      await po.quickApproval(testData.purchaseOrder.approverName);
      await po.accept();
      await expect(page.getByText('Approved', { exact: true })).toBeVisible();

      await po.clickReceive();
      await grn.waitForCreateReady();
      await grn.fillBasicDetails({ referenceNumber: 'AUTO-PO-RETURN-GRN', narration: 'TC-PO-R01 receiving GRN' });
      const createdGrn = await grn.save();
      expect(createdGrn.id).toBeTruthy();

      // "Return" doesn't appear on the PO until this receipt is actually Validated - Validate
      // itself stays disabled until traceability is added, so that step can't be skipped even
      // though this test isn't otherwise about traceability.
      await grn.gotoView(createdGrn.poId, createdGrn.id);
      await grn.addTraceabilityForItem(0, { lotSerial: 'AUTO-PO-RETURN-LOT', quantity: '3' });
      await grn.validate();

      await po.gotoView(sourcePo.id);
      await po.createVendorReturn();
      await expect(page).toHaveURL(/\/vendor-returns\/add-vendor-returns/);

      // Basic Details + Address & Contact are copied straight from the source PO. The dependent
      // fields (Entity/Location/Payment Terms/Purchase Representative) briefly show a "Loading..."
      // placeholder while their own async fetches settle - wait for that to clear before reading.
      await expect(page.getByText(data.vendor).first()).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Loading...' })).toHaveCount(0, { timeout: 10000 });
      expect(await vra.getEditComboboxValue('Location')).toBe(sourceLocation);
      await page.getByText('Address & Contact', { exact: true }).click();
      await page.waitForTimeout(500);
      const vendorAddressValue = await vra.getEditComboboxValue('Vendor Address');
      // Not getEditComboboxValue('Shipping Address'): same accordion-title collision already
      // documented on VendorReturnAuthorizationPage.fillAddressContact() - the section title and
      // the field's own label are both bare "Shipping Address" text, and only the field's label
      // carries a mandatory trailing asterisk.
      const shippingAddressValue = await page
        .getByText(/^Shipping Address\s*\*$/i)
        .first()
        .locator('xpath=following-sibling::*[1]')
        .innerText();
      expect(vendorAddressValue).toBeTruthy();
      expect(vendorAddressValue).not.toMatch(/^Search/i);
      expect(shippingAddressValue).toBeTruthy();
      expect(shippingAddressValue).not.toMatch(/^Search/i);

      // Items are NOT copied (confirmed live: "No Data" in the grid right after Return) - the
      // user picks what's actually being returned, same as a from-scratch VRA.
      await vra.addItem({ item: data.itemName, quantity: '3', rate: '50' });

      const createdVra = await vra.save();
      expect(createdVra.id).toBeTruthy();
    });
  });

});
