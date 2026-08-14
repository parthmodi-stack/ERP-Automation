// erpforce-procure-to-pay.spec.js
// Automates: Purchase Request -> Purchase Order -> Approval -> GRN -> Trace Details -> Validate -> Purchase Invoice
//
// Follows the same self-contained, non-POM convention as the sibling erpforce-purchase-request.spec.js /
// erpforce-rfq-full-workflow.spec.js files (reuses their confirmed-live helpers and idioms), rather than
// the numbered tests/*.spec.js Page-Object-Model suite - this test does its own upstream Request
// create+approve via the shared helper so it can run standalone.

const { test, expect } = require('@playwright/test');
const { createAndApproveRequest } = require('./helpers/createApprovedPurchaseRequest');
const { selectDropdown } = require('../../helpers/dropdown');

const CONFIG = {
  baseUrl: 'https://dev.erpforce.co',
  approverName: 'Dipen Modi',
  lotSerialNumber: `LOT-${Date.now()}`,
  vendorInvoiceNo: `VEND-INV-${Date.now()}`,
};

// ---------- Shared helpers (copied from erpforce-purchase-request.spec.js / erpforce-rfq-full-workflow.spec.js -
// keep in sync if the app changes) ----------
async function pickFirstOption(page) {
  const options = page.getByRole('listbox').locator('[role="option"]:not([aria-disabled="true"])')
    .filter({ hasNot: page.locator('input') })
    .filter({ hasNotText: /Select|No data available|Create New/ });
  await options.first().waitFor({ state: 'visible', timeout: 10000 });
  await options.first().click();
}

