// erpforce-crm-lead-to-delivery-order.spec.js
// Integrates tests/crm/01-lead.spec.js (TC-LEAD-01) -> 02-opportunity.spec.js (TC-OPP-01) ->
// 03-quotation.spec.js (TC-QUO-01) -> 04-sales-order.spec.js (TC-SO-01) ->
// 05-delivery-order.spec.js (TC-DO-01) into ONE continuous flow, threading each stage's REAL
// created record into the next (same Lead -> same Opportunity -> same Quotation -> same Sales
// Order -> same Delivery Order) instead of each stage picking/creating its own independent
// fixture via config/crmChain.js the way the standalone files do. Same convention as
// tests/01-erpforce-full-inventory-to-procurement.spec.js (a single long serial test sharing one
// page/context throughout, each step's logic lifted verbatim from its already-verified-passing
// standalone file) - keep this file in sync with 01-lead.spec.js/02-opportunity.spec.js/
// 03-quotation.spec.js/04-sales-order.spec.js/05-delivery-order.spec.js if the app or those files
// change.
//
// Steps:
//   1. Login
//   2. Create Lead (TC-LEAD-01)
//   3. Convert Lead -> Opportunity, via "Convert" (TC-OPP-01)
//   4. Convert Opportunity -> Quotation, via "Make Quotation", then Submit -> Quick Approval ->
//      Approve (TC-QUO-01)
//   5. Convert Quotation -> Sales Order, via "Create Order", then Submit -> Quick Approval ->
//      select Dipen Modi -> Send Request -> Accept dropdown -> Accept -> Submit (TC-SO-01)
//   6. Convert Sales Order -> Delivery Order, via "Create" -> "Delivery", Next to Promotion, Save,
//      then Trace Details -> Submit -> Validate -> Packed -> Dispatched -> Delivered (TC-DO-01)
//
// Location/Department/Item hand-off: if tests/01-erpforce-full-inventory-to-procurement.spec.js
// (TC-FULLFLOW-01) already ran this session, it saves the exact Location/Department/Item it
// created to config/crmChain.js (same file 01-lead.spec.js/02-opportunity.spec.js read for their
// own hand-off) - reused here for the Lead's Location/Department and the Opportunity/Quotation's
// Location/Item, instead of each stage's own hardcoded/pick-first-available default. Falls back
// to those defaults when TC-FULLFLOW-01 hasn't run first in the same session.

const { test, expect } = require('@playwright/test');
const LoginPage = require('../pages/LoginPage');
const LeadPage = require('../pages/LeadPage');
const OpportunityPage = require('../pages/OpportunityPage');
const QuotationPage = require('../pages/QuotationPage');
const SalesOrderPage = require('../pages/SalesOrderPage');
const CrmDeliveryOrderPage = require('../pages/CrmDeliveryOrderPage');
const testData = require('../config/testData');
const factory = require('../config/testDataFactory');
const crmChain = require('../config/crmChain');

// Explicit (not left to OpportunityPage.addItem's own default of 1) so this exact value can be
// handed off via crm-chain.json for tests/inventory's own Moves History cross-check against this
// run's real "Out" quantity - set once on the Opportunity, then carried through unchanged by
// Quotation/Sales Order/Delivery Order's own "reuse existing item" inheritance.
const ITEM_QUANTITY = '1';

const NAMES = {
  lead: factory.uniqueName('Auto_CRMFull_Lead'),
};

