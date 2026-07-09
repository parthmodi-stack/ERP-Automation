const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class PurchaseAgreementPage extends BasePage {
  // ---------- Navigation ----------
  async gotoList() {
    await this.page.goto('/dashboard/procurement/purchase-agreements');
    await this.page.waitForLoadState('networkidle');
    // networkidle can fire before the page has actually rendered anything under this
    // environment's latency (confirmed live on the sibling Procurement Request page: a bare
    // loading spinner, no list/table content at all, under concurrent multi-worker load) - wait
    // for the "Add" button, always present once the list is ready, same pattern
    // gotoEdit()/gotoAdd()/gotoView() already use.
    await this.page.getByRole('button', { name: 'Add' }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoAdd() {
    await this.gotoList();
    await this.page.getByRole('button', { name: 'Add' }).first().click();
    await this.page.waitForURL('**/add-purchase-agreements');
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.getByRole('combobox').first()).not.toHaveText('', { timeout: 10000 });
  }

  async gotoEdit(id) {
    if (!id) throw new Error(`gotoEdit() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/purchase-agreements/${id}/edit-purchase-agreements`);
    await this.page.waitForLoadState('networkidle');
    // networkidle can fire before the form has actually finished rendering under this
    // environment's latency (confirmed live on the sibling Procurement Request Edit page: still
    // showing a loading spinner well after networkidle) - wait for a field that's always
    // present once the form is ready, same pattern gotoAdd() already uses.
    await this.page.getByRole('textbox', { name: 'Purchase Agreement ID' }).waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/purchase-agreements/${id}/view-purchase-agreements`);
    await this.page.waitForLoadState('networkidle');
    // networkidle can fire before the page has actually rendered anything under this
    // environment's latency (confirmed live: a fully blank white page, no content at all, under
    // concurrent multi-worker load) - wait for the breadcrumb's own "ID:" text, always present
    // once the View page is ready, same pattern gotoEdit()/gotoAdd() already use.
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  // ---------- Generic helpers ----------
  async openDropdownAndPick(placeholder, optionText) {
    const combobox = this.page.getByRole('combobox', { name: placeholder }).first();
    // Scope to the open listbox popover, not the whole page: fields whose value is already
    // shown elsewhere on the page (e.g. the read-only Summary sidebar echoes "Entity: erp-force")
    // create a same-text match outside the dropdown, which getByText would otherwise pick up
    // first - and that stray match sits behind the popover's backdrop, so clicking it hangs.
    // exact: true - several option lists also have entries that are substrings of each other
    // (e.g. Location's "Ahmedabad" vs "Naroda (Ahmedabad)"/"South Bhopal(Ahmedabad)").
    const option = this.page.getByRole('listbox').getByText(optionText, { exact: true }).first();

    // Same KNOWN APP BUG documented on the sibling Procurement Request page: these
    // DynamicSelect-family fields can show "No data available" if a sibling field's selection
    // interrupts this field's own fetch mid-flight - retrying with an Escape + settle in
    // between reliably recovers it.
    for (let attempt = 1; attempt <= 6; attempt++) {
      await combobox.click({ force: true });
      try {
        await combobox.fill(optionText);
      } catch (e) {
        // Ignore if not a text input
      }
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

  // Unlike Entity, Location correctly pre-populates on Edit for this module - so its combobox's
  // accessible name is just as often the CURRENT VALUE as the "Search Location" prompt, and a
  // name-based lookup breaks the moment it already holds something. Locate it structurally via
  // its stable paragraph label instead, which works whether the field is blank or pre-filled.
  async selectFieldByLabel(labelText, optionText) {
    const combobox = this.page.getByText(labelText, { exact: true }).locator('xpath=following::*[@role="combobox"][1]');
    const option = this.page.getByRole('listbox').getByText(optionText, { exact: true }).first();

    // KNOWN APP BUG, confirmed live via the browser's own DevTools Network tab (zero requests
    // fire while typing): this field's search box does NOT call any filter API at all, unlike
    // Procurement Request's equivalent Location field, which searches correctly. So unlike that
    // sibling page, don't attempt to type here - it can only ever wait out a fetch that never
    // happens. Only values already in the default unfiltered "25 most-recently-created" list
    // (`order=id:-1&limit=25`, confirmed via its own API call) are reachable through this field;
    // callers must pass one of those (see testData.js's comment on purchaseAgreement.valid.location).
    for (let attempt = 1; attempt <= 6; attempt++) {
      await combobox.click({ force: true });
      try {
        await option.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
        // force: true - this menu's own MuiBackdrop can still be mid-transition (rendered
        // "invisible" but still intercepting pointer events) right as the popover opens, the
        // same class of issue documented on the sibling Procurement Request page's Location
        // field.
        await option.click({ force: true, timeout: 10000 });
        return;
      } catch (e) {
        if (attempt === 6) throw e;
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(500);
      }
    }
  }

  async selectAgreementType(type) {
    const dropdown = this.page.locator('div[class*="MuiSelect-select"]').first();
    await dropdown.click();
    await this.page.getByRole('option', { name: type }).first().click();
  }

  async setDateToToday() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    // "Date" and "Valid Up To" are both DynamicDate fields sharing the same "Select Date"
    // placeholder/accessible name, so name-based lookup is ambiguous - scope by the field's
    // actual form name instead.
    await this.page.locator('input[name="purchaseAgreement.date"]').fill(`${dd}-${mm}-${yyyy}`);
  }

  // ---------- Basic Details ----------
  async fillBasicDetails({ name, agreementType, vendor, purchaseRepresentative, entity, currency, narration } = {}) {
    if (name) {
      await this.page.getByPlaceholder('Enter Name').fill(name);
    }
    if (agreementType) {
      await this.selectAgreementType(agreementType);
    }
    if (vendor) {
      await this.openDropdownAndPick(/Vendor/i, vendor);
      await this.page.waitForTimeout(1000);
    }
    if (purchaseRepresentative) {
      await this.openDropdownAndPick(/Representative/i, purchaseRepresentative);
    }
    if (entity) {
      // The field's real label/translation is "Entity", not "Company". It only renders blank
      // (matching /Entity/i) on records whose saved value doesn't round-trip through the Edit
      // form - once re-selected to a real master value it correctly persists, so only touch it
      // when it's still showing the empty-state prompt; re-selecting an already-set value can
      // pick a different option than what's currently saved.
      const stillBlank = await this.page.getByRole('combobox', { name: /Entity/i }).count();
      if (stillBlank > 0) {
        await this.openDropdownAndPick(/Entity/i, entity);
        // Location is entity-scoped, and its option list is re-fetched asynchronously after
        // Entity changes - selecting Location immediately after can race that fetch and see
        // the previous entity's (stale) options, intermittently timing out on the new value.
        await this.page.waitForTimeout(2500);
      }
    }
    if (currency) {
      await this.openDropdownAndPick(/Currency/i, currency);
    }
    if (narration) {
      await this.page.getByPlaceholder('Enter Narration').fill(narration);
    }
  }

  async selectLocation(locationName) {
    await this.selectFieldByLabel('Location', locationName);
  }

  // ---------- Items ----------
  async addItem({ itemName, minOrderQty, rate }) {
    await this.page.getByRole('button', { name: 'Add', exact: true }).click();

    const modal = this.page.getByRole('dialog').filter({ hasText: /Item/i });
    await modal.getByRole('combobox', { name: /Item/i }).click();
    await this.page.getByText(itemName, { exact: true }).first().click();

    // Selecting an item triggers an async fetch of its defaults (UoM, description, and Rate
    // are all patched in together); filling Rate immediately after selection races that fetch
    // and gets silently overwritten back to 0 shortly after. "Vendor Item Name" (disabled,
    // read-only) is populated by the same response, so wait for it before filling anything.
    await expect(modal.getByRole('textbox', { name: 'Vendor Item Name' })).not.toHaveValue('', { timeout: 5000 });

    await modal.locator('text=Rate *').locator('xpath=following::input[1]').fill(rate);
    // The field's actual label is "Minimum Order Quantity" (spelled out) - "Qty" is not a
    // substring of "Quantity", so a locator built on the abbreviation never matches.
    await modal.locator('text=Minimum Order Quantity').locator('xpath=following::input[1]').fill(minOrderQty);

    await this.waitForItemAmountsToSettle(modal);
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();
  }

  async editFirstItem({ minOrderQty, rate } = {}) {
    await this.page.locator('table tbody tr').first().locator('button').first().click();
    const modal = this.page.getByRole('dialog').filter({ hasText: /Item/i });

    if (minOrderQty) {
      await modal.locator('text=Minimum Order Quantity').locator('xpath=following::input[1]').fill(minOrderQty);
    }
    if (rate) {
      await modal.locator('text=Rate *').locator('xpath=following::input[1]').fill(rate);
    }
    if (minOrderQty || rate) {
      await this.waitForItemAmountsToSettle(modal);
    }
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).not.toBeVisible();
  }

  // ---------- Save actions ----------
  // The saved record has TWO distinct identifiers that are NOT derivable from one another
  // (confirmed live on the sibling Procurement Request list: a record with numeric id 305 had
  // series_number "PR-2026-000151" - no padding relationship): `id` (the raw DB primary key,
  // used in edit/view URLs) and `series_number` (the formatted string actually rendered in the
  // list's ID column). Callers need `id` for gotoEdit/gotoView and `seriesNumber` for anything
  // that finds the row in the list.
  async saveAndCaptureId(buttonName, exact) {
    const [, listResponse] = await Promise.all([
      this.page.getByRole('button', { name: buttonName, exact }).click(),
      this.page.waitForResponse((r) => r.url().includes('/purchase/v1/purchase-agreements/?')),
    ]);
    await this.page.waitForLoadState('networkidle');
    const record = (await listResponse.json()).data.purchase_agreements[0];
    return { id: String(record.id), seriesNumber: record.series_number };
  }

  async saveAsDraft() {
    return this.saveAndCaptureId(/Save.*Draft/i, false);
  }

  async save() {
    return this.saveAndCaptureId('Save', true);
  }

  async discard() {
    await this.page.getByRole('button', { name: 'Discard' }).click();
  }

  // ---------- List actions ----------
  async editFromList(id, seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByText('Edit', { exact: true }).click();
    await this.page.waitForURL(new RegExp(`${id}/edit-purchase-agreements`));
  }

  async getRowStatus(seriesNumber) {
    const row = this.rowBySeriesNumber(seriesNumber);
    return (
      (await row.getByText(/Draft|Pending|In Progress|Confirmed|Closed|Expired|Rejected/).first().textContent()) ?? ''
    );
  }

  // ---------- Edit page value readers ----------
  async isIdFieldReadOnly() {
    // The field's real accessible name is "Purchase Agreement ID", not "ID" (that's just its
    // paragraph label).
    return this.page.getByRole('textbox', { name: 'Purchase Agreement ID' }).isDisabled();
  }

  // ---------- Delete ----------
  async confirmDelete() {
    const dialog = this.page.getByRole('dialog');
    const deleteBtn = dialog.getByRole('button', { name: /Delete|Confirm/i }).first();
    await deleteBtn.click();
    // The success toast is a short-lived Snackbar that can auto-dismiss before an assertion
    // polls for it under load; callers verify the row/record is actually gone afterward, which
    // is the durable signal that the action took effect.
    await expect(dialog).not.toBeVisible();
  }

  // ---------- Approval flow ----------
  async quickApproval(userName) {
    await this.openSubmitMenu();
    await this.page.getByText('Quick Approval', { exact: true }).click();

    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Quick Approval' });
    await dialog.getByText('Select').click();
    // The user list can have near-duplicate entries differing only by case (separate accounts),
    // and each option's accessible name also includes its avatar-initials prefix, so `exact:
    // true` would never match at all; a case-sensitive RegExp gives a substring match instead.
    await this.page.getByRole('option', { name: new RegExp(userName) }).click();
    await this.page.keyboard.press('Escape');

    await dialog.getByRole('button', { name: 'Send Request' }).click();
    await expect(this.page.getByText(/submitted for approval/i)).toBeVisible();
  }

  async accept() {
    await this.openSubmitMenu();
    await this.page.getByRole('menuitem', { name: 'Accept', exact: true }).click();
    await this.page.getByRole('button', { name: 'Submit' }).click();
    // No toast assertion here - the caller verifies the resulting status badge instead, since
    // the success toast is transient and can auto-dismiss before this could poll for it.
  }

  async reject() {
    await this.openSubmitMenu();
    await this.page.getByRole('menuitem', { name: 'Reject', exact: true }).click();
    await this.page.getByRole('button', { name: 'Submit' }).click();
  }

  async validate() {
    await this.page.getByRole('button', { name: 'Validate' }).click();
    // The confirmation dialog's own button is also labeled "Validate", not "Confirm"/"Submit".
    await this.page.getByRole('dialog').getByRole('button', { name: 'Validate', exact: true }).click();
  }
}

module.exports = PurchaseAgreementPage;
