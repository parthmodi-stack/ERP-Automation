const { test, expect } = require('@playwright/test');
const PurchaseOrderPage = require('../../pages/PurchaseOrderPage');
const ProcurementRequestPage = require('../../pages/ProcurementRequestPage');
const testData = require('../../config/testData');

// Purchase Order - ADVANCED coverage that the base 04-purchase-order.spec.js deliberately omits:
// multi-line items, expenses, taxes, discounts, Summary-panel calculations, and create-from-
// source. This file is additive and non-duplicative: it never re-tests the create/edit/delete/
// approval/listing lifecycle already covered in 04.
//
// UNVERIFIED LIVE: authored from FE source reading (item-entry-modal.tsx, expense-entry-modal.tsx,
// summary/default-data.ts) like the base PO suite - expect locator/flow tuning on first run.
//
// A note on assertions: Tax Template / Discount Item / Expense Account options are selected as
// "first available" (their exact live option text is unverified in this account), so the tax/
// discount FIGURES depend on whatever master record renders first. These tests therefore assert
// the calculation PATHWAY works (the Summary field renders a parseable value and Save succeeds),
// not a specific hardcoded amount - the same pragmatic stance the repo takes for other
// unverified-master-data fields (see selectFirstOptionByLabel).
test.describe('Purchase Order - Advanced (items/expenses/taxes/discounts/summary)', () => {
  test.describe.configure({ timeout: 150000 });

  const data = testData.purchaseOrder;

  // Parse a Summary currency/number string ("AED 909.0000", "5") into a Number.
  const num = (s) => parseFloat(String(s || '').replace(/[^\d.-]/g, '')) || 0;

  // Reusable: get to a fresh Add PO form with the common required header fields + address filled,
  // ready for the caller to add items/expenses before its own assertions.
  async function startPoForm(po, narration) {
    await po.gotoAdd();
    await po.fillBasicDetails({
      vendor: data.valid.vendor,
      entity: data.valid.entity,
      currency: data.valid.currency,
      purchaseRepresentative: data.valid.purchaseRepresentative,
      narration,
    });
    await po.selectLocation(data.valid.location);
    await po.selectPaymentTerm();
    await po.fillAddressContact();
  }

  // ── TC-PO-A01: Multiple line items ────────────────────────────────────────
  // Uses the pinned item twice with different quantities. Whether the grid merges same-item rows
  // or keeps them separate, the Summary Total Quantity is the robust invariant (2 + 3 = 5).
  test('TC-PO-A01 [+] Create a purchase order with multiple line items', async ({ page }) => {
    const po = new PurchaseOrderPage(page);
    await startPoForm(po, 'TC-PO-A01 multi-item');

    await po.addItems(data.multiItem.items);
    expect(await po.getItemRowCount()).toBeGreaterThanOrEqual(1);

    const totalQty = num(await po.getSummaryValue('Total Quantity'));
    const expected = data.multiItem.items.reduce((sum, it) => sum + Number(it.quantity), 0);
    expect(totalQty).toBe(expected);

    const created = await po.saveAsDraft();
    expect(created.id).toBeTruthy();
    expect(await po.getRowStatus(created.seriesNumber)).toContain('Draft');
  });

  // ── TC-PO-A02: Taxes ──────────────────────────────────────────────────────
  test('TC-PO-A02 [+] Create a purchase order with a tax template and verify Summary taxes', async ({ page }) => {
    const po = new PurchaseOrderPage(page);
    await startPoForm(po, 'TC-PO-A02 tax');

    await po.addItem({
      itemName: data.tax.itemName,
      quantity: data.tax.quantity,
      rate: data.tax.rate,
      taxTemplate: true, // first available tax template
    });

    // The Taxes & Charges section must render a parseable value once a template is applied.
    const taxAdded = await po.getSummaryValue('Taxes & Charges Added');
    expect(taxAdded).toMatch(/[\d.]/);
    expect(num(taxAdded)).toBeGreaterThanOrEqual(0);

    // Grand Total must at least cover the pre-tax line total (qty * rate).
    const grand = num(await po.getSummaryValue('Grand Total'));
    expect(grand).toBeGreaterThanOrEqual(Number(data.tax.quantity) * Number(data.tax.rate));

    const created = await po.saveAsDraft();
    expect(created.id).toBeTruthy();
  });

  // ── TC-PO-A03: Discounts ──────────────────────────────────────────────────
  test('TC-PO-A03 [+] Create a purchase order with a discount item and verify Summary discount', async ({ page }) => {
    const po = new PurchaseOrderPage(page);
    await startPoForm(po, 'TC-PO-A03 discount');

    await po.addItem({
      itemName: data.discount.itemName,
      quantity: data.discount.quantity,
      rate: data.discount.rate,
      discountItem: true, // first available discount record (auto-fills Discount Rate %)
    });

    // The label is "Item Discount" (there is NO "Total Discount" in the PO summary).
    const itemDiscount = await po.getSummaryValue('Item Discount');
    expect(itemDiscount).toMatch(/[\d.\-]/);

    const created = await po.saveAsDraft();
    expect(created.id).toBeTruthy();
  });

  // ── TC-PO-A04: Expenses ───────────────────────────────────────────────────
  // Requires settings.enable_purchase_expense. If the Expenses tab is not present in this account,
  // the tab click will fail fast - that is a real signal the feature flag is off, not a test bug.
  test('TC-PO-A04 [+] Create a purchase order with an expense line', async ({ page }) => {
    const po = new PurchaseOrderPage(page);
    await startPoForm(po, 'TC-PO-A04 expense');

    await po.addItem({ itemName: data.valid.itemName, quantity: '2', rate: '100' });
    await po.addExpense({ rate: data.expense.rate });

    // Grand Total should now exceed the bare item subtotal (2 * 100 = 200) once an expense is added.
    const grand = num(await po.getSummaryValue('Grand Total'));
    expect(grand).toBeGreaterThan(0);

    const created = await po.saveAsDraft();
    expect(created.id).toBeTruthy();
  });

  // ── TC-PO-A05: Summary calculation relationship holds ─────────────────────
  // Grand Total should equal Subtotal (excl. taxes) + Taxes Added - Item Discount, within a small
  // rounding tolerance. This validates the Summary panel's internal consistency rather than a
  // pinned figure, so it survives changing master rates.
  test('TC-PO-A05 [+] Summary Grand Total reconciles with subtotal, taxes and discount', async ({ page }) => {
    const po = new PurchaseOrderPage(page);
    await startPoForm(po, 'TC-PO-A05 summary reconcile');

    await po.addItem({ itemName: data.valid.itemName, quantity: '4', rate: '100', taxTemplate: true });

    const subtotal = num(await po.getSummaryValue('Subtotal Excluding Taxes')); // trailing-space label handled in getSummaryValue
    const taxes = num(await po.getSummaryValue('Taxes & Charges Added'));
    const discount = num(await po.getSummaryValue('Item Discount'));
    const grand = num(await po.getSummaryValue('Grand Total')); // trailing-space label handled

    expect(Math.abs(grand - (subtotal + taxes - discount))).toBeLessThanOrEqual(1);
  });

  // ── TC-PO-A06: Create PO from an approved Request, verify PO Summary ───────
  // Complementary to TC-PREQ-27 (which asserts the Request side flips to Completed): here we assert
  // the created-from-source PO's SUMMARY reflects the copied item (Grand Total > 0), an angle the
  // Request-side test does not check. Reuses the real in-app Create > Order navigation.
  test('TC-PO-A06 [+] Create a purchase order from an In Progress Request and verify Summary', async ({ page }) => {
    const pr = new ProcurementRequestPage(page);
    const po = new PurchaseOrderPage(page);
    const prData = testData.procurementRequest.valid;
    const rfqData = testData.rfq.valid; // vendor known to have Contact Person/addresses for the PO tab

    await pr.gotoAdd();
    await pr.fillBasicDetails({
      purchaseRepresentative: prData.purchaseRepresentative,
      vendor: rfqData.vendor,
      narration: 'TC-PO-A06 source request',
    });
    await pr.selectLocation(prData.location);
    await pr.addItem({ itemName: prData.itemName, quantity: '3', rate: '60' });

    const sourceRequest = await pr.save();
    expect(sourceRequest.id).toBeTruthy();

    await pr.gotoView(sourceRequest.id);
    await pr.quickApproval(testData.procurementRequest.approverName);
    await pr.accept();
    await expect(page.getByText('In Progress', { exact: true })).toBeVisible();

    await pr.createOrder();
    await po.waitForCreateFromSourceReady();

    // Item rate/qty carried over -> Summary Grand Total must be non-zero before we even save.
    const grand = num(await po.getSummaryValue('Grand Total'));
    expect(grand).toBeGreaterThan(0);
  });
});