// Converts a just-created Lead into a brand-new Opportunity and returns its real id. Lifted
// verbatim from 02-opportunity.spec.js's own TC-OPP-01 body / tests/crm/helpers/ensureCrmChain.js's
// createFreshOpportunity, minus the crmChain hand-off (this file threads ids through local
// variables instead, same convention as erpforce-full-inventory-to-procurement.spec.js's own
// NAMES object).
async function convertLeadToOpportunity(page, lead, opportunity, leadCompanyName, { locationSearchText = '', itemSearchText = '', itemQuantity } = {}) {
  await lead.openView(leadCompanyName);
  await lead.convertToOpportunity();

  const data = { ...testData.opportunity.valid, locationSearchText, itemSearchText, itemQuantity };
  await opportunity.fillRequiredFieldsAndSave(data);

  const saved = await page.waitForURL(/\/(view-opportunity|dashboard\/crm\/orders\/opportunity(\?.*)?$)/, { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (!saved) {
    await page.screenshot({ path: 'test-results/crmfull-opportunity-save-blocked.png', fullPage: true });
    throw new Error('Opportunity Save did not redirect - see test-results/crmfull-opportunity-save-blocked.png');
  }

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
  return opportunityId;
}

// Converts a just-created Opportunity into a brand-new Quotation, progresses it through
// Submit -> Quick Approval -> Approve, and returns its real id. Lifted verbatim from
// 03-quotation.spec.js's own TC-QUO-01 body.
async function convertOpportunityToQuotation(page, opportunity, quotation, opportunityId, { locationSearchText = '', itemSearchText = '', itemQuantity } = {}) {
  await opportunity.openViewById(opportunityId);
  await opportunity.convertToQuotation();

  const data = {
    ...testData.quotation.valid,
    locationSearchText,
    itemSearchText,
    itemQuantity,
    contactPersonSearchText: '',
    shippingAddressSearchText: '',
  };
  await quotation.fillRequiredFieldsAndSave(data);

  const saved = await page.waitForURL(/\/(view-quotation|dashboard\/crm\/orders\/quotation(\?.*)?$)/, { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (!saved) {
    await page.screenshot({ path: 'test-results/crmfull-quotation-save-blocked.png', fullPage: true });
    throw new Error('Quotation Save did not redirect - see test-results/crmfull-quotation-save-blocked.png');
  }

  let quotationId = (page.url().match(/\/quotation\/(\d+)\/view-quotation/) || [])[1];
  if (!quotationId) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // table tbody tr (NOT getByRole('row').first()) - the latter also matches the table's own
    // HEADER row, which has no anchor at all - same fix already proven in 03-quotation.spec.js.
    const createdRow = page.locator('table tbody tr').first();
    const href = await createdRow.locator('a').first().getAttribute('href').catch(() => null);
    quotationId = (href && href.match(/\/quotation\/(\d+)\//) || [])[1];
    if (quotationId) {
      await quotation.openViewById(quotationId);
    }
  }
  expect(quotationId).toBeTruthy();

  // Reach "Approved" - required before Sales Order conversion is even offered (04-sales-order.spec.js's
  // own precondition). Same approver used throughout this suite's other approval-workflow modules -
  // must be the CURRENTLY LOGGED-IN user for Quick Approval's Accept action to be available.
  await quotation.submitQuickApprovalAndAccept('Dipen Modi');
  return quotationId;
}

// Converts a just-Approved Quotation into a brand-new Sales Order, progresses it through
// Submit -> Quick Approval -> Accept, and returns its real id. Lifted verbatim from
// 04-sales-order.spec.js's own TC-SO-01 body.
async function convertQuotationToSalesOrder(page, quotation, salesOrder, quotationId, { locationSearchText = '', itemSearchText = '', itemQuantity } = {}) {
  await quotation.openViewById(quotationId);
  await quotation.convertToSalesOrder();

  const data = { ...testData.crmSalesOrder.valid, locationSearchText, itemSearchText, itemQuantity };
  await salesOrder.fillRequiredFieldsAndSave(data);

  const saved = await page.waitForURL(/\/(view-sales-order|dashboard\/crm\/orders\/sales-orders(\?.*)?$)/, { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (!saved) {
    await page.screenshot({ path: 'test-results/crmfull-sales-order-save-blocked.png', fullPage: true });
    throw new Error('Sales Order Save did not redirect - see test-results/crmfull-sales-order-save-blocked.png');
  }

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

  // Open the same Sales Order, Submit -> Quick Approval -> Dipen Modi -> Send Request, then
  // Accept dropdown -> Accept -> Submit - same proven sequence TC-SO-01 uses.
  await salesOrder.openViewById(salesOrderId);
  await salesOrder.submitQuickApprovalAndAccept('Dipen Modi');
  return salesOrderId;
}

// Converts a just-Accepted Sales Order into a brand-new Delivery Order, runs it through its full
// Picked -> Packed -> Dispatched -> Delivered lifecycle, and returns its real id. Lifted verbatim
// from 05-delivery-order.spec.js's own TC-DO-01 body.
async function convertSalesOrderToDelivery(page, salesOrder, delivery, salesOrderId) {
  await salesOrder.openViewById(salesOrderId);
  await salesOrder.createDelivery();

  // Capture id straight from the Save response instead of guessing from navigation/DOM - see
  // CrmDeliveryOrderPage.fillRequiredFieldsAndSave's own header comment.
  const created = await delivery.fillRequiredFieldsAndSave();
  let deliveryOrderId = created.id;
  expect(deliveryOrderId).toBeTruthy();

  await delivery.openViewById(deliveryOrderId);
  await expect.poll(() => delivery.getStatus(), { timeout: 15000 }).toBe('Picked');

  await delivery.openTrackDetailsModal(0);
  await delivery.submitTrackDetails();

  await delivery.validate();
  await expect(delivery.packedButton).toBeVisible({ timeout: 10000 });

  await delivery.markPacked();
  await expect(delivery.dispatchedButton).toBeVisible({ timeout: 10000 });

  await delivery.markDispatched();
  await expect(delivery.deliveredButton).toBeVisible({ timeout: 10000 });

  await delivery.markDelivered();
  await expect.poll(() => delivery.getStatus(), { timeout: 15000 }).toBe('Delivered');

  return deliveryOrderId;
}

test.describe('ERPForce: CRM Lead -> Opportunity -> Quotation -> Sales Order -> Delivery Order full flow', () => {
  // Override storageState so this test starts from a genuinely fresh (unauthenticated) session -
  // same override as erpforce-full-inventory-to-procurement.spec.js's own TC-FULLFLOW-01 -
  // otherwise the project's default auth.json storageState (playwright.config.js) would already
  // be logged in, making Step 1's login a no-op instead of an actual login flow.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('TC-CRMFULL-01 [+] Login -> Lead -> Opportunity -> Quotation -> Sales Order -> Delivery Order (Delivered)', { tag: '@smoke2' }, async ({ page }) => {
    // Five confirmed-live sub-flows chained end to end on a genuinely slow shared dev
    // environment, including the Opportunity Draft-status workaround's own retry loop - same
    // class of headroom bump as erpforce-full-inventory-to-procurement.spec.js's own
    // test.setTimeout(1800000), scaled down since this flow has far fewer sub-steps.
    test.setTimeout(1000000);

    // ---------- Step 1: Login ----------
    const login = new LoginPage(page);
    await login.goto();
    await login.loginAndWaitForDashboard(testData.credentials.valid.email, testData.credentials.valid.password);
    await expect(page).toHaveURL(/dashboard/);
    console.log('✅ Step 1 – Logged in');

    // Reuse TC-FULLFLOW-01's own Location/Department/Item when it already ran this session (see
    // file header) - falls back to each stage's usual default otherwise.
    const chain = crmChain.load();
    const fullFlowLocation = chain.fullFlowLocation || '';
    const fullFlowDepartment = chain.fullFlowDepartment || '';
    const fullFlowItem = chain.fullFlowItem || '';
    if (fullFlowLocation || fullFlowItem) {
      console.log('ℹ️  Reusing TC-FULLFLOW-01 data - Location:', fullFlowLocation || '(none)',
        ', Department:', fullFlowDepartment || '(none)', ', Item:', fullFlowItem || '(none)');
    }

    // ---------- Step 2: Create Lead (TC-LEAD-01) ----------
    const lead = new LeadPage(page);
    const opportunity = new OpportunityPage(page);
    const quotation = new QuotationPage(page);
    const salesOrder = new SalesOrderPage(page);
    const delivery = new CrmDeliveryOrderPage(page);

    await lead.createLead({
      ...testData.lead.valid,
      companyName: NAMES.lead,
      ...(fullFlowLocation ? { location: fullFlowLocation } : {}),
      ...(fullFlowDepartment ? { department: fullFlowDepartment } : {}),
    });
    await expect(page).toHaveURL(/\/dashboard\/crm\/orders\/lead(\?.*)?$/);
    console.log('✅ Step 2 – Lead created:', NAMES.lead);

    // ---------- Step 3: Convert Lead -> Opportunity (TC-OPP-01) ----------
    const opportunityId = await convertLeadToOpportunity(page, lead, opportunity, NAMES.lead, {
      locationSearchText: fullFlowLocation,
      itemSearchText: fullFlowItem,
      itemQuantity: ITEM_QUANTITY,
    });
    console.log('✅ Step 3 – Opportunity created from Lead', NAMES.lead, '-> Opportunity id', opportunityId);

    // ---------- Step 4: Convert Opportunity -> Quotation, Submit -> Quick Approval -> Approve (TC-QUO-01) ----------
    const quotationId = await convertOpportunityToQuotation(page, opportunity, quotation, opportunityId, {
      locationSearchText: fullFlowLocation,
      itemSearchText: fullFlowItem,
    });
    console.log('✅ Step 4 – Quotation created from Opportunity', opportunityId, '-> Quotation id', quotationId, '(Approved)');

    // ---------- Step 5: Convert Quotation -> Sales Order, Submit -> Quick Approval -> Accept (TC-SO-01) ----------
    const salesOrderId = await convertQuotationToSalesOrder(page, quotation, salesOrder, quotationId, {
      locationSearchText: fullFlowLocation,
      itemSearchText: fullFlowItem,
      itemQuantity: ITEM_QUANTITY,
    });
    console.log('✅ Step 5 – Sales Order created from Quotation', quotationId, '-> Sales Order id', salesOrderId, '(Accepted)');

    // ---------- Step 6: Convert Sales Order -> Delivery Order, run full lifecycle to Delivered (TC-DO-01) ----------
    const deliveryOrderId = await convertSalesOrderToDelivery(page, salesOrder, delivery, salesOrderId);
    console.log('✅ Step 6 – Delivery Order created from Sales Order', salesOrderId, '-> Delivery Order id', deliveryOrderId, '(Delivered)');

    console.log('🎉 CRM full flow completed: Lead', NAMES.lead, '-> Opportunity', opportunityId, '-> Quotation', quotationId,
      '(Approved) -> Sales Order', salesOrderId, '(Accepted) -> Delivery Order', deliveryOrderId, '(Delivered)');

    // Hand off this run's real Sales Order/Delivery Order ids and item quantity for
    // tests/inventory's own Moves History cross-check against the item's real "Out" movement.
    crmChain.save({
      crmSalesOrderId: salesOrderId,
      crmDeliveryOrderId: deliveryOrderId,
      crmSalesItemQuantity: ITEM_QUANTITY,
    });
  });
});
