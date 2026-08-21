const { expect } = require('@playwright/test');
const { selectDropdown } = require('../helpers/dropdown');

// CRM > Orders > Opportunity (/dashboard/crm/orders/opportunity).
//
// CONFIRMED AGAINST SOURCE (erpforce-fe modules/crm/src/views/orders/opportunity/{add-opportunity,
// form,redux,utils,types.ts} + .../lead/view-lead/components/header-buttons.tsx):
// - There is NO "lead_id" field anywhere in the Opportunity payload/types. Lead and Customer are
//   the SAME underlying Party record, distinguished only by a `type` column ('Customer'/'Lead'/
//   'Prospect'/'Vendor'). The real, deterministic link back to a specific Lead is
//   LeadPage.convertToOpportunity() (the "Convert" button on the Lead's view page) - it navigates
//   here via router state `{ lead: data }`, which this page then reads via fetchLeadByLeadId and
//   sets `sales_op_customer_id = lead.id`, DISABLING that field so it can't be changed.
// - A secondary, non-deterministic path also exists: the "Customer *" field itself
//   (sales_op_customer_id) is a manual DynamicSearchSelect (apiType='party', filtered
//   type.in=['Customer','Lead','Prospect']) when NOT arriving via Convert - searchable by the
//   Lead's own company_name/first+last name. Kept here as selectCustomer() for a standalone run,
//   but the Convert-button path is what a chained test should use.
// - Required fields per Yup (utils/validator.ts): sales_op_customer_id, sales_op_expected_closing_date,
//   company_id, sales_currency, sales_lead_owner_salesperson_id, location_id, itemDatas (min 1),
//   addressData (min 1, needs exactly one default_shipping_address + one default_billing_address),
//   contactData (min 1). Company/Currency/Salesperson/Address/Contact all arrive pre-filled
//   (from the logged-in user's defaults, or copied from the Lead when arriving via Convert) -
//   Expected Closing Date, Location, and Items are the ones this Page Object must always fill.
class OpportunityPage {
  constructor(page) {
    this.page = page;

    // Every select here can arrive pre-filled/disabled (Customer when converted from a Lead,
    // Priority/Stage/Company/Currency/Salesperson to a default) - a name-based locator resolves
    // to zero elements once pre-filled (accessible name becomes the value itself, not the
    // "Search X" placeholder) and hangs. Same structural label->parent->combobox fix as
    // LeadPage.js.
    const byLabel = (label) => page.getByText(label, { exact: true }).first().locator('xpath=..').getByRole('combobox').first();
    this.customerDropdown = byLabel('Customer *');
    this.expectedClosingDateInput = page.getByText('Expected Closing Date', { exact: false })
      .first().locator('xpath=..').locator('input');
    this.expectedRevenueInput = page.getByText('Expected Revenue', { exact: true })
      .first().locator('xpath=..').locator('input');
    this.stageDropdown = byLabel('Stage');
    this.probabilityInput = page.getByText('Probability', { exact: true })
      .first().locator('xpath=..').locator('input');
    this.phoneInput = page.getByPlaceholder('Enter Phone Number').first();
    this.emailInput = page.getByPlaceholder('Enter Email ID').first();
    this.priorityDropdown = byLabel('Priority');
    // location_id - required (Yup), confirmed under the "Classification" section.
    this.locationDropdown = byLabel('Location *');

    this.nextButton = page.getByRole('button', { name: 'Next' });
    this.basicDetailsTab = page.getByRole('tab', { name: 'Basic Details' });
    this.addressTab = page.getByRole('tab', { name: 'Address' });
    this.contactTab = page.getByRole('tab', { name: 'Contact' });
    this.promotionTab = page.getByRole('tab', { name: 'Promotion' });

    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.addButton = page.getByRole('button', { name: /^\+?\s*Add$/ }).first();

    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.editMenuItem = page.getByRole('menuitem', { name: 'Edit' });
    this.deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete' });

    // CONFIRMED LIVE: real Yup messages (utils/validator.ts) differ slightly from what the
    // header comment originally guessed - "Please select customer"/"Please select expected
    // closing date", not "Customer is required"/"Expected Closing Date is required".
    this.customerRequiredError = page.getByText('Please select customer', { exact: true });
    this.expectedClosingDateRequiredError = page.getByText('Please select expected closing date', { exact: true });
    this.locationRequiredError = page.getByText('Location is required', { exact: true });
    this.itemsRequiredError = page.getByText('Please add atleast one Item', { exact: true });
    this.vatInput = page.getByPlaceholder('Enter VAT Number');
    this.crnInput = page.getByPlaceholder('Enter CRN Number');
    this.vatInvalidError = page.getByText(/VAT number should have exactly 15 digits/i);
    this.crnInvalidError = page.getByText(/CRN should have exactly 10 digits/i);

    // Items* table - required (Yup: itemDatas min 1; confirmed live: "Please add atleast one
    // Item" blocks Save with no other visible error), same "Add" button + row-modal pattern as
    // every other module's item table in this suite (Stock Transfer, Purchase Order, ...).
    // CONFIRMED LIVE: this page has multiple "+ Add" buttons (Items table renders first in the
    // DOM, Follow Up further down) - `.last()` resolves to Follow Up's, so Items' own is
    // `.first()`.
    this.addItemButton = page.getByRole('button', { name: /^\+?\s*Add$/ }).first();
    this.itemModal = page.getByRole('dialog');

    // "Make Quotation" - the real Opportunity->Quotation link (view-opportunity/components/
    // header-buttons.tsx). Only renders when status is set, not draft, no quotation_id yet, and
    // user has Quotation.canAdd.
    this.makeQuotationButton = page.getByRole('button', { name: 'Make Quotation', exact: true });
  }

