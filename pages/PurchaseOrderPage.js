const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// UNVERIFIED LIVE: this page object was written from FE source reading (validator.ts,
// basic-details-tab.tsx, header-buttons.tsx, purchase-order.tsx) rather than iterative live
// debugging like the sibling Procurement Request/Purchase Agreement/RFQ pages - it hasn't been
// run against dev.erpforce.co yet. Locators favor structural/regex lookups over guessed exact
// strings wherever the source wasn't unambiguous, to reduce (not eliminate) the risk of drift.
class PurchaseOrderPage extends BasePage {
  // ---------- Navigation ----------
  async gotoList() {
    await this.page.goto('/dashboard/procurement/orders/purchase-order');
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.getByRole('button', { name: 'Add' }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoAdd() {
    await this.gotoList();
    // The Add button is a dropdown offering "Item"/"Fixed Asset" - this suite only exercises
    // the standard Item-based flow (Fixed Asset mode hides/disables several item-modal fields).
    await this.page.getByRole('button', { name: 'Add' }).first().click();
    const itemOption = this.page.getByRole('menuitem', { name: 'Item', exact: true });
    if (await itemOption.count() > 0) {
      await itemOption.click();
    }
    await this.page.waitForURL('**/add-purchase-order');
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.getByRole('textbox', { name: 'Purchase Order ID' }).waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoEdit(id) {
    if (!id) throw new Error(`gotoEdit() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/purchase-order/${id}/edit-purchase-order`);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.getByRole('textbox', { name: 'Purchase Order ID' }).waitFor({ state: 'visible', timeout: 15000 });
    // CONFIRMED LIVE: Vendor/Entity/Currency's dependent-fetch chain can get stuck showing
    // "Loading..." indefinitely on a bare Edit page load - same shared DynamicSelect-family bug
    // documented on BasePage.recoverFromStuckLoadingFields, already guarded on gotoAdd() but
    // missing here. Recover before any later step (fillBasicDetails, getEditComboboxValue) can
    // hang or read a stale "Loading..." value.
    await this.recoverFromStuckLoadingFields();
  }

  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/purchase-order/${id}/view-purchase-order`);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  // ---------- Generic helpers ----------
  // openDropdownAndPick()/selectFieldByLabel()/selectFirstOptionByLabel() now live on BasePage
  // (same DynamicSelect quirks documented on the sibling pages - this module always attempts
  // combobox.fill(), see the `tryFill: true` passed at each call site below).

  // Editing a record on a later day than it was created leaves its stored Date in the past,
  // which the form rejects on save - reset it to today first. Scoped to the "Date" label (NOT
  // "Confirmation Date"/"Expected Receipt Date", separate fields sharing the same "Select Date"
  // placeholder). CONFIRMED LIVE: the label itself renders as "Date *" (trailing required-field
  // asterisk) - an exact:true match against "Date" alone finds ZERO matches and hangs. Use an
  // anchored regex (^Date\s*\*?$) so it still excludes "Confirmation Date"/"Expected Receipt
  // Date" (neither starts with "Date"), same fix as selectLocation's identical asterisk bug.
  async setDateToToday() {
    const dateLabel = this.page.getByText(/^Date\s*\*?$/, { exact: false }).first();
    await dateLabel.locator('xpath=following::input[1]').fill(this.formatDateToday());
  }

  // ---------- Basic Details ----------
  // CONFIRMED LIVE: Vendor/Entity/Currency/Payment Terms arrive PRE-FILLED with account defaults
  // on a fresh Add form (e.g. Entity defaults to "erp-force", Currency to "INR", Payment Terms to
  // "Net 30"). Once a combobox holds a value, its accessible name IS that value ("erp-force"),
  // not the "Search Entity" placeholder - so openDropdownAndPick's name-based lookup
  // (getByRole('combobox', { name: /Entity/i })) stops matching and times out. selectFieldByLabel
  // is structural (finds the combobox via its adjacent label, not its accessible name) and already
  // short-circuits when the current value matches, so it's used here instead - same fix already
  // proven for Location/Payment Terms on this page.
  async fillBasicDetails({ vendor, entity, currency, purchaseRepresentative, narration } = {}) {
    if (vendor) {
      await this.selectFieldByLabel('Vendor', vendor, { exact: false });
    }
    if (entity) {
      await this.selectFieldByLabel('Entity', entity, { exact: false });
    }
    if (currency) {
      await this.selectFieldByLabel('Currency', currency, { exact: false });
    }
    if (purchaseRepresentative) {
      await this.selectFieldByLabel('Purchase Representative', purchaseRepresentative, { exact: false });
    }
    if (narration) {
      await this.page.getByPlaceholder('Enter Narration').fill(narration);
    }
  }

  // Reads the Entity combobox's current visible text - used to scope a freshly created Location
  // to whichever Entity is ACTUALLY selected right now (Location's own options are entity-scoped,
  // same convention as ProcurementRequestPage.getSelectedCompany).
  async getSelectedEntity() {
    const combobox = this.page
      .getByText('Entity *', { exact: true })
      .first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    return ((await combobox.textContent()) || '').replace(/[​﻿]/g, '').trim();
  }

  // CONFIRMED LIVE, two distinct issues fixed here:
  //  1. The Basic Details label renders as "Location *" (trailing required-field asterisk in the
  //     same text node), so an exact:true match against "Location" alone finds ZERO matches there
  //     and instead lands on the unrelated Items grid's "Location" COLUMN HEADER (no asterisk, no
  //     combobox) - selectFieldByLabel then hangs waiting on a combobox that was never found.
  //  2. A pinned literal location name (e.g. "Dhule") eventually gets evicted from the field's own
  //     unfiltered "25 most recent" options window by newer automation-created Location records
  //     account-wide (confirmed live: selectFieldByLabel's own thrown error listed 25 available
  //     options, none of them "Dhule") - the exact same rot already documented and fixed on
  //     ProcurementRequestPage.selectLocation. Rather than keep re-pinning a literal that will
  //     inevitably rot again, create a brand new Location from the field's own "+ Create New
  //     Location" footer action every time, scoped to whichever Entity is currently selected.
  // `namePrefix` seeds the generated name (existing callers keep passing a familiar seed like
  // "Dhule") - a per-call timestamp+random suffix is appended so concurrent/rapid calls never
  // collide. Returns the actual generated name for callers that need to assert on it later.
  async selectLocation(namePrefix) {
    const combobox = this.page
      .getByText('Location *', { exact: true })
      .first()
      .locator('xpath=following::*[@role="combobox"][1]');

    const companyName = (await this.getSelectedEntity()) || 'erp-force';
    const locationName = `${namePrefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.createLocationFromFooter(locationName, companyName, { combobox });
        return locationName;
      } catch (e) {
        if (attempt === 2) throw e;
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(500);
      }
    }
  }

  // Payment Terms may pre-populate when the PO is sourced from a Request/RFQ/Agreement, but often
  // arrives empty (confirmed live: "Search Payment Terms" placeholder + "Payment term is required"
  // error). Select the first REAL option only when the field is still empty ("required"). NOTE:
  // this DynamicSearchSelect renders its own search box as the FIRST role="option" in the listbox,
  // so a bare .getByRole('option').first() clicks that input, not a value - filter it out (and the
  // "Select ..."/"No data" placeholders), the same way BasePage.selectFirstAvailableOption does.
  async selectPaymentTerm() {
    const combobox = this.page
      .getByText(/^Payment\s+Terms/i)
      .first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();

    // Already selected (pre-populated from source) - nothing to do.
    const currentValue = ((await combobox.textContent().catch(() => '')) || '')
      .replace(/[​﻿]/g, '')
      .trim();
    if (currentValue && !/Search Payment Terms/i.test(currentValue)) {
      return;
    }

    await this.selectFirstAvailableOption(combobox);
    await this.page.waitForTimeout(200);
  }

  // ---------- Address & Contact ----------
  // Vendor Address, Contact Person, and Shipping Address are all required on this tab.
  async fillAddressContact() {
    await this.page.getByText('Address & Contact', { exact: true }).click();
    await this.page.waitForTimeout(500);
    await this.selectFirstOptionByLabel('Vendor Address');
    await this.selectFirstOptionByLabel('Contact Person');
    await this.selectFirstOptionByLabel('Shipping Address');
    // The Items accordion lives on Basic Details - switch back so callers can chain straight
    // into addItem() without needing to know about tabs themselves.
    await this.page.getByText('Basic Details', { exact: true }).click();
    await this.page.waitForTimeout(500);
  }

  // ---------- Items ----------
  // `taxTemplate`/`discountItem` are OPTIONAL. When true (or a string), the item-entry modal's
  // Tax Template / Discount Item dropdowns are set from the first available option before Save
  // (source: item-entry-modal.tsx - both are DynamicSearchSelect apiType taxTemplate/
  // discountedItems; selecting a discount item auto-fills the disabled Discount Rate (%), there
  // is NO "Discounted Item" toggle). Pass a string to pick a specific option instead of first.
  // Backward compatible: existing { itemName, quantity, rate } callers are unaffected.
  async addItem({ itemName, quantity, rate, taxTemplate, discountItem } = {}) {
    await this.page.getByRole('button', { name: 'Add', exact: true }).first().click();

    // CONFIRMED LIVE: a bare /Item/i accessible-name regex strict-mode-violates here - the modal
    // also has a "Search Discount Item" combobox whose name substring-matches the same regex.
    // The item selector's own placeholder is the exact string "Search Item" (parallel to every
    // other module's "Search X" combobox trigger convention) - match it exactly to disambiguate.
    const modal = this.page.getByRole('dialog').filter({ hasText: /Item/i });
    await modal.getByRole('combobox', { name: 'Search Item', exact: true }).click();

    // CONFIRMED LIVE: the popover's own default (unfiltered) option list only shows a limited
    // recent-N window and does NOT reliably include a specific pinned item - the same "options
    // window" rot already documented for Location. The open popover renders its own real "Search
    // Item" <input> (distinct from the closed-state trigger div of the same visible text, which
    // has no real placeholder attribute) as a SIBLING of the listbox, not a descendant of it -
    // scoping the lookup to getByRole('listbox') finds nothing and silently no-ops. Target the
    // placeholder unscoped instead (only a real <input> carries a placeholder attribute, so this
    // stays unambiguous even with the trigger's visually-identical text nearby).
    await this.page.getByPlaceholder('Search Item').fill(itemName).catch(() => {});
    const found = await this.selectOptionFromListbox(itemName, { timeout: 7000 });
    if (!found) {
      const available = await this.page.getByRole('listbox').getByRole('option').allTextContents();
      throw new Error(
        `addItem(): item "${itemName}" never appeared in the dropdown. Available: ${JSON.stringify(available.map((o) => o.trim()))}`,
      );
    }

    // Selecting an item patches in defaults (Vendor Item Name, UOM) via an async fetch - wait
    // for the read-only Vendor Item Name field before filling anything, same pattern as the
    // sibling Purchase Agreement page's item modal.
    await expect(modal.getByRole('textbox', { name: 'Vendor Item Name' })).not.toHaveValue('', { timeout: 5000 });

    // CONFIRMED LIVE: selecting Discount Item/Tax Template re-triggers the same defaults-patch
    // effect as the initial Item selection, which OVERWRITES a Rate already typed in beforehand
    // (observed: a manually-entered Rate of "100" reverted to the item's own default vendor price
    // after Tax Template was selected) - the resulting Gross/Tax/Net amounts then get computed off
    // that stale/reverted Rate. Select Discount Item/Tax Template FIRST, then fill Quantity/Rate
    // LAST so nothing subsequent can overwrite them before Save.
    if (discountItem) {
      await this.selectModalDropdown(modal, 'Discount Item', discountItem);
    }
    if (taxTemplate) {
      await this.selectModalDropdown(modal, 'Tax Template', taxTemplate);
    }

    // "text=/^Quantity/" and "text=/^Rate/" match the label whether or not it renders with a
    // trailing required-field "*" - unconfirmed live which form this account uses.
    await modal.locator('text=/^Quantity/').locator('xpath=following::input[1]').fill(quantity);
    await modal.locator('text=/^Rate/').locator('xpath=following::input[1]').fill(rate);

    await this.waitForItemAmountsToSettle(modal);

    // CONFIRMED LIVE: waitForItemAmountsToSettle only guards against an EMPTY Gross Amount string,
    // but the field can transiently render "0.0000" (non-empty) mid-debounce before the real
    // Qty*Rate total lands - Save fired on that stale zero and the whole row (Gross/Tax/Discount/
    // Net/Total) persisted as zero despite a real Rate/Quantity. When both are non-zero (a real
    // total is expected), poll until Gross Amount is actually non-zero before proceeding.
    if (Number(quantity) > 0 && Number(rate) > 0) {
      const grossAmount = modal.locator('text=Gross Amount').locator('xpath=./following::input[1]');
      await expect(async () => {
        const val = parseFloat(((await grossAmount.inputValue()) || '').replace(/[^\d.-]/g, '')) || 0;
        expect(val).toBeGreaterThan(0);
      }).toPass({ timeout: 8000 });
    }

    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();

    // The outer Summary sidebar (Total/Subtotal/Grand Total) recomputes asynchronously AFTER the
    // item modal closes - confirmed live: a caller reading getSummaryValue() immediately after
    // addItem() returns can catch it mid-recompute (rendering "-"). Give it a moment to settle so
    // Summary reads right after this call are reliable.
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(300);
  }

  // Adds several items in sequence (multi-line PO). Each entry is a full addItem() payload.
  async addItems(items = []) {
    for (const item of items) {
      await this.addItem(item);
    }
  }

  // selectModalDropdown(modal, labelText, value) is inherited from BasePage (shared by the item/
  // expense modals here and the GRN traceability Bin dropdown) - see BasePage.js.

  async editFirstItem({ quantity, rate } = {}) {
    await this.page.locator('table tbody tr').first().locator('button').first().click();
    const modal = this.page.getByRole('dialog').filter({ hasText: /Item/i });

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

  // ---------- Expenses ----------
  // The "Expenses" tab (within the Items region, only when settings.enable_purchase_expense is
  // on) has its own "Add" button that opens an "Expense Detail" modal (source:
  // expense-entry-modal.tsx). Account/Tax Template/Location/Department are required dropdowns
  // whose exact option text is unverified in this account, so pick the first available option
  // for each; only Rate is a literal. Switches to the Expenses tab, fills, saves, and stays put.
  async addExpense({ rate } = {}) {
    await this.page.getByRole('tab', { name: 'Expenses' }).click();
    await this.page.waitForTimeout(300);
    // The Expenses tab's own "Add" button (not the Item Entries one) - scope to the visible
    // expenses tabpanel to avoid matching the Item Entries Add.
    const expensesPanel = this.page.getByRole('tabpanel').filter({ hasText: /Expense|No Data/i }).last();
    await expensesPanel.getByRole('button', { name: 'Add', exact: true }).first().click();

    const modal = this.page.getByRole('dialog').filter({ hasText: /Expense/i });
    await this.selectModalDropdown(modal, 'Account', true);
    if (rate !== undefined) {
      await modal.locator('text=/^Rate/').locator('xpath=following::input[1]').fill(String(rate));
    }
    await this.selectModalDropdown(modal, 'Tax Template', true);
    await this.selectModalDropdown(modal, 'Location', true);
    await this.selectModalDropdown(modal, 'Department', true);

    await this.waitForItemAmountsToSettle(modal).catch(() => {});
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();
    // Return to Item Entries so callers chaining addItem() afterwards find the right grid.
    await this.page.getByRole('tab', { name: 'Item Entries' }).click();
    await this.page.waitForTimeout(300);
  }

  // ---------- Grid / summary readers ----------
  async getItemRowCount() {
    return this.page.locator('table tbody tr').filter({ hasNot: this.page.getByText('No Data') }).count();
  }

  // getSummaryValue(label) is inherited from BasePage. Summary section headers must be expanded
  // (they are by default). Note the source label quirks baked into the strings: "Grand Total "
  // and "Subtotal Excluding Taxes " have a trailing space, and "Total Taxes and Charges Addeds"
  // is misspelled - getSummaryValue's trimmed/whitespace-tolerant regex already tolerates these.

  // ---------- Create GRN (Receive) ----------
  // The "Receive" split-button on an APPROVED PO's View page launches GRN creation, navigating to
  // /purchase-order/:poId/grn/add-grn with the PO in router state (source: header-buttons.tsx).
  // It only renders when the PO is Approved (or Billed with pending receiving) AND some item still
  // has remaining quantity. Unlike Submit/Accept this is a plain button, not a caret menu.
  async clickReceive() {
    await this.page.getByRole('button', { name: 'Receive', exact: true }).click();
  }

  // ---------- Create Vendor Return (View page Actions menu) ----------
  // Source: header-buttons.tsx's Action menu "Return" item, navigating to ADD_VENDOR_RETURNS
  // with `{ purchaseOrder: data, source: 'purchase_order' }` in router state. Only rendered when
  // isFullActionMenu is true (Approved + receiving_status Partially/Fully Received via at least
  // one GRN, or status Received/Billed) AND the PO isn't already fully returned - unlike Receive,
  // this lives in the "Actions" caret menu, not its own top-level button.
  async createVendorReturn() {
    await this.page.getByRole('button', { name: 'Actions' }).click();
    await this.page.getByRole('menuitem', { name: 'Return' }).click();
  }

  // ---------- Save actions ----------
  // Dual identifiers, same pattern documented on every sibling page: `id` (raw PK, used in
  // edit/view URLs) and `series_number` (the formatted string rendered in the list's ID column).
  async saveAndCaptureId(buttonName, exact) {
    // 30s (not the 15s actionTimeout default): the list-refetch response can occasionally take
    // longer than 15s to land after Submit/Save - matches the same headroom already given to
    // GRN's own save().
    const [, listResponse] = await Promise.all([
      this.page.getByRole('button', { name: buttonName, exact }).click(),
      this.page.waitForResponse((r) => r.url().includes('/purchase/v1/purchase-orders/?'), { timeout: 30000 }),
    ]);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const record = (await listResponse.json()).data.purchase_orders[0];
    return { id: String(record.id), seriesNumber: record.series_number };
  }

  async saveAsDraft() {
    return this.saveAndCaptureId(/Save.*Draft/i, false);
  }

  // NOT a literal "Save" button - add-purchase-order.tsx's own main action button renders
  // `{t("common.submit")}` (source-confirmed: en.ts's `common.submit` = "Submit"), unlike every
  // sibling module (Procurement Request/Purchase Agreement/RFQ), whose main action really is
  // "Save". Anchored whole-string regex (not a bare substring alternation) so this can't also
  // match the OTHER, differently-worded buttons on the same form ("Save To Draft", "Discard") -
  // a plain `/Submit|Save/i` would strict-mode-violate by matching both at once.
  async save() {
    return this.saveAndCaptureId(/^(Submit|Save)$/, false);
  }

  // ---------- List actions ----------
  async editFromList(id, seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByText('Edit', { exact: true }).click();
    await this.page.waitForURL(new RegExp(`${id}/edit-purchase-order`));
  }

  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Draft|Pending Approval|Pending|Approved|Received|Billed|Rejected|Cancelled|Closed/);
  }

