const { test, expect } = require('@playwright/test');
const OpportunityPage = require('../../pages/OpportunityPage');
const testData = require('../../config/testData');
const { createFreshLead } = require('../crm/helpers/ensureCrmChain');

// Creates a brand-new, independent Lead + standalone Opportunity (manual Customer search, not
// via Convert) so each positive test below has its own unambiguous record to act on instead of
// risking a list-search collision with any other Opportunity in this shared account. Handles
// the already-documented "fresh Save always lands in Draft" app quirk via promoteFromDraftIfNeeded.
async function createStandaloneOpportunity(page, nameSeed) {
  const leadCompanyName = await createFreshLead(page, nameSeed);
  const opp = new OpportunityPage(page);
  const data = { ...testData.opportunity.valid, customerSearchText: leadCompanyName };
  await opp.goto();
  await opp.fillRequiredFieldsAndSave(data);

  const saved = await page.waitForURL(/\/(view-opportunity|dashboard\/crm\/orders\/opportunity(\?.*)?$)/, { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (!saved) throw new Error('createStandaloneOpportunity: Save did not redirect');

  let opportunityId = (page.url().match(/\/opportunity\/(\d+)\/view-opportunity/) || [])[1];
  if (!opportunityId) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const createdRow = page.getByRole('row').filter({ hasText: leadCompanyName }).first();
    await expect(createdRow).toBeVisible({ timeout: 10000 });
    const href = await createdRow.locator('a').first().getAttribute('href').catch(() => null);
    opportunityId = (href && href.match(/\/opportunity\/(\d+)\//) || [])[1];
  }
  if (!opportunityId) throw new Error('createStandaloneOpportunity: could not determine created Opportunity id');

  await opp.promoteFromDraftIfNeeded(opportunityId);
  return { opportunityId, leadCompanyName, opp };
}

// ── tests/crm/07-opportunity-extended.spec.js ────────────────────────────────────────────────
// Extended Opportunity positive/negative coverage NOT already exercised by
// tests/crm/02-opportunity.spec.js (TC-OPP-01, the only existing Opportunity test - a Lead-
// Convert-driven positive create). Numbered from TC-OPP-02 (positive) and TC-OPP-N01 (negative)
// to avoid colliding with that file's own TC-OPP-01. No @smoke2 tag anywhere in this file - it
// must never run as part of the smoke2 chain.
test.describe('Opportunity Management - Extended', () => {

  // ── TC-OPP-N01: Missing Customer (standalone Add, not via Lead Convert) ───
  test('TC-OPP-N01 [-] Attempt to save with no Customer selected', async ({ page }) => {
    const opp = new OpportunityPage(page);
    await opp.goto();
    await opp.save();

    await expect(opp.customerRequiredError).toBeVisible({ timeout: 5000 });
  });

  // ── TC-OPP-N02: Missing Expected Closing Date ──────────────────────────────
  test('TC-OPP-N02 [-] Attempt to save with no Expected Closing Date', async ({ page }) => {
    const opp = new OpportunityPage(page);
    await opp.goto();
    await opp.save();

    await expect(opp.expectedClosingDateRequiredError).toBeVisible({ timeout: 5000 });
  });

  // ── TC-OPP-N03: Missing Location ────────────────────────────────────────────
  test('TC-OPP-N03 [-] Attempt to save with no Location selected', async ({ page }) => {
    const opp = new OpportunityPage(page);
    await opp.goto();
    await opp.save();

    await expect(opp.locationRequiredError).toBeVisible({ timeout: 5000 });
  });

  // ── TC-OPP-N04: Zero Items ───────────────────────────────────────────────────
  test('TC-OPP-N04 [-] Attempt to save with zero Items', async ({ page }) => {
    const opp = new OpportunityPage(page);
    await opp.goto();
    await opp.save();

    await expect(opp.itemsRequiredError).toBeVisible({ timeout: 5000 });
  });

  // ── TC-OPP-N05: Invalid VAT ──────────────────────────────────────────────────
  test('TC-OPP-N05 [-] Attempt to save with a VAT Number that is not exactly 15 digits', async ({ page }) => {
    const opp = new OpportunityPage(page);
    const data = testData.opportunity.invalidVat;
    await opp.goto();
    await opp.vatInput.fill(data.vatNumber);
    await opp.save();

    await expect(opp.vatInvalidError).toBeVisible({ timeout: 5000 });
  });

  // ── TC-OPP-N06: Invalid CRN ──────────────────────────────────────────────────
  test('TC-OPP-N06 [-] Attempt to save with a CRN that is not exactly 10 digits', async ({ page }) => {
    const opp = new OpportunityPage(page);
    const data = testData.opportunity.invalidCrn;
    await opp.goto();
    await opp.crnInput.fill(data.crnNumber);
    await opp.save();

    await expect(opp.crnInvalidError).toBeVisible({ timeout: 5000 });
  });

  // ── TC-OPP-02: Create Opportunity standalone (manual Customer search) ─────
  test('TC-OPP-02 [+] Create Opportunity standalone via manual Customer search', async ({ page }) => {
    test.setTimeout(180000);
    const { opportunityId } = await createStandaloneOpportunity(page, 'Automation_Lead_For_OppStandalone');
    expect(opportunityId).toBeTruthy();
  });

  // ── TC-OPP-03: Edit Opportunity - update Expected Revenue/Priority/Stage ──
  test('TC-OPP-03 [+] Edit Opportunity - update Expected Revenue and Priority', async ({ page }) => {
    test.setTimeout(180000);
    const { opportunityId, opp } = await createStandaloneOpportunity(page, 'Automation_Lead_For_OppEdit');

    const updatedRevenue = '75000';
    await opp.openEditById(opportunityId);
    await opp.fillBasicDetails({ expectedRevenue: updatedRevenue });
    await opp.selectPriority('High');
    await opp.save();

    await page.waitForURL(/\/(view-opportunity|dashboard\/crm\/orders\/opportunity(\?.*)?$)/, { timeout: 15000 });
    await opp.openViewById(opportunityId);
    await expect(page.getByText(updatedRevenue, { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

  // ── TC-OPP-04: View Opportunity - verify saved values ──────────────────────
  test('TC-OPP-04 [+] View Opportunity - verify saved field values on detail page', async ({ page }) => {
    test.setTimeout(180000);
    const { opportunityId, leadCompanyName } = await createStandaloneOpportunity(page, 'Automation_Lead_For_OppView');

    const opp = new OpportunityPage(page);
    await opp.openViewById(opportunityId);
    await expect(page.getByText(leadCompanyName, { exact: false }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(testData.opportunity.valid.expectedRevenue, { exact: false }).first()).toBeVisible();
  });

  // ── TC-OPP-05: Delete Opportunity ───────────────────────────────────────────
  test('TC-OPP-05 [+] Delete an Opportunity via Actions menu', async ({ page }) => {
    test.setTimeout(180000);
    const { opportunityId, opp } = await createStandaloneOpportunity(page, 'Automation_Lead_For_OppDelete');

    await opp.openViewById(opportunityId);
    await opp.actionsButton.click();
    await opp.deleteMenuItem.waitFor({ state: 'visible' });
    await opp.deleteMenuItem.click();
    await opp.confirmDeleteButton.waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    await opp.confirmDeleteButton.click();

    await page.waitForURL(/opportunity/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table tbody tr', { hasText: String(opportunityId) })).toHaveCount(0, { timeout: 10000 });
  });

  // ── TC-OPP-06: Add a second Item to the Items table ────────────────────────
  test('TC-OPP-06 [+] Add a second Item to the Items table', async ({ page }) => {
    test.setTimeout(180000);
    const { opportunityId, opp } = await createStandaloneOpportunity(page, 'Automation_Lead_For_OppSecondItem');

    await opp.openEditById(opportunityId);
    await opp.addItem({ quantity: 2 });
    await opp.save();

    await page.waitForURL(/\/(view-opportunity|dashboard\/crm\/orders\/opportunity(\?.*)?$)/, { timeout: 15000 });
    await opp.openViewById(opportunityId);
    const itemRowCount = await page.getByRole('tabpanel', { name: 'Basic Details' }).locator('table tbody tr').filter({ hasNotText: 'No Data' }).count().catch(() => 0);
    expect(itemRowCount).toBeGreaterThanOrEqual(2);
  });

});
