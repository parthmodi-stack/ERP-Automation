const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

class LandedCostPage extends BasePage {
  constructor(page) {
    super(page);
    this.listUrl = '/dashboard/procurement/orders/landed-cost';
  }

  // ---------------- Navigation ----------------
  async gotoList() {
    await this.page.goto(this.listUrl);
    await this.page.waitForLoadState('networkidle');
    await this.page.getByRole('button', { name: 'Add' }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async gotoAdd() {
    await this.gotoList();
    await this.page.getByRole('button', { name: 'Add' }).first().click();
    await expect(this.page.getByText('New Landed Cost')).toBeVisible();
  }

  async gotoEdit(id) {
    if (!id) throw new Error(`gotoEdit() called with a falsy id (${id})`);
    await this.page.goto(`/dashboard/procurement/landed-cost/${id}/edit-landed-cost`);
    await this.page.waitForLoadState('networkidle');
  }

  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id})`);
    await this.page.goto(`/dashboard/procurement/landed-cost/${id}/view-landed-cost`);
    await this.page.waitForLoadState('networkidle');
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  // ---------------- Combobox helpers ----------------
  clean(text) {
    return text.replace(/[\u200b\uFEFF]/g, '').trim();
  }

  async selectMultiCombobox(label, optionTexts) {
    const escapedLabel = label.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
    const combobox = this.page
      .getByText(labelRegex)
      .first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    await combobox.click({ force: true });
    for (const opt of optionTexts) {
      await this.page.getByRole('option', { name: opt, exact: false }).first().click();
    }
    await this.page.keyboard.press('Escape');
  }

  async selectCombobox(scope, label, optionText) {
    await this.selectFieldByLabel(label, optionText, { scope, exact: false });
  }

  // ---------------- Header form ----------------
  async fillHeader(data) {
    if (data.receipts && data.receipts.length) {
      await this.selectMultiCombobox('Receipt', data.receipts);
      await this.page.waitForTimeout(2000);
    }
    if (data.bill) {
      await this.selectCombobox(this.page, 'Bill', data.bill);
    }
    if (data.narration) {
      await this.page.getByPlaceholder('Enter Narration').fill(data.narration);
    }
  }

  async resetDateToToday() {
    const d = new Date();
    const value = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    await this.page.getByRole('textbox', { name: 'Select Date' }).fill(value);
  }

  async openAddItemModal() {
    const itemsAccordion = this.page.locator('div').filter({ has: this.page.getByRole('button', { name: /Items\*/ }) }).first();
    await itemsAccordion.getByRole('button', { name: 'Add', exact: true }).click();
    const modal = this.page.getByRole('dialog');
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    return modal;
  }

  // ---------------- Items table / modal ----------------
  async addItem(item) {
    const modal = await this.openAddItemModal();
    await this.selectCombobox(modal, 'Item', item.item);
    await this.selectCombobox(modal, 'Split Method', item.splitMethod);
    if (item.bill) await this.selectCombobox(modal, 'Bill', item.bill);
    if (item.account) await this.selectCombobox(modal, 'Account', item.account);
    await modal.getByPlaceholder('Enter Cost').fill(item.cost);
    if (item.description) await modal.getByPlaceholder('Enter Description').fill(item.description);
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).toBeHidden();
  }

  async itemsGridRowCount() {
    return this.page.locator('text=Items').first().locator('xpath=following::table[1]//tbody/tr').count();
  }

  async clickCompute() {
    await this.page.getByRole('button', { name: 'Compute' }).click();
  }

  async getItemValuationRow(costLine) {
    const section = this.page.locator('div').filter({ has: this.page.getByRole('button', { name: 'Item Valuation', exact: true }) }).first();
    const row = section.getByRole('row', { name: new RegExp(costLine) }).first();
    return {
      originalValue: this.clean(await row.locator('td').nth(3).innerText()),
      newValue: this.clean(await row.locator('td').nth(4).innerText()),
    };
  }

  // ---------------- Save actions ----------------
  // Both add-landed-cost.tsx and edit-landed-cost.tsx only call navigateToListing() after their
  // create/update dispatch resolves `fulfilled` - waiting for that redirect is a reliable, save
  // -actually-succeeded signal that works for both flows. A bare click() here previously returned
  // instantly, and the test's very next step (gotoList()'s hard page.goto()) could fire before
  // the in-flight create/update request ever got a response, silently aborting it client-side -
  // the test passed, but no record was actually created.
  async save() {
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    await this.page.waitForURL(this.listUrl, { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }

  // Dual identifiers, same pattern as every sibling page (VendorReturnAuthorizationPage/
  // PurchaseOrderPage): `id` (raw PK, used in edit/view URLs) and `seriesNumber` (the formatted
  // "LNDC-..." string rendered in the list's ID column, used for list search/row lookups).
  // The list endpoint is `/purchase/v1/landing-cost/?` (note: "landing", not "landed") and the
  // body is `data.landing_costs[]`, ordered newest-first, so the just-created record is [0].
  // Arms the response waiter and triggers the list fetch together (reload) so the GET is captured
  // as it fires - a bare waitForResponse called after the list already loaded waits forever for a
  // response that already happened.
  async captureCreatedIdFromListResponse() {
    const [resp] = await Promise.all([
      this.page.waitForResponse(
        (r) => /\/landing-cost\/\?/.test(r.url()) && r.request().method() === 'GET',
      ),
      this.page.reload(),
    ]);
    await this.page.waitForLoadState('networkidle');
    const record = (await resp.json())?.data?.landing_costs?.[0];
    return { id: String(record?.id), seriesNumber: record?.series_number };
  }

  // ---------------- View page ----------------
  // The status badge renders in the view's title block, right beside the "ID: LNDC-..." text
  // (NOT in the app's top <header> banner - that earlier scope matched nothing). Anchor off the
  // ID text, which gotoView() already waits for, and read the sibling status paragraph.
  async getStatusBadge() {
    const idBlock = this.page.getByText(/^ID:/).first().locator('xpath=..');
    return this.clean(await idBlock.getByText(/Draft|Validated/).first().innerText());
  }

  async openActionsMenu() {
    await this.page.getByRole('button', { name: 'Actions' }).click();
  }

  async hasActionsButton() {
    return this.page.getByRole('button', { name: 'Actions' }).isVisible().catch(() => false);
  }

  async hasValidateButton() {
    return this.page.getByRole('button', { name: 'Validate' }).isVisible().catch(() => false);
  }

  async clickValidate() {
    await this.page.getByRole('button', { name: 'Validate' }).click();
  }

  async deleteFromView() {
    await this.openActionsMenu();
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();
    await this.page.getByRole('button', { name: /confirm|yes|delete/i }).last().click();
  }
}

module.exports = LandedCostPage;
