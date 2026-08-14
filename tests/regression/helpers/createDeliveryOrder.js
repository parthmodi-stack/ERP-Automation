const OpportunityPage = require('../../../pages/OpportunityPage');
const QuotationPage = require('../../../pages/QuotationPage');
const SalesOrderPage = require('../../../pages/SalesOrderPage');
const CrmDeliveryOrderPage = require('../../../pages/CrmDeliveryOrderPage');
const testData = require('../../../config/testData');
const { createFreshLead, createFreshOpportunity } = require('../../crm/helpers/ensureCrmChain');

// Builds a brand-new Lead -> Opportunity -> Quotation (Accepted) -> Sales Order (Accepted) ->
// Delivery Order chain, same pattern as every other *-extended.spec.js helper in this folder.
//
// CONFIRMED LIVE: the Delivery Order Save's own client-side redirect to view-delivery-orders can
// intermittently take longer than CrmDeliveryOrderPage.fillRequiredFieldsAndSave()'s own fixed
// ~2s wait (same root cause already documented on that method - NOT re-fixed there per explicit
// instruction to leave pages/CrmDeliveryOrderPage.js's own save behavior untouched/reverted) - this
// helper adds its OWN test-local retry (one extra Save click if the URL genuinely hasn't moved
// after 25s) instead, so callers here don't inherit the ~40% intermittent failure rate seen
// against the unmodified method alone.
async function createDeliveryOrderFromFreshSalesOrder(page, nameSeed) {
  const leadCompanyName = await createFreshLead(page, nameSeed);
  const opportunityId = await createFreshOpportunity(page, leadCompanyName);

  const opportunity = new OpportunityPage(page);
  await opportunity.openViewById(opportunityId);
  await opportunity.convertToQuotation();

  const quotation = new QuotationPage(page);
  const quoData = { ...testData.quotation.valid, locationSearchText: '', contactPersonSearchText: '', shippingAddressSearchText: '' };
  await quotation.fillRequiredFieldsAndSave(quoData);

  const quoSaved = await page.waitForURL(/\/(view-quotation|dashboard\/crm\/orders\/quotation(\?.*)?$)/, { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (!quoSaved) throw new Error('createDeliveryOrderFromFreshSalesOrder: Quotation Save did not redirect');

  let quotationId = (page.url().match(/\/quotation\/(\d+)\/view-quotation/) || [])[1];
  if (!quotationId) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const href = await page.locator('table tbody tr').first().locator('a').first().getAttribute('href').catch(() => null);
    quotationId = (href && href.match(/\/quotation\/(\d+)\//) || [])[1];
    if (quotationId) await quotation.openViewById(quotationId);
  }
  if (!quotationId) throw new Error('createDeliveryOrderFromFreshSalesOrder: could not determine created Quotation id');

  await quotation.submitQuickApprovalAndAccept('Dipen Modi');
  await quotation.openViewById(quotationId);
  await quotation.convertToSalesOrder();

  const salesOrder = new SalesOrderPage(page);
  const soData = { ...testData.crmSalesOrder.valid, locationSearchText: '' };
  await salesOrder.fillRequiredFieldsAndSave(soData);

  const soSaved = await page.waitForURL(/\/(view-sales-order|dashboard\/crm\/orders\/sales-orders(\?.*)?$)/, { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (!soSaved) throw new Error('createDeliveryOrderFromFreshSalesOrder: Sales Order Save did not redirect');

  let salesOrderId = (page.url().match(/\/sales-orders?\/(\d+)\/view-sales-order/) || [])[1];
  if (!salesOrderId) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const href = await page.locator('table tbody tr').first().locator('a').first().getAttribute('href').catch(() => null);
    salesOrderId = (href && href.match(/\/sales-orders?\/(\d+)\//) || [])[1];
    if (salesOrderId) await salesOrder.openViewById(salesOrderId);
  }
  if (!salesOrderId) throw new Error('createDeliveryOrderFromFreshSalesOrder: could not determine created Sales Order id');

  await salesOrder.openViewById(salesOrderId);
  await salesOrder.submitQuickApprovalAndAccept('Dipen Modi');

  const delivery = new CrmDeliveryOrderPage(page);
  // CONFIRMED LIVE (repeatedly, across many attempts today): the Delivery Order Save's own
  // client-side redirect to view-delivery-orders can fail to fire at all, even after a long wait
  // or an extra Save click - re-clicking Save risks creating a SECOND record rather than actually
  // fixing anything, which points to this being a front-end redirect bug rather than the server
  // request itself being slow. Instead of depending on the redirect, look the record up directly
  // on the list page (sorted by ID descending, i.e. newest first) and confirm it's really OURS via
  // the Customer column matching leadCompanyName before trusting its id - this works whether or
  // not the client-side redirect ever happens, since the record is created server-side either way.
  let deliveryOrderId;
  let lastError;
  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await salesOrder.openViewById(salesOrderId);
      await salesOrder.createDelivery();
      await delivery.fillRequiredFieldsAndSave();

      const redirected = await page.waitForURL(/\/(view-delivery-orders|dashboard\/crm\/orders\/delivery-orders(\?.*)?$)/, { timeout: 15000 })
        .then(() => true).catch(() => false);
      if (redirected) {
        deliveryOrderId = (page.url().match(/\/delivery-orders\/(\d+)\/view-delivery-orders/) || [])[1];
        if (deliveryOrderId) break;
      }

      // Give the backend a settle beat before checking the list - CONFIRMED LIVE: sometimes the
      // record really wasn't created yet at the moment the redirect wait gave up, not just a
      // redirect that already happened silently.
      await page.waitForTimeout(3000);
      await delivery.gotoList();
      let sortLabel = await delivery.sortByButton('ID').getAttribute('aria-label').catch(() => '');
      if (!/descending/i.test(sortLabel || '')) {
        await delivery.clickSortBy('ID');
        sortLabel = await delivery.sortByButton('ID').getAttribute('aria-label').catch(() => '');
        if (!/descending/i.test(sortLabel || '')) await delivery.clickSortBy('ID');
      }
      const firstRow = page.locator('tbody tr').filter({ hasNotText: 'Add Calculation' }).first();
      const rowText = await firstRow.textContent().catch(() => '');
      if (!rowText.includes(leadCompanyName)) {
        throw new Error(`Newest Delivery Order row does not match this run's own Customer (${leadCompanyName}) - Save likely never actually happened (attempt ${attempt}/${MAX_ATTEMPTS})`);
      }
      const href = await firstRow.locator('a').first().getAttribute('href').catch(() => null);
      deliveryOrderId = (href && href.match(/\/delivery-orders\/(\d+)\//) || [])[1];
      if (!deliveryOrderId) throw new Error(`Could not extract Delivery Order id from list row (attempt ${attempt}/${MAX_ATTEMPTS})`);
      break;
    } catch (e) {
      lastError = e;
      deliveryOrderId = undefined;
    }
  }
  if (!deliveryOrderId) {
    throw new Error(`createDeliveryOrderFromFreshSalesOrder: Delivery Order creation failed after ${MAX_ATTEMPTS} attempts - last error: ${lastError && lastError.message}`);
  }

  return { deliveryOrderId, salesOrderId, quotationId, opportunityId, leadCompanyName, delivery, salesOrder, quotation };
}

module.exports = { createDeliveryOrderFromFreshSalesOrder };
