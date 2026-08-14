const AccountingDocumentPage = require('../base/AccountingDocumentPage');

/**
 * Payment Entry (Payment sub-type only - not Collection).
 * Source: erpforce-fe modules/accounting/src/views/payment-entry/payment/*
 * Routes: pathname.accounting.ts PATHNAME_PAYMENT_ENTRY.{PAYMENT,ADD_PAYMENT_ENTRY,
 * EDIT_PAYMENT_ENTRY,VIEW_PAYMENT_ENTRY}
 *
 * Confirmed against the running app:
 * - The payment method is a `type` radio group (Cash/Bank/Cheque), not a FormParser select -
 *   plain <FormControlLabel> radios with labels "Cash"/"Bank"/"Cheque", no `name` attribute
 *   worth relying on (React state, not react-hook-form registration for the group itself).
 *   Changing it renames the bank-account field to bank_account_cash/bank_account_bank/
 *   bank_account_cheque and, for Cheque, adds cheque_number/cheque_date/cheque_bank.
 * - Header fields: party_type, entry_id (the party itself), date, company, reference_number,
 *   currency, amount, exchange_rate, narration, location, department, plus the type-specific
 *   bank_account_<type> and (Cheque only) cheque_number/cheque_date/cheque_bank.
 * - Saving requires at least one selected row in the "Bill Entries"/"Credit Note" tables UNLESS
 *   the "Is Advance" checkbox is checked, in which case bill allocation is skipped entirely.
 *   That checkbox has no name/aria-label; it is reliably the first plain (non-radio)
 *   `.PrivateSwitchBase-input[type="checkbox"]` on the page - the Bill/Credit-Note tables' row
 *   and "select all" checkboxes always render further down the form, after it.
 * - CONFIRMED BUG: creating a Bank-type payment fails server-side with
 *   "Unknown column 'bank_account_bank' in 'field list'" - the frontend sends a column name the
 *   backend schema doesn't have. Cash and Cheque both save successfully. See
 *   ACCOUNTING_FINDINGS.md.
 * - Row menu (hover-revealed, via the shared base class): View, Edit, Duplicate,
 *   Submit for Approval, Delete.
 * - The list DOES have a real Filter modal (Filters / Saved Filters / Add Filter / Add Group /
 *   Clear all filters / Cancel / Apply, built on react-querybuilder) - unlike Chart of
 *   Accounts, which has none. There is no visible Export button for this admin test account
 *   (no ExportIcon/ImportIcon in the ActionBar, only Search/Filter/Add) - either this account
 *   lacks the `generateexcel` permission for Payment Entries specifically, or export isn't
 *   wired up for this screen; see ACCOUNTING_FINDINGS.md.
 */
