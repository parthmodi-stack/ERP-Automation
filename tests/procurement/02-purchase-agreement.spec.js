const { test, expect } = require('@playwright/test');
const PurchaseAgreementPage = require('../../pages/PurchaseAgreementPage');
const testData              = require('../../config/testData');

test.describe('Purchase Agreement Management', () => {
  // This module's create/edit flow (extra fields, item-default settle wait, and Location's own
  // search-then-retry loop which can take ~25s per attempt under concurrent load) runs close to
  // the default test timeout on its own - give it headroom rather than racing it.
  test.describe.configure({ timeout: 150000 });

  // Each of these holds { id, seriesNumber } once set - see the comment on
  // PurchaseAgreementPage.saveAndCaptureId for why both are needed.
  let createdRequest;
  let editRequest;
  let rejectedRequest;
  // Set by TC-PAGR-02 (selectLocation() now always creates a fresh, uniquely-named Location -
  // see PurchaseAgreementPage.selectLocation's own comment for why) - TC-PAGR-03 asserts against
  // this actual generated name rather than a guessed literal.
  let updatedLocationName;
  const viewValues = {};

  // ── TC-PAGR-01: Create Agreement ─────────────────────────────────────────
  test('TC-PAGR-01 [+] Create a new agreement with an item and save as Draft', { tag: '@smoke' }, async ({ page }) => {
    const pa   = new PurchaseAgreementPage(page);
    const data = testData.purchaseAgreement.valid;

    await pa.gotoAdd();
    await pa.fillBasicDetails({
      name:                    data.name,
      agreementType:           data.agreementType,
      vendor:                 data.vendor,
      purchaseRepresentative: data.purchaseRepresentative,
      narration:               data.narration,
    });
    await pa.selectLocation(data.location);
    await pa.addItem({ itemName: data.itemName, minOrderQty: data.minOrderQty, rate: data.rate });

    createdRequest = await pa.saveAsDraft();
    expect(createdRequest.id).toBeTruthy();

    const status = await pa.getRowStatus(createdRequest.seriesNumber);
    expect(status).toContain('Draft');
  });

  // ── TC-PAGR-02: Edit the Draft agreement ─────────────────────────────────
  test('TC-PAGR-02 [+] Edit the draft agreement and persist changes', async ({ page }) => {
    const pa   = new PurchaseAgreementPage(page);
    const data = testData.purchaseAgreement.valid;

    await pa.gotoList();
    await pa.editFromList(createdRequest.id, createdRequest.seriesNumber);

    await pa.setDateToToday();
    // Unlike Location, Entity does not pre-populate on the Edit form despite having a saved
    // value (it renders blank "Search Entity") - see the known-issue test below. It must be
    // re-selected every edit or Save fails "Entity is required".
    await pa.fillBasicDetails({ entity: data.entity, narration: data.updatedNarration });
    // Location is entity-scoped: the switched entity's valid options differ from the default
    // entity's - selecting an out-of-scope value appears to work in the same client session but
    // silently produces a cross-entity mismatch that renders blank on the next reload.
    updatedLocationName = await pa.selectLocation(data.updatedLocation);
    await pa.editFirstItem({ minOrderQty: data.updatedMinOrderQty });

    await pa.saveAsDraft();
  });

  // ── TC-PAGR-03: View page reflects saved data ────────────────────────────
  test('TC-PAGR-03 [+] View page displays all previously filled data correctly', async ({ page }) => {
    const pa   = new PurchaseAgreementPage(page);
    const data = testData.purchaseAgreement.valid;

    await pa.gotoView(createdRequest.id);

    // The View page's own "ID" display uses the same series_number format as the list, not
    // the raw numeric id - see the comment on saveAndCaptureId.
    await expect(page.getByText(`ID: ${createdRequest.seriesNumber}`, { exact: false })).toBeVisible();
    // .first(): the read-only Summary sidebar echoes Narration/Vendor/Location too (Vendor is
    // also its own link element, giving 2 matches without this).
    await expect(page.getByText(data.updatedNarration).first()).toBeVisible();
    await expect(page.getByText(data.vendor).first()).toBeVisible();
    await expect(page.getByText(updatedLocationName).first()).toBeVisible();
    await expect(page.getByText(data.itemName.split(' - ')[1] || data.itemName).first()).toBeVisible();

    // This module's View page has no aggregate "Total Quantity" summary field - cross-check
    // the edited quantity via the Items table row itself.
    await expect(page.locator('table tbody tr').first()).toContainText(data.updatedMinOrderQty);
  });

  // ── TC-PAGR-04: Submit, Quick Approval, Accept, Validate ─────────────────
  test('TC-PAGR-04 [+] Send Quick Approval to logged-in user, Accept it, and Validate it', async ({ page }) => {
    const pa   = new PurchaseAgreementPage(page);
    const data = testData.purchaseAgreement.valid;

    // Move to Pending first via a plain Save.
    await pa.gotoEdit(createdRequest.id);
    await pa.setDateToToday();
    await pa.fillBasicDetails({ entity: data.entity });
    await pa.selectLocation(data.updatedLocation);
    await pa.save();

    await pa.gotoView(createdRequest.id);
    await pa.quickApproval(testData.purchaseAgreement.approverName);
    await expect(page.getByText('Pending Approval')).toBeVisible();

    await pa.accept();
    await expect(page.getByText('Confirmed')).toBeVisible();

    await pa.validate();
    await expect(page.getByText('In Progress')).toBeVisible();
  });

  // ── TC-PAGR-05: Second agreement, Reject ──────────────────────────────────
  test('TC-PAGR-05 [+/-] Create a second agreement, send Quick Approval, and Reject it', async ({ page }) => {
    const pa   = new PurchaseAgreementPage(page);
    const data = testData.purchaseAgreement.reject;

    await pa.gotoAdd();
    await pa.fillBasicDetails({
      name:                    data.name,
      agreementType:           data.agreementType,
      vendor:                 data.vendor,
      purchaseRepresentative: data.purchaseRepresentative,
      // Currency auto-defaults on the Add form, but that default is populated by an async
      // fetch that isn't always done resolving before a plain Save (unlike Save To Draft,
      // which doesn't enforce it) - confirmed live via a visible "Please select currency"
      // inline error on this exact flow. Select it explicitly rather than racing the default.
      currency:                data.currency,
      narration:               data.narration,
    });
    await pa.selectLocation(data.location);
    await pa.addItem({ itemName: data.itemName, minOrderQty: data.minOrderQty, rate: data.rate });

    rejectedRequest = await pa.save();

    await pa.gotoView(rejectedRequest.id);
    await pa.quickApproval(testData.purchaseAgreement.approverName);
    await expect(page.getByText('Pending Approval')).toBeVisible();

    await pa.reject();
    await expect(page.getByText('Rejected', { exact: true })).toBeVisible();
  });

  // ── TC-PAGR-06: Auto-filled fields on Edit match View ────────────────────
  test('TC-PAGR-06 [+] Auto-filled fields on Edit match the View page', async ({ page }) => {
    const pa   = new PurchaseAgreementPage(page);
    const data = testData.purchaseAgreement.valid;

    await pa.gotoAdd();
    await pa.fillBasicDetails({
      name:                    'TC-PAGR-06 field auto-fill check',
      agreementType:           data.agreementType,
      vendor:                 data.vendor,
      purchaseRepresentative: data.purchaseRepresentative,
      narration:               'TC-PAGR-06 full-field auto-fill check narration',
    });
    await pa.selectLocation(data.location);
    await pa.addItem({ itemName: data.itemName, minOrderQty: '4', rate: '25' });

    editRequest = await pa.saveAsDraft();
    expect(editRequest.id).toBeTruthy();

    await pa.gotoView(editRequest.id);
    viewValues.purchaseRepresentative = await pa.getFieldValueOnView('Purchase Representative');
    viewValues.vendor                 = await pa.getFieldValueOnView('Vendor');
    viewValues.currency               = await pa.getFieldValueOnView('Currency');
    viewValues.narration              = await pa.getFieldValueOnView('Narration');

    await pa.gotoEdit(editRequest.id);
    await expect(page.getByRole('combobox', { name: data.purchaseRepresentative })).toBeVisible();

    expect(await pa.getEditComboboxValue('Purchase Representative')).toBe(viewValues.purchaseRepresentative);
    expect(await pa.getEditComboboxValue('Vendor *')).toBe(viewValues.vendor);
    expect(await pa.getEditComboboxValue('Currency *')).toBe(viewValues.currency);
    expect(await pa.getEditNarrationValue()).toBe(viewValues.narration);

    await expect(page.getByText(data.itemName.split(' - ')[1] || data.itemName).first()).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toContainText('4');
  });

  // ── TC-PAGR-07: Entity auto-populates on Edit ────────────────────────────
  test('TC-PAGR-07 [+] Entity auto-populates on Edit', async ({ page }) => {
    // This was previously a documented known gap (Entity rendered blank on Edit despite a
    // saved value, unlike every other field checked in TC-PAGR-06) - confirmed live (2 clean
    // runs) that it now correctly pre-populates, so this asserts the fix directly instead of
    // tracking the gap via test.fail().
    const pa   = new PurchaseAgreementPage(page);
    const data = testData.purchaseAgreement.valid;

    await pa.gotoEdit(editRequest.id);
    // The combobox briefly shows a "Loading..." placeholder while its own async fetch settles,
    // after gotoEdit()'s own readiness wait (which only checks the ID textbox) has already
    // passed - wait for the real value to land before reading it.
    await expect(page.getByRole('combobox', { name: 'Loading...' })).toHaveCount(0, { timeout: 10000 });
    expect(await pa.getEditComboboxValue('Entity *')).toBe(data.entity);
  });

  // ── TC-PAGR-08: ID field is read-only in Edit mode ───────────────────────
  test('TC-PAGR-08 [+] ID field remains read-only in Edit mode', async ({ page }) => {
    const pa = new PurchaseAgreementPage(page);
    await pa.gotoEdit(editRequest.id);
    expect(await pa.isIdFieldReadOnly()).toBe(true);
  });

  // ── TC-PAGR-09: Editing one field updates only that field ────────────────
  test('TC-PAGR-09 [+] Editing Quantity and saving updates only that field', async ({ page }) => {
    const pa = new PurchaseAgreementPage(page);

    await pa.gotoEdit(editRequest.id);
    await pa.setDateToToday();
    await pa.editFirstItem({ minOrderQty: '9' });
    await pa.saveAsDraft();

    await pa.gotoView(editRequest.id);
    await expect(page.locator('table tbody tr').first()).toContainText('9');

    // Unchanged fields retain their original values.
    expect(await pa.getFieldValueOnView('Vendor')).toBe(viewValues.vendor);
    expect(await pa.getFieldValueOnView('Purchase Representative')).toBe(viewValues.purchaseRepresentative);
    expect(await pa.getFieldValueOnView('Narration')).toBe(viewValues.narration);
  });

  // ── Shared helper for the delete-flow test cases below ───────────────────
  // Returns { id, seriesNumber }, same shape as saveAsDraft()/save().
  async function createDraftWithItem(pa, name) {
    const data = testData.purchaseAgreement.valid;
    return pa.createDraft({ ...data, name, narration: name, minOrderQty: '1', rate: '10' });
  }

  // ── TC-PAGR-10: Delete a Draft agreement ──────────────────────────────────
  test('TC-PAGR-10 [+] Delete a Draft purchase agreement', async ({ page }) => {
    const pa      = new PurchaseAgreementPage(page);
    const created = await createDraftWithItem(pa, 'TC-PAGR-10 delete draft');

    await pa.gotoList();
    await pa.deleteFromList(created.seriesNumber);
    await expect(pa.rowBySeriesNumber(created.seriesNumber)).toHaveCount(0);
  });

  // ── TC-PAGR-11: Deleting a Pending agreement should be blocked ───────────
  test('TC-PAGR-11 [-] Deleting a Submitted (Pending) agreement should be blocked', async ({ page }) => {
    // Same class of gap as the sibling Procurement Request page's TC-PREQ-14: the View page's
    // Actions menu still offers Delete for a non-Draft status, with no server-side or full UI
    // enforcement of this business rule (confirmed live: Delete menuitem count is 1, not 0).
    test.fail(true, 'Known gap: View page Actions menu allows deleting a Pending agreement.');

    const pa      = new PurchaseAgreementPage(page);
    const created = await createDraftWithItem(pa, 'TC-PAGR-11 delete pending');
    const data    = testData.purchaseAgreement.valid;

    await pa.gotoEdit(created.id);
    await pa.setDateToToday();
    await pa.fillBasicDetails({ entity: data.entity });
    await pa.selectLocation(data.updatedLocation);
    await pa.save(); // Draft -> Pending

    await pa.gotoView(created.id);
    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  });

  // ── TC-PAGR-12: Deleting an Approved agreement should be blocked ─────────
  test('TC-PAGR-12 [-] Deleting an Approved (In Progress) agreement should be blocked', async ({ page }) => {
    // Same class of gap as TC-PAGR-11, confirmed independently for the approved/Confirmed status
    // (matching the sibling Procurement Request page's TC-PREQ-15).
    test.fail(true, 'Known gap: View page Actions menu allows deleting a Confirmed/In Progress agreement.');

    const pa      = new PurchaseAgreementPage(page);
    const created = await createDraftWithItem(pa, 'TC-PAGR-12 delete approved');
    const data    = testData.purchaseAgreement.valid;

    await pa.gotoEdit(created.id);
    await pa.setDateToToday();
    await pa.fillBasicDetails({ entity: data.entity });
    await pa.selectLocation(data.updatedLocation);
    await pa.save();

    await pa.gotoView(created.id);
    await pa.quickApproval(testData.purchaseAgreement.approverName);
    await pa.accept();
    await expect(page.getByText('Confirmed')).toBeVisible();

    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  });

  // ── TC-PAGR-13: Related master data survives delete ──────────────────────
  test('TC-PAGR-13 [+] Item master data remains intact after deleting a Draft agreement', async ({ page }) => {
    const pa      = new PurchaseAgreementPage(page);
    const data    = testData.purchaseAgreement.valid;
    const created = await createDraftWithItem(pa, 'TC-PAGR-13 related data check');

    await pa.gotoList();
    await pa.deleteFromList(created.seriesNumber);

    await pa.gotoAdd();
    await pa.fillBasicDetails({ vendor: data.vendor, purchaseRepresentative: data.purchaseRepresentative });
    await pa.selectLocation(data.location);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const modal = page.getByRole('dialog').filter({ hasText: /Item/i });
    await modal.getByRole('combobox', { name: /Item/i }).click();
    await expect(page.getByText(data.itemName, { exact: true }).first()).toBeVisible();
  });

  // ── TC-PAGR-14: Create > Order navigation ────────────────────────────────
  // Modeled on the sibling Procurement Request/RFQ pages' own TC-PREQ-27/TC-RFQ-07 - the View
  // page's "Create" action (only rendered once status is In Progress) offers an "Order" menu
  // item that navigates to the Add Purchase Order page, carrying this agreement's data via
  // route state (confirmed in source: header-buttons.tsx's Create > Order MenuItem passes
  // `state: { purchaseAgreement: data }`, which add-purchase-order.tsx reads back out as
  // `location.state?.purchaseAgreement` to pre-fill the new Purchase Order).
  test('TC-PAGR-14 [+] Create > Order navigates to the Add Purchase Order page', async ({ page }) => {
    const pa = new PurchaseAgreementPage(page);
    await pa.gotoView(createdRequest.id);
    await pa.createOrder();
    await expect(page).toHaveURL(/\/purchase-order\/add-purchase-order/);
  });

  // ── Listing Page (TC-PAGR-L01 - TC-PAGR-L05) ─────────────────────────────
  // Reuses records already created/status-transitioned by the lifecycle tests above
  // (editRequest=Draft, createdRequest=In Progress, rejectedRequest=Rejected).
  test.describe('Listing Page', () => {
    test('TC-PAGR-L01 [+] Search/filter the list', async ({ page }) => {
      const pa = new PurchaseAgreementPage(page);
      await pa.gotoList();

      await pa.searchList(editRequest.seriesNumber);
      await expect(pa.rowBySeriesNumber(editRequest.seriesNumber)).toBeVisible();

      await pa.searchList('no-such-agreement-zzz-999');
      await expect(pa.noDataRow()).toBeVisible();
      await expect(page.locator('table tbody tr').filter({ has: page.locator('a') })).toHaveCount(0);

      await pa.clearSearch();
    });

    test('TC-PAGR-L02 [+] Sort a column ascending/descending', async ({ page }) => {
      const pa = new PurchaseAgreementPage(page);
      await pa.gotoList();

      const initialSort = await pa.getColumnAriaSort('Date');
      expect(initialSort).toBe('none');

      await pa.clickColumnHeader('Date');
      const afterFirstClick = await pa.getColumnAriaSort('Date');
      expect(['ascending', 'descending']).toContain(afterFirstClick);

      await pa.clickColumnHeader('Date');
      const afterSecondClick = await pa.getColumnAriaSort('Date');
      expect(afterSecondClick).not.toBe(afterFirstClick);
      expect(['ascending', 'descending']).toContain(afterSecondClick);
    });

    test('TC-PAGR-L03 [+] Paginate between pages', async ({ page }) => {
      const pa = new PurchaseAgreementPage(page);
      await pa.gotoList();

      await expect(pa.prevPageButton()).toBeDisabled();
      expect(await pa.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);

      await pa.nextPageButton().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      expect(await pa.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
      await expect(pa.prevPageButton()).toBeEnabled();

      await pa.prevPageButton().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      expect(await pa.getPaginationLabel()).toMatch(/Page\s*1\s*of\s*\d+/);

      await pa.goToPage(2);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      expect(await pa.getPaginationLabel()).toMatch(/Page\s*2\s*of\s*\d+/);
    });

    test('TC-PAGR-L04 [+] Row action menu actions reflect status/permission gating', async ({ page }) => {
      const pa = new PurchaseAgreementPage(page);
      await pa.gotoList();

      // Unlike the sibling Procurement Request page, Purchase Agreement's Edit action is only
      // disabled for Closed/Expired status - Draft and In Progress rows both keep it enabled.
      await pa.searchList(editRequest.seriesNumber);
      expect(await pa.isRowActionDisabled(editRequest.seriesNumber, 'Edit')).toBe(false);

      await pa.searchList(createdRequest.seriesNumber);
      expect(await pa.isRowActionDisabled(createdRequest.seriesNumber, 'Edit')).toBe(false);

      await pa.clearSearch();
    });

    test('TC-PAGR-L05 [+] Row status badge matches the record\'s lifecycle state', async ({ page }) => {
      const pa = new PurchaseAgreementPage(page);
      await pa.gotoList();

      expect(await pa.getRowStatus(editRequest.seriesNumber)).toContain('Draft');
      expect(await pa.getRowStatus(createdRequest.seriesNumber)).toContain('In Progress');
      expect(await pa.getRowStatus(rejectedRequest.seriesNumber)).toContain('Rejected');
    });
  });

});
