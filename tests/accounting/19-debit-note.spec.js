const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const DebitNotePage = require('../../pages/accounting/DebitNotePage');
const PurchaseInvoicePage = require('../../pages/accounting/PurchaseInvoicePage');

// =============================================================================
// Debit Note - single-file coverage
// =============================================================================
//
// Debit Note (Accounting > Credits > Debit Note) is raised against a Vendor (or Customer),
// either standalone or tied to an existing approved Purchase Invoice (bill):
//
//   TC-DN-LIST-01  Listing page loads with expected Add control
//   TC-DN-ADD-01   Add form required-field validation
//   TC-DN-CRUD-01  Create a Debit Note from the listing page for a Vendor party
//   TC-DN-CRUD-02  Create a Debit Note WITHOUT a bill, submit for approval and accept
//   TC-DN-CRUD-03  Create a Debit Note USING a bill - checks for an approved Purchase Invoice
//                  for the vendor first, creating and approving one if none exists

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

/** Sends a Quick Approval request to the current test user, then Accepts it - same ApprovalWrapper component shared by every document module in this suite. */
async function quickApprove(page, approverName = testData.accounting.paymentEntry.approverName) {
  const splitMenuTrigger = page.getByRole('button', { name: /select merge strategy/i });
  await expect(splitMenuTrigger).toBeVisible({ timeout: 10000 });
  await splitMenuTrigger.click();
  await page.getByRole('menuitem', { name: /Quick Approval/i }).click();

  const approvalDialog = page.getByRole('dialog');
  await expect(approvalDialog).toBeVisible({ timeout: 15000 });
  const approverSelect = approvalDialog.getByRole('combobox').first();
  await approverSelect.click();
  await page.getByRole('option', { name: approverName, exact: false }).click();
  await page.keyboard.press('Escape');
  await approvalDialog.getByRole('button', { name: /Send Request/i }).click();
  await waitForIdle(page, 1000);

  const acceptBtn = page.getByRole('button', { name: /^Accept$/i });
  // Confirmed live for Debit Note: unlike every other document module in this suite, the button
  // surface does not reactively swap from "Submit" to "Accept" after Send Request without a
  // reload - a plain page.reload() forces it to re-fetch and show the real current state.
  if (!(await acceptBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    await page.reload();
    await waitForIdle(page, 1000);
  }
  await expect(acceptBtn).toBeVisible({ timeout: 15000 });
  await acceptBtn.click();
  const acceptDialog = page.getByRole('dialog');
  await expect(acceptDialog).toBeVisible({ timeout: 10000 });
  await acceptDialog.getByRole('button', { name: /Submit/i }).click();
  await waitForIdle(page, 1500);
}

/**
 * Real, selectable options exclude the empty placeholder slot, "Select ..." prompt, and
 * "No data available". The placeholder slot's own text isn't plain whitespace - confirmed live
 * it's zero-width space characters (invisible, but not matched by regex `\s` or `.trim()`), which
 * silently passed the original `/^\s*$/` check and got treated as a "real" bill option - strip
 * those characters first so the placeholder is correctly excluded.
 */
const ZERO_WIDTH_CHARS = /[​‌‍﻿]/g;
function isRealOption(text) {
  const cleaned = text.replace(ZERO_WIDTH_CHARS, '').trim();
  return cleaned.length > 0 && !/no data available|^select\b/i.test(cleaned);
}

/**
 * Checks whether the given vendor already has at least one bill available in the Debit Note
 * Add form's own "Bills" dropdown (which only ever lists that vendor's APPROVED Purchase
 * Invoices - confirmed live), and selects the first real one if so. If none exist, creates and
 * approves a fresh Purchase Invoice for that exact vendor name via PurchaseInvoicePage, then
 * re-opens the Debit Note Add form and selects the newly-approved bill.
 * @returns {Promise<{dn: DebitNotePage, actualVendor: string}>}
 */
async function ensureDebitNoteFormHasBill(page, vendorName) {
  const dn = new DebitNotePage(page);
  await dn.openAdd();
  await dn.selectPartyType('Vendor');
  await dn.selectPartyName(vendorName);
  const actualVendor = (await dn.headerSelectTrigger('party_id').textContent())?.trim();

  // "Bills" is a MULTI-select (confirmed live: MuiSelect-multiple) - unlike every other header
  // dropdown in this suite, clicking an option does NOT auto-close the menu, so an explicit
  // Escape is required afterward or the next dropdown's click gets intercepted by its backdrop.
  const billTrigger = dn.headerSelectTrigger('invoice_id');
  await billTrigger.click();
  await page.waitForTimeout(800);
  const billOptions = await page.getByRole('option').allTextContents();
  const realBillOption = billOptions.find(isRealOption);

  if (realBillOption) {
    await page.getByRole('option', { name: realBillOption, exact: true }).click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    return { dn, actualVendor };
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // No approved bill for this vendor yet - create and approve one via Purchase Invoice.
  const pi = new PurchaseInvoicePage(page);
  const piData = testData.accounting.purchaseInvoice;
  const { actualVendor: piVendor } = await pi.createItemInvoice(
    {
      vendor:          actualVendor,
      currency:        piData.currency,
      paymentTerm:     piData.paymentTerm,
      vendorInvoiceNo: `${piData.valid.vendorInvoiceNo}_DN`,
      shippingAddress: piData.shippingAddress,
    },
    [{ item: piData.item.dropdownOption, quantity: piData.item.quantity, rate: piData.item.rate, taxTemplate: piData.item.taxTemplate }]
  );
  await pi.save();
  await page.waitForURL(pi.listPath, { timeout: 20000 });
  await waitForIdle(page);
  await pi.openNewestRow();
  await expect(page.getByRole('button', { name: /^Submit$/i })).toBeVisible({ timeout: 10000 });
  await quickApprove(page);
  await expect(pi.approvalStatusChipOnView()).toHaveText(/Approved/i, { timeout: 15000 });

  // Re-open a fresh Debit Note Add form now that the bill is approved, and select it.
  const dn2 = new DebitNotePage(page);
  await dn2.openAdd();
  await dn2.selectPartyType('Vendor');
  await dn2.selectPartyName(piVendor || actualVendor);
  const actualVendor2 = (await dn2.headerSelectTrigger('party_id').textContent())?.trim();

  const billTrigger2 = dn2.headerSelectTrigger('invoice_id');
  await billTrigger2.click();
  await page.waitForTimeout(800);
  const billOptions2 = await page.getByRole('option').allTextContents();
  const realBillOption2 = billOptions2.find(isRealOption);
  if (!realBillOption2) {
    throw new Error(`ensureDebitNoteFormHasBill: still no real Bills option for ${actualVendor2} after approving a Purchase Invoice (got: ${JSON.stringify(billOptions2)})`);
  }
  await page.getByRole('option', { name: realBillOption2, exact: true }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  return { dn: dn2, actualVendor: actualVendor2 };
}

test.describe('Debit Note Management', () => {
  test('TC-DN-LIST-01 [+] Listing page loads with expected Add control', async ({ page }) => {
    const dn = new DebitNotePage(page);
    await dn.gotoList();

    // Not page.getByText('Debit Note').first() - confirmed live it matches 20+ hidden nav
    // sidebar entries with the exact same text before the visible page heading; scoped to
    // <main> to only match the real, visible heading.
    await expect(page.locator('main').getByText('Debit Note', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(dn.addButton).toBeVisible();
  });

  test('TC-DN-ADD-01 [-] Add form blocks Save with required fields blank', async ({ page }) => {
    const dn = new DebitNotePage(page);
    await dn.openAdd();

    await dn.save();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/add-debit-note/);
  });
});

test.describe('Debit Note - CRUD', () => {
  const data = testData.accounting.debitNote;

  test('TC-DN-CRUD-01 [+] Create a Debit Note from the listing page for a Vendor party', async ({ page }) => {
    test.setTimeout(90000);
    const dn = new DebitNotePage(page);

    // "Amount" is a disabled field - it auto-fills once an item entry is added, not directly
    // editable (see DebitNotePage.fillAmount's comment).
    const { actualPartyName } = await dn.createDebitNote(
      {
        partyType:   'Vendor',
        partyName:   data.vendor,
        journalType: data.journalType,
        currency:    data.currency,
        reference:   data.reference,
      },
      [{ item: data.item.dropdownOption, quantity: data.item.quantity, rate: data.item.rate, taxTemplate: data.item.taxTemplate }]
    );
    expect(actualPartyName).toBeTruthy();

    await dn.save();
    await page.waitForURL(dn.listPath, { timeout: 20000 });
    await waitForIdle(page);

    await dn.openNewestRow();
    await expect(page.getByText(actualPartyName).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-DN-CRUD-02 [+] Create a Debit Note WITHOUT a bill, submit for approval and accept', async ({ page }) => {
    test.setTimeout(120000);
    const dn = new DebitNotePage(page);

    const { actualPartyName } = await dn.createDebitNote(
      {
        partyType:   'Vendor',
        partyName:   data.vendor,
        journalType: data.journalType,
        currency:    data.currency,
        reference:   `${data.reference}-NOBILL`,
      },
      [{ item: data.item.dropdownOption, quantity: data.item.quantity, rate: data.item.rate, taxTemplate: data.item.taxTemplate }]
    );
    expect(actualPartyName).toBeTruthy();

    await dn.save();
    await page.waitForURL(dn.listPath, { timeout: 20000 });
    await waitForIdle(page);

    await dn.openNewestRow();
    await expect(page.getByRole('button', { name: /^Submit$/i })).toBeVisible({ timeout: 10000 });
    await quickApprove(page);

    await expect(dn.approvalStatusChipOnView()).toHaveText(/Approved/i, { timeout: 15000 });
  });

  test('TC-DN-CRUD-03 [+] Create a Debit Note USING a bill (creating and approving one first if the vendor has none)', async ({ page }) => {
    test.setTimeout(150000);

    const { dn, actualVendor } = await ensureDebitNoteFormHasBill(page, data.vendor);

    await dn.selectJournalType(data.journalType);
    await dn.selectCurrencyIfNeeded(data.currency);
    await dn.fillReference(`${data.reference}-WITHBILL`);
    // Selecting a Bill only links it for reference - confirmed live it does NOT itself populate
    // the Debit Note's own Amount, which stays $0.00 (and blocks Save) without an item entry,
    // same as the without-bill case in TC-DN-CRUD-02.
    await dn.addItemEntry({ item: data.item.dropdownOption, quantity: data.item.quantity, rate: data.item.rate, taxTemplate: data.item.taxTemplate });

    await dn.save();
    await page.waitForURL(dn.listPath, { timeout: 20000 });
    await waitForIdle(page);

    await dn.openNewestRow();
    await expect(page.getByText(actualVendor).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /^Submit$/i })).toBeVisible({ timeout: 10000 });
    await quickApprove(page);

    await expect(dn.approvalStatusChipOnView()).toHaveText(/Approved/i, { timeout: 15000 });
  });
});