  async gotoList() {
    // Same stuck-on-its-own-bare-loading-spinner class of bug as every other module in this
    // suite - retry with a reload instead of trusting one wait.
    await this.page.goto('/dashboard/crm/orders/opportunity', { timeout: 60000 });
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

  // Standalone entry point (not via Lead Convert) - Customer stays a manual searchable field.
  async goto() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-opportunity');
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      try {
        await this.customerDropdown.waitFor({ state: 'visible', timeout: 15000 });
        return;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.reload({ timeout: 60000 }).catch(() => {});
      }
    }
  }

  async openViewById(id) {
    await this.page.goto(`/dashboard/crm/orders/opportunity/${id}/view-opportunity`, { timeout: 60000 });
    // CONFIRMED LIVE: this view page can get genuinely STUCK on its own bare loading spinner (not
    // just slow) after this navigation - a single wait, however generous, never resolves that, but
    // a hard reload reliably recovers it (same documented fix as convertToQuotation() above /
    // erpforce-full-inventory-to-procurement.spec.js's own waitVisibleWithReload). Capped at ONE
    // reload (not several) - enough to recover a genuinely stuck page without repeated reloads.
    const readySignal = this.actionsButton.or(this.makeQuotationButton).first();
    for (let attempt = 1; attempt <= 2; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      const visible = await readySignal.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);
      if (visible) return;
      if (attempt === 2) return;
      await this.page.reload({ timeout: 60000 }).catch(() => {});
    }
  }

  async openView(customerSearchText) {
    await this.gotoList();
    await this.page.getByText(customerSearchText, { exact: false }).first().click();
    await this.page.waitForURL('**/view-opportunity');
    await this.page.waitForLoadState('networkidle');
  }

  // CONFIRMED AGAINST SOURCE: the real Opportunity->Quotation link. Only call this from an
  // Opportunity view page (openView/openViewById), not from Add. Same stuck-on-its-own-bare-
  // loading-spinner class of bug as every other module in this suite - retry with a reload
  // rather than trust one wait, using the Payment Terms field as the "did it actually render"
  // signal since that's the first field QuotationPage.fillRequiredFieldsAndSave touches.
  async convertToQuotation() {
    await this.makeQuotationButton.click();
    await this.page.waitForURL('**/add-quotation**');
    const paymentTermsField = this.page.getByText('Payment Terms *', { exact: true }).first();
    // Capped at ONE reload (not several).
    for (let attempt = 1; attempt <= 2; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const visible = await paymentTermsField.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      if (visible) return;
      if (attempt === 2) return; // let the caller's own field interactions surface the real error
      await this.page.reload({ timeout: 60000 }).catch(() => {});
    }
  }

  // CONFIRMED LIVE: Customer can arrive already pre-filled AND disabled (arriving via a Lead's
  // Convert button) - same pre-filled-breaks-the-placeholder-locator issue as Priority/Lead
  // Status/Country in LeadPage.js. Skip entirely if disabled (locked from the Convert flow -
  // exactly what a chained test wants) or if it already shows the desired text; only fight the
  // locator for a genuinely-empty standalone Add.
  async selectCustomer(searchText) {
    if (!searchText) return;
    const isDisabled = await this.customerDropdown.getAttribute('aria-disabled').catch(() => null);
    if (isDisabled === 'true') return;
    const currentText = ((await this.customerDropdown.textContent().catch(() => '')) || '')
      .replace(/[​﻿]/g, '').trim();
    if (currentText.startsWith(searchText)) return; // already the desired customer
    await selectDropdown(this.page, this.customerDropdown, searchText, searchText);
  }

  // Same DD-MM-YYYY format as BasePage.formatDateToday(), used identically for date textboxes
  // throughout this suite (e.g. RfqPage.setDateToToday()) - Expected Closing Date makes more
  // business sense as a near-future date than today, so default 30 days out (Yup: min_date=today).
  formatFutureDate(daysFromNow = 30) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }

  async fillExpectedClosingDate(dateStr) {
    await this.expectedClosingDateInput.fill(dateStr || this.formatFutureDate());
  }

  async selectStage(value) {
    if (!value) return;
    await selectDropdown(this.page, this.stageDropdown, value, value, { optional: true });
  }

  async selectPriority(value) {
    if (!value) return;
    await selectDropdown(this.page, this.priorityDropdown, value, value, { optional: true });
  }

  // location_id - required (Yup); may already be empty regardless of arrival path (not copied
  // from the Lead, which has no equivalent required Location field).
  async selectLocation(searchText) {
    const currentText = ((await this.locationDropdown.textContent().catch(() => '')) || '')
      .replace(/[​﻿]/g, '').trim();
    if (currentText && !/^Search /i.test(currentText)) return;
    await selectDropdown(this.page, this.locationDropdown, searchText || '', searchText || '', { optional: false });
  }

  async fillBasicDetails({ expectedRevenue, phone, email } = {}) {
    if (expectedRevenue !== undefined) await this.expectedRevenueInput.fill(String(expectedRevenue));
    if (phone !== undefined) await this.phoneInput.fill(phone);
    if (email !== undefined) await this.emailInput.fill(email);
  }

  async goToAddressTab() {
    await this.nextButton.click();
    await expect(this.addressTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
  }

  async goToContactTab() {
    await this.nextButton.click();
    await expect(this.contactTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
  }

  // Opens the Items table's own "Add" modal, searches Item by whichever text is given (empty =
  // pick first available, same "first available" convention as 07-inventory-item.spec.ts/
  // erpforce-stock-transfer.spec.js for fields whose exact live master-data value isn't pinned),
  // fills Quantity/Rate/Tax Template (all required per Yup) and saves the row.
  async addItem({ itemSearchText = '', quantity, rate } = {}) {
    await this.addItemButton.click();
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

    // Quantity is required (confirmed live and against Yup: item_entries.quantity) - leaving it
    // empty keeps this modal open after Save with no thrown error, silently leaving the Items
    // table empty. Always fill it, default 1.
    const qtyInput = this.itemModal.getByText(/^Quantity\s*\*?$/i).first()
      .locator('xpath=..')
      .locator('input');
    if (await qtyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await qtyInput.fill(String(quantity ?? 1));
    }

    // Rate is ALSO required (item_entries.rate) - CONFIRMED LIVE: this was missing entirely,
    // leaving Rate genuinely empty ("Please add rate" inline error) and every downstream Amount
    // field (Gross/Tax/Net/Total) stuck at 0/empty since they're computed from it - Save then
    // silently never closes the modal, with no thrown error to explain why. The selected Item's
    // own default price does NOT pre-fill this field (confirmed live), so always fill it.
    const rateInput = this.itemModal.getByText(/^Rate\s*\*?$/i).first()
      .locator('xpath=..')
      .locator('input');
    if (await rateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rateInput.fill(String(rate ?? 100));
    }
    await this.page.waitForTimeout(500); // let any debounced amount recompute settle

    // Tax Template is also required (item_entries.tax_template_id) - same "pick first available"
    // convention as the rest of this suite, confirmed live for Inventory Item's own Default Tax.
    const taxCombobox = this.itemModal.getByText(/^Tax Template\s*\*?$/i).first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
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
      throw new Error('Item modal did not close after Save - likely a validation error inside it (see screenshot)');
    }
  }

  // CONFIRMED LIVE: a stale MUI backdrop left over from the last dropdown selection (same quirk
  // documented in helpers/dropdown.js) can silently swallow this click with no visible error and
  // no navigation - dismiss any stray backdrop first, and retry once if the click still didn't
  // navigate anywhere.
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

  // Fills whatever this Page Object knows is required and not already pre-filled, regardless of
  // whether this Add form was reached standalone or via a Lead's Convert button - safe either
  // way since every setter here is itself a no-op when the field already has a real value.
  async fillRequiredFieldsAndSave(data = {}) {
    await this.selectCustomer(data.customerSearchText);
    await this.fillExpectedClosingDate(data.expectedClosingDate);
    await this.fillBasicDetails(data);
    await this.selectStage(data.stage);
    await this.selectPriority(data.priority);
    await this.selectLocation(data.locationSearchText);
    await this.addItem({ itemSearchText: data.itemSearchText, quantity: data.itemQuantity });
    await this.save();
  }

  // CONFIRMED AGAINST SOURCE (add-opportunity.tsx onSubmit): a brand-new Opportunity's "Save"
  // click (not "Save To Draft") still submits with is_draft:1 regardless - a genuine app bug.
  // onSubmit's ternary is `(opportunityState?.id && vals?.opportunity?.id) ? updateOpportunity(vals)
  // : saveAsDraft(values)` - the ELSE branch (a brand-new record) passes the ORIGINAL `values`
  // object, not `vals`, even though `vals` is what explicitly sets `is_draft: 0`. `vals` only
  // ever reaches the server on the `updateOpportunity` branch, i.e. editing an ALREADY-existing
  // record. Net effect: every fresh Opportunity save lands in Draft status regardless of which
  // button was clicked, and Draft records don't show "Make Quotation" (view-opportunity/
  // components/header-buttons.tsx only renders it in the `!is_draft` branch).
  // Workaround: open the just-created Draft's own Edit page and Save again - this second save
  // has a real id, so onSubmit takes the updateOpportunity(vals) branch and actually clears the
  // Draft flag.
  async promoteFromDraftIfNeeded(opportunityId) {
    // CONFIRMED LIVE: checking for "Draft" text BEFORE acting is itself unreliable - the chip can
    // render after the rest of the page (same class of slowness documented throughout this
    // suite), so an early check can false-negative and skip the Edit+Save fix entirely even
    // though the record genuinely still needs it (confirmed live: a run with no DEBUG log at all
    // from the block below still ended up Draft, meaning the early check wrongly concluded "not
    // draft" and returned without ever attempting the fix). Always attempt Edit+Save
    // unconditionally instead of gating on that read - re-saving an already-non-draft record with
    // the same data via the same "update" endpoint is harmless/idempotent - then verify success
    // AFTER acting (a check failing there means genuinely still Draft, not a rendering race).
    // Retry the whole cycle up to 3 times.
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.openViewById(opportunityId);
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      await this.page.getByRole('button', { name: 'Edit', exact: true }).click();
      await this.page.waitForURL('**/edit-opportunity**', { timeout: 15000 });
      // Same stuck-on-its-own-bare-loading-spinner class of bug as every other module in this
      // suite - retry with a reload rather than trust one wait before clicking Save. Capped at
      // ONE reload (not several).
      for (let reloadAttempt = 1; reloadAttempt <= 2; reloadAttempt++) {
        await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        const visible = await this.saveButton.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
        if (visible) break;
        if (reloadAttempt === 2) break;
        await this.page.reload({ timeout: 60000 }).catch(() => {});
      }
      // The Save button being visible doesn't mean the form has actually hydrated with this
      // record's existing data yet - clicking Save while that underlying fetch is still in
      // flight can silently take the "create new draft" branch instead of "update" (the ternary
      // this file's own header comment documents depends on Redux state populated by that fetch),
      // leaving is_draft:1 regardless of how many times this retries. Wait for a field that only
      // shows a real value once the fetch has resolved before clicking Save.
      await expect(this.expectedClosingDateInput).not.toHaveValue('', { timeout: 15000 }).catch(() => {});

      // Capture the actual update request/response as the SOURCE OF TRUTH instead of trusting
      // navigation - CONFIRMED LIVE the Save click can be silently swallowed (same stray-
      // backdrop/click-race class of issue documented throughout this suite) with no request
      // ever firing, which then made a hard, unguarded waitForURL right after throw and abort
      // this whole function instead of letting the outer retry loop try again. If no response
      // comes back, click Save a second time in place before giving up on this attempt - same
      // "edit second time" recovery this method already relies on for the is_draft bug itself.
      let response = await this.captureUpdateResponse();
      if (!response) {
        console.log(`DEBUG promoteFromDraftIfNeeded attempt ${attempt}: first Save click produced no response - retrying the click once`);
        response = await this.captureUpdateResponse();
      }

      if (response) {
        const body = await response.json().catch(() => null);
        console.log(
          `DEBUG promoteFromDraftIfNeeded attempt ${attempt}: ${response.request().method()} ${response.url()} -> ${response.status()}`,
          JSON.stringify(body).slice(0, 800),
        );
      } else {
        console.log(`DEBUG promoteFromDraftIfNeeded attempt ${attempt}: no matching opportunity update response captured after retry - Save may be genuinely stuck this attempt`);
      }

      // Don't let a stuck/slow navigation crash the whole function - a failed attempt should
      // just fall through to the outer loop's next attempt instead of throwing uncaught.
      const navigated = await this.page.waitForURL(
        /\/(view-opportunity|dashboard\/crm\/orders\/opportunity(\?.*)?$)/,
        { timeout: 20000 },
      ).then(() => true).catch(() => false);
      if (!navigated) continue;
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Verify AFTER acting whether it's still Draft - a longer, more generous wait than any
      // precondition check needs, since we're not gating an action on it, just deciding whether
      // to retry the cycle.
      const stillDraft = await this.page.getByText('Draft', { exact: true }).first()
        .isVisible({ timeout: 10000 }).catch(() => false);
      if (!stillDraft) return;
    }
    throw new Error(`promoteFromDraftIfNeeded: Opportunity ${opportunityId} still Draft after 3 attempts`);
  }

  // Single click-and-capture used by promoteFromDraftIfNeeded's own first-try/retry-once pair.
  async captureUpdateResponse() {
    const responsePromise = this.page.waitForResponse(
      (r) => /opportunit/i.test(r.url()) && ['POST', 'PUT', 'PATCH'].includes(r.request().method()),
      { timeout: 15000 },
    ).catch(() => null);
    await this.save();
    return responsePromise;
  }

  async createOpportunity(data) {
    await this.goto();
    await this.fillRequiredFieldsAndSave(data);
  }

  async openEditById(id) {
    await this.openViewById(id);
    await this.actionsButton.click();
    await this.editMenuItem.waitFor({ state: 'visible' });
    await this.editMenuItem.click();
    await this.page.waitForURL('**/edit-opportunity**', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = OpportunityPage;
