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
  // "Search X" fields are custom combobox triggers, not native inputs - their visible
  // prompt text is the accessible name, not a real placeholder attribute.
  async openDropdownAndPick(placeholder, optionText) {
    const combobox = this.page.getByRole('combobox', { name: placeholder });
    const option = this.page.getByText(optionText, { exact: true }).first();

    // Same KNOWN APP BUG documented on selectLocation: ANY of these DynamicSelect-family
    // fields can show "No data available" if a sibling field's selection interrupts this
    // field's own fetch mid-flight (confirmed live via screenshot on Currency this time, not
    // just Location) - retrying with an Escape + settle in between reliably recovers it.
    for (let attempt = 1; attempt <= 6; attempt++) {
      await combobox.click({ force: true });
      try {
        // force: true - fields backed by a native-style MuiSelect (e.g. Currency) can have
        // their own MuiBackdrop still mid-transition when the option becomes visible,
        // intercepting the click even though the option itself is genuinely visible/stable.
        await option.click({ force: true, timeout: 7000 });
        return;
      } catch (e) {
        if (attempt === 6) throw e;
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(500);
      }
    }
  }

  // Structural, label-based lookup for DynamicSelect-family fields - unlike name-based lookup
  // (openDropdownAndPick), this doesn't care whether the combobox's accessible name is currently
  // the "Search X" prompt or an already-selected value, so it can't race against that value
  // changing between a caller's own "is it still blank" check and the click itself (confirmed
  // live on Currency: a `getByRole('combobox', {name:'Search Currency'})` count() check saw it
  // blank, but the field's name had already changed by the time the click ran moments later).
  async selectFieldByLabel(labelText, optionText) {
    const combobox = this.page.getByText(labelText, { exact: true }).locator('xpath=following::*[@role="combobox"][1]');
    const option = this.page.getByText(optionText, { exact: true }).first();

    // 6 attempts, not 3: each open/close cycle has an empirically ~50% chance of hitting a
    // freshly-loaded options list rather than the stuck "No data available" state (confirmed
    // live on Location: option count flipped 0 -> 28 -> 0 across 3 naive same-page attempts) -
    // 3 attempts has a non-trivial chance of failing purely on bad luck, not a real block.
    for (let attempt = 1; attempt <= 6; attempt++) {
      await combobox.click({ force: true });
      try {
        await option.click({ force: true, timeout: 7000 });
        return;
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
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    await this.page.getByRole('textbox', { name: 'Select Date' }).fill(`${dd}-${mm}-${yyyy}`);
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
    const option = this.page.getByText(locationName, { exact: true }).first();
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
        return;
      } catch (e) {
        if (attempt === 6) throw e;
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(500);
      }
    }
  }

  // ---------- Items ----------
  async addItem({ itemName, quantity, rate }) {
    // exact: true avoids matching the "Items*Please add atleast one Item" accordion header,
    // whose accessible name contains "add" as a case-insensitive substring.
    await this.page.getByRole('button', { name: 'Add', exact: true }).click();

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
    await this.page.locator('table tbody tr').first().locator('button').first().click(); // pencil/edit icon
    const modal = this.page.getByRole('dialog').filter({ hasText: 'Edit Item' });

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
    const [, listResponse] = await Promise.all([
      this.page.getByRole('button', { name: buttonName, exact }).click(),
      this.page.waitForResponse((r) => r.url().includes('/purchase/v1/purchase-requests/?')),
    ]);
    await this.page.waitForLoadState('networkidle');
    const record = (await listResponse.json()).data.purchase_requests[0];
    return { id: String(record.id), seriesNumber: record.series_number };
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
    const row = this.rowBySeriesNumber(seriesNumber);
    return (await row.getByText(/Draft|Pending|In Progress|Completed|Rejected/).first().textContent()) ?? '';
  }

  // ---------- Edit page value readers ----------
  async isIdFieldReadOnly() {
    return this.page.getByRole('textbox', { name: 'ID', exact: true }).isDisabled();
  }

  // ---------- Delete ----------
  async confirmDelete() {
    const dialog = this.page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    // No toast-text assertion here (the exact wording/id format it embeds is unverified on this
    // account) - the caller verifies the row/record is actually gone afterward instead, which is
    // the durable signal that the action took effect.
    await expect(dialog).not.toBeVisible();
  }

  // ---------- Approval flow ----------
  async quickApproval(userName) {
    await this.openSubmitMenu();
    await this.page.getByText('Quick Approval', { exact: true }).click();

    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Quick Approval' });
    await dialog.getByText('Select').click();
    // The options list renders as a portal outside the dialog's DOM subtree, so it must be
    // queried at the page level even though it appears visually inside the modal. A
    // case-sensitive RegExp gives a substring match, which is needed if the user list ever
    // has near-duplicate entries differing only by case (see purchaseAgreement.page.ts).
    await this.page.getByRole('option', { name: new RegExp(userName) }).click();
    await this.page.keyboard.press('Escape'); // close the dropdown panel

    await dialog.getByRole('button', { name: 'Send Request' }).click();
    await expect(this.page.getByText('Requests has been submitted for approval.')).toBeVisible();
  }

  async accept() {
    await this.openSubmitMenu();
    // menuitem role disambiguates from the underlying main "Accept" button, which shares
    // the same exact text and stays in the DOM under the open menu.
    await this.page.getByRole('menuitem', { name: 'Accept', exact: true }).click();
    await this.page.getByRole('button', { name: 'Submit' }).click(); // confirmation dialog
    await expect(this.page.getByText('Requests has been approved successfully.')).toBeVisible();
  }

  async reject() {
    await this.openSubmitMenu();
    await this.page.getByRole('menuitem', { name: 'Reject', exact: true }).click();
    await this.page.getByRole('button', { name: 'Submit' }).click(); // confirmation dialog
    await expect(this.page.getByText('Requests has been rejected successfully.')).toBeVisible();
  }

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
}

module.exports = ProcurementRequestPage;
