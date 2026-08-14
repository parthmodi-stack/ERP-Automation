const { test, expect } = require('@playwright/test');
const SalesOrderPage = require('../../pages/SalesOrderPage');
const QuotationPage = require('../../pages/QuotationPage');
const testData = require('../../config/testData');
const crmChain = require('../../config/crmChain');
const { ensureQuotation } = require('./helpers/ensureCrmChain');

test.describe('Sales Order Management', () => {

  // ── TC-SO-01: Create Sales Order from an Accepted Quotation (via its "Create Order" action) ──
  // CONFIRMED AGAINST SOURCE (see pages/SalesOrderPage.js header comment): the real Quotation->
  // Sales Order link is the "Create Order" button on the Quotation's view page, which only
  // renders once that Quotation's status is "Accepted". It navigates to Add Sales Order via
  // router state, pre-filling customer/items/currency/company/addresses/shipping from that exact
  // Quotation. Self-healing via ensureQuotation() - creates its own Lead -> Opportunity ->
  // Quotation (progressed all the way to Accepted) first if none of that has run yet this
  // session - completing the full CRM chain: Lead -> Opportunity -> Quotation -> Sales Order.
  test('TC-SO-01 [+] Create Sales Order by converting an Accepted Quotation', async ({ page }) => {
    test.setTimeout(500000);

    const quotationId = await ensureQuotation(page);

    const quotation = new QuotationPage(page);
    await quotation.openViewById(quotationId);
    await quotation.convertToSalesOrder();

    const salesOrder = new SalesOrderPage(page);
    const data = { ...testData.crmSalesOrder.valid, locationSearchText: '' };
    await salesOrder.fillRequiredFieldsAndSave(data);

    const saved = await page.waitForURL(/\/(view-sales-order|dashboard\/crm\/orders\/sales-orders(\?.*)?$)/, { timeout: 20000 })
      .then(() => true).catch(() => false);
    if (!saved) {
      await page.screenshot({ path: 'test-results/sales-order-save-blocked.png', fullPage: true });
      throw new Error('Sales Order Save did not redirect - see test-results/sales-order-save-blocked.png');
    }

    let salesOrderId = (page.url().match(/\/sales-orders?\/(\d+)\/view-sales-order/) || [])[1];
    if (!salesOrderId) {
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      // table tbody tr (NOT getByRole('row').first()) - the latter also matches the table's own
      // HEADER row, which has no anchor at all - same fix already proven in 03-quotation.spec.js.
      const createdRow = page.locator('table tbody tr').first();
      const href = await createdRow.locator('a').first().getAttribute('href').catch(() => null);
      salesOrderId = (href && href.match(/\/sales-orders?\/(\d+)\//) || [])[1];
      if (salesOrderId) await salesOrder.openViewById(salesOrderId);
    }
    expect(salesOrderId).toBeTruthy();
    console.log('DEBUG created Sales Order id:', salesOrderId, 'from Quotation:', quotationId);

    // ---- Open the same Sales Order, Submit -> Quick Approval -> Dipen Modi -> Send Request,
    // then Accept dropdown -> Accept -> Submit ----
    await salesOrder.openViewById(salesOrderId);
    await salesOrder.submitQuickApprovalAndAccept('Dipen Modi');

    crmChain.save({ salesOrderId, quotationId });
    console.log('🎉 Full CRM chain complete: Lead -> Opportunity -> Quotation (Accepted) -> Sales Order', salesOrderId, '(Accepted)');
  });

});
