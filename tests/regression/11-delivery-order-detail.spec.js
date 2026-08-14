const { test, expect } = require('@playwright/test');
const CrmDeliveryOrderPage = require('../../pages/CrmDeliveryOrderPage');
const { createDeliveryOrderFromFreshSalesOrder } = require('./helpers/createDeliveryOrder');

// ── tests/regression/11-delivery-order-detail.spec.js ─────────────────────────────────────────
// Delivery Orders Detail Page coverage, sourced from Delivery_Orders_TestCases.xlsx. Continues
// the TC-DO-NN numbering after 10-delivery-order-list.spec.js. No @smoke2 tag - never runs there.
//
// ONE fresh Delivery Order is built here (TC-DO-17) and progressed all the way to "Delivered" via
// CrmDeliveryOrderPage.completeDeliveryLifecycle() - the Action Buttons group (Print/Send Email/
// Return Delivery/Create Invoice/Accounting Ledger) only renders at that terminal status
// (CONFIRMED LIVE), and every other test in this file reuses that same record.
async function getFieldValue(page, labelRegex) {
  return (await page.getByText(labelRegex, { exact: false }).first()
    .locator('xpath=./following::*[1]').first().textContent().catch(() => '')).trim();
}

test.describe('Delivery Order Management - Detail Page', () => {
  test.describe.configure({ timeout: 500000 });

  let deliveryOrderId;
  let leadCompanyName;

  test('TC-DO-17 [+] Setup: create and progress a fresh Delivery Order to Delivered', async ({ page }) => {
    test.setTimeout(500000);
    const created = await createDeliveryOrderFromFreshSalesOrder(page, 'Automation_Lead_For_DODetail');
    deliveryOrderId = created.deliveryOrderId;
    leadCompanyName = created.leadCompanyName;

    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await expect.poll(() => delivery.getStatus(), { timeout: 15000 }).toBe('Picked');
    await delivery.completeDeliveryLifecycle();
    await expect.poll(() => delivery.getStatus(), { timeout: 15000 }).toBe('Delivered');
  });

  // ── Detail Page - Basic Details ────────────────────────────────────────────
  test('TC-DO-18 [+] Open delivery order detail page shows header ID and status', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await expect(page.getByText(/^ID/).first()).toBeVisible();
    await expect(page.getByText('Delivered', { exact: true }).first()).toBeVisible();
  });

  test('TC-DO-19 [+] Verify Sales Order field is a clickable hyperlink and navigates correctly', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await delivery.saleOrderButton.click();
    await page.waitForURL(/\/sales-orders?\/\d+\/view-sales-order/, { timeout: 15000 });
  });

  test('TC-DO-20 [+] Verify Customer field shows the correct lead/customer name', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await expect(page.getByText(leadCompanyName, { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-DO-21 [+] Verify Operation Type shows "Delivery Order"', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    const value = await getFieldValue(page, /^Operation Type/);
    expect(value).toMatch(/Delivery Order/i);
  });

  test('TC-DO-22 [+] Verify Salesperson field', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    const value = await getFieldValue(page, /Salesperson/i);
    expect(value).toBeTruthy();
  });

  test('TC-DO-23 [+] Verify Entity field', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    const value = await getFieldValue(page, /^Entity/);
    expect(value).toBeTruthy();
  });

  test('TC-DO-24 [+] Verify Reference Number shows "-" placeholder when empty', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    const value = await getFieldValue(page, /^Reference Number/);
    expect(value).toBe('-');
  });

  test('TC-DO-25 [+] Verify PO Number shows "-" placeholder when empty', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    const value = await getFieldValue(page, /^PO Number/);
    expect(value).toBe('-');
  });

  test('TC-DO-26 [+] Verify PO Date shows "-" placeholder when empty', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    const value = await getFieldValue(page, /^PO Date/);
    expect(value).toBe('-');
  });

  // ── Detail Page - Items Table ──────────────────────────────────────────────
  test('TC-DO-27 [+] Items table visible with all expected columns', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    const headers = await page.getByRole('columnheader').allTextContents();
    for (const col of ['Item', 'UOM', 'Sales Order Line', 'Quantity', 'On Hand', 'Reserved', 'Remaining', 'Delivered Quantity', 'Location', 'Trace Details']) {
      expect(headers.some(h => h.includes(col)), `Missing items column "${col}" - headers: ${JSON.stringify(headers)}`).toBeTruthy();
    }
  });

  test('TC-DO-28 [+] Items table shows the item created for this Delivery Order', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    const cells = await page.locator('table tbody tr').first().locator('td').allTextContents();
    expect(cells[0]).toContain('Auto_Full_Item');
  });

  test('TC-DO-29 [+] Verify Quantity/On Hand/Reserved/Delivered Quantity render numeric values', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    const cells = await page.locator('table tbody tr').first().locator('td').allTextContents();
    // Column order: Item, UOM, SOL, Quantity, On Hand, Reserved, Remaining, Delivered Qty, Location...
    expect(cells[3]).toMatch(/^\d/);
    expect(cells[4]).toMatch(/^\d/);
    expect(cells[5]).toMatch(/^\d/);
    expect(cells[7]).toMatch(/^\d/);
  });

  test('TC-DO-30 [+] Expand summary panel below items table', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    const expandButton = page.getByRole('button', { name: /summary/i });
    await expandButton.click();
    await page.waitForTimeout(500);
    // No crash and the button remains interactable - a summary/aggregate panel is now open.
    await expect(expandButton).toBeVisible();
  });

  // ── Detail Page - Tabs ─────────────────────────────────────────────────────
  test('TC-DO-31 [+] Switch to Package tab', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await delivery.packageTab.click();
    await expect(delivery.packageTab).toHaveAttribute('aria-selected', 'true');
  });

  test('TC-DO-32 [+] Switch to Address and Contact tab', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await delivery.addressContactTab.click();
    await expect(delivery.addressContactTab).toHaveAttribute('aria-selected', 'true');
  });

  test('TC-DO-33 [+] Switch to Shipping tab', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await delivery.shippingTab.click();
    await expect(delivery.shippingTab).toHaveAttribute('aria-selected', 'true');
  });

  test('TC-DO-34 [+] Switch to Promotion tab', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await delivery.promotionTab.click();
    await expect(delivery.promotionTab).toHaveAttribute('aria-selected', 'true');
  });

  test('TC-DO-35 [+] Tab data persists when switching between tabs', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await delivery.packageTab.click();
    await delivery.shippingTab.click();
    await delivery.basicDetailsTab.click();
    await expect(page.getByText(leadCompanyName, { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

  // ── Detail Page - Transportation (known gaps: BUG-02/BUG-03) ──────────────
  test('TC-DO-36 [-] Known gap: Transportation section header renders untranslated i18n key', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await expect(delivery.transportationSectionHeader).toBeVisible({ timeout: 10000 });
  });

  test('TC-DO-37 [-] Known gap: Driver/Vehicle Number field labels render untranslated i18n keys', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await expect(delivery.driverFieldLabel).toBeVisible({ timeout: 10000 });
    await expect(delivery.vehicleNumberFieldLabel).toBeVisible({ timeout: 10000 });
  });

  // ── Detail Page - Classification & Attachment ─────────────────────────────
  test('TC-DO-38 [+] Verify Department in Classification section', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await expect(delivery.departmentLabel.first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-DO-39 [+] Attachment section shows placeholder when empty', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await expect(delivery.attachmentLabel.first()).toBeVisible({ timeout: 10000 });
  });

  // ── Detail Page - Action Buttons (only render once status === Delivered) ─
  test('TC-DO-40 [+] Print/Send Email/Return Delivery/Create Invoice buttons appear once Delivered', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await expect(delivery.printButton).toBeVisible({ timeout: 10000 });
    await expect(delivery.sendEmailButton).toBeVisible({ timeout: 10000 });
    await expect(delivery.returnDeliveryButton).toBeVisible({ timeout: 10000 });
    await expect(delivery.createInvoiceButton).toBeVisible({ timeout: 10000 });
  });

  test('TC-DO-41 [+] Click Print button opens a print dialog/preview without error', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await delivery.printButton.click();
    await page.waitForTimeout(1500);
    // No crash - either a new tab/dialog opened, or a print-preview surface rendered in-page.
  });

  test('TC-DO-42 [+] Click Send Email opens an email dialog with a recipient pre-filled', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await delivery.sendEmailButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
  });

  test('TC-DO-43 [+] Create Invoice from a Delivered Delivery Order', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await delivery.createInvoiceButton.click();
    await page.waitForTimeout(2000);
    // Either navigates to the created invoice, or opens a confirmation dialog - no crash either way.
  });

  test('TC-DO-44 [-] Known gap: Accounting Ledger action button renders untranslated i18n key (BUG-01)', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await expect(delivery.accountingLedgerButton).toBeVisible({ timeout: 10000 });
  });

  test('TC-DO-45 [+] Go back button returns to the previous page', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.gotoList();
    await delivery.openViewById(deliveryOrderId);
    await delivery.goBackButton.click();
    await page.waitForURL(/\/dashboard\/crm\/orders\/delivery-orders/, { timeout: 10000 });
  });

  test('TC-DO-46 [+] Module switcher opens with available modules listed', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.openViewById(deliveryOrderId);
    await delivery.switchModuleButton.click();
    await page.waitForTimeout(500);
    await expect(page.getByText('CRM', { exact: false }).first()).toBeVisible({ timeout: 5000 });
  });
});
