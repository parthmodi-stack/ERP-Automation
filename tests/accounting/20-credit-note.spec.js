const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const CreditNotePage = require('../../pages/accounting/CreditNotePage');
const SalesInvoicePage = require('../../pages/accounting/SalesInvoicePage');

// =============================================================================
// Credit Note - single-file coverage
// =============================================================================
//
// Credit Note (Accounting > Credits > Credit Note) is the Sales-side mirror of Debit Note (see
// DebitNotePage.js / 19-debit-note.spec.js): raised against a Customer (or Vendor), either
// standalone or tied to an existing approved Sales Invoice:
//
//   TC-CN-LIST-01  Listing page loads with expected Add control
//   TC-CN-ADD-01   Add form required-field validation
//   TC-CN-CRUD-01  Create a Credit Note from the listing page for a Customer party
//   TC-CN-CRUD-02  Create a Credit Note WITHOUT an invoice, submit for approval and accept
//   TC-CN-CRUD-03  Create a Credit Note USING an invoice - checks for an approved Sales Invoice
//                  for the customer first, creating and approving one if none exists

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
  // Same quirk confirmed for Debit Note - the button surface doesn't reactively swap from
  // "Submit" to "Accept" after Send Request without a reload; Credit Note shares the same
  // Add/View form scaffolding, so applying the same defensive reload here too.
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
 * "No data available". The placeholder slot's own text is zero-width space characters
 * (invisible, but not matched by regex `\s` or `.trim()`) - see 19-debit-note.spec.js's own
 * isRealOption for the same fix.
 */
const ZERO_WIDTH_CHARS = /[​‌‍﻿]/g;
function isRealOption(text) {
  const cleaned = text.replace(ZERO_WIDTH_CHARS, '').trim();
  return cleaned.length > 0 && !/no data available|^select\b/i.test(cleaned);
}

/**
 * Checks whether the given customer already has at least one invoice available in the Credit
 * Note Add form's own "Invoice" dropdown (which only ever lists that customer's own APPROVED
 * Sales Invoices - same MULTI-select behavior confirmed for Debit Note's "Bills" field), and
 * selects the first real one if so. If none exist, creates and approves a fresh Sales Invoice
 * for that exact customer name via SalesInvoicePage, then re-opens the Credit Note Add form and
 * selects the newly-approved invoice.
 * @returns {Promise<{cn: CreditNotePage, actualCustomer: string}>}
 */
