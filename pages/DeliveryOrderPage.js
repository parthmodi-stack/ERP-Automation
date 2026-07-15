const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class DeliveryOrderPage extends BasePage {
  constructor(page) {
    super(page);
    this.listUrl = '/dashboard/procurement/orders/delivery-order';
  }

  async gotoList() {
    await this.page.goto(this.listUrl);
    await this.page.waitForLoadState('networkidle');
  }

  async gotoEdit(id) {
    await this.page.goto(`/dashboard/procurement/delivery-order/${id}/edit-delivery-order`);
    await this.page.waitForLoadState('networkidle');
  }

  async gotoView(id) {
    await this.page.goto(`/dashboard/procurement/delivery-order/${id}/view-delivery-order`);
    await this.page.waitForLoadState('networkidle');
  }

  // ---------------- Creation via source Vendor Return Authorization ----------------
  // Precondition helper: opens an Approved VRA and triggers its "Delivery"
  // action, landing on the newly generated Delivery Order's view page.
  async createFromApprovedVra(vraViewUrl) {
    await this.page.goto(vraViewUrl);
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.getByText('Approved', { exact: true })).toBeVisible();
    const [resp] = await Promise.all([
      this.page.waitForResponse((r) => /delivery-order/i.test(r.url()) && r.request().method() !== 'GET'),
      this.page.getByRole('button', { name: 'Delivery' }).click(),
    ]);
    return resp;
  }

  // ---------------- Edit form ----------------
  clean(text) {
    return text.replace(/[\u200b\uFEFF]/g, '').trim();
  }

  async getDisabledFieldValue(label) {
    const field = this.page.getByLabel(label, { exact: true });
    return this.clean(await field.innerText().catch(async () => field.inputValue()));
  }

  async isFieldDisabled(label) {
    const field = this.page.getByLabel(label, { exact: true });
    return field.isDisabled();
  }

  async setReferenceNo(value) {
    await this.page.getByPlaceholder('Enter Reference No.').fill(value);
  }

  async setNarration(value) {
    await this.page.getByPlaceholder('Enter Narration').fill(value);
  }

  async setExchangeRate(value) {
    await this.page.getByLabel('Exchange Rate').fill(value);
  }

  async resetDateToToday() {
    const d = new Date();
    const value = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    await this.page.getByLabel('Date', { exact: true }).fill(value);
  }

  // ---------------- Status lifecycle ----------------
  async openStatusDropdown() {
    await this.page.getByLabel('Status', { exact: true }).click();
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
    return this.clean(await this.page.locator('header, [class*="status"]').getByText(/Picked|Packed|Dispatched|Delivered/).first().innerText());
  }

  async getStageChipState(stage) {
    const chip = this.page.getByText(stage, { exact: true });
    return (await chip.isDisabled?.().catch(() => false)) || (await chip.getAttribute('disabled')) !== null
      ? 'disabled'
      : 'active';
  }

  // ---------------- Read-back ----------------
  async getFieldValueOnView(label) {
    const value = await this.page
      .getByText(label, { exact: true })
      .locator('xpath=following-sibling::*[1]')
      .innerText();
    return this.clean(value);
  }

  async getReturnAuthorizationLink() {
    const link = this.page.getByText('Return Authorization', { exact: true }).locator('xpath=following-sibling::*[1] | following::a[1]');
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
