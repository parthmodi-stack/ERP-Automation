const { test, expect } = require('@playwright/test');
const CustomerReturnPage = require('../../pages/CustomerReturnPage');
const testData = require('../../config/testData');
const { createCustomerReturnViaReturnDelivery } = require('./helpers/createCustomerReturnViaReturnDelivery');

// ── tests/regression/13-customer-returns.spec.js ──────────────────────────────────────────────
// Customer Returns (CRM > Orders > Customer Returns) can be created three ways: (1) directly from
// this module's own listing page, (2) via the "RMA" button on a fully-delivered/fully-invoiced,
// Completed CRM Sales Order's view page, (3) via the "Return Delivery" button on a Delivered CRM
// Delivery Order's view page. This file covers ways (1) and (3) so far - see
// pages/CustomerReturnPage.js's header comment for the full write-up of what's been confirmed live,
// including a confirmed app issue: way (1)'s full (non-draft) Save always fails server-side ("Item
// <id> has no delivery record. Cannot process return.") regardless of item choice - the
// direct-create form has no field to link a return line to a prior Sales/Delivery Order. Save To
// Draft has no such check. Way (3) sidesteps this entirely since its item entries arrive already
// linked, and is the only path that can currently reach the full Submit -> Approve -> Receive ->
// GRN -> "Pending Receipt" lifecycle (see the second describe block below).
test.describe('Customer Returns - Direct Create (Draft)', () => {
  const data = testData.customerReturn.valid;

  test('TC-CR-01 [+] Navigate to list and verify page loads', { tag: '@smoke' }, async ({ page }) => {
    const cr = new CustomerReturnPage(page);
    await cr.gotoList();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(cr.addButton).toBeVisible();
  });

  test('TC-CR-02 [+] Create a Customer Return directly from the listing page as Draft', { tag: '@smoke' }, async ({ page }) => {
    test.setTimeout(90000);
    const cr = new CustomerReturnPage(page);

    await cr.openAdd();
    await cr.fillHeader({ customer: data.customer });
    await cr.addItemEntry({ item: data.item, quantity: data.quantity, rate: data.rate });

    const { id, seriesNumber, status } = await cr.saveAsDraftAndCaptureId();
    expect(id).toBeTruthy();
    expect(seriesNumber).toMatch(/^RMA-\d{4}-\d+$/);
    expect(status).toBe('Draft');

    await cr.gotoList();
    const rowStatus = await cr.getRowStatus(seriesNumber);
    expect(rowStatus).toContain('Draft');
  });

  test('TC-CR-03 [-] Known gap: Save (not Save To Draft) is rejected - no delivery record on any item selectable here', async ({ page }) => {
    test.setTimeout(60000);
    const cr = new CustomerReturnPage(page);

    await cr.openAdd();
    await cr.fillHeader({ customer: data.customer });
    await cr.addItemEntry({ item: data.item, quantity: data.quantity, rate: data.rate });

    await Promise.all([
      expect(cr.toastMessage).toContainText(/no delivery record/i, { timeout: 10000 }),
      cr.saveButton.click(),
    ]);
    // Rejected server-side - stays on the Add form.
    await expect(page).toHaveURL(new RegExp(cr.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test.describe.serial('Customer Returns - Via Return Delivery -> full approval/receipt lifecycle', () => {
  test.describe.configure({ timeout: 150000 });
  const approverName = testData.customerReturn.approverName;

  let cr;
  let id;
  let seriesNumber;

  test('TC-CR-05 [+] "Return Delivery" on a Delivered order creates a linked, non-draft Customer Return', async ({ page }) => {
    test.setTimeout(120000);
    // Scans existing Delivered orders and retries across candidates internally if one turns out
    // to already be fully or partially returned (clamping quantity down, or moving to a different
    // candidate) - see the helper's own header comment.
    const created = await createCustomerReturnViaReturnDelivery(page);
    cr = created.cr;
    id = created.id;
    seriesNumber = created.seriesNumber;

    expect(id).toBeTruthy();
    expect(seriesNumber).toMatch(/^RMA-\d{4}-\d+$/);
    // Confirmed live: a Return-Delivery-originated Customer Return lands directly on "Pending",
    // skipping Draft entirely - unlike way (1)'s manually-built Draft (see TC-CR-02).
    expect(created.status).toBe('Pending');

    await cr.gotoList();
    const rowStatus = await cr.getRowStatus(seriesNumber);
    expect(rowStatus).toContain('Pending');
  });

  test('TC-CR-06 [+] Submit for Quick Approval, Accept, Receive -> GRN -> status "Pending Receipt"', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(!id, 'depends on TC-CR-05 creating a linked Customer Return first');

    await cr.gotoView(id);
    await expect(page.getByRole('button', { name: /^Submit$/i })).toBeVisible({ timeout: 10000 });

    await cr.quickApproval(approverName);
    await expect.poll(() => cr.getStatusOnView(), { timeout: 15000 }).toMatch(/Pending Approval/i);

    await cr.accept();
    await expect(cr.receiveButton).toBeVisible({ timeout: 15000 });

    await cr.receiveButton.click();
    await page.waitForURL('**/add-Grn', { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const grn = await cr.createGrnAndCaptureId();
    expect(grn.id).toBeTruthy();
    expect(grn.seriesNumber).toMatch(/^CRG-\d{4}-\d+$/);
    expect(grn.customerReturnId).toBe(id);

    // GRN Save redirects back to the Customer Return's own View page.
    await expect(page).toHaveURL(new RegExp(`${id}/view-customer-returns`));
    await expect.poll(() => cr.getStatusOnView(), { timeout: 15000 }).toBe('Pending Receipt');

    await cr.gotoList();
    const rowStatus = await cr.getRowStatus(seriesNumber);
    expect(rowStatus).toContain('Pending Receipt');
  });
});
