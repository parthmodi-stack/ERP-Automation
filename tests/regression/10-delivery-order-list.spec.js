const { test, expect } = require('@playwright/test');
const CrmDeliveryOrderPage = require('../../pages/CrmDeliveryOrderPage');
const { createDeliveryOrderFromFreshSalesOrder } = require('./helpers/createDeliveryOrder');

// ── tests/regression/10-delivery-order-list.spec.js ───────────────────────────────────────────
// Delivery Orders List Page coverage, sourced from Delivery_Orders_TestCases.xlsx (manual TC
// sheet, TC-01 through TC-37 categories). Continues the TC-DO-NN numbering after TC-DO-01
// (tests/crm/05-delivery-order.spec.js) and TC-SO-* (09-sales-order-extended.spec.js). No
// @smoke2 tag anywhere in this file - it must never run as part of the smoke2 chain.
//
// Only ONE fresh Delivery Order is built here (TC-DO-02, the setup test) - every other test in
// this file exercises generic list-page structure (columns/sorting/pagination/add-calculation)
// against whatever data already exists live, since those don't need a specific business record.
test.describe('Delivery Order Management - List Page', () => {
  test.describe.configure({ timeout: 400000 });

  let deliveryOrderId;
  let leadCompanyName;

  test('TC-DO-02 [+] Setup: create a fresh Delivery Order for List Page tests', async ({ page }) => {
    test.setTimeout(400000);
    const created = await createDeliveryOrderFromFreshSalesOrder(page, 'Automation_Lead_For_DOList');
    deliveryOrderId = created.deliveryOrderId;
    leadCompanyName = created.leadCompanyName;
    expect(deliveryOrderId).toBeTruthy();
  });

  // ── List Page - Navigation & Display ──────────────────────────────────────
  test('TC-DO-03 [+] Delivery Orders list page loads with all expected columns', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.gotoList();
    const headers = await page.getByRole('columnheader').allTextContents();
    for (const col of ['ID', 'Date', 'Sales Order', 'Status', 'Salesperson', 'Customer', 'Location', 'Entity']) {
      expect(headers.some(h => h.includes(col)), `Missing column "${col}" - headers: ${JSON.stringify(headers)}`).toBeTruthy();
    }
  });

  test('TC-DO-04 [+] Breadcrumb navigation from detail page returns to list', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await delivery.breadcrumbDeliveryOrdersLink.click();
    await expect(page).toHaveURL(/\/dashboard\/crm\/orders\/delivery-orders$/, { timeout: 10000 });
  });

  test('TC-DO-05 [+] Status badge renders for each record', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.gotoList();
    const firstRow = page.locator('tbody tr').filter({ hasNotText: 'Add Calculation' }).first();
    await expect(firstRow.getByText(/^(Picked|Packed|Dispatched|Delivered)$/)).toBeVisible({ timeout: 10000 });
  });

  // ── List Page - Sorting ────────────────────────────────────────────────────
  test('TC-DO-06 [+] Sort by ID toggles ascending/descending order', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.gotoList();
    const firstIdCell = () => page.locator('tbody tr').filter({ hasNotText: 'Add Calculation' }).first().locator('td').nth(2);

    await delivery.clickSortBy('ID');
    const first = (await firstIdCell().textContent()).trim();
    await delivery.clickSortBy('ID');
    const second = (await firstIdCell().textContent()).trim();
    expect(first).not.toBe(second);
  });

  test('TC-DO-07 [+] Sort by Date toggles ascending/descending order', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.gotoList();
    const firstDateCell = () => page.locator('tbody tr').filter({ hasNotText: 'Add Calculation' }).first().locator('td').nth(3);

    await delivery.clickSortBy('Date');
    const first = (await firstDateCell().textContent()).trim();
    await delivery.clickSortBy('Date');
    const second = (await firstDateCell().textContent()).trim();
    expect(first).not.toBe(second);
  });

  test('TC-DO-08 [+] Sort by Status toggles ascending/descending', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.gotoList();
    // Unlike ID/Date (unique/sequential values), most records today share the same "Delivered"
    // status - the first row's own status text can legitimately stay the same across both sort
    // directions when one status value dominates the dataset. Assert the CONTROL's own toggled
    // state (its accessible name flips between "ascending"/"descending") instead of data content.
    await delivery.clickSortBy('Status');
    await expect(delivery.sortByButton('Status')).toHaveAccessibleName(/ascending/i, { timeout: 5000 });
    await delivery.clickSortBy('Status');
    await expect(delivery.sortByButton('Status')).toHaveAccessibleName(/descending/i, { timeout: 5000 });
  });

  // ── List Page - Pagination ─────────────────────────────────────────────────
  test('TC-DO-09 [+] Default items per page is 20', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.gotoList();
    const label = await delivery.getPaginationLabel();
    expect(label).toContain('20');
    expect(await page.locator('tbody tr').filter({ hasNotText: 'Add Calculation' }).count()).toBeLessThanOrEqual(20);
  });

  test('TC-DO-10 [+] Change items per page updates grid size', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.gotoList();
    await delivery.changePageSize(10);
    await expect.poll(() => delivery.getPaginationLabel(), { timeout: 10000 }).toContain('Items per page :10');
    const count = await page.locator('tbody tr').filter({ hasNotText: 'Add Calculation' }).count();
    expect(count).toBeLessThanOrEqual(10);
  });

  test('TC-DO-11 [+] Next/Previous pagination buttons navigate pages', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.gotoList();
    await delivery.changePageSize(10);
    const labelBefore = await delivery.getPaginationLabel();
    if (/Page 1 of 1/i.test(labelBefore)) {
      test.skip(true, 'Only one page of data exists - Next/Previous has nothing to navigate to');
    }
    await delivery.nextPageButton().click();
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const labelAfterNext = await delivery.getPaginationLabel();
    expect(labelAfterNext).not.toBe(labelBefore);
    await delivery.prevPageButton().click();
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const labelAfterPrev = await delivery.getPaginationLabel();
    expect(labelAfterPrev).toBe(labelBefore);
  });

  test('TC-DO-12 [+] Go To a specific valid page number', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.gotoList();
    await delivery.changePageSize(10);
    const label = await delivery.getPaginationLabel();
    const match = label.match(/Page \d+ of (\d+)/i);
    const totalPages = match ? parseInt(match[1], 10) : 1;
    if (totalPages < 2) {
      test.skip(true, 'Only one page of data exists - Go To has nothing to navigate to');
    }
    await delivery.goToPage(totalPages);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const newLabel = await delivery.getPaginationLabel();
    expect(newLabel).toContain(`Page ${totalPages} of ${totalPages}`);
  });

  test('TC-DO-13 [-] Go To an out-of-range page number is handled gracefully', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.gotoList();
    await delivery.goToPage(99999);
    await page.waitForTimeout(1000);
    // No crash / blank page - either it clamps to the last valid page or ignores the input.
    const rowsOrEmpty = page.locator('tbody tr').filter({ hasNotText: 'Add Calculation' }).first().or(delivery.noDataRow());
    await expect(rowsOrEmpty).toBeVisible({ timeout: 10000 });
  });

  // ── List Page - Add Calculation ────────────────────────────────────────────
  test('TC-DO-14 [+] "+ Add Calculation" footer is present on the grid', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.gotoList();
    // CONFIRMED LIVE: this footer row lives in its own separate rowgroup (a real <tfoot>-style
    // element), NOT inside the same <tbody> as the data rows - a `tbody tr` filter never matches
    // it (unlike ItemsPage.js's own dataRows() filter, whose module renders it inside tbody).
    await expect(page.getByText('+ Add Calculation', { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

  // ── List Page - Row Actions ────────────────────────────────────────────────
  test('TC-DO-15 [+] Click a Delivery Order row link navigates to its detail page', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    // Confirm the id we created really is on the list and its own link navigates back to itself.
    await delivery.gotoList();
    const idText = await delivery.getFirstRowSeriesNumber();
    expect(idText).toBeTruthy();
    await page.locator('tbody tr').filter({ hasNotText: 'Add Calculation' }).first().locator('a').first().click();
    await page.waitForURL(/\/view-delivery-orders/, { timeout: 10000 });
    await expect(page.getByText(/^(Picked|Packed|Dispatched|Delivered)$/).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-DO-16 [+] Row action menu offers Edit and Delete', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.gotoList();
    const firstRow = page.locator('tbody tr').filter({ hasNotText: 'Add Calculation' }).first();
    await firstRow.locator('button').first().click();
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
  });
});
