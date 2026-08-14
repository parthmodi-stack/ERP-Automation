const { test, expect } = require('@playwright/test');
const OpportunityPage = require('../../pages/OpportunityPage');
const LeadPage = require('../../pages/LeadPage');
const testData = require('../../config/testData');
const crmChain = require('../../config/crmChain');
const { ensureLead } = require('../crm/helpers/ensureCrmChain');

test.describe('Opportunity Management', () => {

  // ── TC-OPP-01: Create Opportunity from an existing Lead (via its "Convert" action) ───────
  // CONFIRMED AGAINST SOURCE (see pages/OpportunityPage.js header comment): the real Lead->
  // Opportunity link is the "Convert" button on the Lead's own view page - it navigates to Add
  // Opportunity via router state, pre-filling and LOCKING the Customer field to that exact Lead.
  // Self-healing via ensureLead() - creates its own Lead first if none has run yet this session,
  // so this test also works standalone.
  test('TC-OPP-01 [+] Create Opportunity by converting an existing Lead', async ({ page }) => {
    test.setTimeout(240000);

    const leadCompanyName = await ensureLead(page);

    const lead = new LeadPage(page);
    await lead.openView(leadCompanyName);
    await lead.convertToOpportunity();

    const opportunity = new OpportunityPage(page);
    // Same fullFlow hand-off as TC-LEAD-01 above (config/crmChain.js) - reference the exact
    // Location/Item TC-FULLFLOW-01 created when it already ran this session, instead of an empty
    // search text (pick-first-available). Falls back to '' when run standalone.
    const chain = crmChain.load();
    const data = {
      ...testData.opportunity.valid,
      locationSearchText: chain.fullFlowLocation || '',
      itemSearchText: chain.fullFlowItem || '',
    };
    await opportunity.fillRequiredFieldsAndSave(data);

    // Save can bounce back with a required field this Page Object doesn't yet know about (same
    // class of issue proven throughout this suite's other chained flows) - give it a moment and
    // capture full-page diagnostics rather than fail blind.
    const saved = await page.waitForURL(/\/(view-opportunity|dashboard\/crm\/orders\/opportunity(\?.*)?$)/, { timeout: 20000 })
      .then(() => true).catch(() => false);
    if (!saved) {
      await page.screenshot({ path: 'test-results/opportunity-save-blocked.png', fullPage: true });
      throw new Error('Opportunity Save did not redirect - see test-results/opportunity-save-blocked.png');
    }

    let opportunityId = (page.url().match(/\/opportunity\/(\d+)\/view-opportunity/) || [])[1];
    if (!opportunityId) {
      // Redirected to the plain list instead of straight to its view page - find the row by the
      // Lead's own company name (same identity this Opportunity's Customer is locked to) and
      // read its id back, same "read from the list's own row" convention used throughout this
      // suite rather than assuming.
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const createdRow = page.getByRole('row').filter({ hasText: leadCompanyName }).first();
      await expect(createdRow).toBeVisible({ timeout: 10000 });
      const href = await createdRow.locator('a').first().getAttribute('href').catch(() => null);
      opportunityId = (href && href.match(/\/opportunity\/(\d+)\//) || [])[1];
    }
    expect(opportunityId).toBeTruthy();
    console.log('DEBUG created Opportunity id:', opportunityId, 'from Lead:', leadCompanyName);

    // CONFIRMED APP BUG (see OpportunityPage.promoteFromDraftIfNeeded's own comment): a fresh
    // Opportunity's "Save" click still submits with is_draft:1 regardless - Edit+Save again to
    // actually clear it, since "Make Quotation" (03-quotation.spec.js's own linking step) only
    // renders for a non-draft Opportunity.
    await opportunity.promoteFromDraftIfNeeded(opportunityId);

    crmChain.save({ opportunityId, leadCompanyName });
  });

});
