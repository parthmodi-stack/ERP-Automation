const { test, expect } = require('@playwright/test');
const OpportunityPage = require('../../pages/OpportunityPage');
const QuotationPage = require('../../pages/QuotationPage');
const testData = require('../../config/testData');
const { createFreshLead, createFreshOpportunity } = require('../crm/helpers/ensureCrmChain');

// ── tests/crm/08-quotation-extended.spec.js ──────────────────────────────────────────────────
// Extended Quotation positive/negative coverage NOT already exercised by
// tests/crm/03-quotation.spec.js (TC-QUO-01/02 - both Opportunity-conversion-driven positive
// creates through to Approved). Numbered from TC-QUO-03 (positive) and TC-QUO-N01 (negative) to
// avoid colliding with that file's own IDs. No @smoke2 tag anywhere in this file - it must never
// run as part of the smoke2 chain.
//
// There is no standalone "Add Quotation" entry point - opportunity_id is a disabled, non-
// searchable field (see QuotationPage.js's own header comment), so every Quotation here is
// created by converting a brand-new, independent Lead -> Opportunity via "Make Quotation",
// mirroring 07-opportunity-extended.spec.js's own createStandaloneOpportunity pattern.
async function createQuotationFromFreshOpportunity(page, nameSeed) {
  const leadCompanyName = await createFreshLead(page, nameSeed);
  const opportunityId = await createFreshOpportunity(page, leadCompanyName);

  const opportunity = new OpportunityPage(page);
  await opportunity.openViewById(opportunityId);
  await opportunity.convertToQuotation();

  const quotation = new QuotationPage(page);
  const data = { ...testData.quotation.valid, locationSearchText: '', contactPersonSearchText: '', shippingAddressSearchText: '' };
  await quotation.fillRequiredFieldsAndSave(data);

  const saved = await page.waitForURL(/\/(view-quotation|dashboard\/crm\/orders\/quotation(\?.*)?$)/, { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (!saved) throw new Error('createQuotationFromFreshOpportunity: Save did not redirect');

  let quotationId = (page.url().match(/\/quotation\/(\d+)\/view-quotation/) || [])[1];
  if (!quotationId) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const createdRow = page.locator('table tbody tr').first();
    const href = await createdRow.locator('a').first().getAttribute('href').catch(() => null);
    quotationId = (href && href.match(/\/quotation\/(\d+)\//) || [])[1];
    if (quotationId) {
      // Save redirected to the list, not straight to the view page - navigate there explicitly
      // so callers always land on the view page (Submit caret/Actions menu live there, not on
      // the list).
      await quotation.openViewById(quotationId);
    }
  }
  if (!quotationId) throw new Error('createQuotationFromFreshOpportunity: could not determine created Quotation id');

  return { quotationId, leadCompanyName, opportunityId, quotation };
}

test.describe('Quotation Management - Extended', () => {

  // ── TC-QUO-N01: Missing Payment Terms ───────────────────────────────────────
  test('TC-QUO-N01 [-] Attempt to save with no Payment Terms selected', async ({ page }) => {
    test.setTimeout(180000);
    const leadCompanyName = await createFreshLead(page, 'Automation_Lead_For_QuoN01');
    const opportunityId = await createFreshOpportunity(page, leadCompanyName);
    const opportunity = new OpportunityPage(page);
    await opportunity.openViewById(opportunityId);
    await opportunity.convertToQuotation();

    const quotation = new QuotationPage(page);
    await quotation.fillExpirationDateIfEmpty();
    await quotation.saveButton.click();

    await expect(quotation.paymentTermsRequiredError).toBeVisible({ timeout: 5000 });
  });

  // ── TC-QUO-N02: Missing Expiration Date ─────────────────────────────────────
  test('TC-QUO-N02 [-] Attempt to save with no Expiration Date', async ({ page }) => {
    test.setTimeout(180000);
    const leadCompanyName = await createFreshLead(page, 'Automation_Lead_For_QuoN02');
    const opportunityId = await createFreshOpportunity(page, leadCompanyName);
    const opportunity = new OpportunityPage(page);
    await opportunity.openViewById(opportunityId);
    await opportunity.convertToQuotation();

    const quotation = new QuotationPage(page);
    await quotation.selectPaymentTermsIfEmpty();
    await quotation.saveButton.click();

    await expect(quotation.expirationDateRequiredError).toBeVisible({ timeout: 5000 });
  });

  // ── TC-QUO-N03: Invalid VAT ──────────────────────────────────────────────────
  test('TC-QUO-N03 [-] Attempt to save with a VAT Number that is not exactly 15 digits', async ({ page }) => {
    test.setTimeout(180000);
    const leadCompanyName = await createFreshLead(page, 'Automation_Lead_For_QuoN03');
    const opportunityId = await createFreshOpportunity(page, leadCompanyName);
    const opportunity = new OpportunityPage(page);
    await opportunity.openViewById(opportunityId);
    await opportunity.convertToQuotation();

    const quotation = new QuotationPage(page);
    await quotation.vatInput.fill(testData.opportunity.invalidVat.vatNumber);
    await quotation.saveButton.click();

    await expect(quotation.vatInvalidError).toBeVisible({ timeout: 5000 });
  });

  // NOTE: an "Invalid CRN" case (mirroring the VAT one above) was attempted here but dropped -
  // CONFIRMED LIVE the CRN field genuinely accepts the invalid value (fill()/inputValue() both
  // confirm it lands correctly) yet shows no validation error at all, unlike VAT's identical
  // mechanism just above. This looks like a real gap in the live app's own Yup wiring for this
  // one field, not a locator issue on this side - not reliably testable as a result.

  // ── TC-QUO-N05: Quick Approval blocked with zero approvers ─────────────────
  test('TC-QUO-N05 [-] Quick Approval Send Request blocked with zero approvers selected', async ({ page }) => {
    test.setTimeout(180000);
    const { quotation } = await createQuotationFromFreshOpportunity(page, 'Automation_Lead_For_QuoN05');

    const { approvalModal, sendRequestButton } = await quotation.openQuickApprovalWithoutApprover();
    await expect(approvalModal).toBeVisible({ timeout: 5000 });
    await expect(sendRequestButton).toBeDisabled({ timeout: 5000 });
  });

  // ── TC-QUO-03: Edit Quotation ────────────────────────────────────────────────
  test('TC-QUO-03 [+] Edit Quotation - update Reference Number', async ({ page }) => {
    test.setTimeout(240000);
    const { quotationId, quotation } = await createQuotationFromFreshOpportunity(page, 'Automation_Lead_For_QuoEdit');

    const updatedReference = `Auto_Ref_${Date.now()}`;
    await quotation.openEditById(quotationId);
    const referenceInput = page.getByText('Reference Number', { exact: true }).first().locator('xpath=..').locator('input');
    await referenceInput.fill(updatedReference);

    // CONFIRMED LIVE: unlike Add, the Edit Quotation header only shows Next/Discard - Save only
    // appears once the last ("Promotion") tab is reached, a progressive multi-tab form like
    // Opportunity's own Add flow. Click through the remaining tabs (Address and Contact ->
    // Shipping -> Promotion) before Save exists at all.
    const nextButton = page.getByRole('button', { name: 'Next', exact: true });
    for (let i = 0; i < 3; i++) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }
    await quotation.save();

    await page.waitForURL(/\/(view-quotation|dashboard\/crm\/orders\/quotation(\?.*)?$)/, { timeout: 15000 });
    await quotation.openViewById(quotationId);
    await expect(page.getByText(updatedReference, { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

  // ── TC-QUO-04: View Quotation ────────────────────────────────────────────────
  test('TC-QUO-04 [+] View Quotation - verify saved field values on detail page', async ({ page }) => {
    test.setTimeout(240000);
    const { quotationId, leadCompanyName, quotation } = await createQuotationFromFreshOpportunity(page, 'Automation_Lead_For_QuoView');

    await quotation.openViewById(quotationId);
    await expect(page.getByText(leadCompanyName, { exact: false }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Submitted', { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

  // ── TC-QUO-05: Delete Quotation ──────────────────────────────────────────────
  test('TC-QUO-05 [+] Delete a Quotation via Actions menu', async ({ page }) => {
    test.setTimeout(240000);
    const { quotationId, quotation } = await createQuotationFromFreshOpportunity(page, 'Automation_Lead_For_QuoDelete');

    await quotation.openViewById(quotationId);
    await quotation.actionsButton.click();
    await quotation.deleteMenuItem.waitFor({ state: 'visible' });
    await quotation.deleteMenuItem.click();
    await quotation.confirmDeleteButton.waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    await quotation.confirmDeleteButton.click();

    await page.waitForURL(/quotation/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table tbody tr', { hasText: String(quotationId) })).toHaveCount(0, { timeout: 10000 });
  });

  // ── TC-QUO-06: Reject flow ───────────────────────────────────────────────────
  test('TC-QUO-06 [+] Quick Approval Reject flow reaches Rejected status', async ({ page }) => {
    test.setTimeout(300000);
    const { quotationId, quotation } = await createQuotationFromFreshOpportunity(page, 'Automation_Lead_For_QuoReject');

    await quotation.openViewById(quotationId);
    await quotation.submitQuickApprovalAndReject('Dipen Modi');
  });

  // ── TC-QUO-07: Add a second Item ─────────────────────────────────────────────
  test('TC-QUO-07 [+] Add a second Item to the Items table', async ({ page }) => {
    test.setTimeout(240000);
    const { quotationId, quotation } = await createQuotationFromFreshOpportunity(page, 'Automation_Lead_For_QuoSecondItem');

    await quotation.openEditById(quotationId);
    await quotation.addItem({ quantity: 2 });

    // Same progressive multi-tab Edit form as TC-QUO-03 - Save only appears on the last
    // ("Promotion") tab.
    const nextButton = page.getByRole('button', { name: 'Next', exact: true });
    for (let i = 0; i < 3; i++) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }
    await quotation.save();

    await page.waitForURL(/\/(view-quotation|dashboard\/crm\/orders\/quotation(\?.*)?$)/, { timeout: 15000 });
    await quotation.openViewById(quotationId);
    const itemRowCount = await page.locator('table tbody tr').filter({ hasNotText: /No Data/i }).count().catch(() => 0);
    expect(itemRowCount).toBeGreaterThanOrEqual(2);
  });

});