  // CONFIRMED FROM SOURCE (erpforce-common-hub-fe's action-bar.tsx): the search icon button
  // (`showSearch` branch), filter icon button, and the Add control are all rendered as DIRECT
  // children of the same stable `.action-bar--RightContent` container, in that fixed order. This
  // page passes `isDropdownMenuButton` (Add offers Item/Fixed Asset - see gotoAdd()), so its Add
  // renders as a `DropdownButton` composite (its OWN internal ButtonGroup wrapping Add + caret) in
  // place of every sibling module's plain single `Button` - nesting Add one level deeper and
  // breaking BasePage's shared sibling-counting xpath (which counts backward from Add itself).
  // Target the search icon as the FIRST direct-child button of the stable container instead -
  // this doesn't care how deeply Add/DropdownButton nests its own internals.
  async ensureSearchInputOpen() {
    const searchInput = this.page.getByPlaceholder('Search', { exact: true });
    if (await searchInput.isVisible().catch(() => false)) {
      return searchInput;
    }
    await this.page.locator('.action-bar--RightContent > button').first().click();
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
    return searchInput;
  }

  // ---------- Edit page value readers ----------
  isIdFieldReadOnly() {
    return this.page.getByRole('textbox', { name: 'Purchase Order ID' }).isDisabled();
  }

