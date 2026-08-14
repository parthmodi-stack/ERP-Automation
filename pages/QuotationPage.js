const { selectDropdown } = require('../helpers/dropdown');

// CRM > Orders > Quotation (/dashboard/crm/orders/quotation).
//
// CONFIRMED AGAINST SOURCE (erpforce-fe modules/crm/src/views/orders/quotation/{add-quotation,
// form,component,redux,utils} + .../opportunity/view-opportunity/components/header-buttons.tsx +
// .../quotation/view-quotation/view-quotation.tsx):
// - The real, deterministic Opportunity->Quotation link is OpportunityPage.convertToQuotation()
//   (the "Make Quotation" button on the Opportunity's view page). It navigates here via router
//   state `{ opportunity: data }`; this page then dispatches fetchOpportunityById and does a full
//   form reset() from the response (customer, items, currency, company, address, contact all
//   copied over). The form's own `opportunity_id` field is a DISABLED read-only DynamicInput -
//   never a manual/searchable locator, so there is no "select an Opportunity" step to model here.
// - Required per Yup (utils/valiadation.ts - note the source's own filename typo): date,
//   customer_id, payment_terms_id, company_id, currency_id, location_id, expiration_date,
//   exchange_rate, posting_time, transaction_type, itemDatas; contact_person_id and
//   company_shipping_address_id are additionally required whenever transaction_type==='credit'
//   (the default). Customer/Company/Currency/Exchange Rate/Date/Posting Time arrive pre-filled
//   from the Opportunity conversion; Payment Terms/Location/Contact Person/Shipping Address/Items
//   are the ones this Page Object must always fill.
// - The Add form's own "Save" button (not "Save To Draft") sets status straight to 'Submitted'
//   (confirmed: submitData() dispatches postV1QuotationSaveAsDraft either way, only the `status`
//   payload field differs) - no separate "submit" step is needed to leave Draft.
// - "Create Order" (the real Quotation->Sales Order link, see SalesOrderPage/convertToSalesOrder
//   below) only renders once status === 'Accepted'. Reaching that from 'Submitted' requires the
//   same Submit-dropdown -> Quick Approval -> approver Accepts sequence already proven for
//   Procurement (erpforce-procure-to-pay.spec.js) - this page shares the same `DropdownButton`
//   component and "select merge strategy" caret accessible name.
class QuotationPage {
  constructor(page) {
    this.page = page;

    // CONFIRMED LIVE: Contact Person's real label text is "Contact Person *" (trailing
    // required-field asterisk) - an exact:true match against the bare label alone (no asterisk)
    // finds ZERO elements and hangs, same class of bug already documented throughout this suite
    // (e.g. PurchaseOrderPage.setDateToToday's own "Date *" note). Anchored regex tolerates the
    // asterisk whether or not it's actually there (Contact Person/Shipping Address only render
    // required for transaction_type==='credit').
    const byLabel = (label) => page.getByText(new RegExp(`^${label}\\s*\\*?$`)).first().locator('xpath=..').getByRole('combobox').first();
    this.paymentTermsDropdown = byLabel('Payment Terms');
    // CONFIRMED LIVE: unlike Payment Terms/Contact Person/Shipping Address, this account renders
    // Location's own i18n key literally as "crm.quotation.fields.location_label *" instead of
    // "Location *" (same broken-translation bug already documented/fixed on
    // ProcurementRequestPage.selectLocation / PurchaseOrderPage.selectLocation) - match either.
    this.locationDropdown = page.getByText('Location *', { exact: true })
      .or(page.getByText('crm.quotation.fields.location_label *', { exact: true }))
      .first().locator('xpath=..').getByRole('combobox').first();
    this.contactPersonDropdown = byLabel('Contact Person');
    this.shippingAddressDropdown = byLabel('Shipping Address');
    this.expirationDateLabel = page.getByText(/^Expiration Date\s*\*?$/, { exact: false }).first();

    // CONFIRMED LIVE: Contact Person/Shipping Address live on their own "Address and Contact" tab,
    // not the "Basic Details" tab Payment Terms/Location/Expiration Date and the Items grid are
    // on - selecting them without switching tabs first finds no match and hangs (same class of fix
    // as PurchaseOrderPage.fillAddressContact()).
    this.basicDetailsTab = page.getByRole('tab', { name: 'Basic Details', exact: true });
    this.addressContactTab = page.getByRole('tab', { name: 'Address and Contact', exact: true });

    this.addButton = page.getByRole('button', { name: /^\+?\s*Add$/ }).first();
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.itemModal = page.getByRole('dialog');

    // View page - conversion + approval workflow.
    this.createOrderButton = page.getByRole('button', { name: 'Create Order', exact: true });
    this.submitCaret = page.getByRole('button', { name: 'select merge strategy' });
    this.menu = page.getByRole('menu');
    this.confirmDialog = page.getByRole('dialog');

    // CONFIRMED LIVE: real Yup messages (utils/valiadation.ts). The source string is
    // 'Please add  payment terms' (double space) but HTML collapses that to a single space when
    // rendered, so match what actually shows on the page, not the raw source literal.
    this.paymentTermsRequiredError = page.getByText('Please add payment terms', { exact: true });
    this.expirationDateRequiredError = page.getByText('Expiry Date is required', { exact: true });
    // CONFIRMED AGAINST SOURCE (general-details.tsx): these render as bare spinbuttons with a
    // placeholder driven by a translation key (vat_number_placeholder/crn_placeholder) - likely
    // broken/untranslated like several other keys already confirmed live on this exact form
    // (crm.quotation.fields.location_label *, ...termsCondition_label, crm.settings.
    // quote_percentage_label), so a placeholder-text guess is unreliable here. The DOM `name`
    // attribute is immune to that and matches the source's own name='vat_number'/name='crn'.
    // CONFIRMED AGAINST SOURCE: fieldArrayName='quotation' prefixes the rendered `name` attribute
    // (same convention as Lead's own lead.vat_number) - the bare 'vat_number'/'crn' guess never
    // matches anything.
    this.vatInput = page.locator('input[name="quotation.vat_number"]');
    this.vatInvalidError = page.getByText(/VAT number should have exactly 15 digits/i);
    this.approversRequiredError = page.getByText('Please select the approvers', { exact: true });

    // List / view page - Actions menu (same pattern as LeadPage.js/OpportunityPage.js).
    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.editMenuItem = page.getByRole('menuitem', { name: 'Edit' });
    this.deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete' });
  }