async function closeAnyOpenPopover(page) {
  const openListbox = page.getByRole('listbox');
  if (await openListbox.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('body').click({ position: { x: 2, y: 2 }, force: true }).catch(() => {});
    await openListbox.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

async function waitVisibleWithReload(page, locator, { attempts = 4, perAttemptTimeout = 30000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    try {
      await locator.waitFor({ state: 'visible', timeout: perAttemptTimeout });
      return;
    } catch (e) {
      if (attempt === attempts) throw e;
      await page.reload({ timeout: 60000 }).catch(() => {});
    }
  }
}

// Opens the "Create"/"Submit"/"Accept" split-button's own menu (caret's accessible name is
// shared as "select merge strategy" across every approval-workflow module - confirmed live in
// createApprovedPurchaseRequest.js / erpforce-rfq-full-workflow.spec.js) and clicks a menuitem.
async function openSplitButtonMenuAndPick(page, menuItemNamePattern) {
  const caret = page.getByRole('button', { name: 'select merge strategy' });
  const menu = page.getByRole('menu');
  for (let attempt = 1; attempt <= 4; attempt++) {
    await caret.click();
    try {
      await menu.waitFor({ state: 'visible', timeout: 3000 });
      break;
    } catch (e) {
      if (attempt === 4) throw e;
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  await page.getByRole('menuitem', { name: menuItemNamePattern }).click();
}

// Structural label -> parent -> combobox resolver (same pattern used throughout the sibling
// erpforce-*.spec.js files and the pages/*.js Page Objects), since closed comboboxes here don't
// reliably carry their own "Search X" placeholder/accessible-name once pre-filled.
function comboboxByLabel(page, labelPattern, { exact = false } = {}) {
  return page.getByText(labelPattern, { exact }).first().locator('xpath=..').getByRole('combobox').first();
}

async function selectFirstIfEmpty(page, combobox, { alreadySelectedPattern = /^Search /i } = {}) {
  const currentText = ((await combobox.textContent().catch(() => '')) || '').replace(/[​﻿]/g, '').trim();
  if (currentText && !alreadySelectedPattern.test(currentText)) return; // pre-filled - nothing to do
  await closeAnyOpenPopover(page);
  await combobox.click();
  await page.waitForTimeout(600);
  await pickFirstOption(page);
}

test.describe('ERPForce: Purchase Request to Purchase Invoice (procure-to-pay)', () => {
  test('TC-P2P-01 [+] Full cycle: PR -> PO -> Approval -> GRN -> Trace -> Validate -> Purchase Invoice', { tag: '@smoke' }, async ({ page }) => {
    // Six confirmed-live sub-flows chained end to end on a genuinely slow shared dev environment -
    // same class of headroom bump as erpforce-rfq-full-workflow.spec.js's own test.setTimeout(600000).
    test.setTimeout(600000);

    // ---- Step 0: Create and approve an upstream Purchase Request (leaves the page on its View,
    // status "In Progress") ----
    const request = await createAndApproveRequest(page, { baseUrl: CONFIG.baseUrl });

    // ---- Step 1: Create -> Order from the Request's own Create split-button ----
    await openSplitButtonMenuAndPick(page, /^order$/i);
    await waitVisibleWithReload(page, page.getByRole('textbox', { name: 'Purchase Order ID' }));
    // The Purchase Order ID textbox rendering doesn't mean the rest of the form (Payment Terms/
    // Department's own async option fetches) has settled yet - wait for the page to actually
    // finish loading before touching any dropdown, or a click can land while its option list is
    // still empty/mid-fetch.
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // ---- Step 2: Payment Terms & Department (both may already be pre-filled from the Request) ----
    // CONFIRMED LIVE: Payment Terms master data can be genuinely EMPTY (not just slow to load) for
    // some vendor/currency combinations - "No data available" with only a "+ Create New Payment
    // Terms" footer option, same documented condition as
    // PurchaseInvoicePage.selectPaymentTerm's own create-fallback. A bare pick-first-option hangs
    // forever there, so reuse that same proven helpers/dropdown.js selectDropdown (allowCreateNew)
    // instead of assuming a real option always exists.
    async function fillPaymentTermsIfEmpty() {
      const combobox = comboboxByLabel(page, /^Payment\s+Terms/i);
      const currentText = ((await combobox.textContent().catch(() => '')) || '').replace(/[​﻿]/g, '').trim();
      if (currentText && !/^Search /i.test(currentText)) return; // already has a real value
      const newTermName = `Auto_Payment_Term_${Date.now()}`;
      await selectDropdown(page, combobox, newTermName, newTermName, {
        allowCreateNew: true,
        createNewFields: { due_date_based_on: "Day's after Invoice date", credit_days: '30' },
      });
    }

    await fillPaymentTermsIfEmpty();
    await comboboxByLabel(page, 'Department', { exact: true }).scrollIntoViewIfNeeded().catch(() => {});
    await selectFirstIfEmpty(page, comboboxByLabel(page, 'Department', { exact: true }));

    // ---- Step 3: Next -> Shipping Address ----
    // Every mandatory field on this tab must actually hold a value before Next is trusted to have
    // navigated - re-verify (not just re-click) whichever field still shows its inline "required"
    // error, using the SAME create-fallback-aware fill as above, not a bare pick-first-option that
    // would hang the same way on a still-empty Payment Terms list.
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.getByRole('button', { name: 'Next' }).click();
      await page.waitForTimeout(500);
      const paymentTermsError = page.getByText(/Payment term is requier(e)?d/i);
      const departmentError = page.getByText(/Department is requier(e)?d/i);
      if (await paymentTermsError.isVisible().catch(() => false)) {
        await fillPaymentTermsIfEmpty();
      } else if (await departmentError.isVisible().catch(() => false)) {
        await closeAnyOpenPopover(page);
        await comboboxByLabel(page, 'Department', { exact: true }).click();
        await page.waitForTimeout(600);
        await pickFirstOption(page);
      } else {
        break; // navigated past Basic Detail - no mandatory-field error visible
      }
    }
    const shipAddrTrigger = page.getByText('Search Shipping Address', { exact: true });
    if (await shipAddrTrigger.isVisible().catch(() => false)) {
      await shipAddrTrigger.click();
      await page.waitForTimeout(800);
      await pickFirstOption(page);
    } else {
      await selectFirstIfEmpty(page, comboboxByLabel(page, /Shipping\s+Address/i));
    }

    // ---- Step 4: Submit the order, capture its id from the list refetch ----
    const poListResponsePromise = page.waitForResponse((r) => r.url().includes('/purchase/v1/purchase-orders/?'), { timeout: 30000 });
    await page.getByRole('button', { name: /^Submit$/, exact: false }).first().click();
    const poListResponse = await poListResponsePromise;
    const createdPo = (await poListResponse.json()).data.purchase_orders[0];
    await page.goto(`${CONFIG.baseUrl}/dashboard/procurement/purchase-order/${createdPo.id}/view-purchase-order`, { timeout: 60000 });
    await waitVisibleWithReload(page, page.getByText(/^ID:/).first());

    // ---- Step 5: Verify Pending status ----
    await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible();

    // ---- Step 6: Submit dropdown -> Quick Approval ----
    const submitButton = page.getByRole('button', { name: 'Submit', exact: true });
    await submitButton.locator('xpath=following-sibling::button[1]').click();
    await page.getByText('Quick Approval', { exact: true }).click();

    // ---- Step 7: Select approver, send request ----
    const approvalModal = page.locator('[role="dialog"]').filter({ hasText: 'Quick Approval' });
    await closeAnyOpenPopover(page);
    await approvalModal.getByText('Select').click();
    await page.getByRole('listbox').getByRole('option', { name: new RegExp(CONFIG.approverName) }).first().click();
    await page.keyboard.press('Escape');
    await approvalModal.getByRole('button', { name: 'Send Request' }).click();
    await expect(page.getByText('Pending Approval')).toBeVisible();

    // ---- Step 8: Accept -> confirm Submit ----
    await openSplitButtonMenuAndPick(page, /^Accept$/);
    await page.getByRole('button', { name: 'Submit' }).click(); // confirmation dialog
    await expect(page.getByText('Approved', { exact: true })).toBeVisible();

    // ---- Step 9: Receive -> GRN ----
    await page.getByRole('button', { name: 'Receive', exact: true }).click();
    await waitVisibleWithReload(page, page.getByText('ID', { exact: true }).first());

    // ---- Step 10: Save GRN, then open its View page ----
    const grnResponsePromise = page.waitForResponse(
      (r) => /\/purchase-orders\/\d+\/grn(\/\d+)?(\?|$)/.test(r.url()) && ['POST', 'PUT'].includes(r.request().method()),
      { timeout: 20000 },
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const grnResponse = await grnResponsePromise;
    const grnBody = await grnResponse.json().catch(() => null);
    const grnData = grnBody && grnBody.data ? grnBody.data : grnBody;
    const grnRecord = (grnData && (grnData.grn || grnData.goods_receipt_note)) || grnData;
    const grnId = String(grnRecord.id);
    await page.goto(`${CONFIG.baseUrl}/dashboard/procurement/purchase-order/${createdPo.id}/grn/${grnId}/view-grn`, { timeout: 60000 });
    await waitVisibleWithReload(page, page.getByText(/^ID:/).first());

    // ---- Step 11: Open Trace Details for the first item row ----
    const itemRow = page.locator('table tbody tr').first();
    await itemRow.locator('button').last().click();
    const traceDialog = page.getByRole('dialog').filter({ hasText: 'Trace Details' });
    await traceDialog.waitFor({ state: 'visible', timeout: 10000 });

    // ---- Step 12: Add trace entry ----
    await traceDialog.getByRole('button', { name: 'Add', exact: true }).click();
    const traceAddModal = page.getByRole('dialog').filter({ has: page.getByPlaceholder('Select Lot/Serial number') });
    await traceAddModal.waitFor({ state: 'visible', timeout: 10000 });

    // ---- Step 13-14: Lot/Serial number + matching quantity, save the row, then submit ----
    // CONFIRMED LIVE: the isEditable() gate this used to have could read false right after the
    // modal opens (before the field finishes wiring up), silently skipping the fill and saving
    // the trace row with Quantity 0 - which then blocked Submit below with the row stuck open
    // instead of the dialog closing. Wait for the field itself, then always fill it with the same
    // quantity as the item (falling back to '10', this flow's own known request/PO quantity, if
    // the side-panel read comes back empty).
    const qtyText = await traceDialog.getByText('Quantity', { exact: true }).first()
      .locator('xpath=following::*[1]').textContent().catch(() => '');
    const itemQuantity = (qtyText || '').trim() || '10';

    await traceAddModal.getByPlaceholder('Select Lot/Serial number').fill(CONFIG.lotSerialNumber);
    await page.waitForTimeout(500);
    const traceQtyField = traceAddModal.getByPlaceholder('Enter Quantity');
    await traceQtyField.waitFor({ state: 'visible', timeout: 5000 });
    await traceQtyField.fill(itemQuantity);
    await traceAddModal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(traceAddModal).not.toBeVisible({ timeout: 10000 });

    await traceDialog.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(traceDialog).not.toBeVisible({ timeout: 15000 });

    // ---- Step 15: Validate ----
    await page.getByRole('button', { name: 'Validate', exact: true }).click();
    await expect(page.getByText('Validated', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    // ---- Step 16: Bill -> Purchase Invoice ----
    await page.getByRole('button', { name: 'Bill', exact: true }).click();
    await page.waitForURL('**/add-purchase-invoice', { timeout: 30000 });

    // ---- Step 17: Vendor Invoice No + Save ----
    // CONFIRMED LIVE: same stuck-on-its-own-bare-loading-spinner class of bug as
    // waitVisibleWithReload's other call sites in this file - a single networkidle wait can hang
    // well past a generous timeout while this form never actually renders, only a reload
    // recovers it.
    const vendorInvoiceInput = page.locator(
      '[name*="supplier_invoice_number"], [name*="vendor_invoice_no"], [placeholder*="Invoice No"]',
    ).first();
    await waitVisibleWithReload(page, vendorInvoiceInput);
    await vendorInvoiceInput.fill(CONFIG.vendorInvoiceNo);
    await page.getByRole('button', { name: /^Save$/i }).last().click();

    // CONFIRMED LIVE: same "Save redirects to the plain LIST, not the record's own view page"
    // pattern as the Request/Order saves above - the vendor invoice number isn't one of the
    // list's own visible columns, so open the newest row (this dev env's list sorts newest-first)
    // rather than assert on the list page itself.
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.locator('tbody tr').first().getByRole('link').first().click();
    await expect(page.getByText(CONFIG.vendorInvoiceNo).first()).toBeVisible({ timeout: 20000 });
  });
});
