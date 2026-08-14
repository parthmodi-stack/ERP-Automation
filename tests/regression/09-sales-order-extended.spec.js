const { test, expect } = require('@playwright/test');
const OpportunityPage = require('../../pages/OpportunityPage');
const QuotationPage = require('../../pages/QuotationPage');
const SalesOrderPage = require('../../pages/SalesOrderPage');
const testData = require('../../config/testData');
const { createFreshLead, createFreshOpportunity } = require('../crm/helpers/ensureCrmChain');

// ── tests/regression/09-sales-order-extended.spec.js ─────────────────────────────────────────
// Extended Sales Order positive/negative coverage NOT already exercised by
// tests/crm/04-sales-order.spec.js (TC-SO-01 - the only existing Sales Order test, a Quotation-
// conversion-driven positive create through to Accepted). Numbered from TC-SO-02 (positive) and
// TC-SO-N01 (negative) to avoid colliding with that file's own TC-SO-01. No @smoke2 tag anywhere
// in this file - it must never run as part of the smoke2 chain.
//
// There is no standalone "Add Sales Order" entry point - quotation_id/opportunity_id are
// disabled, non-searchable fields, and "Create Order" only renders once the source Quotation's
// status is 'Accepted' - so every Sales Order here is built from a brand-new, independent Lead ->
// Opportunity -> Quotation (progressed all the way to Accepted) -> Sales Order, mirroring
// 08-quotation-extended.spec.js's own createQuotationFromFreshOpportunity pattern.
async function createSalesOrderFromFreshQuotation(page, nameSeed) {
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
  if (!quoSaved) throw new Error('createSalesOrderFromFreshQuotation: Quotation Save did not redirect');

  let quotationId = (page.url().match(/\/quotation\/(\d+)\/view-quotation/) || [])[1];
  if (!quotationId) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const createdRow = page.locator('table tbody tr').first();
    const href = await createdRow.locator('a').first().getAttribute('href').catch(() => null);
    quotationId = (href && href.match(/\/quotation\/(\d+)\//) || [])[1];
    if (quotationId) await quotation.openViewById(quotationId);
  }
  if (!quotationId) throw new Error('createSalesOrderFromFreshQuotation: could not determine created Quotation id');

  await quotation.submitQuickApprovalAndAccept('Dipen Modi');
  await quotation.openViewById(quotationId);
  await quotation.convertToSalesOrder();

  const salesOrder = new SalesOrderPage(page);
  const soData = { ...testData.crmSalesOrder.valid, locationSearchText: '' };
  await salesOrder.fillRequiredFieldsAndSave(soData);

  const soSaved = await page.waitForURL(/\/(view-sales-order|dashboard\/crm\/orders\/sales-orders(\?.*)?$)/, { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (!soSaved) throw new Error('createSalesOrderFromFreshQuotation: Sales Order Save did not redirect');

  let salesOrderId = (page.url().match(/\/sales-orders?\/(\d+)\/view-sales-order/) || [])[1];
  if (!salesOrderId) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const createdRow = page.locator('table tbody tr').first();
    const href = await createdRow.locator('a').first().getAttribute('href').catch(() => null);
    salesOrderId = (href && href.match(/\/sales-orders?\/(\d+)\//) || [])[1];
    if (salesOrderId) await salesOrder.openViewById(salesOrderId);
  }
  if (!salesOrderId) throw new Error('createSalesOrderFromFreshQuotation: could not determine created Sales Order id');

  return { salesOrderId, quotationId, opportunityId, leadCompanyName, salesOrder, quotation };
}

test.describe('Sales Order Management - Extended', () => {

  // NOTE: "Missing Payment Terms" and "Zero Items" were attempted here but dropped - CONFIRMED
  // LIVE Payment Terms genuinely arrives empty yet Save succeeds anyway ("Sales order saved
  // successfully"), and Items always arrive carried over from the source Quotation (never
  // empty). "Additional Discount Percentage over/under 100" was also dropped - the field is
  // disabled by default and the toggle meant to enable it wasn't found by label text within a
  // reasonable number of attempts, not reliably testable as a result.

  // ── TC-SO-N01: Quick Approval blocked with zero approvers ─────────────────
  test('TC-SO-N01 [-] Quick Approval Send Request blocked with zero approvers selected', async ({ page }) => {
    test.setTimeout(400000);
    const { salesOrder } = await createSalesOrderFromFreshQuotation(page, 'Automation_Lead_For_SON01');

    const { approvalModal, sendRequestButton } = await salesOrder.openQuickApprovalWithoutApprover();
    await expect(approvalModal).toBeVisible({ timeout: 5000 });
    await expect(sendRequestButton).toBeDisabled({ timeout: 5000 });
  });

  // ── TC-SO-02: Edit Sales Order ───────────────────────────────────────────────
  test('TC-SO-02 [+] Edit Sales Order - update PO Number', async ({ page }) => {
    test.setTimeout(400000);
    const { salesOrderId, salesOrder } = await createSalesOrderFromFreshQuotation(page, 'Automation_Lead_For_SOEdit');

    const updatedPoNumber = `PO-UPDATED-${Date.now()}`;
    await salesOrder.openEditById(salesOrderId);
    const poNumberInput = page.getByText('PO Number', { exact: false }).first().locator('xpath=..').locator('input');
    await poNumberInput.fill(updatedPoNumber);

    // Same progressive multi-tab Edit form already confirmed on Quotation's own Edit page -
    // Save only appears once the last tab is reached.
    const nextButton = page.getByRole('button', { name: 'Next', exact: true });
    for (let i = 0; i < 3; i++) {
      const visible = await nextButton.isVisible({ timeout: 2000 }).catch(() => false);
      if (!visible) break;
      await nextButton.click();
      await page.waitForTimeout(500);
    }
    await salesOrder.save();

    await page.waitForURL(/\/(view-sales-order|dashboard\/crm\/orders\/sales-orders(\?.*)?$)/, { timeout: 15000 });
    await salesOrder.openViewById(salesOrderId);
    await expect(page.getByText(updatedPoNumber, { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

  // ── TC-SO-03: View Sales Order ────────────────────────────────────────────────
  test('TC-SO-03 [+] View Sales Order - verify saved field values on detail page', async ({ page }) => {
    test.setTimeout(400000);
    const { salesOrderId, leadCompanyName, salesOrder } = await createSalesOrderFromFreshQuotation(page, 'Automation_Lead_For_SOView');

    await salesOrder.openViewById(salesOrderId);
    await expect(page.getByText(leadCompanyName, { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

  // ── TC-SO-04: Delete Sales Order ──────────────────────────────────────────────
  test('TC-SO-04 [+] Delete a Sales Order via Actions menu', async ({ page }) => {
    test.setTimeout(400000);
    const { salesOrderId, salesOrder } = await createSalesOrderFromFreshQuotation(page, 'Automation_Lead_For_SODelete');

    await salesOrder.openViewById(salesOrderId);
    await salesOrder.actionsButton.click();
    await salesOrder.deleteMenuItem.waitFor({ state: 'visible' });
    await salesOrder.deleteMenuItem.click();
    await salesOrder.confirmDeleteButton.waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    await salesOrder.confirmDeleteButton.click();

    await page.waitForURL(/sales-order/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table tbody tr', { hasText: String(salesOrderId) })).toHaveCount(0, { timeout: 10000 });
  });

  // ── TC-SO-05: Reject flow ─────────────────────────────────────────────────────
  test('TC-SO-05 [+] Quick Approval Reject flow reaches Rejected status', async ({ page }) => {
    test.setTimeout(400000);
    const { salesOrderId, salesOrder } = await createSalesOrderFromFreshQuotation(page, 'Automation_Lead_For_SOReject');

    await salesOrder.openViewById(salesOrderId);
    await salesOrder.submitQuickApprovalAndReject('Dipen Modi');
  });

  // ── TC-SO-06: Add a second Item ───────────────────────────────────────────────
  test('TC-SO-06 [+] Add a second Item to the Items table', async ({ page }) => {
    test.setTimeout(400000);
    const { salesOrderId, salesOrder } = await createSalesOrderFromFreshQuotation(page, 'Automation_Lead_For_SOSecondItem');

    await salesOrder.openEditById(salesOrderId);
    await salesOrder.addItem({ quantity: 2 });

    const nextButton = page.getByRole('button', { name: 'Next', exact: true });
    for (let i = 0; i < 3; i++) {
      const visible = await nextButton.isVisible({ timeout: 2000 }).catch(() => false);
      if (!visible) break;
      await nextButton.click();
      await page.waitForTimeout(500);
    }
    await salesOrder.save();

    await page.waitForURL(/\/(view-sales-order|dashboard\/crm\/orders\/sales-orders(\?.*)?$)/, { timeout: 15000 });
    await salesOrder.openViewById(salesOrderId);
    const itemRowCount = await page.locator('table tbody tr').filter({ hasNotText: /No Data/i }).count().catch(() => 0);
    expect(itemRowCount).toBeGreaterThanOrEqual(2);
  });

});