  async gotoList() {
    await this.page.goto('/dashboard/crm/orders/quotation', { timeout: 60000 });
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      try {
        await this.addButton.waitFor({ state: 'visible', timeout: 15000 });
        return;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.reload({ timeout: 60000 }).catch(() => {});
      }
    }
  }

  async openViewById(id) {
    await this.page.goto(`/dashboard/crm/orders/quotation/${id}/view-quotation`, { timeout: 60000 });
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const visible = await this.page.getByText(/^ID/).first()
        .waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      if (visible) return;
      if (attempt === 4) return;
      await this.page.reload({ timeout: 60000 }).catch(() => {});
    }
  }

  // CONFIRMED AGAINST SOURCE: the real Quotation->Sales Order link. Only call this from a
  // Quotation view page once status === 'Accepted' (see submitQuickApprovalAndAccept below) -
  // the button doesn't render otherwise.
  async convertToSalesOrder() {
    await this.createOrderButton.click();
    await this.page.waitForURL('**/add-sales-order**');
  }

  async openEditById(id) {
    await this.openViewById(id);
    await this.actionsButton.click();
    await this.editMenuItem.waitFor({ state: 'visible' });
    await this.editMenuItem.click();
    await this.page.waitForURL('**/edit-quotation**', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }

  async selectIfEmpty(combobox, searchText, opts = {}) {
    const currentText = ((await combobox.textContent().catch(() => '')) || '').replace(/[​﻿]/g, '').trim();
    if (currentText && !/^Search /i.test(currentText)) return;
    await selectDropdown(this.page, combobox, searchText || '', searchText || '', opts);
  }

  // Payment Terms master data has been confirmed EMPTY before (see
  // erpforce-procure-to-pay.spec.js's own fillPaymentTermsIfEmpty) - this field shares that same
  // apiType='paymentTerm' with an inline "Create New" fallback (addType='paymentTerm'), so reuse
  // the identical allowCreateNew mechanism instead of assuming a real option always exists.
  async selectPaymentTermsIfEmpty() {
    const currentText = ((await this.paymentTermsDropdown.textContent().catch(() => '')) || '')
      .replace(/[​﻿]/g, '').trim();
    if (currentText && !/^Search /i.test(currentText)) return;
    const newTermName = `Auto_Payment_Term_${Date.now()}`;
    await selectDropdown(this.page, this.paymentTermsDropdown, newTermName, newTermName, {
      allowCreateNew: true,
      createNewFields: { due_date_based_on: "Day's after Invoice date", credit_days: '30' },
    });
  }

  // CONFIRMED LIVE: expiration_date is required per Yup (see this file's own header comment) but
  // arrives genuinely empty ("Select Date") even when converting from an Opportunity - nothing
  // else on this form fills it. Same DD-MM-YYYY text-fill pattern as PurchaseOrderPage/
  // GoodsReceiptNotePage's own setDateToToday() (this class doesn't extend BasePage, so that
  // helper isn't inherited here). Defaults 30 days out since an expiration date <= today would be
  // semantically backwards and risks its own separate validation error.
  async fillExpirationDateIfEmpty(daysFromNow = 30) {
    const input = this.expirationDateLabel.locator('xpath=following::input[1]');
    const current = (await input.inputValue().catch(() => '')).trim();
    if (current) return;
    const future = new Date();
    future.setDate(future.getDate() + daysFromNow);
    const formatted = `${String(future.getDate()).padStart(2, '0')}-${String(future.getMonth() + 1).padStart(2, '0')}-${future.getFullYear()}`;
    await input.fill(formatted);
  }

  async fillGeneralDetails({ locationSearchText, contactPersonSearchText, shippingAddressSearchText } = {}) {
    await this.selectPaymentTermsIfEmpty();
    await this.selectIfEmpty(this.locationDropdown, locationSearchText);
    await this.fillExpirationDateIfEmpty();

    // Switch to the "Address and Contact" tab for these two - see basicDetailsTab/
    // addressContactTab's own constructor comment for why.
    await this.addressContactTab.click();
    await this.page.waitForTimeout(500);
    // Contact Person / Shipping Address are only required for transaction_type==='credit' (the
    // default) - fill them defensively either way since selectIfEmpty no-ops if already filled,
    // and mark optional in case this Quotation happens to be cash-mode (they'd have no options).
    await this.selectIfEmpty(this.contactPersonDropdown, contactPersonSearchText, { optional: true });
    await this.selectIfEmpty(this.shippingAddressDropdown, shippingAddressSearchText, { optional: true });

    // Back to Basic Details - addItem()'s own "Add" button and the Items grid live there, same
    // "return to the tab callers expect" convention as PurchaseOrderPage.fillAddressContact().
    await this.basicDetailsTab.click();
    await this.page.waitForTimeout(500);
  }

  // Converting from an Opportunity already copies its items over (see this file's own header
  // comment: "does a full form reset() ... items ... copied over") - checked before addItem() so
  // a Quotation that already arrived with an item isn't given a second, redundant one.
  async hasExistingItem() {
    const rows = this.page.locator('table tbody tr').filter({ hasNotText: /No Data/i });
    return (await rows.count()) > 0;
  }

  // Same Add-Item-modal pattern as OpportunityPage.addItem, adapted to Quotation's own item
  // field names confirmed against add-item.tsx (item_id, uom_id, rate, quantity, tax_template -
  // note: no "_id" suffix on tax_template here, unlike Opportunity/Sales Order).
  async addItem({ itemSearchText = '', quantity } = {}) {
    await this.addButton.click();
    await this.itemModal.waitFor({ state: 'visible', timeout: 10000 });

    const itemCombobox = this.itemModal.getByText(/^Item(s)?\s*\*?$/i).first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    await itemCombobox.click();
    await this.page.waitForTimeout(500);
    if (itemSearchText) {
      const searchInput = this.page.locator('input[placeholder*="Search"]').last();
      await searchInput.fill(itemSearchText);
      await this.page.waitForTimeout(600);
    }
    const options = this.page.getByRole('listbox').locator('[role="option"]:not([aria-disabled="true"])')
      .filter({ hasNot: this.page.locator('input') })
      .filter({ hasNotText: /Select|No data available|Create New/ });
    await options.first().waitFor({ state: 'visible', timeout: 8000 });
    await options.first().click();
    await this.page.waitForTimeout(500);

    const qtyInput = this.itemModal.getByText(/^Quantity\s*\*?$/i).first().locator('xpath=..').locator('input');
    if (await qtyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await qtyInput.fill(String(quantity ?? 1));
    }
    await this.page.waitForTimeout(500);

    const taxCombobox = this.itemModal.getByText(/^Tax Template\s*\*?$/i).first().locator('xpath=..').getByRole('combobox').first();
    const taxText = ((await taxCombobox.textContent().catch(() => '')) || '').replace(/[​﻿]/g, '').trim();
    if (!taxText || /^Search /i.test(taxText)) {
      await taxCombobox.click();
      await this.page.waitForTimeout(500);
      const taxOptions = this.page.getByRole('listbox').locator('[role="option"]:not([aria-disabled="true"])')
        .filter({ hasNot: this.page.locator('input') })
        .filter({ hasNotText: /Select|No data available|Create New/ });
      if (await taxOptions.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await taxOptions.first().click();
        await this.page.waitForTimeout(300);
      }
    }

    const modalSaveButton = this.itemModal.getByRole('button', { name: 'Save', exact: true });
    await modalSaveButton.click();
    const closed = await this.itemModal.waitFor({ state: 'hidden', timeout: 8000 }).then(() => true).catch(() => false);
    if (!closed) {
      throw new Error('Quotation item modal did not close after Save - likely a validation error inside it');
    }
  }

  // Same stale-MUI-backdrop-after-dropdown-selection quirk as OpportunityPage.save()/
  // helpers/dropdown.js - and this form's own "Save" (not "Save To Draft") is what sets status
  // straight to 'Submitted' per source, not a separate submit step.
  async save() {
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.mouse.click(2, 2).catch(() => {});
    await this.page.waitForTimeout(300);
    const urlBefore = this.page.url();
    await this.saveButton.click();
    await this.page.waitForTimeout(2000);
    if (this.page.url() === urlBefore) {
      await this.saveButton.click();
    }
  }

  async fillRequiredFieldsAndSave(data = {}) {
    await this.fillGeneralDetails(data);
    // Skip adding an item if one already carried over from the source Opportunity - see
    // hasExistingItem()'s own comment.
    if (!(await this.hasExistingItem())) {
      await this.addItem({ itemSearchText: data.itemSearchText, quantity: data.itemQuantity });
    }
    await this.save();
  }

  // Opens the "Submit"/caret split-button's own menu - same shared component + "select merge
  // strategy" accessible name as every other approval-workflow module in this suite
  // (createApprovedPurchaseRequest.js / erpforce-rfq-full-workflow.spec.js / erpforce-procure-to-
  // pay.spec.js). Retries the whole open-then-click sequence since MUI's Menu popover can keep
  // remounting its MenuList right after opening.
  async openSplitButtonMenuAndPick(menuItemNamePattern) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.submitCaret.click();
      try {
        await this.menu.waitFor({ state: 'visible', timeout: 3000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.keyboard.press('Escape').catch(() => {});
      }
    }
    await this.page.getByRole('menuitem', { name: menuItemNamePattern }).click();
  }

  // CONFIRMED AGAINST SOURCE (view-quotation.tsx): from status 'Submitted' (which this form's own
  // Save already set), the "Submit" DropdownButton's "Quick Approval" option opens
  // QuickApprovalModal (onConfirm -> handleSubmitForApproval('quick_approval', approverIds)).
  // Once an approver is assigned, an "Approve" DropdownButton appears for them with "Accept"/
  // "Reject" options; clicking Accept calls setApprovalToAcceptOrReject('Approved') opening a
  // confirm dialog whose Submit sets the quotation's status to 'Accepted' - the precondition
  // "Create Order" needs.
  async submitQuickApprovalAndAccept(approverName) {
    await this.openSplitButtonMenuAndPick('Quick Approval');
    // CONFIRMED LIVE: this modal's own title renders as the broken i18n key
    // "crm.quotation.quickApproval" (no space, camelCase) instead of "Quick Approval" - same class
    // of broken-translation bug already fixed on Location/Contact Person above. \s* tolerates
    // both the proper spaced text and the broken camelCase key in one pattern.
    const approvalModal = this.page.getByRole('dialog').filter({ hasText: /Quick\s*Approval/i });
    await approvalModal.waitFor({ state: 'visible', timeout: 10000 });
    await approvalModal.getByText('Select', { exact: false }).first().click();
    await this.page.getByRole('listbox').getByRole('option', { name: new RegExp(approverName) }).first().click();
    await this.page.keyboard.press('Escape');
    await approvalModal.getByRole('button', { name: /Send Request|Confirm|Submit/i }).click();
    await this.page.getByText('Submitted', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    // Now acting as the assigned approver (same logged-in account, matching every other
    // approval-workflow module's own Quick Approval convention in this suite).
    // CONFIRMED LIVE: this reload can leave the SPA genuinely STUCK on its own bare loading
    // spinner (not just slow) - a single networkidle wait, however generous, never resolves, but
    // a hard reload reliably recovers it (same documented fix as erpforce-rfq-full-workflow.spec.js/
    // erpforce-full-inventory-to-procurement.spec.js's own waitVisibleWithReload). Retry the whole
    // reload rather than trust one before clicking the Approve caret below.
    // CONFIRMED LIVE: once an approver is assigned, this page shows its OWN dedicated green
    // "Approve" split-button (View / Approve, each with their own adjacent caret) - NOT the shared
    // "select merge strategy" Submit caret used to send Quick Approval above. Its own dropdown
    // menu holds "Accept"/"Reject" (confirmed via screenshot) - "Accept" then opens the "Approve
    // Quotation" confirm dialog handled below. Wait for this specific button, not the old
    // submitCaret, which was matching a different, unrelated caret on this page.
    const approveButton = this.page.getByRole('button', { name: 'Approve', exact: true });
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const visible = await approveButton.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      if (visible) break;
      if (attempt === 4) break;
      await this.page.reload({ timeout: 60000 }).catch(() => {});
    }
    const approveCaret = approveButton.locator('xpath=following-sibling::button[1]');
    for (let attempt = 1; attempt <= 4; attempt++) {
      await approveCaret.click();
      try {
        await this.menu.waitFor({ state: 'visible', timeout: 3000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.keyboard.press('Escape').catch(() => {});
      }
    }
    await this.page.getByRole('menuitem', { name: 'Accept', exact: true }).click();
    // CONFIRMED LIVE: the confirmation dialog here ("Approve Quotation" / "Are you sure you want
    // to Quotation approve?") has an "Approve" button, NOT "Submit" - the old /^Submit$/i locator
    // never matched, so isVisible's catch(() => false) silently skipped the click entirely and
    // the status never actually flipped.
    const confirmButton = this.confirmDialog.getByRole('button', { name: /^Approve$/i });
    if (await confirmButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmButton.click();
    }
    // CONFIRMED LIVE: the final status chip here reads "Approved", not "Accepted" (unlike the
    // Procurement modules' own convention) - despite the menu action itself being labelled
    // "Accept". Confirmed via a real passing run: Quick Approval -> Accept -> confirm Approve all
    // completed successfully and the page genuinely showed "Approved".
    await this.page.getByText('Approved', { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  // Same sequence as submitQuickApprovalAndAccept but stops short of selecting an approver -
  // CONFIRMED LIVE: with zero approvers selected, "Send Request" is disabled (a UI-level guard
  // in addition to the modal's own "Please select the approvers" (min 1) Yup rule), so this
  // returns the modal + button for the caller to assert the disabled state directly rather than
  // clicking it.
  async openQuickApprovalWithoutApprover() {
    await this.openSplitButtonMenuAndPick('Quick Approval');
    const approvalModal = this.page.getByRole('dialog').filter({ hasText: /Quick\s*Approval/i });
    await approvalModal.waitFor({ state: 'visible', timeout: 10000 });
    const sendRequestButton = approvalModal.getByRole('button', { name: /Send Request|Confirm|Submit/i });
    return { approvalModal, sendRequestButton };
  }

  // Mirrors submitQuickApprovalAndAccept, but picks "Reject" from the Approve split-button's own
  // dropdown instead of "Accept" - CONFIRMED AGAINST SOURCE (view-quotation.tsx): Reject calls
  // setApprovalToAcceptOrReject('Rejected'), same confirm-dialog flow as Accept.
  async submitQuickApprovalAndReject(approverName) {
    await this.openSplitButtonMenuAndPick('Quick Approval');
    const approvalModal = this.page.getByRole('dialog').filter({ hasText: /Quick\s*Approval/i });
    await approvalModal.waitFor({ state: 'visible', timeout: 10000 });
    await approvalModal.getByText('Select', { exact: false }).first().click();
    await this.page.getByRole('listbox').getByRole('option', { name: new RegExp(approverName) }).first().click();
    await this.page.keyboard.press('Escape');
    await approvalModal.getByRole('button', { name: /Send Request|Confirm|Submit/i }).click();
    await this.page.getByText('Submitted', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    const approveButton = this.page.getByRole('button', { name: 'Approve', exact: true });
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const visible = await approveButton.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      if (visible) break;
      if (attempt === 4) break;
      await this.page.reload({ timeout: 60000 }).catch(() => {});
    }
    const approveCaret = approveButton.locator('xpath=following-sibling::button[1]');
    for (let attempt = 1; attempt <= 4; attempt++) {
      await approveCaret.click();
      try {
        await this.menu.waitFor({ state: 'visible', timeout: 3000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.keyboard.press('Escape').catch(() => {});
      }
    }
    await this.page.getByRole('menuitem', { name: 'Reject', exact: true }).click();
    const confirmButton = this.confirmDialog.getByRole('button', { name: /^Reject$/i });
    if (await confirmButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmButton.click();
    }
    await this.page.getByText('Rejected', { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
  }
}

module.exports = QuotationPage;
