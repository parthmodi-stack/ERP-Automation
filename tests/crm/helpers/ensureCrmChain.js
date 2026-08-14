// Self-healing setup helpers for the CRM Lead -> Opportunity -> Quotation -> Sales Order chain.
// Same convention as tests/procurement/helpers/createApprovedPurchaseRequest.js: each function
// ensures its own entity exists (creating the whole upstream chain if needed) so any one of
// 02-opportunity.spec.js / 03-quotation.spec.js / 04-sales-order.spec.js can also run standalone,
// not just when the earlier stages already ran first in the same session. Real records are
// handed off via config/crmChain.js, not recreated needlessly when already present.
const { expect } = require('@playwright/test');
const LeadPage = require('../../../pages/LeadPage');
const OpportunityPage = require('../../../pages/OpportunityPage');
const QuotationPage = require('../../../pages/QuotationPage');
const SalesOrderPage = require('../../../pages/SalesOrderPage');
const testData = require('../../../config/testData');
const factory = require('../../../config/testDataFactory');
const crmChain = require('../../../config/crmChain');

// Builds a brand-new Lead, bypassing crmChain's cached leadCompanyName - for callers that
// specifically need an INDEPENDENT record (e.g. an Opportunity that still needs its own "Make
// Quotation" button, which stops rendering once the chain's shared Opportunity is converted -
// see OpportunityPage.js's own header comment), not the one shared chain everything else reuses.
async function createFreshLead(page, nameSeed = 'Automation_Lead_For_CRM_Chain') {
  const lead = new LeadPage(page);
  const leadCompanyName = factory.uniqueName(nameSeed);
  // .minimal (not .valid) - no Follow Up needed just to get a Convert-able Lead, and Follow Up's
  // own dropdown has an unrelated live instability observed earlier this session.
  const leadData = { ...testData.lead.minimal, companyName: leadCompanyName };
  await lead.createLead(leadData);
  await expect(page).toHaveURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/, { timeout: 15000 });
  return leadCompanyName;
}

async function ensureLead(page) {
  const chain = crmChain.load();
  if (chain.leadCompanyName) return chain.leadCompanyName;

  const leadCompanyName = await createFreshLead(page);
  crmChain.save({ leadCompanyName });
  return leadCompanyName;
}

