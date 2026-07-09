const { test, expect } = require('@playwright/test');
const ProcurementRequestPage = require('../../pages/ProcurementRequestPage');
const testData               = require('../../config/testData');

test.describe('Procurement Request Management', () => {
  // This account's environment is slower than the default 30s test timeout allows for (shared
  // dataset, added network latency) - a test that hits that ceiling doesn't just fail, it takes
  // down every later test that reads module-level state set by an earlier test too (Playwright
  // appears to restart the worker after a hard timeout, which re-requires this file and resets
  // every `let` above to undefined). Match purchase-agreement.spec.js's same (now also bumped)
  // timeout - multi-step flows (create+edit+approve+delete-attempt) can run close to 90s under
  // concurrent (multi-worker) load even when every step itself is behaving correctly.
  test.describe.configure({ timeout: 150000 });

  // Each of these holds { id, seriesNumber } once set - see the comment on
  // ProcurementRequestPage.saveAndCaptureId for why both are needed.
  let createdRequest;
  let approvedRequest;
  let editRequest;
  const viewValues = {};

  // ── TC-PREQ-01: Create Request ───────────────────────────────────────────
  test('TC-PREQ-01 [+] Create a new request with an item and save as Draft', { tag: '@smoke' }, async ({ page }) => {
    const pr   = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;

    await pr.gotoAdd();
    await pr.fillBasicDetails({
      purchaseRepresentative: data.purchaseRepresentative,
      vendor:                 data.vendor,
      narration:               data.narration,
    });
    await pr.selectLocation(data.location);
    await pr.addItem({ itemName: data.itemName, quantity: data.quantity, rate: data.rate });

    createdRequest = await pr.saveAsDraft();
    expect(createdRequest.id).toBeTruthy();

    const status = await pr.getRowStatus(createdRequest.seriesNumber);
    expect(status).toContain('Draft');
  });

  // ── TC-PREQ-02: Edit the Draft request ───────────────────────────────────
  test('TC-PREQ-02 [+] Edit the draft request and persist changes', async ({ page }) => {
    const pr   = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;

    await pr.gotoList();
    await pr.editFromList(createdRequest.id, createdRequest.seriesNumber);

    await pr.setDateToToday();
    await pr.fillBasicDetails({ narration: data.updatedNarration });
    // Unlike Entity/Purchase Representative/Vendor/Currency/Narration, the edit form does not
    // pre-populate the previously saved Location - it must be re-selected or Save fails
    // "Location is required".
    await pr.selectLocation(data.location);
    await pr.editFirstItem({ quantity: data.updatedQuantity });

    // saveAsDraft (not save) keeps status Draft, since TC-PREQ-04 separately drives approval.
    await pr.saveAsDraft();
  });

  // ── TC-PREQ-03: View page reflects saved data ────────────────────────────
  test('TC-PREQ-03 [+] View page displays all previously filled data correctly', async ({ page }) => {
    const pr   = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;

    await pr.gotoView(createdRequest.id);

    // The View page's own "ID" display uses the same series_number format as the list, not
    // the raw numeric id - see the comment on saveAndCaptureId.
    await expect(page.getByText(createdRequest.seriesNumber, { exact: true })).toBeVisible();
    await expect(page.getByText(data.updatedNarration)).toBeVisible();
    await expect(page.getByText(data.vendor)).toBeVisible();
    await expect(page.getByText(data.location)).toBeVisible();
    await expect(page.getByText(data.itemName.split(' - ')[1] || data.itemName).first()).toBeVisible();

    // Cross-check computed totals reflect the edited quantity.
    await expect(page.locator('text=Total Quantity').locator('xpath=following::*[1]')).toHaveText(data.updatedQuantity);
  });

  // ── TC-PREQ-04: Submit, Quick Approval, Accept ───────────────────────────
  test('TC-PREQ-04 [+] Send Quick Approval to logged-in user and Accept it', async ({ page }) => {
    // KNOWN, ALREADY-FIXED-AT-SOURCE BUG - pending deployment to dev.erpforce.co: on the Edit
    // page, basic-details.tsx's getAndSetCustomerDependentFields() scopes Currency's options to
    // whatever currencies are linked to the selected Vendor, with no fallback when that vendor
    // has none configured (confirmed live: "PC new Vendor" deterministically produces an empty
    // list across 6/6 retries, not a timing race - genuinely no options are ever dispatched).
    // Fixed in erpforce-fe/modules/procurement/src/views/request/form/basic-details.tsx (falls
    // back to the global currency/company list when the vendor-specific one is empty), but that
    // fix isn't live on dev.erpforce.co yet. Remove this test.fail() once it is.
    test.fail(true, 'Known gap: Currency has no options for vendors with no linked currencies (fix pending deployment).');

    const pr   = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;

    // The Submit/Quick Approval action only appears for status Pending/Rejected, not Draft
    // (TC-PREQ-02 deliberately left it Draft); move it to Pending first via a plain Save.
    // Unlike Save To Draft, a plain Save enforces required-field validation, so Currency (which
    // - like Location - does not round-trip onto the Edit form) must also be re-selected here or
    // Save silently fails and never navigates (see the comment on fillBasicDetails' currency arg).
    // Currency is selected AFTER Location, not before: the same sibling-re-render bug that
    // blocks Location's own fetch (see selectLocation) can run in reverse too - selecting
    // Currency first and then retrying Location's dropdown open several times was observed to
    // silently clear Currency back to blank by the time Save was clicked.
    await pr.gotoEdit(createdRequest.id);
    await pr.setDateToToday();
    await pr.selectLocation(data.location);
    await pr.fillBasicDetails({ currency: data.currency });
    await pr.save();

    await pr.gotoView(createdRequest.id);
    await pr.quickApproval(testData.procurementRequest.approverName);
    await expect(page.getByText('Pending Approval')).toBeVisible();

    await pr.accept();
    await expect(page.getByText('In Progress')).toBeVisible();
  });

  // ── TC-PREQ-05: Second request, Reject ───────────────────────────────────
  test('TC-PREQ-05 [+/-] Create a second request, send Quick Approval, and Reject it', async ({ page }) => {
    const pr   = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.reject;

    await pr.gotoAdd();
    await pr.fillBasicDetails({
      purchaseRepresentative: data.purchaseRepresentative,
      vendor:                 data.vendor,
      narration:               data.narration,
    });
    await pr.selectLocation(data.location);
    await pr.addItem({ itemName: data.itemName, quantity: data.quantity, rate: data.rate });

    const rejectRequest = await pr.save();

    await pr.gotoView(rejectRequest.id);
    await pr.quickApproval(testData.procurementRequest.approverName);
    await expect(page.getByText('Pending Approval')).toBeVisible();

    await pr.reject();
    await expect(page.getByText('Rejected', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Re-Submit' })).toBeVisible();
  });

  // ── TC-PREQ-06: Create (Order/RFQ) button gating ─────────────────────────
  test('TC-PREQ-06 [+] Create button only appears once the request is In Progress (approved)', async ({ page }) => {
    const pr   = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;

    await pr.gotoAdd();
    await pr.fillBasicDetails({
      purchaseRepresentative: data.purchaseRepresentative,
      vendor:                 data.vendor,
      narration:               'TC-PREQ-06 create-order/rfq navigation check',
    });
    await pr.selectLocation(data.location);
    await pr.addItem({ itemName: data.itemName, quantity: '2', rate: '20' });

    approvedRequest = await pr.save(); // plain save on a new record goes straight to Pending
    expect(approvedRequest.id).toBeTruthy();

    await pr.gotoView(approvedRequest.id);
    await expect(page.getByText('Pending', { exact: true })).toBeVisible();
    // Create (Order/RFQ) is only offered once a request has actually been approved.
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(0);

    await pr.quickApproval(testData.procurementRequest.approverName);
    // The status banner (and the split-button beneath it) keeps re-rendering for a moment after
    // quickApproval()'s own toast appears - calling accept() immediately can grab a reference to
    // the submit button right as it's torn down and rebuilt (confirmed live: "element was
    // detached from the DOM, retrying" on openSubmitMenu). Wait for the settled Pending Approval
    // state first, same as TC-PREQ-04/05 already do between these two calls.
    await expect(page.getByText('Pending Approval')).toBeVisible();
    await pr.accept();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();
  });

  // ── TC-PREQ-07: Create > Order navigation ────────────────────────────────
  test('TC-PREQ-07 [+] Create > Order navigates to the Add Purchase Order page', async ({ page }) => {
    const pr = new ProcurementRequestPage(page);
    await pr.gotoView(approvedRequest.id);
    await pr.createOrder();
    await expect(page).toHaveURL(/\/procurement\/purchase-order\/add-purchase-order/);
  });

  // ── TC-PREQ-08: Create > RFQ navigation ───────────────────────────────────
  test('TC-PREQ-08 [+] Create > RFQ navigates to the Add RFQ page', async ({ page }) => {
    const pr = new ProcurementRequestPage(page);
    await pr.gotoView(approvedRequest.id);
    await pr.createRfq();
    // Unlike the Order route, RFQ's path keeps an "orders/" segment.
    await expect(page).toHaveURL(/\/procurement\/orders\/request-for-quote\/add-request-for-quote/);
  });

  // ── TC-PREQ-09: Auto-filled fields on Edit match View ────────────────────
  test('TC-PREQ-09 [+] Auto-filled fields on Edit match the View page', async ({ page }) => {
    const pr   = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;

    await pr.gotoAdd();
    await pr.fillBasicDetails({
      purchaseRepresentative: data.purchaseRepresentative,
      vendor:                 data.vendor,
      narration:               'TC-PREQ-09 full-field auto-fill check',
    });
    await pr.selectLocation(data.location);
    await pr.addItem({ itemName: data.itemName, quantity: '4', rate: '25' });

    editRequest = await pr.saveAsDraft();
    expect(editRequest.id).toBeTruthy();

    // Record every value shown on the View page before opening Edit.
    await pr.gotoView(editRequest.id);
    viewValues.entity                 = await pr.getFieldValueOnView('Entity');
    viewValues.purchaseRepresentative = await pr.getFieldValueOnView('Purchase Representative');
    viewValues.vendor                 = await pr.getFieldValueOnView('Vendor');
    viewValues.currency               = await pr.getFieldValueOnView('Currency');
    viewValues.narration              = await pr.getFieldValueOnView('Narration');
    viewValues.location               = await pr.getFieldValueOnView('Location');

    await pr.gotoEdit(editRequest.id);
    await expect(page.getByRole('combobox', { name: data.purchaseRepresentative })).toBeVisible();

    expect(await pr.getEditComboboxValue('Entity *')).toBe(viewValues.entity);
    expect(await pr.getEditComboboxValue('Purchase Representative')).toBe(viewValues.purchaseRepresentative);
    expect(await pr.getEditComboboxValue('Vendor')).toBe(viewValues.vendor);
    // Currency is excluded here - like Location (see TC-PREQ-10), it does not round-trip onto
    // the Edit form (confirmed live: blank immediately after navigating to Edit) even though
    // every other field checked above does.
    expect(await pr.getEditNarrationValue()).toBe(viewValues.narration);

    await expect(page.getByText(data.itemName.split(' - ')[1] || data.itemName).first()).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toContainText('4');
  });

  // ── TC-PREQ-10: Known issue - Location does not auto-populate on Edit ────
  test('TC-PREQ-10 [-] Known issue: Location does not auto-populate on Edit', async ({ page }) => {
    // Every other field checked in TC-PREQ-09 correctly pre-populates; Location is a genuine,
    // isolated app bug (confirmed by polling the field with no change). This test tracks the
    // gap: if it's ever fixed, Playwright will report it as an unexpected pass.
    test.fail(true, 'Known gap: Location renders blank on the Edit form despite a saved value.');

    const pr = new ProcurementRequestPage(page);
    await pr.gotoEdit(editRequest.id);
    expect(await pr.getEditComboboxValue('Location *')).toBe(viewValues.location);
  });

  // ── TC-PREQ-11: ID field is read-only in Edit mode ───────────────────────
  test('TC-PREQ-11 [+] ID field remains read-only in Edit mode', async ({ page }) => {
    const pr = new ProcurementRequestPage(page);
    await pr.gotoEdit(editRequest.id);
    expect(await pr.isIdFieldReadOnly()).toBe(true);
  });

  // ── TC-PREQ-12: Editing one field updates only that field ────────────────
  test('TC-PREQ-12 [+] Editing Quantity and saving updates only that field', async ({ page }) => {
    const pr   = new ProcurementRequestPage(page);
    const data = testData.procurementRequest.valid;

    await pr.gotoEdit(editRequest.id);
    await pr.setDateToToday();
    // Location must be re-selected every edit (see TC-PREQ-10 known-issue test above).
    await pr.selectLocation(data.location);
    await pr.editFirstItem({ quantity: '9' });
    await pr.saveAsDraft();

    await pr.gotoView(editRequest.id);
    await expect(page.locator('text=Total Quantity').locator('xpath=following::*[1]')).toHaveText('9');

    // Unchanged fields retain their original values.
    expect(await pr.getFieldValueOnView('Vendor')).toBe(viewValues.vendor);
    expect(await pr.getFieldValueOnView('Purchase Representative')).toBe(viewValues.purchaseRepresentative);
    expect(await pr.getFieldValueOnView('Narration')).toBe(viewValues.narration);
  });

  // ── Shared helper for the delete-flow test cases below ───────────────────
  // Returns { id, seriesNumber }, same shape as saveAsDraft()/save().
  async function createDraftWithItem(pr, narration) {
    const data = testData.procurementRequest.valid;
    await pr.gotoAdd();
    await pr.fillBasicDetails({
      purchaseRepresentative: data.purchaseRepresentative,
      vendor:                 data.vendor,
      narration,
    });
    await pr.selectLocation(data.location);
    await pr.addItem({ itemName: data.itemName, quantity: '1', rate: '10' });
    return pr.saveAsDraft();
  }

  // ── TC-PREQ-13: Delete a Draft request ───────────────────────────────────
  test('TC-PREQ-13 [+] Delete a Draft procurement request', async ({ page }) => {
    const pr      = new ProcurementRequestPage(page);
    const created = await createDraftWithItem(pr, 'TC-PREQ-13 delete draft');

    await pr.gotoList();
    await pr.deleteFromList(created.seriesNumber);
    await expect(pr.rowBySeriesNumber(created.seriesNumber)).toHaveCount(0);

    // Record cannot be opened again - the breadcrumb falls back to a "-" placeholder rather
    // than "undefined" (confirmed live via ARIA snapshot).
    await pr.gotoView(created.id);
    await expect(page.getByText('ID: -')).toBeVisible();
  });

  // ── TC-PREQ-14: Deleting a Pending request should be blocked ────────────
  test('TC-PREQ-14 [-] Deleting a Submitted (Pending) request should be blocked', async ({ page }) => {
    // Known gap discovered while writing this test: the list row's "..." menu hides Delete for
    // non-Draft status, but the View page's Actions menu still allows it and it succeeds. There
    // is no actual server-side or full UI enforcement of this business rule today.
    test.fail(true, 'Known gap: View page Actions menu allows deleting a Pending request.');

    const pr      = new ProcurementRequestPage(page);
    const created = await createDraftWithItem(pr, 'TC-PREQ-14 delete pending');
    const data    = testData.procurementRequest.valid;

    await pr.gotoEdit(created.id);
    await pr.setDateToToday();
    await pr.selectLocation(data.location);
    await pr.save(); // Draft -> Pending

    await pr.gotoView(created.id);
    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  });

  // ── TC-PREQ-15: Deleting an Approved request should be blocked ───────────
  test('TC-PREQ-15 [-] Deleting an Approved (In Progress) request should be blocked', async ({ page }) => {
    // Same class of gap as TC-PREQ-14, confirmed independently for the approved/In Progress status.
    test.fail(true, 'Known gap: View page Actions menu allows deleting an In Progress request.');

    const pr      = new ProcurementRequestPage(page);
    const created = await createDraftWithItem(pr, 'TC-PREQ-15 delete approved');
    const data    = testData.procurementRequest.valid;

    await pr.gotoEdit(created.id);
    await pr.setDateToToday();
    await pr.selectLocation(data.location);
    await pr.save();

    await pr.gotoView(created.id);
    await pr.quickApproval(testData.procurementRequest.approverName);
    await pr.accept();
    await expect(page.getByText('In Progress')).toBeVisible();

    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  });

  // ── TC-PREQ-16: Related master data survives delete ──────────────────────
  test('TC-PREQ-16 [+] Item master data remains intact after deleting a Draft request', async ({ page }) => {
    const pr      = new ProcurementRequestPage(page);
    const data    = testData.procurementRequest.valid;
    const created = await createDraftWithItem(pr, 'TC-PREQ-16 related data check');

    await pr.gotoList();
    await pr.deleteFromList(created.seriesNumber);

    // Purchase Rep/Vendor selection isn't needed for this check, but every other flow in this
    // suite does it before selectLocation - skipping it raced the entity resolving and timed
    // out, since Location's available options are entity-scoped.
    await pr.gotoAdd();
    await pr.fillBasicDetails({ purchaseRepresentative: data.purchaseRepresentative, vendor: data.vendor });
    await pr.selectLocation(data.location);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const modal = page.getByRole('dialog').filter({ hasText: 'Edit Item' });
    await modal.getByRole('combobox', { name: 'Search Item' }).click();
    await expect(page.getByText(data.itemName, { exact: true }).first()).toBeVisible();
  });

});
