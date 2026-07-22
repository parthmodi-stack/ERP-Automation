const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class DeliveryOrderPage extends BasePage {
  constructor(page) {
    super(page);
    this.listUrl = '/dashboard/procurement/orders/delivery-order';
  }

  async gotoList() {
    await this.page.goto(this.listUrl);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // CONFIRMED LIVE: networkidle can fire while the table is still showing shimmer/skeleton
    // placeholder rows (no real cell text yet) - callers that read the first row immediately
    // (e.g. the newest-record ID extraction after createFromApprovedVra) can get an empty string.
    // Wait for the first row's ID cell to actually settle before returning.
    await expect(this.page.locator('tbody tr').first().locator('td').nth(1)).not.toHaveText('', { timeout: 15000 }).catch(() => {});
  }

  async gotoEdit(id) {
    await this.page.goto(`/dashboard/procurement/delivery-order/${id}/edit-delivery-order`);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  async gotoView(id) {
    await this.page.goto(`/dashboard/procurement/delivery-order/${id}/view-delivery-order`);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  // ---------------- Creation via source Vendor Return Authorization ----------------
  // Precondition helper: opens an Approved VRA and triggers its "Delivery" action.
  // CONFIRMED LIVE this does NOT instantly create a record (this method's own previous, never-
  // live-verified assumption) - it navigates to a full "Add New Delivery Order" form with
  // Vendor/Currency/Entity/Location/Purchase Representative inherited-and-disabled from the
  // source VRA, but Status left blank and required. Drive that form to Submit here so callers get
  // back an actually-created record, same as every sibling create-from-source helper.
  async createFromApprovedVra(vraViewUrl) {
    await this.page.goto(vraViewUrl);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await expect(this.page.getByText('Approved', { exact: true })).toBeVisible();
    await this.page.getByRole('button', { name: 'Delivery' }).click();
    await this.page.waitForURL('**/add-delivery-order', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // Not selectStatus()/openStatusDropdown() (getByLabel('Status')): CONFIRMED LIVE the Add
    // form's Status field is a paragraph-label + DynamicSearchSelect combobox pair like every
    // other field on this form, not a native label-associated control - getByLabel never matches
    // it. Those two methods are for the Edit page's own differently-rendered Status field; use the
    // same structural label lookup every sibling module's page object already relies on instead.
    await this.selectFieldByLabel('Status', 'Picked', { exact: false });
    const [resp] = await Promise.all([
      this.page.waitForResponse((r) => /delivery-order/i.test(r.url()) && r.request().method() !== 'GET'),
      this.page.getByRole('button', { name: 'Submit' }).click(),
    ]);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // The list's ID column only ever shows the formatted series_number, not this raw id
    // gotoView()/gotoEdit() need - read both directly off the create response instead of scraping
    // the list (same dual-identifier pattern every sibling page's saveAndCaptureId() already uses).
    const record = (await resp.json()).data.delivery_order;
    return { id: String(record.id), seriesNumber: record.series_number };
  }

  // ---------------- Edit form ----------------
  clean(text) {
    return text.replace(/[\u200b\uFEFF]/g, '').trim();
  }

  // CONFIRMED (erpforce-fe source, basic-details-tab.tsx): none of this form's fields wire a
  // real <label htmlFor>/aria-label to their control - every field is a shared @erpsquad/common
  // component that renders its label as a plain sibling <Typography>, so getByLabel() never
  // matches anything on this page (Add or Edit). Plain-input fields (DynamicInput/DynamicDate)
  // DO carry a real HTML `placeholder` attribute though, which getByPlaceholder queries
  // directly - use that for those.
  inputByPlaceholder(placeholder) {
    return this.page.getByPlaceholder(placeholder, { exact: true });
  }

  // Combobox-style fields (DynamicSearchSelect/DynamicSelect) render as a `div[role="combobox"]`
  // with no real placeholder attribute of their own - match structurally instead (label
  // paragraph -> its very next sibling IS the combobox), the same pattern already proven live in
  // BasePage.getEditComboboxValue()/selectFieldByLabel() for this exact shared component family.
  comboboxByLabel(label) {
    const escapedLabel = label.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
    return this.page.getByText(labelRegex).first().locator('xpath=following-sibling::*[1]');
  }

  async getDisabledFieldValue(label) {
    return this.clean(await this.comboboxByLabel(label).innerText());
  }

  async isFieldDisabled(label) {
    return this.comboboxByLabel(label).isDisabled();
  }

  async setReferenceNo(value) {
    await this.inputByPlaceholder('Enter Reference No.').fill(value);
  }

  async setNarration(value) {
    await this.inputByPlaceholder('Enter Narration').fill(value);
  }

  async setExchangeRate(value) {
    await this.inputByPlaceholder('0.00').fill(value);
  }

  async resetDateToToday() {
    const d = new Date();
    const value = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    await this.inputByPlaceholder('Select Date').fill(value);
  }

  // ---------------- Status lifecycle ----------------
  async openStatusDropdown() {
    await this.comboboxByLabel('Status').click();
  }

  async isStatusOptionDisabled(option) {
    const opt = this.page.getByRole('option', { name: option, exact: true });
    const cls = (await opt.getAttribute('aria-disabled')) ?? (await opt.getAttribute('class'));
    return cls === 'true' || /disabled/i.test(cls ?? '');
  }

  async selectStatus(option) {
    await this.openStatusDropdown();
    await this.page.getByRole('option', { name: option, exact: true }).click();
  }

  async save() {
    await this.page.getByRole('button', { name: 'Save' }).click();
  }

  async discard() {
    await this.page.getByRole('button', { name: 'Discard' }).click();
  }

  // "Validate" button on the view page advances the current stage by one
  // step (Picked -> Packed -> ... ). Distinct from directly editing Status.
  async clickValidate() {
    await this.page.getByRole('button', { name: 'Validate' }).click();
  }

  async getStatusBadge() {
    // CONFIRMED LIVE: "ID: DLO-..." is a bare text node with no element wrapper of its own (not
    // inside a <header> or a "status"-classed element, and not a usable xpath anchor either), and
    // the status chip is its own exact-text paragraph ("Picked"/"Packed"/etc) rendered before the
    // Packed/Dispatched/Delivered stage BUTTONS further along the page - an exact match picks the
    // chip as the first (and only non-button) hit.
    return this.clean(
      await this.page.getByText(/^(Picked|Packed|Dispatched|Delivered)$/, { exact: true }).first().innerText()
    );
  }

  async getStageChipState(stage) {
    const chip = this.page.getByText(stage, { exact: true });
    return (await chip.isDisabled?.().catch(() => false)) || (await chip.getAttribute('disabled')) !== null
      ? 'disabled'
      : 'active';
  }

  // ---------------- Read-back ----------------
  async getFieldValueOnView(label) {
    // .first(): the read-only Summary sidebar echoes Vendor/Currency/Location/etc too, same as
    // every sibling module's own View page - confirmed live (2 matches without this).
    const value = await this.page
      .getByText(label, { exact: true })
      .locator('xpath=following-sibling::*[1]')
      .first()
      .innerText();
    return this.clean(value);
  }

  async getReturnAuthorizationLink() {
    // CONFIRMED LIVE: the union xpath matches both the field's own sibling paragraph AND the
    // link inside it simultaneously (both carry the same text) - a strict-mode violation. `.first()`
    // is enough since both alternatives already resolve to the same visible text.
    const link = this.page
      .getByText('Return Authorization', { exact: true })
      .locator('xpath=following-sibling::*[1] | following::a[1]')
      .first();
    return this.clean(await link.innerText());
  }

  // ---------------- Actions menu ----------------
  async openActionsMenu() {
    await this.page.getByRole('button', { name: 'Actions' }).click();
  }

  async deleteFromView() {
    await this.openActionsMenu();
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();
    await this.page.getByRole('button', { name: /confirm|yes|delete/i }).last().click();
  }
}

module.exports = DeliveryOrderPage;