class PaymentEntryPage extends AccountingDocumentPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_payment_entry',
      listPath: '/dashboard/accounting/payment-entry/payment',
      addPath: '/dashboard/accounting/payment-entry/payment/add-payment-entry',
      statusCssSlug: 'paymentEntry',
    });

    this.filterTrigger = page.locator('.action-bar--RightContent svg[data-testid="FilterIcon"]');
    // Confirmed live: after the "Approval Status" value editor's own MUI multi-select
    // popover has been opened and closed once, Chromium's accessibility tree stops exposing this
    // dialog through getByRole('dialog') for the rest of the test - the element is still in the
    // DOM, still visible, still has role="dialog" as a raw attribute (confirmed via
    // elementFromPoint and a plain attribute selector, neither of which go through the
    // accessibility tree), it's just no longer resolvable via Playwright's ARIA-tree-based
    // getByRole query. A raw attribute selector sidesteps this entirely.
    this.filterDialog = page.locator('[role="dialog"]').filter({ hasText: 'Filters' });
    this.addFilterButton = this.filterDialog.getByText('Add Filter', { exact: true });
    this.addFilterGroupButton = this.filterDialog.getByText('Add Group', { exact: true });
    this.clearAllFiltersButton = this.filterDialog.getByText('Clear all filters', { exact: true });
    // CSS/text-based, not getByRole - confirmed live that after the value editor's own MUI
    // multi-select popover has opened and closed once, getByRole queries stop resolving *any*
    // element within this whole dialog subtree (not just the dialog root itself - its buttons
    // too), even though they're still in the DOM, visible, and receive real clicks. A plain
    // element/text-based locator never goes through the accessibility tree, so it isn't affected.
    this.applyFilterButton = this.filterDialog.locator('button').filter({ hasText: 'Apply' });
    this.cancelFilterButton = this.filterDialog.locator('button').filter({ hasText: 'Cancel' });
    this.filterFieldTrigger = this.filterDialog.locator('[testid="fields"] [role="combobox"]');

    this.exportTrigger = page.locator('.action-bar--RightContent svg[data-testid="ExportIcon"]');
    this.isAdvanceCheckbox = page.locator('.PrivateSwitchBase-input[type="checkbox"]').first();
  }

  /**
   * Targets the radio <input> directly rather than its visible label text: a bare
   * getByText('Bank'/'Cheque') can ambiguously match leftover list-page row links (e.g. a
   * "Bank"-type row's Type cell) if this runs right after a client-side route change from the
   * list to the Add form, before React has fully swapped the DOM - confirmed against the
   * running app.
   */
  async setPaymentType(type) {
    if (type === 'Cash') return; // default, nothing to click
    await this.page.locator(`input[type="radio"][value="${type}"]`).check({ force: true });
  }

  async selectPartyType(type) {
    await this.selectField('party_type', type);
  }

  /**
   * Searches by the name's first word only, then exact-matches the full name for the click.
   * Confirmed against the running app: the party search API returns "No data available" for a
   * full multi-word name typed verbatim (e.g. searching "Keyur  Italiya" finds nothing, even
   * though that party exists) - a short/partial term is required.
   */
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

  /**
   * @param {{type?: 'Cash'|'Bank'|'Cheque', partyType?: string, party?: string, currency?: string,
   *   amount?: string|number, narration?: string, bankAccount?: string, chequeNumber?: string,
   *   chequeDate?: string, chequeBank?: string, advance?: boolean}} data
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
    ...rest
  }) {
    await this.setPaymentType(type);
    if (partyType) await this.selectPartyType(partyType);
    if (party) await this.selectParty(party);
    if (currency) await this.selectCurrency(currency);
    if (amount !== undefined) await this.fillField('amount', amount);
    if (narration !== undefined) await this.fillField('narration', narration);
    // The bank_account_<type> field is relabeled "Cash Account" (not skipped) when type is Cash -
    // confirmed against add-payment.tsx (customeFilter just narrows it to account_type: ['Cash']
    // instead of ['Bank'], the field itself is never removed). It's a real, always-present field
    // for every payment type, so select it unconditionally - falling back to whatever account is
    // actually available for this type if no explicit bankAccount name is given, per this suite's
    // "selection is mandatory, first-available is an acceptable fallback" rule.
    await this.selectBankAccount(type, bankAccount || '', bankAccount || '');
    if (type === 'Cheque') {
      if (chequeNumber !== undefined) await this.fillField('cheque_number', chequeNumber);
      if (chequeDate !== undefined) await this.fillField('cheque_date', chequeDate);
      if (chequeBank !== undefined) await this.fillField('cheque_bank', chequeBank);
    }
    await this.fillForm(rest);
    if (advance !== undefined) await this.setAdvance(advance);
  }

  async openFilterModal() {
    await this.filterTrigger.click();
    await this.filterDialog.waitFor({ state: 'visible' });
  }

  async addFilterRule() {
    await this.addFilterButton.click();
  }

  /** Opens the field dropdown for the most recently added rule and selects `fieldLabel` (e.g. "Type", "Status"). */
  async selectFilterField(fieldLabel) {
    await this.filterFieldTrigger.last().click();
    await this.page.getByRole('option', { name: fieldLabel, exact: true }).last().click();
  }

  /**
   * Picks `optionLabel` in the most recently added rule's value editor. Confirmed against the
   * running app: react-querybuilder's default ValueEditor (testid="value-editor") is swapped out
   * for a custom multi-select component when a field's operator defaults to "In" - that custom
   * component drops the testid, so it has to be targeted by its stable wrapper class
   * (.filter-select) instead. A rule only counts toward "active conditions" (and therefore
   * enables Clear All/Apply) once field, operator, AND value are all set - confirmed live that a
   * field-only rule leaves the dialog reporting "0 active conditions".
   */
  async selectFilterValue(optionLabel) {
    const valueTrigger = this.filterDialog.locator('.filter-select [role="combobox"]').last();
    await valueTrigger.click();
    await this.page.getByRole('option', { name: optionLabel, exact: true }).click();
    // Multi-select keeps its menu open after a checkbox click - close it so a later click on
    // Apply/Clear All isn't obscured by the still-open listbox overlay.
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
  }
}

module.exports = PaymentEntryPage;