async function ensureCreditNoteFormHasInvoice(page, customerName) {
  const cn = new CreditNotePage(page);
  await cn.openAdd();
  await cn.selectPartyType('Customer');
  await cn.selectPartyName(customerName);
  const actualCustomer = (await cn.headerSelectTrigger('party_id').textContent())?.trim();

  // "Invoice" is a MULTI-select (same as Debit Note's own "Bills") - clicking an option does NOT
  // auto-close the menu, so an explicit Escape is required afterward.
  const invoiceTrigger = cn.headerSelectTrigger('invoice_id');
  await invoiceTrigger.click();
  await page.waitForTimeout(800);
  const invoiceOptions = await page.getByRole('option').allTextContents();
  const realInvoiceOption = invoiceOptions.find(isRealOption);

  if (realInvoiceOption) {
    await page.getByRole('option', { name: realInvoiceOption, exact: true }).click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    return { cn, actualCustomer };
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // No approved invoice for this customer yet - create and approve one via Sales Invoice.
  const si = new SalesInvoicePage(page);
  const siData = testData.accounting.salesInvoice;
  const { actualCustomer: siCustomer } = await si.createItemInvoice(
    { customer: actualCustomer, currency: siData.currency, paymentTerm: siData.paymentTerm, accountReceivable: siData.accountReceivable },
    [{ item: siData.item.dropdownOption, quantity: siData.item.quantity, rate: siData.item.rate, taxCode: siData.item.taxCode }]
  );
  const invoice = await si.saveAndCaptureId('Save');
  await si.gotoView(invoice.id);
  await expect(page.getByRole('button', { name: /^Submit$/i })).toBeVisible({ timeout: 10000 });
  await quickApprove(page);
  await expect(si.approvalStatusChipOnView()).toHaveText(/Approved/i, { timeout: 15000 });

  // Re-open a fresh Credit Note Add form now that the invoice is approved, and select it.
  const cn2 = new CreditNotePage(page);
  await cn2.openAdd();
  await cn2.selectPartyType('Customer');
  await cn2.selectPartyName(siCustomer || actualCustomer);
  const actualCustomer2 = (await cn2.headerSelectTrigger('party_id').textContent())?.trim();

  const invoiceTrigger2 = cn2.headerSelectTrigger('invoice_id');
  await invoiceTrigger2.click();
  await page.waitForTimeout(800);
  const invoiceOptions2 = await page.getByRole('option').allTextContents();
  const realInvoiceOption2 = invoiceOptions2.find(isRealOption);
  if (!realInvoiceOption2) {
    throw new Error(`ensureCreditNoteFormHasInvoice: still no real Invoice option for ${actualCustomer2} after approving a Sales Invoice (got: ${JSON.stringify(invoiceOptions2)})`);
  }
  await page.getByRole('option', { name: realInvoiceOption2, exact: true }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  return { cn: cn2, actualCustomer: actualCustomer2 };
}

test.describe('Credit Note Management', () => {
  test('TC-CN-LIST-01 [+] Listing page loads with expected Add control', { tag: '@smoke' }, async ({ page }) => {
    const cn = new CreditNotePage(page);
    await cn.gotoList();

    // Scoped to <main> - same reasoning as Debit Note's own TC-DN-LIST-01: a plain
    // page.getByText('Credit Note') also matches hidden nav sidebar entries.
    await expect(page.locator('main').getByText('Credit Note', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(cn.addButton).toBeVisible();
  });

  test('TC-CN-ADD-01 [-] Add form blocks Save with required fields blank', async ({ page }) => {
    const cn = new CreditNotePage(page);
    await cn.openAdd();

    await cn.save();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/add-credit-note/);
  });
});

test.describe('Credit Note - CRUD', () => {
  const data = testData.accounting.creditNote;

  test('TC-CN-CRUD-01 [+] Create a Credit Note from the listing page for a Customer party', { tag: '@smoke' }, async ({ page }) => {
    test.setTimeout(90000);
    const cn = new CreditNotePage(page);

    // "Amount" is a disabled field - it auto-fills once an item entry is added, not directly
    // editable (see CreditNotePage.fillAmount's comment).
    const { actualPartyName } = await cn.createCreditNote(
      {
        partyType:   'Customer',
        partyName:   data.customer,
        journalType: data.journalType,
        currency:    data.currency,
        reference:   data.reference,
      },
      [{ item: data.item.dropdownOption, quantity: data.item.quantity, rate: data.item.rate, taxTemplate: data.item.taxCode }]
    );
    expect(actualPartyName).toBeTruthy();

    await cn.save();
    await page.waitForURL(cn.listPath, { timeout: 20000 });
    await waitForIdle(page);

    await cn.openNewestRow();
    await expect(page.getByText(actualPartyName).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-CN-CRUD-02 [+] Create a Credit Note WITHOUT an invoice, submit for approval and accept', async ({ page }) => {
    test.setTimeout(120000);
    const cn = new CreditNotePage(page);

    const { actualPartyName } = await cn.createCreditNote(
      {
        partyType:   'Customer',
        partyName:   data.customer,
        journalType: data.journalType,
        currency:    data.currency,
        reference:   `${data.reference}-NOINVOICE`,
      },
      [{ item: data.item.dropdownOption, quantity: data.item.quantity, rate: data.item.rate, taxTemplate: data.item.taxCode }]
    );
    expect(actualPartyName).toBeTruthy();

    await cn.save();
    await page.waitForURL(cn.listPath, { timeout: 20000 });
    await waitForIdle(page);

    await cn.openNewestRow();
    await expect(page.getByRole('button', { name: /^Submit$/i })).toBeVisible({ timeout: 10000 });
    await quickApprove(page);

    await expect(cn.approvalStatusChipOnView()).toHaveText(/Approved/i, { timeout: 15000 });
  });

  test('TC-CN-CRUD-03 [+] Create a Credit Note USING an invoice (creating and approving one first if the customer has none)', async ({ page }) => {
    test.setTimeout(150000);

    const { cn, actualCustomer } = await ensureCreditNoteFormHasInvoice(page, data.customer);

    await cn.selectJournalType(data.journalType);
    await cn.selectCurrencyIfNeeded(data.currency);
    await cn.fillReference(`${data.reference}-WITHINVOICE`);
    // Selecting an Invoice only links it for reference - same as Debit Note's own Bill field, it
    // does NOT itself populate the Credit Note's own Amount, which stays $0.00 (and blocks Save)
    // without an item entry, same as the without-invoice case in TC-CN-CRUD-02.
    await cn.addItemEntry({ item: data.item.dropdownOption, quantity: data.item.quantity, rate: data.item.rate, taxTemplate: data.item.taxCode });

    await cn.save();
    await page.waitForURL(cn.listPath, { timeout: 20000 });
    await waitForIdle(page);

    await cn.openNewestRow();
    await expect(page.getByText(actualCustomer).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /^Submit$/i })).toBeVisible({ timeout: 10000 });
    await quickApprove(page);

    await expect(cn.approvalStatusChipOnView()).toHaveText(/Approved/i, { timeout: 15000 });
  });
});
