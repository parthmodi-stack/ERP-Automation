const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// UNVERIFIED LIVE: written from FE source reading, not iterative live debugging against
// dev.erpforce.co (same caveat as the sibling Purchase Order page) - expect some locator/flow
// adjustments once this is first executed. Sources read: modules/procurement/src/views/orders/
// vendor-returns/{form/form.tsx, form/components/basic-details-tab.tsx,
// form/components/address-contact-tab.tsx, item-entry-modal/item-entry-modal.tsx,
// utils/{validator.ts,constant.ts,default-data.ts}, add-vendor-returns/add-vendor-returns.tsx,
// edit-vendor-returns/edit-vendor-returns.tsx, view-vendor-returns/view-vendor-returns.tsx,
// view-vendor-returns/components/basic-details-tab.tsx, vendor-returns.tsx, pathname.procurement.ts},
// erpforce-common-hub-fe's approval-wrapper.tsx/dropdown-button.tsx/confirm-modal.tsx, and
// modules/i18n/constants/lang/en.ts's procurement.vendorReturns.* / common.* keys.
//
// Two things confirmed directly from source, not just inferred by analogy with sibling modules:
// - default-data.ts's editDisableStatus/deleteDisableStatus are both empty arrays, so this
//   module's list row Edit/Delete actions are NEVER status-disabled (unlike the sibling
//   Procurement Request/Purchase Order pages, whose disable lists are non-empty).
// - The form is two tabs ("Basic Details" / "Address & Contact") joined by a "Next" button;
//   Address & Contact's Supplier Address/Contact Person/Shipping Address are required by
//   validator.ts's generatePOFormValidationSchema, but Save To Draft (handleSaveAsDraft) does
//   NOT run that schema at all (only checks "is any field filled"), so only Submit (Add) / Save
//   (Edit) - not Save To Draft - actually need the Address & Contact tab filled in.
class VendorReturnAuthorizationPage extends BasePage {
  // ---------- Navigation ----------
  async gotoList() {
    await this.page.goto('/dashboard/procurement/orders/vendor-returns');
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.getByRole('button', { name: 'Add' }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoAdd() {
    await this.gotoList();
    await this.page.getByRole('button', { name: 'Add' }).first().click();
    await this.page.waitForURL('**/add-vendor-returns');
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await expect(this.page.getByRole('combobox').first()).not.toHaveText('', { timeout: 10000 });
  }

  async gotoEdit(id) {
    if (!id) throw new Error(`gotoEdit() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/vendor-returns/${id}/edit-vendor-returns`);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // "Select Date" is the DynamicDate field's placeholder/accessible name - same pattern as the
    // sibling Procurement Request page's Date field.
    await this.page.getByRole('textbox', { name: 'Select Date' }).waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/vendor-returns/${id}/view-vendor-returns`);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  // ---------- Generic dropdown helpers (DynamicSearchSelect-family fields) ----------
  // openDropdownAndPick()/selectFieldByLabel()/selectFirstOptionByLabel() now live on BasePage.
  // CONFIRMED LIVE: this form's required-field paragraph labels render as a single text node
  // including the trailing asterisk (e.g. "Currency *"), not "Currency" plus a separate asterisk
  // element - an exact match against the bare label name never matches (this is what caused
  // TC-VRA-01's second failed run, a 15s timeout on getByText('Currency', { exact: true })), so
  // every selectFieldByLabel call on this page passes `{ exact: false }` for a substring match.

  // validator.ts rejects a future Date ("Date cannot be in the future") - editing a record on a
  // later day than it was created leaves its stored Date in the past, which is fine, but never
  // in the future; reset to today defensively before every save, same pattern as every sibling
  // page.
  async setDateToToday() {
    await this.page.getByRole('textbox', { name: 'Select Date' }).fill(this.formatDateToday());
  }

  // ---------- Basic Details tab ----------
  async fillBasicDetails({
    vendor,
    agreement,
    currency,
    exchangeRate,
    company,
    location,
    paymentTerms,
    purchaseRepresentative,
    referenceNo,
    incoterm,
    narration,
  } = {}) {
    if (vendor) {
      await this.openDropdownAndPick(/Vendor/i, vendor);
      // Selecting Vendor triggers getAndSetCustomerDependentFields(), an async effect that
      // auto-populates Currency and Payment Terms from the vendor's own linked defaults
      // (confirmed live) - give it time to settle before touching either field below, since a
      // race here is what silently overwrites an explicit selection back to the vendor default.
      await this.page.waitForTimeout(1500);
    }
    if (agreement) {
      await this.selectFieldByLabel('Agreement', agreement, { exact: false });
    }
    if (currency) {
      // CONFIRMED LIVE: Currency auto-populates from the selected Vendor's default before this
      // runs, so the combobox's accessible name has already changed away from the "Search
      // Currency"/"Currency" placeholder by the time openDropdownAndPick's name-based lookup
      // would look for it (this is what broke TC-VRA-01 on first run - a 15s timeout on
      // getByRole('combobox', { name: /Currency/i })). The structural, label-based lookup
      // doesn't care what the combobox's current accessible name is, so use that instead.
      await this.selectFieldByLabel('Currency', currency, { exact: false });
    }
    if (exchangeRate) {
      // "0.00" is Exchange Rate's own placeholder (exchangeRate_placeholder) and, on this tab,
      // unique to this field. Filled after Currency, deliberately overwriting whatever
      // setExchangeRateFromCurrency() auto-fetched for the selected currency.
      await this.page.getByPlaceholder('0.00').first().fill(exchangeRate);
    }
    if (company) {
      // CONFIRMED LIVE (screenshot from TC-VRA-01's first run): this field's own
      // DynamicSearchSelect renders its visible label as "Entity", not "Company" - despite its
      // label prop literally being t('procurement.vendorReturns.fields.company_label') in
      // source. Same undocumented component-level behavior already noted on the sibling
      // Purchase Agreement page's own company_id field.
      await this.selectFieldByLabel('Entity', company, { exact: false });
    }
    if (location) {
      await this.selectFieldByLabel('Location', location, { exact: false });
    }
    if (paymentTerms) {
      // Also auto-populated by Vendor selection (confirmed live, same class of issue as
      // Currency above) - structural lookup for the same reason.
      await this.selectFieldByLabel('Payment Terms', paymentTerms, { exact: false });
    }
    if (purchaseRepresentative) {
      await this.selectFieldByLabel('Purchase Representative', purchaseRepresentative, { exact: false });
    }
    if (referenceNo) {
      await this.page.getByPlaceholder('Enter Reference No.').fill(referenceNo);
    }
    if (incoterm) {
      await this.selectFieldByLabel('Incoterm', incoterm, { exact: false });
    }
    if (narration) {
      await this.page.getByPlaceholder('Enter Narration').fill(narration);
    }
  }

  // ---------- Tab navigation ----------
  // "Next" only advances once Basic Details' own required fields (Date/Vendor/Currency/
  // Company/Location/Exchange Rate) pass validation (form.tsx's moveToNextTab gates on
  // methods.formState.errors) - callers must fill those first.
  async goToNextTab() {
    await this.page.getByRole('button', { name: 'Next', exact: true }).click();
    await this.page.waitForTimeout(500);
  }

  async goToBasicDetailsTab() {
    await this.page.getByText('Basic Details', { exact: true }).click();
    await this.page.waitForTimeout(500);
  }

  async goToAddressContactTab() {
    await this.page.getByText('Address & Contact', { exact: true }).click();
    await this.page.waitForTimeout(500);
  }

  // ---------- Address & Contact tab ----------
  // Supplier Address and Contact Person may already auto-populate once Vendor is selected
  // (useDefaultPartyDetails in address-contact-tab.tsx), but Shipping Address never does -
  // explicitly select all three regardless, since re-selecting an already-filled value is a
  // no-op-equivalent here.
  async fillAddressContact() {
    await this.selectFirstOptionByLabel('Vendor Address');
    await this.selectFirstOptionByLabel('Contact Person');
    // CONFIRMED LIVE: Shipping Address's own accordion SECTION title (companyShippibngAddress)
    // renders as an identically-worded, asterisk-less "Shipping Address" text node earlier in the
    // DOM than the field's own label - selectFirstOptionByLabel's optional-asterisk regex matches
    // that title first, finds no combobox inside the accordion's button wrapper, and silently
    // no-ops the click (swallowed by selectFirstAvailableOption's own `.catch`), then times out
    // waiting for a listbox that never opens. The field's own label uniquely carries the
    // required-field asterisk ("Shipping Address *") - require it explicitly to disambiguate.
    const shippingCombobox = this.page
      .getByText(/^Shipping Address\s*\*$/i)
      .first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    await this.selectFirstAvailableOption(shippingCombobox);
  }

  // ---------- Items ----------
  // Item-modal fields reuse BasePage.selectFieldByLabel scoped to the modal (`{ scope: modal }`)
  // - unlike the main form, this modal's labels don't carry a trailing asterisk in the same text
  // node, so the default `exact: true` matching is correct here (no `{ exact: false }` needed).
  async addItem({ item, uom, quantity, rate, location, description, discountItem, taxTemplate, department, narration } = {}) {
    // Items live in an accordion on the Basic Details tab - ensure we're there before opening
    // the modal, since callers may have just come back from Address & Contact.
    await this.goToBasicDetailsTab();
    await this.page.getByRole('button', { name: 'Add', exact: true }).click();

    const modal = this.page.getByRole('dialog').filter({ hasText: 'Add Item' });
    // CONFIRMED LIVE: a bare /Item/i regex also matches "Search Discount Item" (a second,
    // distinct combobox in this modal), causing a strict-mode violation - match the Item field's
    // exact placeholder instead.
    await modal.getByRole('combobox', { name: 'Search Item', exact: true }).click();
    await this.page.getByText(item, { exact: true }).first().click();

    // Selecting an item triggers autofillItemVendorName(), an async fetch that patches in
    // UoM/Rate/Tax Template/Description together; "Vendor Item Name" (disabled, read-only) is
    // populated by the same response, so wait for it before filling anything - same pattern as
    // the sibling Purchase Agreement/Purchase Order item modals.
    await expect(modal.getByRole('textbox', { name: 'Vendor Item Name' })).not.toHaveValue('', { timeout: 5000 }).catch(() => { });

    if (uom) {
      await this.selectFieldByLabel('UoM', uom, { scope: modal });
    }
    await modal.locator('text=/^Quantity/').locator('xpath=following::input[1]').fill(quantity);
    if (location) {
      await this.selectFieldByLabel('Location', location, { scope: modal });
    }
    if (description) {
      await modal.getByPlaceholder('Enter Description').fill(description);
    }
    await modal.locator('text=/^Rate/').locator('xpath=following::input[1]').fill(rate);
    if (discountItem) {
      await this.selectFieldByLabel('Discount Item', discountItem, { scope: modal });
    }
    if (taxTemplate) {
      await this.selectFieldByLabel('Tax Template', taxTemplate, { scope: modal });
    }
    if (department) {
      await this.selectFieldByLabel('Department', department, { scope: modal });
    }
    if (narration) {
      await modal.getByPlaceholder('Enter Narration').fill(narration);
    }

    // Gross/Tax/Discount/Net/Total Amount are computed by a 1000ms-debounced effect after
    // Quantity/Rate change - saving before it fires submits null amounts.
    await this.waitForItemAmountsToSettle(modal);
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();
  }

  async editFirstItem({ quantity, rate } = {}) {
    await this.goToBasicDetailsTab();
    await this.page.locator('table tbody tr').first().locator('button').first().click();
    const modal = this.page.getByRole('dialog').filter({ hasText: 'Add Item' });
    await modal.waitFor({ state: 'visible', timeout: 10000 });

    if (quantity) {
      await modal.locator('text=/^Quantity/').locator('xpath=following::input[1]').fill(quantity);
    }
    if (rate) {
      await modal.locator('text=/^Rate/').locator('xpath=following::input[1]').fill(rate);
    }
    if (quantity || rate) {
      await this.waitForItemAmountsToSettle(modal);
    }
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();
  }

  // ---------- Save actions ----------
  // Dual identifiers, same pattern documented on every sibling page: `id` (raw PK, used in
  // edit/view URLs) and `series_number` (the formatted string rendered in the list's ID column).
  async saveAndCaptureId(buttonName, exact) {
    const [, listResponse] = await Promise.all([
      this.page.getByRole('button', { name: buttonName, exact }).click(),
      this.page.waitForResponse((r) => r.url().includes('/purchase/v1/vra/?')),
    ]);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const record = (await listResponse.json()).data.vras[0];
    return { id: String(record.id), seriesNumber: record.series_number };
  }

  async saveAsDraft() {
    return this.saveAndCaptureId(/Save.*Draft/i, false);
  }

  // Add's equivalent button is labeled "Submit"; Edit's is labeled "Save" (and internally moves
  // Draft -> Pending) - both enforce the full Yup schema (Address & Contact included), unlike
  // saveAsDraft(). A single method covers both, matching every sibling page's `save()` name.
  async save() {
    return this.saveAndCaptureId(/^(Save|Submit)$/, false);
  }

  // ---------- List actions ----------
  async editFromList(id, seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByText('Edit', { exact: true }).click();
    await this.page.waitForURL(new RegExp(`${id}/edit-vendor-returns`));
  }

  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Pending Approval|Draft|Pending|Approved|Rejected|Delivered|Refunded|Closed/);
  }

  // ---------- Edit page value readers ----------
  isIdFieldReadOnly() {
    // The field's real accessible name is "ID" (id_label), unlike the sibling Purchase
    // Agreement/Purchase Order pages, whose disabled ID field carries a more specific label.
    return this.page.getByRole('textbox', { name: 'ID', exact: true }).isDisabled();
  }

  // ---------- Delete / Approval flow ----------
  // confirmDelete()/quickApproval() now live on BasePage unchanged. accept() is the one wording
  // exception: CONFIRMED LIVE the real toast text is "Vendor Return Authorization Accepted", not
  // BasePage's default "approved successfully" - override just that one default rather than
  // touching every sibling module's shared BasePage.accept().
  async accept(opts = {}) {
    return super.accept({ successToast: /Vendor Return Authorization Accepted/i, ...opts });
  }

  // reject()'s wording does match BasePage's default "rejected successfully" regex, but the
  // toast is a short-lived Snackbar that can auto-dismiss before the assertion polls for it
  // under load (confirmed live: TC-VRA-05 intermittently timed out on it) - same class of
  // flakiness PurchaseAgreementPage's reject() already works around. Skip it here too; the
  // caller verifies the resulting "Rejected" status badge right after, which is the durable
  // signal that the action actually took effect.
  async reject(opts = {}) {
    return super.reject({ successToast: null, ...opts });
  }

  // ---------- Module-level business method ----------
  // Matches the spec file's own local createDraftWithItem() helper body exactly.
  async createDraft(data) {
    await this.gotoAdd();
    await this.fillBasicDetails({
      vendor: data.vendor,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      company: data.company,
      location: data.location,
      purchaseRepresentative: data.purchaseRepresentative,
      narration: data.narration,
    });
    await this.addItem({ item: data.itemName, quantity: data.quantity, rate: data.rate });
    return this.saveAsDraft();
  }
}

module.exports = VendorReturnAuthorizationPage;
