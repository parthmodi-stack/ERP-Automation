const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class RfqPage extends BasePage {
  // ---------- Navigation ----------
  async gotoList() {
    await this.page.goto('/dashboard/procurement/orders/request-for-quote', { timeout: 60000 });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // networkidle can fire before the page has actually rendered anything under this
    // environment's latency (same class of issue documented on the sibling Procurement
    // Request/Purchase Agreement pages) - wait for the "Add" button, always present once ready.
    await this.page.getByRole('button', { name: 'Add' }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoAdd() {
    await this.gotoList();
    await this.page.getByRole('button', { name: 'Add' }).first().click();
    await this.page.waitForURL('**/add-request-for-quote');
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // Wait for the form to render by checking for a stable field like Date.
    await this.page.getByRole('textbox', { name: 'Select Date' }).first().waitFor({ state: 'visible', timeout: 15000 });
    // Vendor/Entity/Currency/Purchase Representative's dependent-fetch chain can get stuck on
    // "Loading..." indefinitely on page load (see BasePage's own comment on this) - recover before
    // any later step can hang on it.
    await this.recoverFromStuckLoadingFields();
  }

  async gotoEdit(id) {
    if (!id) throw new Error(`gotoEdit() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/orders/request-for-quote/${id}/edit-request-for-quote`, { timeout: 60000 });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.getByRole('textbox', { name: 'Select Date' }).first().waitFor({ state: 'visible', timeout: 15000 });
    // Same stuck-"Loading..." class of bug as gotoAdd() - confirmed live, TC-RFQ-09: Vendor/
    // Entity/Currency/Purchase Representative all got permanently stuck here on a bare page load.
    await this.recoverFromStuckLoadingFields();
  }

  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/orders/request-for-quote/${id}/view-request-for-quote`);
    // networkidle can hang forever when the SPA keeps background connections alive (notifications
    // polling, analytics, etc.) - use a short race so we don't block the entire test timeout.
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  // ---------- Generic helpers ----------
  // openDropdownAndPick()/selectFieldByLabel() now live on BasePage - "Search X" fields are
  // custom combobox triggers, not native inputs, so their visible prompt text is the accessible
  // name, not a real placeholder attribute. This module always attempts combobox.fill() (see the
  // `tryFill: true` passed at each call site below).

  // Selecting a Vendor in the RFQ form cascades: it auto-populates Entity, Currency, Exchange
  // Rate, and Payment Term from the vendor's master data. These fields are set asynchronously
  // via Redux after a customer-data fetch, so we must wait for the dependent Entity combobox to
  // update before interacting with other fields.
  // NOT "Company": the underlying field name is `company_id`, but its rendered paragraph label
  // is literally "Entity *" (confirmed live via ARIA snapshot) - same field-name-vs-label-text
  // mismatch already documented on the sibling Procurement Request/Purchase Agreement pages.
  async waitForVendorDependentFields() {
    const entityLabel = this.page.getByText('Entity', { exact: false }).first();
    const entityCombobox = entityLabel.locator('xpath=following::*[@role="combobox"][1]');
    await expect(entityCombobox).not.toHaveText('', { timeout: 15000 });
    // Additional settle time for Currency and Exchange Rate fields.
    await this.page.waitForTimeout(1500);
  }

  // Reads the Entity combobox's current visible text - used to scope a freshly created Location
  // to whichever Entity/Company is ACTUALLY selected right now (same reasoning as
  // ProcurementRequestPage.getSelectedCompany).
  async getSelectedEntity() {
    const entityCombobox = this.page
      .getByText('Entity', { exact: false })
      .first()
      .locator('xpath=following::*[@role="combobox"][1]');
    return ((await entityCombobox.textContent()) || '').replace(/[​﻿]/g, '').trim();
  }

  // Location (Basic Details, optional field, plain "Location" label - no trailing asterisk,
  // unlike Procurement Request's required "Location *") - same ever-shifting "25 most-recently-
  // created, no working search filter" window as every sibling module's Location/Shipping
  // Address field (confirmed live: RFQ's OWN Shipping Address field hit this exact issue when its
  // pinned "Dhule" fell out of the window). Create a brand new Location from the field's own
  // "+ Create New Location" footer action every time instead, scoped to whichever Entity is
  // currently selected. `namePrefix` seeds the generated name; returns the actual generated name.
  async selectLocation(namePrefix) {
    const combobox = this.page
      .getByText('Location', { exact: true })
      .first()
      .locator('xpath=following::*[@role="combobox"][1]');

    const entityName = (await this.getSelectedEntity()) || 'erp-force';
    const locationName = `${namePrefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.createLocationFromFooter(locationName, entityName, { combobox });
        return locationName;
      } catch (e) {
        if (attempt === 2) throw e;
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(500);
      }
    }
  }

  // KNOWN APP QUIRK, confirmed live: the Address & Contact tab's Shipping Address field only
  // populates its options once Entity is marked "dirty" via an explicit re-selection - even to
  // its own current value. Entity already holds a default value from page load (or from the
  // vendor cascade), but the location-fetch effect that feeds Shipping Address's options never
  // runs until the user actively re-selects it (confirmed via network capture: zero
  // location-fetch requests fire otherwise, and Shipping Address's option list stays empty).
  async reselectEntityToTriggerShippingAddress() {
    const entityCombobox = this.page.getByText('Entity', { exact: false }).first().locator('xpath=following::*[@role="combobox"][1]');
    // Web-first wait: this field can still show its transient "Loading..." placeholder text
    // (DynamicSelect-family fields pass through this before resolving, same class of issue
    // BasePage's own dropdown helpers already guard against) right after a fresh page load whose
    // own pre-fill fetch hasn't settled yet (confirmed live, TC-PREQ-26: Create RFQ's
    // fetchPurchaseRequestById was still in flight) - a raw one-shot textContent() read here can
    // capture "Loading..." itself as `currentValue`, which then can never be found in the
    // listbox. Wait for a real, settled value before capturing it.
    await expect(entityCombobox).not.toHaveText(/^(Loading\.\.\.)?$/, { timeout: 15000 });
    const currentValue = ((await entityCombobox.textContent()) || '').replace(/[\u200B\uFEFF]/g, "").trim();

    // Same known DynamicSelect stuck-fetch/MuiBackdrop-intercept bug as every other dropdown in
    // this suite - retry with an Escape + settle in between.
    for (let attempt = 1; attempt <= 6; attempt++) {
      await entityCombobox.click({ force: true });
      try {
        const found = await this.selectOptionFromListbox(currentValue);
        if (found) {
          await this.page.waitForTimeout(1500);
          return;
        }
        throw new Error(`Option "${currentValue}" not found in listbox`);
      } catch (e) {
        if (attempt === 6) throw e;
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(500);
      }
    }
  }

  // Editing a record on a later day than it was created leaves its stored Date in the past,
  // which the form rejects on save ("Date cannot be in the past") - reset it to today first.
  async setDateToToday() {
    await this.page.getByRole('textbox', { name: 'Select Date' }).first().fill(this.formatDateToday());
  }

  // ---------- Basic Details ----------
  async fillBasicDetails({ vendor, purchaseRepresentative, narration } = {}) {
    if (vendor) {
      await this.openDropdownAndPick(/Vendor/i, vendor, { tryFill: true });
      // Wait for vendor-dependent fields (Entity, Currency, Exchange Rate) to cascade.
      await this.waitForVendorDependentFields();
    }
    if (purchaseRepresentative) {
      await this.openDropdownAndPick(/Representative/i, purchaseRepresentative, { tryFill: true });
    }
    if (narration) {
      await this.page.getByPlaceholder('Enter Narration').fill(narration);
    }
  }

  // ---------- Address & Contact ----------
  // Contact Person and Shipping Address are BOTH required fields on this tab that Vendor
  // selection does NOT auto-populate (confirmed live: only Vendor Address auto-fills) - Save
  // fails validation without them. Must be called after fillBasicDetails's vendor selection,
  // while still on the Basic Details tab (re-selecting Entity happens there), before this
  // method switches to the Address & Contact tab itself.
  async fillAddressContact({ contactPerson, shippingAddress, vendorAddress } = {}) {
    await this.reselectEntityToTriggerShippingAddress();
    await this.page.getByText('Address & Contact', { exact: true }).click();
    await this.page.waitForTimeout(1000);
    if (vendorAddress) {
      await this.selectFieldByLabel('Vendor Address *', vendorAddress);
    }
    if (contactPerson) {
      await this.selectFieldByLabel('Contact Person *', contactPerson);
    }
    if (shippingAddress) {
      // This field's option list only ever shows the 25 most-recently-created Locations with no
      // working search filter (same class of issue already documented on Purchase Agreement's
      // own Location field) - any pinned literal value, even a previously-confirmed-live one like
      // "Dhule", eventually gets evicted by newer automation-created Location records (confirmed
      // live, TC-PREQ-26: "Dhule" was no longer in the available list at all). Try the requested
      // value first, but fall back to whichever option renders first rather than failing the
      // whole flow over an address whose specific identity doesn't drive any test assertion.
      await this.selectFieldByLabel('Shipping Address *', shippingAddress).catch(() =>
        this.selectFirstOptionByLabel('Shipping Address *'),
      );
    }
    // The Items accordion (addItem()) lives on Basic Details, not this tab - switch back so
    // callers can chain straight into addItem() without needing to know about tabs themselves.
    // KNOWN APP QUIRK: selectFieldByLabel uses `force: true` to click the Shipping Address
    // option (bypassing the MUI Backdrop's pointer-event interception), but the underlying
    // MuiMenu/Popover component (`menu-rfq_contacts.shipping_address`) can remain mounted in
    // the DOM with its invisible Backdrop still intercepting pointer events on the rest of the
    // page - Escape explicitly closes it before we attempt the tab switch.
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
    await this.page.getByText('Basic Details', { exact: true }).click();
    await this.page.waitForTimeout(500);
  }

  // ---------- Items ----------
  async addItem({ itemName, requestedQuantity }) {
    // exact: true avoids matching the "Items*Please add atleast one Item" accordion header.
    // .first(): the Basic Details tab also has a "Call For Tender" accordion with its own
    // identically-labeled "Add" button further down the page - Items comes first in DOM order.
    // clickWithDialogRetry (BasePage) guards against a lingering dialog/backdrop from a PRIOR item
    // modal still intercepting pointer events (confirmed live, TC-RFQ-15).
    await this.clickWithDialogRetry(() => this.page.getByRole('button', { name: 'Add', exact: true }).first());

    const modal = this.page.getByRole('dialog');
    let combobox = modal.getByRole('combobox', { name: /Item/i }).first();
    if (await combobox.count() === 0) {
      const labelElement = modal.getByText('Item', { exact: false }).first();
      combobox = labelElement.locator('xpath=following::*[@role="combobox"][1]');
    }
    await combobox.click();
    await this.page.getByText(itemName, { exact: true }).first().click();

    // Wait for item defaults (Vendor Item Name, UOM) to populate from the async item-data fetch.
    await this.page.waitForTimeout(2000);

    if (requestedQuantity) {
      await modal.locator('text=Requested Quantity').locator('xpath=following::input[1]').fill(requestedQuantity);
    }

    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();
  }

  async editFirstItem({ requestedQuantity } = {}) {
    // Scoped to tbody rows to target the row's edit icon, not column header buttons.
    await this.clickWithDialogRetry(() => this.page.locator('table tbody tr').first().locator('button').first());
    const modal = this.page.getByRole('dialog');

    if (requestedQuantity) {
      await modal.locator('text=Requested Quantity').locator('xpath=following::input[1]').fill(requestedQuantity);
    }

    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();
  }

  // ---------- Save actions ----------
  // The saved record has TWO distinct identifiers that are NOT derivable from one another:
  // `id` (the raw DB primary key, used in edit/view URLs) and `series_number` (the formatted
  // string actually rendered in the list's ID column). Callers need `id` for gotoEdit/gotoView
  // and `seriesNumber` for anything that finds the row in the list.
  async saveAndCaptureId(buttonName, exact) {
    const [, listResponse] = await Promise.all([
      this.page.getByRole('button', { name: buttonName, exact }).click(),
      this.page.waitForResponse((r) => r.url().includes('/purchase/v1/rfq/?')),
    ]);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const record = (await listResponse.json()).data.rfqs[0];
    return { id: String(record.id), seriesNumber: record.series_number };
  }

  async saveAsDraft() {
    return this.saveAndCaptureId(/Save.*Draft/i, false);
  }

  async save() {
    return this.saveAndCaptureId('Save', true);
  }

  // ---------- List actions ----------
  async editFromList(id, seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByText('Edit', { exact: true }).click();
    await this.page.waitForURL(new RegExp(`${id}/edit-request-for-quote`));
  }

  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Draft|Open|RFQ Sent|Response Received|Pending Order|Order|Completed|Cancelled/);
  }

  // ---------- Edit page value readers ----------
  async isIdFieldReadOnly() {
    // The RFQ ID field is a disabled text input.
    const idField = this.page.locator('input[name="rfq.id"]');
    if (await idField.count() > 0) {
      return idField.isDisabled();
    }
    // Fallback: try via role
    return this.page.getByRole('textbox', { name: /ID/i }).first().isDisabled();
  }

  // ---------- Delete ----------
  // confirmDelete() now lives on BasePage unchanged.

  // ---------- Status actions (RFQ-specific) ----------
  // The RFQ module does NOT have an approval workflow. Instead, it has:
  // - Save (Draft → Open)
  // - Cancel (Open/Draft → Cancelled)
  // - Create (Order/Response/Agreement) — available on Open/RFQ Sent/Response Received

  async cancelFromView() {
    await this.page.getByRole('button', { name: 'Actions' }).click();
    await this.page.getByText('Cancel', { exact: true }).click();
    // Confirmation dialog
    const dialog = this.page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).not.toBeVisible();
  }

  // ---------- Create Order / Response / Agreement ----------
  // "Create" is a DropdownButton that only renders for certain statuses, but reuses the exact
  // same "select merge strategy" caret/MuiMenu pattern as the approval-workflow modules' submit
  // menu - clickSubmitMenuItem() (BasePage) already retries the whole open-menu-then-click
  // sequence for that shared pattern (same MuiMenu remount-on-open instability documented there),
  // so reuse it here instead of a bare openSubmitMenu() + one-shot click.
  async createOrder() {
    await this.clickSubmitMenuItem(/Order/i);
  }

  async createResponse() {
    await this.clickSubmitMenuItem(/Response/i);
  }

  // ---------- RFQ Response (Create > Response) ----------
  // WRITTEN FROM erpforce-fe/erpforce-be SOURCE, NOT YET LIVE-VERIFIED end-to-end - same
  // "unverified live" caveat this repo already carries for VendorReturnAuthorizationPage.
  // add-response-for-quote.tsx re-fetches the source RFQ by id (route state's
  // requestForQuoteData.id -> fetchRequestForQuoteId) and spreads the ENTIRE source RFQ object
  // into the response form (form.tsx's own reset({ rfq_response: { ...data, id: null } })) -
  // Vendor/Currency/Company/Purchase Representative/Narration/Items all arrive pre-filled from
  // that fresh fetch. Two things are NOT safe to leave as-is though: Date carries over the source
  // RFQ's own (now-past) date and must be reset via setDateToToday(), and Payment Terms is a
  // required field (Yup-enforced) that is NEVER pre-filled from the source RFQ at all - Save
  // fails validation without it.
  //
  // No URL/route param identifies which RFQ this is for (route: `.../request-for-quote/
  // add-response`, no id segment) - the page reads it purely from React Router location.state,
  // which only gets set by createResponse()'s own in-app click navigation above. A bare
  // page.goto() to this URL would redirect straight back to the RFQ list (source-confirmed), so
  // this method only waits for the navigation createResponse() already triggered - it doesn't (and
  // can't) navigate here directly itself.
  async waitForResponseFormReady() {
    await this.page.waitForURL(/\/request-for-quote\/add-response/);
    await this.page.getByRole('textbox', { name: 'Select Date' }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  // Payment Terms' exact live option text in this account is unverified, so pick whichever
  // renders first rather than guessing a literal string (same approach PurchaseOrderPage takes
  // for its own unverified required fields) unless a caller explicitly needs a specific value.
  async selectResponsePaymentTerms(paymentTermName) {
    if (paymentTermName) {
      await this.selectFieldByLabel('Payment Terms *', paymentTermName);
    } else {
      await this.selectFirstOptionByLabel('Payment Terms *');
    }
  }

  // Item/Vendor Item Name/Purchase Order/Requested Quantity/Estimated Quantity Per Year/
  // Description are all disabled, pre-filled read-only fields on this modal (response's own
  // item-entry-modal.tsx) - Rate is the one field genuinely required (Yup-enforced) and left
  // blank by the source-RFQ copy, so it's the only one that actually needs filling for Save to
  // pass item validation.
  async editResponseItemRate(rate) {
    // clickWithDialogRetry (BasePage) guards against a lingering dialog/backdrop from the
    // just-closed source-RFQ item modal still intercepting pointer events here (confirmed live,
    // TC-RFQ-15: a raw single click here hung the full 90s test timeout on
    // "MuiDialog-container"/"MuiBackdrop-root subtree intercepts pointer events").
    await this.clickWithDialogRetry(() => this.page.locator('table tbody tr').first().locator('button').first());
    const modal = this.page.getByRole('dialog');
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    await modal.locator('text=Rate').locator('xpath=following::input[1]').fill(rate);
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(modal).not.toBeVisible();
  }

  // Response has a single Save action (no Draft concept reachable from the FE, source-confirmed:
  // no "Save as Draft" button anywhere in this form) - posts to `/v1/rfq/:id/response`, which also
  // flips the PARENT RFQ's own status to "Response Received" server-side (only from Open/RFQ
  // Sent, source-confirmed in rfq-response.service.js). Callers verify that flip via
  // gotoView(sourceRfqId) rather than this page's own view-response page, which (like the
  // Responses listing) also depends on React Router location.state and isn't reliably
  // deep-linkable the same way gotoView's plain id-based URL is.
  async saveResponse() {
    await Promise.all([
      this.page.waitForResponse((r) => r.request().method() === 'POST' && /\/rfq\/\d+\/response/.test(r.url())),
      this.page.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  // ---------- Module-level business method ----------
  // Matches the spec file's own local createDraftRfq() helper body exactly.
  async createDraft(data) {
    await this.gotoAdd();
    await this.fillBasicDetails({
      vendor: data.vendor,
      purchaseRepresentative: data.purchaseRepresentative,
      narration: data.narration,
    });
    // Optional field - only present on testData entries that explicitly opt into it (see
    // testData.rfq.valid.location's own comment).
    if (data.location) {
      await this.selectLocation(data.location);
    }
    await this.fillAddressContact({
      contactPerson: data.contactPerson,
      shippingAddress: data.shippingAddress,
      vendorAddress: data.vendorAddress,
    });
    await this.addItem({ itemName: data.itemName, requestedQuantity: data.requestedQuantity });
    return this.saveAsDraft();
  }
}

module.exports = RfqPage;