// Converts an existing Lead (by company name) into a brand-new Opportunity, independent of
// crmChain's cached opportunityId - same "independent record" rationale as createFreshLead above.
async function createFreshOpportunity(page, leadCompanyName) {
  const lead = new LeadPage(page);
  await lead.openView(leadCompanyName);
  await lead.convertToOpportunity();

  const opportunity = new OpportunityPage(page);
  await opportunity.fillRequiredFieldsAndSave({ ...testData.opportunity.valid, locationSearchText: '' });
  await page.waitForURL(/\/(view-opportunity|dashboard\/crm\/orders\/opportunity(\?.*)?$)/, { timeout: 20000 });

  let opportunityId = (page.url().match(/\/opportunity\/(\d+)\/view-opportunity/) || [])[1];
  if (!opportunityId) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const createdRow = page.getByRole('row').filter({ hasText: leadCompanyName }).first();
    await expect(createdRow).toBeVisible({ timeout: 10000 });
    const href = await createdRow.locator('a').first().getAttribute('href').catch(() => null);
    opportunityId = (href && href.match(/\/opportunity\/(\d+)\//) || [])[1];
  }
  expect(opportunityId).toBeTruthy();

  // CONFIRMED APP BUG (see OpportunityPage.promoteFromDraftIfNeeded's own comment): a fresh
  // Opportunity's "Save" click still submits with is_draft:1 regardless - Edit+Save again to
  // actually clear it, since "Make Quotation" only renders for a non-draft Opportunity.
  await opportunity.promoteFromDraftIfNeeded(opportunityId);

  // CONFIRMED LIVE: promoteFromDraftIfNeeded's own retry loop can still exhaust without actually
  // clearing Draft. Verify it really worked before handing this id back - every caller here
  // (ensureOpportunity/ensureQuotation) caches whatever id this returns into crm-chain.json
  // unconditionally, so silently returning a still-Draft id would poison the cache: every LATER
  // run would keep reusing this same broken, un-convertible Opportunity and fail identically,
  // indistinguishable from genuine intermittent flakiness (confirmed - this is exactly what
  // happened: a Draft opportunity got cached, then every subsequent run reused it and failed the
  // same way at "Make Quotation" without promoteFromDraftIfNeeded ever running again).
  const stillDraft = await page.getByText('Draft', { exact: true }).first().isVisible({ timeout: 5000 }).catch(() => false);
  if (stillDraft) {
    throw new Error(
      `createFreshOpportunity: Opportunity ${opportunityId} is still Draft after promoteFromDraftIfNeeded - refusing to cache a broken record into crm-chain.json.`,
    );
  }
  return opportunityId;
}

async function ensureOpportunity(page) {
  const chain = crmChain.load();
  if (chain.opportunityId) return chain.opportunityId;

  const leadCompanyName = await ensureLead(page);
  const opportunityId = await createFreshOpportunity(page, leadCompanyName);

  crmChain.save({ opportunityId, leadCompanyName });
  return opportunityId;
}

async function ensureQuotation(page) {
  const chain = crmChain.load();
  if (chain.quotationId) return chain.quotationId;

  const opportunityId = await ensureOpportunity(page);

  const opportunity = new OpportunityPage(page);
  await opportunity.openViewById(opportunityId);
  await opportunity.convertToQuotation();

  const quotation = new QuotationPage(page);
  await quotation.fillRequiredFieldsAndSave({
    ...testData.quotation.valid,
    locationSearchText: '',
    contactPersonSearchText: '',
    shippingAddressSearchText: '',
  });
  await page.waitForURL(/\/(view-quotation|dashboard\/crm\/orders\/quotation(\?.*)?$)/, { timeout: 20000 });

  let quotationId = (page.url().match(/\/quotation\/(\d+)\/view-quotation/) || [])[1];
  if (!quotationId) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // table tbody tr (NOT getByRole('row').first()) - the latter also matches the table's own
    // HEADER row, which has no anchor at all - same fix already proven in 03-quotation.spec.js.
    const createdRow = page.locator('table tbody tr').first();
    const href = await createdRow.locator('a').first().getAttribute('href').catch(() => null);
    quotationId = (href && href.match(/\/quotation\/(\d+)\//) || [])[1];
    if (quotationId) await quotation.openViewById(quotationId);
  }
  expect(quotationId).toBeTruthy();

  // "Create Order" (04-sales-order.spec.js's own conversion step) only renders once status ===
  // 'Accepted' - reach it here so ensureQuotation() always hands back a Sales-Order-ready record.
  await quotation.submitQuickApprovalAndAccept('Dipen Modi');

  crmChain.save({ quotationId, opportunityId });
  return quotationId;
}

async function ensureSalesOrder(page) {
  const chain = crmChain.load();
  if (chain.salesOrderId) return chain.salesOrderId;

  const quotationId = await ensureQuotation(page);

  const quotation = new QuotationPage(page);
  await quotation.openViewById(quotationId);
  await quotation.convertToSalesOrder();

  const salesOrder = new SalesOrderPage(page);
  await salesOrder.fillRequiredFieldsAndSave({ locationSearchText: '' });
  await page.waitForURL(/\/(view-sales-order|dashboard\/crm\/orders\/sales-orders(\?.*)?$)/, { timeout: 20000 });

  let salesOrderId = (page.url().match(/\/sales-orders?\/(\d+)\/view-sales-order/) || [])[1];
  if (!salesOrderId) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // table tbody tr (NOT getByRole('row').first()) - the latter also matches the table's own
    // HEADER row, which has no anchor at all - same fix already proven in 04-sales-order.spec.js.
    const createdRow = page.locator('table tbody tr').first();
    const href = await createdRow.locator('a').first().getAttribute('href').catch(() => null);
    salesOrderId = (href && href.match(/\/sales-orders?\/(\d+)\//) || [])[1];
  }
  expect(salesOrderId).toBeTruthy();

  // "Create -> Delivery" (05-delivery-order.spec.js's own conversion step) needs an Accepted
  // Sales Order - reach it here so ensureSalesOrder() always hands back a Delivery-ready record.
  await salesOrder.openViewById(salesOrderId);
  await salesOrder.submitQuickApprovalAndAccept('Dipen Modi');

  crmChain.save({ salesOrderId, quotationId });
  return salesOrderId;
}

module.exports = {
  ensureLead,
  ensureOpportunity,
  ensureQuotation,
  ensureSalesOrder,
  createFreshLead,
  createFreshOpportunity,
};
