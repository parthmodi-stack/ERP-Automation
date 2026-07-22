const AccountingDocumentPage = require('../base/AccountingDocumentPage');

/**
 * Collection Entry (Sales-side mirror of PaymentEntryPage.js - money coming IN from a Customer,
 * as opposed to Payment Entry's money going OUT to a Vendor).
 * Source: erpforce-fe modules/accounting/src/views/payment-entry/collection/*
 * Routes confirmed against the running app (reached via a Sales Invoice's Actions -> "Collection
 * Entry" menu item, enabled only once Approved and not yet fully Paid):
 *   list  /dashboard/accounting/payment-entry/collection
 *   add   /dashboard/accounting/payment-entry/collection/add-collection-entry
 *
 * Confirmed against the running app:
 * - Same `type` radio group as Payment Entry (Cash/Bank/Cheque, no `name` attribute worth relying
 *   on - plain React state). Unlike Payment Entry, only "Bank" renders a `bank_account_bank`
 *   SELECT field - "Cheque" has NO bank_account select at all, just its own free-text "Cheque
 *   Bank" (`cheque_bank`) field in the Cheque Details section (see create()'s bankAccount
 *   handling, gated to `type === 'Bank'` only).
 * - Header fields: party_type, entry_id (the Customer), date, company, reference_number,
 *   currency, amount, exchange_rate, narration, location, department, bank_account_bank (Bank
 *   type only), cheque_number/cheque_date/cheque_bank (Cheque type only).
 * - Reached FROM a specific Sales Invoice, the form auto-links invoices in an "Invoice Entries"
 *   table - confirmed live this table lists EVERY outstanding invoice for that customer (not just
 *   the one the Collection Entry was opened from), pre-populated with each one's own series
 *   number, due date, invoice/paid/due amounts. This is the "auto fill invoice" behavior
 *   referenced when this module is built, unlike Payment Entry's own is_advance-checkbox-skips-
 *   bill-selection flow. This suite only applies payment against the ONE row matching our own
 *   invoice's own series number (see applyToInvoiceRow()) - every other row is left untouched, so
 *   the shared environment's other outstanding invoices don't get marked Paid as a side effect of
 *   this test.
 * - Each Invoice Entries row has a pencil (Edit) icon that opens a small dialog (field-array
 *   prefix `sales_invoice`) with invoice_id, invoice_amount, amount_paid, amount_due,
 *   discount_applied, payment_amount (the one to fill), discount_percentage, actual_amount -
 *   merely checking the row's own "select" checkbox does NOT by itself populate any amount.
 */
