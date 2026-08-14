const { test, expect } = require('@playwright/test');
const SalesOrderPage = require('../../pages/SalesOrderPage');
const CrmDeliveryOrderPage = require('../../pages/CrmDeliveryOrderPage');
const crmChain = require('../../config/crmChain');
const { ensureSalesOrder } = require('./helpers/ensureCrmChain');

test.describe('Delivery Order Management', () => {

  // ── TC-DO-01: Create Delivery Order from an Accepted Sales Order, then run it through its full
  // Picked -> Packed -> Dispatched -> Delivered lifecycle ──────────────────────────────────────
  // CONFIRMED LIVE (exploratory session - see pages/CrmDeliveryOrderPage.js header comment for the
  // full write-up): "Create" split-button's "Delivery" option on an Accepted Sales Order's view
  // page -> Next through Basic Details/Package/Address and Contact/Shipping to Promotion -> Save
  // -> new Delivery Order starts "Picked" -> its Items grid's Trace Details icon opens a "Track
  // Details" dialog whose Lot/Serial entry can already be pre-populated (Submit works directly) ->
  // Validate reveals a "Packed" button (doesn't itself change status) -> Packed -> Dispatched ->
  // Delivered, each its own button revealed by the previous one. Self-healing via
  // ensureSalesOrder() - builds the whole Lead -> Opportunity -> Quotation -> Sales Order chain
  // first if none of that has run yet this session.
  test('TC-DO-01 [+] Create Delivery Order from an Accepted Sales Order and complete its lifecycle to Delivered', async ({ page }) => {
    // Building the whole upstream Lead -> Opportunity -> Quotation -> Sales Order chain alone
    // (ensureSalesOrder, standalone) has taken up to ~5 minutes on this shared, real-latency dev
    // environment - the Delivery Order creation + full status lifecycle on top needs real
    // headroom beyond that, same class of bump as every other multi-stage test in this suite.
    test.setTimeout(900000);

    const salesOrderId = await ensureSalesOrder(page);

    // ---- Step 1-2: Open the Sales Order, Create -> Delivery ----
    const salesOrder = new SalesOrderPage(page);
    await salesOrder.openViewById(salesOrderId);
    await salesOrder.createDelivery();

    // ---- Step 3-4: Next through to Promotion, then Save ----
    const delivery = new CrmDeliveryOrderPage(page);
    await delivery.fillRequiredFieldsAndSave();

    const saved = await page.waitForURL(/\/(view-delivery-orders|dashboard\/crm\/orders\/delivery-orders(\?.*)?$)/, { timeout: 20000 })
      .then(() => true).catch(() => false);
    if (!saved) {
      await page.screenshot({ path: 'test-results/delivery-order-save-blocked.png', fullPage: true });
      throw new Error('Delivery Order Save did not redirect - see test-results/delivery-order-save-blocked.png');
    }

    let deliveryOrderId = (page.url().match(/\/delivery-orders\/(\d+)\/view-delivery-orders/) || [])[1];
    if (!deliveryOrderId) {
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      // table tbody tr (NOT getByRole('row').first()) - the latter also matches the table's own
      // HEADER row, which has no anchor at all - same fix already proven throughout this suite.
      const createdRow = page.locator('table tbody tr').first();
      const href = await createdRow.locator('a').first().getAttribute('href').catch(() => null);
      deliveryOrderId = (href && href.match(/\/delivery-orders\/(\d+)\//) || [])[1];
    }
    expect(deliveryOrderId).toBeTruthy();
    console.log('DEBUG created Delivery Order id:', deliveryOrderId, 'from Sales Order:', salesOrderId);

    // ---- Step 5: Open the same Delivery Order, verify status is Picked ----
    await delivery.openViewById(deliveryOrderId);
    await expect.poll(() => delivery.getStatus(), { timeout: 15000 }).toBe('Picked');

    // ---- Step 6-7: Trace Details icon -> Track Details module -> Submit ----
    await delivery.openTrackDetailsModal(0);
    await delivery.submitTrackDetails();

    // ---- Step 8: Validate ----
    await delivery.validate();
    await expect(delivery.packedButton).toBeVisible({ timeout: 10000 });

    // ---- Step 9-11: Packed -> Dispatched -> Delivered ----
    await delivery.markPacked();
    await expect(delivery.dispatchedButton).toBeVisible({ timeout: 10000 });

    await delivery.markDispatched();
    await expect(delivery.deliveredButton).toBeVisible({ timeout: 10000 });

    await delivery.markDelivered();

    // ---- Step 12: Verify final status is Delivered ----
    await expect.poll(() => delivery.getStatus(), { timeout: 15000 }).toBe('Delivered');

    crmChain.save({ deliveryOrderId, salesOrderId });
    console.log('🎉 Full CRM chain complete: ... -> Sales Order', salesOrderId, '-> Delivery Order', deliveryOrderId, '(Delivered)');
  });

});
