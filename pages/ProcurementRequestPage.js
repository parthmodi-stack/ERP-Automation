const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class ProcurementRequestPage extends BasePage {
  // ---------- Navigation ----------
  async gotoList() {
    await this.page.goto('/dashboard/procurement/requests');
    await this.page.waitForLoadState('networkidle');
    // networkidle can fire before the page has actually rendered anything under this
    // environment's latency (confirmed live: a bare loading spinner, no list/table content at
    // all, under concurrent multi-worker load) - wait for the "Add" button, always present once
    // the list is ready, same pattern gotoEdit()/gotoAdd()/gotoView() already use.
    await this.page.getByRole('button', { name: 'Add' }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoAdd() {
    await this.gotoList();
    await this.page.getByRole('button', { name: 'Add' }).first().click();
    await this.page.waitForURL('**/add-requests');
    await this.page.waitForLoadState('networkidle');
    // Location's options are entity-scoped; selecting it before the default Entity resolves
    // can race and time out. Other flows avoid this incidentally via prior field selections.
    await expect(this.page.getByRole('combobox').first()).not.toHaveText('', { timeout: 10000 });
  }

  async gotoEdit(id) {
    if (!id) throw new Error(`gotoEdit() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/requests/${id}/edit-requests`);
    await this.page.waitForLoadState('networkidle');
    // networkidle can fire before the form has actually finished rendering under this
    // environment's latency (confirmed live via screenshot: still showing a loading spinner
    // well after networkidle) - wait for a field that's always present once the form is ready,
    // same pattern gotoAdd() already uses.
    await this.page.getByRole('textbox', { name: 'Select Date' }).waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/requests/${id}/view-requests`);
    await this.page.waitForLoadState('networkidle');
    // networkidle can fire before the page has actually rendered anything under this
    // environment's latency (confirmed live on the sibling Purchase Agreement page: a fully
    // blank white page, no content at all, under concurrent multi-worker load) - wait for the
    // breadcrumb's own "ID:" text, always present once the View page is ready, same pattern
    // gotoEdit()/gotoAdd() already use.
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  // ---------- Generic helpers ----------
  // openDropdownAndPick()/selectFieldByLabel() now live on BasePage (identical 6-attempt
  // retry/escape/wait-500ms skeleton this page and every sibling procurement module relied on
  // independently) - "Search X" fields are custom combobox triggers, not native inputs, so their
  // visible prompt text is the accessible name, not a real placeholder attribute.

  // Editing a record on a later day than it was created leaves its stored Date in the past,
  // which the form rejects on save ("Date cannot be in the past") - reset it to today first.
  async setDateToToday() {
    await this.page.getByRole('textbox', { name: 'Select Date' }).fill(this.formatDateToday());
  }

  // ---------- Basic Details ----------
  async fillBasicDetails({ purchaseRepresentative, vendor, currency, narration } = {}) {
    if (purchaseRepresentative) {
      await this.openDropdownAndPick('Search Purchase Representative', purchaseRepresentative);
    }
    if (vendor) {
      await this.openDropdownAndPick('Search Vendor', vendor);
    }
    if (currency) {
      // Currency defaults to a real value on the Add form and does not round-trip onto the
      // Edit form (confirmed live: blank immediately after navigating to Edit) - re-selecting
      // it structurally by label is a no-op-equivalent on Add (still picks the same value) and
      // a fix on Edit, and doesn't care which state the combobox's accessible name is in.
      await this.selectFieldByLabel('Currency *', currency);
    }
    if (narration) {
      await this.page.getByPlaceholder('Enter Narration').fill(narration);
    }
  }

  // TEMPORARY WORKAROUND: on this project's dev.erpforce.co account, the Location field's
  // translation key (crm.salesOrder.fields.location_label) isn't resolving, so its paragraph
  // label reads literally "crm.salesOrder.fields.location_label *" instead of "Location *"
  // (confirmed live via ARIA snapshot - this is a real app/content bug, not a test issue).
  // Also, unlike what an earlier pass assumed, this field DOES already hold a value on the
  // Edit page in this account's current data - once populated, a combobox's accessible NAME
  // becomes that value instead of any "Search X" prompt (confirmed live: name was literally
  // "Test_Location_Playwright_UPDATED_..."), so selecting by combobox name can never work
  // reliably here. Locate structurally via the paragraph label instead (same pattern as
  // purchaseAgreement.page.ts's selectFieldByLabel), which works whether the field is blank,
  // pre-filled, or under the broken translation key.
  async selectLocation(locationName) {
    const properLabelText = 'Location *';
    const brokenLabelText = 'crm.salesOrder.fields.location_label *';
    const label = this.page
      .getByText(properLabelText, { exact: true })
      .or(this.page.getByText(brokenLabelText, { exact: true }));
    const combobox = label.locator('xpath=following::*[@role="combobox"][1]');
    // Scoped to the open listbox popover, not the whole page - unlike every other dropdown
    // helper in this file, this was previously a page-wide getByText(...).first(), which could
    // silently resolve to a same-text element outside the popover. Even scoped to the listbox,
    // this field has a SECOND decoy match: the popover's own search textbox is wrapped in a
    // role="option" element whose accessible name mirrors whatever's currently typed (confirmed
    // live via ARIA snapshot: two "option \"Dhule\"" entries after typing "Dhule" - one wrapping
    // a nested "Search Location" textbox, one a real <paragraph> option below it). `.first()`
    // resolved to the decoy every time - a force-click on it "succeeds" (no error) but selects
    // nothing, so the real popover never closes and is left covering whatever renders underneath
    // it (this is exactly what blocked the Items "Add" button). Exclude any option that contains
    // a nested textbox to reliably land on the real, selectable one.
    const option = this.page
      .getByRole('listbox')
      .getByRole('option', { name: locationName, exact: true })
      .filter({ hasNot: this.page.getByRole('textbox') })
      .first();
    // The visible search box only exists inside the popover once it's open, as its OWN
    // element (not a sibling of the trigger, and not the same as the trigger's hidden
    // `MuiSelect-nativeInput` shadow input - confirmed live those are two different elements).
    // Its placeholder mirrors the (possibly broken-i18n) field label.
    const searchInput = this.page
      .getByPlaceholder('Search Location')
      .or(this.page.getByPlaceholder('Search crm.salesOrder.fields.location_label'));

    // The dropdown's default (unfiltered) list only returns the 25 most-recently-created
    // records (confirmed live via its own API call: `order=id:-1&limit=25`) - values outside
    // that ever-shifting window never appear without searching. Typing into the popover's own
    // search input DOES trigger a real filtered re-fetch (confirmed live: a `search=<value>`
    // query param gets appended and the target value comes back) - my earlier conclusion that
    // search was broken was from typing into the wrong (hidden) element.
    //
    // Separately, this field can ALSO hit a genuine app bug (documented in memory, not fixed
    // here - it lives in the shared erpforce-common-hub-fe DynamicSelect component and we were
    // told not to touch it): its `isAlreadyLoaded` flag can get stuck true when a sibling
    // field's selection (Purchase Representative/Vendor, selected just before this call) causes
    // a form-wide re-render mid-fetch, permanently blocking the options list for that open
    // attempt (confirmed via trace network-log: zero HTTP requests fire when this happens). A
    // plain re-click without closing first is NOT reliable (the popover can still be "open"
    // from the failed attempt, so the next click just toggles it shut instead of triggering a
    // fresh fetch) - an explicit Escape + short settle before reopening is what actually
    // re-triggers it.
    for (let attempt = 1; attempt <= 6; attempt++) {
      await combobox.click({ force: true });
      if (await searchInput.first().isVisible().catch(() => false)) {
        await searchInput.first().fill(locationName);
        await this.page.waitForTimeout(1000);
      }
      try {
        // force: true - this menu's own MuiBackdrop can still be mid-transition (rendered
        // "invisible" but still intercepting pointer events) right as the popover opens, which
        // fails Playwright's actionability check even though the option itself is genuinely
        // visible/stable (same class of issue as the Purchase Representative/Vendor fields).
        await option.click({ force: true, timeout: 7000 });
        // A force click bypasses normal interaction semantics and can leave the popover
        // rendered "expanded" with its full option list still in the DOM (confirmed live via
        // ARIA snapshot: the listbox stayed open and blocked a later Save button click) even
        // though the value itself did get selected - explicitly verify it closes rather than
        // assuming the click's side effects did. Escape alone isn't always enough (nothing may
        // have keyboard focus after a forced click), so fall back to clicking an inert corner
        // of the page to force a blur/outside-click dismissal.
        await this.page.keyboard.press('Escape');
        const listbox = this.page.getByRole('listbox');
        if (await listbox.isVisible().catch(() => false)) {
          await this.page.locator('body').click({ position: { x: 2, y: 2 }, force: true });
          await expect(listbox).not.toBeVisible({ timeout: 5000 }).catch(() => {});
        }
        // Verify the click actually committed a value - confirmed live (TC-PREQ-05) that this
        // exact sequence can complete with no thrown error while the combobox is still showing
        // its blank "Search Location" placeholder, later failing Save's own "Location is
        // required" validation. Don't trust "the click didn't throw" as proof of success; treat
        // a non-matching combobox value as a failed attempt and let the retry loop try again.
        const committedValue = (await combobox.innerText().catch(() => '')).replace(/[​﻿]/g, '').trim();
        if (!committedValue.includes(locationName)) {
          throw new Error(`selectLocation("${locationName}") did not commit - combobox shows "${committedValue}"`);
        }
        return;
      } catch (e) {
        if (attempt === 6) throw e;
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(500);
      }
    }
  }

  // ---------- Items ----------
  // A prior dropdown (e.g. Location) can reopen its popover well AFTER the code that selected
  // a value from it has already moved on - confirmed live: closing it right after selection
  // (selectLocation's own Escape+backdrop-click) genuinely succeeds in the moment, but it comes
  // back seconds later regardless, consistently and reproducibly. Root cause: the field's own
  // debounced search request (fired when its search box was typed into) can still be in flight
  // under this environment's real network latency - when that LATE response finally lands, the
  // underlying DynamicSelect component re-renders as "open" simply because it now has options to
  // show, independent of whether a selection was already made. There's no reliable fixed delay
  // to wait out here, so any click elsewhere on the page needs to defend against the popover
  // having silently reappeared in between, not just check for it once beforehand.
  async closeAnyOpenPopover() {
    const openListbox = this.page.getByRole('listbox');
    if (await openListbox.isVisible().catch(() => false)) {
      await this.page.keyboard.press('Escape');
      await this.page.locator('body').click({ position: { x: 2, y: 2 }, force: true });
      await expect(openListbox).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  }

  async addItem({ itemName, quantity, rate }) {
    // exact: true avoids matching the "Items*Please add atleast one Item" accordion header,
    // whose accessible name contains "add" as a case-insensitive substring.
    const addButton = this.page.getByRole('button', { name: 'Add', exact: true });
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.closeAnyOpenPopover();
      try {
        await addButton.click({ timeout: 5000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }

    const modal = this.page.getByRole('dialog').filter({ hasText: 'Edit Item' });
    await modal.getByRole('combobox', { name: 'Search Item' }).click();
    await this.page.getByText(itemName, { exact: true }).first().click();

    await modal.getByPlaceholder('0.00').first().fill(quantity); // Quantity field
    await modal.locator('text=Rate *').locator('xpath=following::input[1]').fill(rate);

    await this.waitForItemAmountsToSettle(modal);
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();
  }

  async editFirstItem({ quantity, rate } = {}) {
    // Scoped to tbody rows: `table.getByRole('button')` would match the column header's
    // sort/arrow-icon buttons first, not the row's own edit/delete icon buttons.
    // A prior dropdown (e.g. Location) can reopen its popover asynchronously well AFTER a
    // one-time close check already passed (see closeAnyOpenPopover's comment) - a single
    // check-then-click isn't enough. NOT force:true here: a forced click still dispatches at
    // the target's real screen coordinates, so if the popover is genuinely covering that exact
    // position when the click fires, force just clicks the popover instead of failing loudly -
    // the modal then never opens and every later step fails deep inside `modal.locator(...)`
    // with a confusing error. A normal (non-forced) click blocks on real obscuring elements and
    // throws if one's still there, so the retry loop below can react to a genuine miss.
    const editIcon = this.page.locator('table tbody tr').first().locator('button').first();
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.closeAnyOpenPopover();
      try {
        await editIcon.click({ timeout: 5000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }
    const modal = this.page.getByRole('dialog').filter({ hasText: 'Edit Item' });
    await modal.waitFor({ state: 'visible', timeout: 10000 });

    if (quantity) {
      await modal.locator('text=Quantity *').locator('xpath=following::input[1]').fill(quantity);
    }
    if (rate) {
      await modal.locator('text=Rate *').locator('xpath=following::input[1]').fill(rate);
    }
    if (quantity || rate) {
      await this.waitForItemAmountsToSettle(modal);
    }
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();
  }

  // ---------- Save actions ----------
  // This is a shared, persistent dataset, so the newest row isn't reliably "first" in the
  // list (other records can legitimately sort above it) - capture the list's own refetch after
  // redirect and read the freshly created/updated record straight from its JSON body. That
  // record has TWO distinct identifiers that are NOT derivable from one another (confirmed live:
  // a record with numeric id 305 had series_number "PR-2026-000151" - no padding relationship):
  // `id` (the raw DB primary key, used in edit/view URLs) and `series_number` (the formatted
  // string actually rendered in the list's ID column, e.g. "PR-2026-000151"). Callers need
  // `id` for gotoEdit/gotoView and `seriesNumber` for anything that finds the row in the list.
  async saveAndCaptureId(buttonName, exact) {
    // Same lingering-popover class of issue as addItem()/editFirstItem() above - NOT force:true
    // for the same reason documented on editFirstItem()'s edit-icon click: a forced click can
    // silently land on the popover instead of Save, leaving the subsequent waitForResponse
    // hanging on a request that never fires.
    const saveButton = this.page.getByRole('button', { name: buttonName, exact });
    let listResponsePromise;
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.closeAnyOpenPopover();
      listResponsePromise = this.page.waitForResponse((r) => r.url().includes('/purchase/v1/purchase-requests/?'));
      try {
        await saveButton.click({ timeout: 5000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }
    const listResponse = await listResponsePromise;
    await this.page.waitForLoadState('networkidle');
    const record = (await listResponse.json()).data.purchase_requests[0];
    // The "ID" column renders a FORMATTED display string (e.g. "PR-2026-000349"), not the raw
    // numeric `id` (confirmed live via ARIA snapshot/screenshot - series_number itself does NOT
    // exist as an API field for this module, so this must be a client-side cell formatter, and
    // guessing its exact prefix/year/padding convention is fragile). Read it directly from the
    // list's own first row instead: `record` above IS that same first row (both come from the
    // identical API response the table renders from), so there's no ambiguity about which row.
    await this.page.getByRole('button', { name: 'Add' }).first().waitFor({ state: 'visible', timeout: 15000 });
    const seriesNumber = await this.page.locator('table tbody tr').first().getByRole('link').first().innerText();
    return { id: String(record.id), seriesNumber };
  }

  async saveAsDraft() {
    return this.saveAndCaptureId('Save To Draft', false);
  }

  async save() {
    return this.saveAndCaptureId('Save', true);
  }

  // ---------- List actions ----------
  async editFromList(id, seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByText('Edit', { exact: true }).click();
    await this.page.waitForURL(new RegExp(`${id}/edit-requests`));
  }

  async getRowStatus(seriesNumber) {
    // Callers reach this right after a save's own redirect - networkidle can fire before the
    // list page has actually mounted its search bar (same class of issue documented on
    // gotoList()), so searchList() below can otherwise time out waiting for a placeholder that
    // hasn't rendered yet.
    await this.page.getByRole('button', { name: 'Add' }).first().waitFor({ state: 'visible', timeout: 15000 });
    // This shared, ever-growing dataset can easily exceed the list's default page size (10) -
    // the just-created/edited record isn't guaranteed to land on the currently displayed page
    // (confirmed live: a timeout waiting for a row that genuinely exists, just not on page 1).
    // Search for it explicitly rather than assuming it's already visible.
    await this.searchList(seriesNumber);
    const status = await this.getRowStatusMatching(seriesNumber, /Draft|Pending|In Progress|Completed|Rejected/);
    await this.clearSearch();
    return status;
  }

  // ---------- Edit page value readers ----------
  async isIdFieldReadOnly() {
    return this.page.getByRole('textbox', { name: 'ID', exact: true }).isDisabled();
  }

  // ---------- Delete / Approval flow ----------
  // confirmDelete()/quickApproval()/accept()/reject() now live on BasePage - this module's own
  // toast wording ('Requests has been submitted for approval.' / '...approved successfully.' /
  // '...rejected successfully.') already matches BasePage's default toast regexes, so no override
  // is needed here.

  // ---------- Create Order / RFQ ----------
  // "Create" is another split-button (same "select merge strategy" caret pattern as
  // Submit/Accept) that only renders once status is "In Progress", and only shows the
  // "Order"/"RFQ" menu items the logged-in user has permission for. Its main button is a
  // no-op, same as Accept's.
  async createOrder() {
    await this.openSubmitMenu();
    await this.page.getByRole('menuitem', { name: 'Order', exact: true }).click();
  }

  async createRfq() {
    await this.openSubmitMenu();
    await this.page.getByRole('menuitem', { name: 'RFQ', exact: true }).click();
  }

  // ---------- Module-level business method ----------
  // Matches the spec files' own local createDraftWithItem() helper body exactly - centralizes it
  // here so every spec that needs "a throwaway draft record with one item" calls the same method
  // instead of redefining it per file.
  async createDraft(data) {
    await this.gotoAdd();
    await this.fillBasicDetails({
      purchaseRepresentative: data.purchaseRepresentative,
      vendor: data.vendor,
      narration: data.narration,
    });
    await this.selectLocation(data.location);
    await this.addItem({ itemName: data.itemName, quantity: data.quantity, rate: data.rate });
    return this.saveAsDraft();
  }
}

module.exports = ProcurementRequestPage;
