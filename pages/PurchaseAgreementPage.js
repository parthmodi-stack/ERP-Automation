const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class PurchaseAgreementPage extends BasePage {
  // ---------- Navigation ----------
  async gotoList() {
    await this.page.goto('/dashboard/procurement/purchase-agreements');
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
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
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await expect(this.page.getByRole('combobox').first()).not.toHaveText('', { timeout: 10000 });
  }

  async gotoEdit(id) {
    if (!id) throw new Error(`gotoEdit() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/purchase-agreements/${id}/edit-purchase-agreements`);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // networkidle can fire before the form has actually finished rendering under this
    // environment's latency (confirmed live on the sibling Procurement Request Edit page: still
    // showing a loading spinner well after networkidle) - wait for a field that's always
    // present once the form is ready, same pattern gotoAdd() already uses.
    await this.page.getByRole('textbox', { name: 'Purchase Agreement ID' }).waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`/dashboard/procurement/purchase-agreements/${id}/view-purchase-agreements`);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // networkidle can fire before the page has actually rendered anything under this
    // environment's latency (confirmed live: a fully blank white page, no content at all, under
    // concurrent multi-worker load) - wait for the breadcrumb's own "ID:" text, always present
    // once the View page is ready, same pattern gotoEdit()/gotoAdd() already use.
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  // ---------- Generic helpers ----------
  // openDropdownAndPick()/selectFieldByLabel() now live on BasePage; this module's own quirks
  // (always attempts combobox.fill() - see the `tryFill: true` passed at each call site below)
  // are now passed as options instead of being separately re-implemented here. Location itself
  // no longer goes through these (see selectLocation()'s own comment for why).

  async selectAgreementType(type) {
    const dropdown = this.page.locator('div[class*="MuiSelect-select"]').first();
    await dropdown.click();
    await this.page.getByRole('option', { name: type }).first().click();
  }

  async setDateToToday() {
    // "Date" and "Valid Up To" are both DynamicDate fields sharing the same "Select Date"
    // placeholder/accessible name, so name-based lookup is ambiguous - scope by the field's
    // actual form name instead.
    await this.page.locator('input[name="purchaseAgreement.date"]').fill(this.formatDateToday());
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
      await this.openDropdownAndPick(/Vendor/i, vendor, { tryFill: true });
      await this.page.waitForTimeout(1000);
    }
    if (purchaseRepresentative) {
      await this.openDropdownAndPick(/Representative/i, purchaseRepresentative, { tryFill: true });
    }
    if (entity) {
      // The field's real label/translation is "Entity", not "Company". It only renders blank
      // (matching /Entity/i) on records whose saved value doesn't round-trip through the Edit
      // form - once re-selected to a real master value it correctly persists, so only touch it
      // when it's still showing the empty-state prompt; re-selecting an already-set value can
      // pick a different option than what's currently saved.
      const stillBlank = await this.page.getByRole('combobox', { name: /Entity/i }).count();
      if (stillBlank > 0) {
        await this.openDropdownAndPick(/Entity/i, entity, { tryFill: true });
        // Location is entity-scoped, and its option list is re-fetched asynchronously after
        // Entity changes - selecting Location immediately after can race that fetch and see
        // the previous entity's (stale) options, intermittently timing out on the new value.
        await this.page.waitForTimeout(2500);
      }
    }
    if (currency) {
      await this.openDropdownAndPick(/Currency/i, currency, { tryFill: true });
    }
    if (narration) {
      await this.page.getByPlaceholder('Enter Narration').fill(narration);
    }
  }

  // Purchase Agreement's Location field never calls its own filter API at all (confirmed live:
  // zero requests fire while typing), unlike the sibling Procurement Request page's equivalent
  // field - a value is only ever reachable while it's still inside the default unfiltered "25
  // most-recently-created" list. Pinning to a literal name (the old "Dhule" seed) is unreliable
  // under any real concurrent load: confirmed live that it gets pushed out of that list entirely
  // once enough OTHER Locations are created (e.g. Procurement Request's own selectLocation()
  // already creates a brand new Location on every single call it makes). Match the sibling
  // Procurement Request page's own fix for this exact failure mode: always create a fresh,
  // uniquely-named Location right before selecting it (via BasePage's shared
  // createLocationFromFooter), landing it at the very top of that list regardless of what
  // anything else concurrently creates. Returns the generated name so callers that need to
  // assert against it later (e.g. the View page) don't have to guess it.
  async selectLocation(namePrefix) {
    const locationName = `${namePrefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await this.createLocationFromFooter(locationName, 'erp-force');
    return locationName;
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
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const record = (await listResponse.json()).data.purchase_agreements[0];
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
    await this.page.waitForURL(new RegExp(`${id}/edit-purchase-agreements`));
  }

  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Draft|Pending|In Progress|Confirmed|Closed|Expired|Rejected/);
  }

  // ---------- Edit page value readers ----------
  async isIdFieldReadOnly() {
    // The field's real accessible name is "Purchase Agreement ID", not "ID" (that's just its
    // paragraph label).
    return this.page.getByRole('textbox', { name: 'Purchase Agreement ID' }).isDisabled();
  }

  // ---------- Delete / Approval flow ----------
  // confirmDelete()/quickApproval() now live on BasePage unchanged (this module's toast wording
  // already matches the shared defaults). accept()/reject() deliberately skip the toast assertion
  // here (it's a short-lived Snackbar that can auto-dismiss before an assertion polls for it
  // under load; callers verify the resulting status badge instead, which is the durable signal).
  async accept() {
    return super.accept({ successToast: null });
  }

  async reject() {
    return super.reject({ successToast: null });
  }

  async validate() {
    await this.page.getByRole('button', { name: 'Validate' }).click();
    // The confirmation dialog's own button is also labeled "Validate", not "Confirm"/"Submit".
    await this.page.getByRole('dialog').getByRole('button', { name: 'Validate', exact: true }).click();
  }

  // ---------- Create Order (View page, In Progress status) ----------
  // Unlike the sibling Procurement Request/RFQ pages' own "Create" action (a DropdownButton
  // sharing the "select merge strategy" caret/MuiMenu pattern - see BasePage.openSubmitMenu/
  // clickSubmitMenuItem), Purchase Agreement's header-buttons.tsx implements "Create" as its own
  // plain Box wrapping two Buttons with a bare onClick (confirmed in source: no DropdownButton
  // import at all) - open it by its own visible "Create" button text instead of reusing that
  // shared caret helper, which would never find its aria-label here.
  async createOrder() {
    await this.page.getByRole('button', { name: 'Create', exact: true }).click();
    await this.page.getByRole('menuitem', { name: 'Order', exact: true }).click();
  }

  // ---------- Module-level business method ----------
  // Matches the spec file's own local createDraftWithItem() helper body exactly.
  async createDraft(data) {
    await this.gotoAdd();
    await this.fillBasicDetails({
      name: data.name,
      agreementType: data.agreementType,
      vendor: data.vendor,
      purchaseRepresentative: data.purchaseRepresentative,
      narration: data.narration,
    });
    await this.selectLocation(data.location);
    await this.addItem({ itemName: data.itemName, minOrderQty: data.minOrderQty, rate: data.rate });
    return this.saveAsDraft();
  }
}

module.exports = PurchaseAgreementPage;