  // ---------- Delete / Approval flow ----------
  // confirmDelete()/quickApproval() are inherited from BasePage unchanged - Submit/Quick
  // Approval/Accept/Reject come from the same shared ApprovalWrapper component as Purchase
  // Agreement/Procurement Request.
  //
  // CONFIRMED LIVE: accept/reject's actual toasts (a real role="alert" snackbar) read exactly
  // "Purchase Order Accepted"/"Purchase Order Rejected" - NOT BasePage's default
  // /approved successfully/i / /rejected successfully/i, despite the i18n source keys
  // (procurement.purchaseOrder.msg.requestApproved/requestRejected = "... has been
  // approved/rejected successfully.") suggesting otherwise; some other status-change toast
  // appears to win the race by the time the assertion runs. Override with a regex covering both
  // wordings, in case either is actually shown depending on timing/environment.
  async accept(opts = {}) {
    return super.accept({ successToast: /Purchase Order Accepted|approved successfully/i, ...opts });
  }

  async reject(opts = {}) {
    return super.reject({ successToast: /Purchase Order Rejected|rejected successfully/i, ...opts });
  }

  // ---------- Create from Request/RFQ/Agreement ----------
  // WRITTEN FROM erpforce-fe/erpforce-be SOURCE, NOT YET LIVE-VERIFIED - same "unverified live"
  // caveat this whole file already carries. No URL/route param identifies which source record
  // this is for (route: `.../purchase-order/add-purchase-order`, no id segment) - the page reads
  // it purely from React Router location.state (a confusingly-named `purchase_order` key whose
  // VALUE is actually the source Request/RFQ/Agreement object, not an actual purchase order), set
  // only by the originating page's own in-app click navigation. A bare page.goto() to this URL
  // would never populate that state, so this method only waits for the navigation the caller
  // already triggered (e.g. ProcurementRequestPage.createOrder()) - it doesn't (and can't)
  // navigate here directly itself.
  async waitForCreateFromSourceReady() {
    await this.page.waitForURL(/\/purchase-order\/add-purchase-order/);
    await this.page.getByRole('textbox', { name: 'Purchase Order ID' }).waitFor({ state: 'visible', timeout: 15000 });
    await this.recoverFromStuckLoadingFields();
  }

  // ---------- Module-level business method ----------
  // Matches the spec file's own local createDraftWithItem() helper body exactly.
  async createDraft(data) {
    await this.gotoAdd();
    await this.fillBasicDetails({
      vendor: data.vendor,
      entity: data.entity,
      currency: data.currency,
      purchaseRepresentative: data.purchaseRepresentative,
      narration: data.narration,
    });
    await this.selectLocation(data.location);
    await this.selectPaymentTerm();
    await this.fillAddressContact();
    await this.addItem({ itemName: data.itemName, quantity: data.quantity, rate: data.rate });
    return this.saveAsDraft();
  }
}

module.exports = PurchaseOrderPage;
