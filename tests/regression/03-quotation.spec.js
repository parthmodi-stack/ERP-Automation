const { test, expect } = require('@playwright/test');
const QuotationPage = require('../../pages/QuotationPage');
const OpportunityPage = require('../../pages/OpportunityPage');
const testData = require('../../config/testData');
const crmChain = require('../../config/crmChain');
const { ensureOpportunity, createFreshLead, createFreshOpportunity } = require('../crm/helpers/ensureCrmChain');

test.describe('Quotation Management', () => {

  // ── TC-QUO-01: Create Quotation from an existing Opportunity (via its "Make Quotation" action) ──
  // CONFIRMED AGAINST SOURCE (see pages/QuotationPage.js header comment): the real Opportunity->
  // Quotation link is the "Make Quotation" button on the Opportunity's view page - it navigates
  // to Add Quotation via router state, pre-filling customer/items/currency/company/address/
  // contact from that exact Opportunity. Then progresses the Quotation through Submit -> Quick
  // Approval -> Accept so it reaches "Accepted" status - the precondition 04-sales-order.spec.js's
  // "Create Order" conversion requires. Self-healing via ensureOpportunity() - creates its own
  // Lead -> Opportunity first if neither has run yet this session.
  test('TC-QUO-01 [+] Create Quotation by converting an existing Opportunity, then Accept it', async ({ page }) => {
    test.setTimeout(400000);

    const opportunityId = await ensureOpportunity(page);

    const opportunity = new OpportunityPage(page);
    await opportunity.openViewById(opportunityId);
    await opportunity.convertToQuotation();

    const quotation = new QuotationPage(page);
    const data = {
      ...testData.quotation.valid,
      locationSearchText: '',
      contactPersonSearchText: '',
      shippingAddressSearchText: '',
    };
    await quotation.fillRequiredFieldsAndSave(data);

    const saved = await page.waitForURL(/\/(view-quotation|dashboard\/crm\/orders\/quotation(\?.*)?$)/, { timeout: 20000 })
      .then(() => true).catch(() => false);
    if (!saved) {
      await page.screenshot({ path: 'test-results/quotation-save-blocked.png', fullPage: true });
      throw new Error('Quotation Save did not redirect - see test-results/quotation-save-blocked.png');
    }

    let quotationId = (page.url().match(/\/quotation\/(\d+)\/view-quotation/) || [])[1];
    if (!quotationId) {
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      // table tbody tr (NOT getByRole('row').first()) - the latter also matches the table's own
      // HEADER row (which also carries an implicit ARIA row role and sorts before any data row in
      // DOM order), which has no anchor at all - .first() landed there and left quotationId
      // undefined even though Save had genuinely redirected to the list with a real new row on it.
      const createdRow = page.locator('table tbody tr').first();
      const href = await createdRow.locator('a').first().getAttribute('href').catch(() => null);
      quotationId = (href && href.match(/\/quotation\/(\d+)\//) || [])[1];
      if (quotationId) {
        await quotation.openViewById(quotationId);
      }
    }
    expect(quotationId).toBeTruthy();
    console.log('DEBUG created Quotation id:', quotationId, 'from Opportunity:', opportunityId);

    // Reach "Accepted" - required before Sales Order conversion is even offered. Same approver
    // used throughout this suite's other approval-workflow modules (Procurement's own
    // CONFIG.approverName) - must be the CURRENTLY LOGGED-IN user for Quick Approval's Accept
    // action to actually be available to this session.
    await quotation.submitQuickApprovalAndAccept('Dipen Modi');

    crmChain.save({ quotationId, opportunityId });
  });

  // ── TC-QUO-02: Create Quotation from a freshly created Opportunity (Save only, no approval) ──
  // "Make Quotation" only renders on an Opportunity with no quotation_id yet (see
  // OpportunityPage.js's own header comment) - TC-QUO-01 above already converted the shared
  // chain's Opportunity (crmChain.opportunityId), so ensureOpportunity() would just hand back
  // that same, already-quotationed record and "Make Quotation" would never appear. This test
  // builds its own independent Lead -> Opportunity via createFreshLead()/createFreshOpportunity()
  // instead, so its own Opportunity still has the button.
  test('TC-QUO-02 [+] Create Quotation from a freshly created Opportunity via Make Quotation', async ({ page }) => {
    test.setTimeout(240000);

    const leadCompanyName = await createFreshLead(page, 'Automation_Lead_For_Quotation');
    const opportunityId = await createFreshOpportunity(page, leadCompanyName);

    const opportunity = new OpportunityPage(page);

    // ---- Step 1: Open the saved Opportunity and click "Make Quotation" ----
    await opportunity.openViewById(opportunityId);
    await opportunity.convertToQuotation();

    // ---- Step 2: Fill all mandatory fields and Save ----
    const quotation = new QuotationPage(page);
    const data = {
      ...testData.quotation.valid,
      locationSearchText: '',
      contactPersonSearchText: '',
      shippingAddressSearchText: '',
    };
    await quotation.fillRequiredFieldsAndSave(data);

    const saved = await page.waitForURL(/\/(view-quotation|dashboard\/crm\/orders\/quotation(\?.*)?$)/, { timeout: 20000 })
      .then(() => true).catch(() => false);
    if (!saved) {
      await page.screenshot({ path: 'test-results/quotation-tc-quo-02-save-blocked.png', fullPage: true });
      throw new Error('Quotation Save did not redirect - see test-results/quotation-tc-quo-02-save-blocked.png');
    }

    let quotationId = (page.url().match(/\/quotation\/(\d+)\/view-quotation/) || [])[1];
    if (!quotationId) {
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      // table tbody tr (NOT getByRole('row').first()) - the latter also matches the table's own
      // HEADER row (which also carries an implicit ARIA row role and sorts before any data row in
      // DOM order), which has no anchor at all - .first() landed there and left quotationId
      // undefined even though Save had genuinely redirected to the list with a real new row on it.
      const createdRow = page.locator('table tbody tr').first();
      const href = await createdRow.locator('a').first().getAttribute('href').catch(() => null);
      quotationId = (href && href.match(/\/quotation\/(\d+)\//) || [])[1];
    }
    expect(quotationId).toBeTruthy();
    console.log('DEBUG created Quotation id (TC-QUO-02):', quotationId, 'from Opportunity:', opportunityId, 'Lead:', leadCompanyName);

    // ---- Step 3: Open the same Quotation, Submit -> Quick Approval -> Dipen Modi, then Approve ----
    // submitQuickApprovalAndAccept already re-opens the Submit split-button's dropdown, sends the
    // Quick Approval request to the named approver, reloads (now acting as that approver), then
    // opens the resulting Approve dropdown and clicks Accept - same proven sequence TC-QUO-01 uses.
    await quotation.openViewById(quotationId);
    await quotation.submitQuickApprovalAndAccept('Dipen Modi');
  });

});