class CollectionPage extends AccountingDocumentPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_collection_entry',
      listPath: '/dashboard/accounting/payment-entry/collection',
      addPath: '/dashboard/accounting/payment-entry/collection/add-collection-entry',
      statusCssSlug: 'collectionEntry',
    });

    this.isAdvanceCheckbox = this.page.locator('.PrivateSwitchBase-input[type="checkbox"]').first();
  }

  /** Same accessible-name-ambiguity reasoning as PaymentEntryPage.setPaymentType - target the radio input directly. */
  async setPaymentType(type) {
    if (type === 'Cash') return;
    await this.page.locator(`input[type="radio"][value="${type}"]`).check({ force: true });
  }

  async selectPartyType(type) {
    await this.selectField('party_type', type);
  }

  /** Same partial-search-then-exact-match convention as PaymentEntryPage.selectParty. */
  async selectParty(name) {
    await this.selectField('entry_id', name.trim().split(/\s+/)[0], name);
  }

  async selectCurrency(name) {
    await this.selectField('currency', name);
  }

  async selectBankAccount(type, searchText, optionText = searchText) {
    await this.selectField(`bank_account_${type.toLowerCase()}`, searchText, optionText);
  }

  async setAdvance(checked) {
    if ((await this.isAdvanceCheckbox.isChecked()) !== checked) {
      await this.isAdvanceCheckbox.click();
    }
  }

  /** Opens the newest (list is sorted newest-first) row's View page - same pattern as SalesInvoicePage.openNewestRow. */
  async openNewestRow() {
    await this.gotoList();
    await this.page.waitForTimeout(500);
    const firstRow = this.page.locator('table tbody tr').first();
    await firstRow.waitFor({ state: 'visible', timeout: 10000 });
    await firstRow.locator('a').first().click();
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(800);
  }

  /**
   * Opens the ONE Invoice Entries row matching `invoiceSeriesNumber` (e.g. "INV-2026-000014") via
   * its pencil/Edit icon, fills that row's own `payment_amount`, saves that row's own small
   * dialog, and checks the row's own selection checkbox - every other row in the table (this
   * customer's other outstanding invoices) is left untouched. Call this BEFORE filling the
   * header's own `amount` field (the two are independent inputs).
   * Presses Tab (blurs) after filling `payment_amount` and settle-waits before saving the dialog:
   * confirmed live (same debounced-computed-total pattern this suite already documents for line
   * items elsewhere - see DEFAULT_TEST_CASES.md) that a plain `.fill()` sets the DOM value but
   * does NOT trigger this dialog's own `amount_due` recalculation - in the real app, typing a
   * Payment Amount drops Amount Due to the remainder; without the blur+settle wait, Amount Due
   * never recomputes and the whole Collection Entry then fails to save with a generic "The amount
   * must be greater than zero." toast, because the app never registers the row as actually paid.
   * The checkbox step is separately required too: filling payment_amount without checking the
   * row's own checkbox also leaves it uncounted.
   * Scoped to the table whose own column header is "Invoice Number": confirmed live the page also
   * renders a separate (usually empty) "Debit Note" Note Entries table further down, and a plain
   * `table tbody tr` locator would match both.
   */
  async applyToInvoiceRow(invoiceSeriesNumber, paymentAmount) {
    const invoiceTable = this.page.locator('table').filter({ has: this.page.getByRole('columnheader', { name: /Invoice Number/i }) });
    const row = invoiceTable.locator('tbody tr').filter({ hasText: invoiceSeriesNumber }).first();
    await row.waitFor({ state: 'visible', timeout: 15000 });
    await row.locator('button').first().click();
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    const paymentAmountField = dialog.locator('[name="sales_invoice.payment_amount"]');
    await paymentAmountField.fill(String(paymentAmount));
    await paymentAmountField.press('Tab');
    await this.page.waitForTimeout(800);
    await dialog.getByRole('button', { name: /^Save$/i }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 10000 });
    await this.page.waitForTimeout(500);
    const checkbox = row.locator('input[type="checkbox"]');
    if (!(await checkbox.isChecked())) await checkbox.check();
  }

  /**
   * @param {{type?: 'Cash'|'Bank'|'Cheque', partyType?: string, party?: string, currency?: string,
   *   amount?: string|number, narration?: string, bankAccount?: string, chequeNumber?: string,
   *   chequeDate?: string, chequeBank?: string, advance?: boolean, invoiceSeriesNumber?: string,
   *   invoicePaymentAmount?: string|number}} data
   */
  async create({
    type = 'Cash',
    partyType,
    party,
    currency,
    amount,
    narration,
    bankAccount,
    chequeNumber,
    chequeDate,
    chequeBank,
    advance,
    invoiceSeriesNumber,
    invoicePaymentAmount,
    ...rest
  }) {
    await this.setPaymentType(type);
    if (partyType) await this.selectPartyType(partyType);
    if (party) await this.selectParty(party);
    if (currency) await this.selectCurrency(currency);
    // Applying to the pre-linked invoice row BEFORE filling the header amount - the row's own
    // dialog is independent of the header field, confirmed live (see applyToInvoiceRow's comment).
    if (invoiceSeriesNumber && invoicePaymentAmount !== undefined) {
      await this.applyToInvoiceRow(invoiceSeriesNumber, invoicePaymentAmount);
    }
    if (amount !== undefined) await this.fillField('amount', amount);
    if (narration !== undefined) await this.fillField('narration', narration);
    // Confirmed live: only "Bank" renders a bank_account_bank SELECT field - "Cheque" has no such
    // dropdown at all, just its own free-text "Cheque Bank" (cheque_bank) field below.
    if (bankAccount && type === 'Bank') await this.selectBankAccount(type, bankAccount);
    if (type === 'Cheque') {
      if (chequeNumber !== undefined) await this.fillField('cheque_number', chequeNumber);
      if (chequeDate !== undefined) await this.fillField('cheque_date', chequeDate);
      if (chequeBank !== undefined) await this.fillField('cheque_bank', chequeBank);
    }
    await this.fillForm(rest);
    if (advance !== undefined) await this.setAdvance(advance);
  }
}

module.exports = CollectionPage;
