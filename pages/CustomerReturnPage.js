const BasePage = require('./BasePage');
const { selectDropdown } = require('../helpers/dropdown');

// CRM > Orders > Customer Returns (/dashboard/crm/orders/customer-returns).
//
// CONFIRMED LIVE (exploratory session):
// - Routes: list `/dashboard/crm/orders/customer-returns`, add
//   `/dashboard/crm/orders/customer-returns/add-customer-returns`, edit
//   `/dashboard/crm/orders/customer-returns/<id>/edit-customer-returns`. Field-array prefix is
//   `customerReturn` (e.g. `customerReturn.date`, `customerReturn.exchange_rate`).
// - List columns: ID (series number, e.g. "RMA-2026-000098"), Date, Customer, Salesperson, Sales
//   Order, Entity, RMA Status. Real status values seen: Draft, Pending Credit, Pending Receipt,
//   Return Completed.
// - Add form required fields: Date (auto-filled today), Customer, Entity, Currency, Exchange
//   Rate, plus Location under the Classification section - none of these are exposed as a plain
//   `<select>`, all are the app's custom MUI combobox components (same DynamicSelect family
//   `helpers/dropdown.js`'s `selectDropdown()` already handles for CRM's LeadPage). Salesperson
//   pre-fills to the logged-in user and Operation Type renders disabled - neither needs selecting.
// - At least one Item Entry row (Item/UOM/Quantity/Rate required in its own modal, opened via the
//   Items section's own "Add" button) is required before Save (not Save To Draft) will pass
//   client-side validation.
// - CONFIRMED APP BUG on the DIRECT-CREATE (listing page "Add") flow specifically: a full Save
//   (not draft) is rejected server-side every time with "Item <id> has no delivery record. Cannot
//   process return." - even for an item genuinely already delivered to that exact customer via a
//   real, Delivered Delivery Order - because neither the header nor the item modal expose any
//   field to reference which prior Sales Order/Delivery Order a return line is against, so the
//   backend can never resolve the link through this form. Save To Draft has no such check and
//   works (see saveAsDraftAndCaptureId below).
// - The OTHER creation path - CrmDeliveryOrderPage.returnDeliveryButton, on a Delivered order's own
//   view page ("way 3" of the three ways a Customer Return can be created - see
//   tests/regression/13-customer-returns.spec.js) - lands on this SAME add-customer-returns form
//   but with the item entries already pre-linked to that Delivery/Sales Order, so a full Save
//   succeeds immediately (confirmed live: 200, status "Pending", `source: "delivery"`,
//   `sales_order_id`/`delivery_order_id` both populated) - see saveAndCaptureId below. CONFIRMED
//   LIVE: the Return Delivery button itself stops rendering once a given Delivery Order has
//   already been used for a return, even though the Delivery Order's own status chip stays
//   "Delivered" either way (no other visible signal) - see
//   tests/regression/helpers/findReturnableDeliveryOrder.js, which scans for one still available
//   rather than assuming any specific id still is.
// - The View Customer Return page previously crashed with a real JS error ("Cannot destructure
//   property 'options' of 'W(...)' as it is undefined") for every record under this suite's own
//   login account - that's now been fixed app-side (confirmed live, re-tested clean). Once on the
//   View page, the approval lifecycle is the same ApprovalWrapper split-button pattern used
//   everywhere else in this suite (BasePage's quickApproval/accept, inherited as-is): Submit's
//   caret -> "Quick Approval" (assign to an approver) -> that approver's own session clicks the
//   resulting "Accept" button's caret -> "Accept" -> a "Receive" button appears -> Receive
//   navigates to the GRN form (`/dashboard/crm/orders/customer-returns/add-Grn`, pre-filled with
//   the return's own item entries) -> Save -> back on the Customer Return's own View page, now at
//   status "Pending Receipt". CONFIRMED LIVE: neither Quick Approval's nor Accept's own toast
//   renders real confirmation text here (`#notistack-snackbar` picks up unrelated breadcrumb text
//   instead, "Customer Returns") - both are called with `successToast: null` (see quickApproval/
//   accept overrides below); the button/status transition itself is the reliable signal instead.
// - Save-as-Draft API: `POST /sales/v1/customer-returns/save-as-draft` -> `{ data: { customerReturns: {...} } }`
//   - `customerReturns` is a SINGLE OBJECT here, not an array like the sibling Procurement
//   modules' own `data.vras`/`data.purchaseOrders` etc. - don't copy that `[0]` indexing pattern
//   blindly when reusing this page object as a template.
// - GRN creation API: `POST /sales/v1/customer-returns/<id>/grn` -> `{ data: { customerReturnsGrn: {...} } }`
//   - again a single object, with its own `id`/`series_number` (e.g. "CRG-2026-000090") plus
//   `customer_return_id` linking back. CONFIRMED LIVE: the success toast has a real app-side typo,
//   "GRN creatd successfully" (missing the second 'e') - match that literal text if asserting on
//   it, not the correctly-spelled word.
class CustomerReturnPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.listPath = '/dashboard/crm/orders/customer-returns';
    this.addPath = '/dashboard/crm/orders/customer-returns/add-customer-returns';

    this.addButton = page.getByRole('button', { name: /^Add$/i }).or(page.getByText(/^Add$/i)).first();
    // "Save" also matches the item modal's own Save button while it's open - scope to the LAST
    // one (the outer form's), same convention as CashExpensePage/PurchaseInvoicePage.
    this.saveButton = page.getByRole('button', { name: /^Save$/i }).last();
    this.saveDraftButton = page.getByRole('button', { name: /Save To Draft/i }).first();
    this.discardButton = page.getByRole('button', { name: /^Discard$/i });

    this.itemModal = page.getByRole('dialog');
    this.addItemButton = page.locator('button.table--AddButton').first();
    this.classificationSectionHeader = page.getByText('Classification', { exact: true }).first();
    this.itemsSectionHeader = page.getByText('Items', { exact: true }).first();

    this.toastMessage = page.locator('#notistack-snackbar');

    // ---------- View page ----------
    // The status badge next to "ID: RMA-..." in the breadcrumb area - same structural spot as
    // every other document module's own status chip.
    this.statusChipOnView = page.getByText(
      /^(Draft|Pending Approval|Pending|Approved|Rejected|Pending Receipt|Pending Credit|Return Completed)$/,
      { exact: true },
    ).first();
    this.receiveButton = page.getByRole('button', { name: /^Receive$/i });
    // GRN form's own Save - reuses the same "Save" name as the Add/Edit form, scope to the last
    // one for the same reason as this.saveButton above.
    this.grnSaveButton = page.getByRole('button', { name: /^Save$/i }).last();
  }

  headerSelectTrigger(fieldFragment) {
    return this.page.locator(`[id*="mui-component-select-"][id*="${fieldFragment}"]`).first();
  }

  async gotoList() {
    await this.page.goto(this.listPath, { timeout: 60000 });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  async openAdd() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-customer-returns', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  async selectCustomer(name) {
    await selectDropdown(this.page, this.headerSelectTrigger('customer_id'), name, name);
  }

  // Entity/Currency/Location default to whatever's already there once Customer is picked, but
  // aren't guaranteed to auto-populate - pass '' (the default) to accept whichever option the
  // dropdown's own fallback lands on rather than a guessed literal name.
  async selectEntity(name = '') {
    await selectDropdown(this.page, this.headerSelectTrigger('company_id'), name, name, { optional: true });
  }

  async selectCurrency(name = '') {
    await selectDropdown(this.page, this.headerSelectTrigger('currency_id'), name, name, { optional: true });
  }

  async selectLocation(name = '') {
    await this.classificationSectionHeader.scrollIntoViewIfNeeded();
    await selectDropdown(this.page, this.headerSelectTrigger('location_id'), name, name, { optional: true });
  }

  /** @param {{customer?: string, entity?: string, currency?: string, location?: string}} header */
  async fillHeader({ customer, entity = '', currency = '', location = '' } = {}) {
    if (customer) {
      await this.selectCustomer(customer);
      // Selecting Customer can trigger its own dependent-field auto-population (same pattern
      // documented on VendorReturnAuthorizationPage/PaymentEntryPage) - give it a settle beat
      // before touching Entity/Currency so this doesn't race that effect.
      await this.page.waitForTimeout(1000);
    }
    await this.selectEntity(entity);
    await this.selectCurrency(currency);
    await this.selectLocation(location);
  }

  async openAddItemModal() {
    await this.itemsSectionHeader.scrollIntoViewIfNeeded();
    await this.addItemButton.click();
    await this.itemModal.waitFor({ state: 'visible', timeout: 10000 });
    return this.itemModal;
  }

  /** @param {{item?: string, uom?: string, quantity?: string|number, rate?: string|number}} entry */
  async addItemEntry({ item, uom = '', quantity, rate } = {}) {
    const dialog = await this.openAddItemModal();

    if (item) {
      const itemTrigger = dialog.locator('[id*="mui-component-select-"][id*="item"]').first();
      await selectDropdown(this.page, itemTrigger, item, item);
      await this.page.waitForTimeout(800);
    }
    // UOM auto-fills from the selected Item's own default unit - only re-select if a specific
    // one was asked for, otherwise accept whatever's already there.
    const uomTrigger = dialog.locator('[id*="mui-component-select-"][id*="uom"]').first();
    await selectDropdown(this.page, uomTrigger, uom, uom, { optional: true });

    if (quantity !== undefined) {
      const quantityField = dialog.locator('[name*="quantity"]').first();
      await quantityField.fill(String(quantity));
      await quantityField.press('Tab');
      await this.page.waitForTimeout(300);
    }
    if (rate !== undefined) {
      const rateField = dialog.locator('[name*="rate"]').first();
      await rateField.fill(String(rate));
      await rateField.press('Tab');
      await this.page.waitForTimeout(300);
    }
    // Gross/Tax/Net/Total Amount are computed by a debounced effect after Quantity/Rate change,
    // same as every other item-modal module in this suite - wait for it before Save.
    await this.waitForItemAmountsToSettle(dialog);

    await dialog.getByRole('button', { name: /^Save$/i }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 10000 });
    await this.page.waitForTimeout(300);
  }

  /**
   * Edits the first Items row's quantity via its own row-level Edit icon (first button in the
   * row) - used when a Return-Delivery-originated form's pre-filled quantity (the full originally
   * delivered amount) exceeds what's actually still returnable (see this file's header comment on
   * "Return quantity ... exceeds allowed limit"). Opens the same item modal addItemEntry() itself
   * uses, just via the row's edit affordance rather than the Items section's own "Add" button.
   */
  async editFirstItemQuantity(newQuantity) {
    const row = this.page.locator('table tbody tr').first();
    await row.locator('button').first().click();
    await this.itemModal.waitFor({ state: 'visible', timeout: 10000 });

    const quantityField = this.itemModal.locator('[name*="quantity"]').first();
    await quantityField.fill(String(newQuantity));
    await quantityField.press('Tab');
    await this.waitForItemAmountsToSettle(this.itemModal);

    await this.itemModal.getByRole('button', { name: /^Save$/i }).click();
    await this.itemModal.waitFor({ state: 'hidden', timeout: 10000 });
    await this.page.waitForTimeout(300);
  }

  /**
   * Save To Draft, capturing the created record's id/series_number/status straight from the
   * save-as-draft API response - see this file's own header comment on the response shape
   * (`data.customerReturns` is a single object, not an array).
   * @returns {Promise<{id: string, seriesNumber: string, status: string}>}
   */
  async saveAsDraftAndCaptureId() {
    const [, response] = await Promise.all([
      this.saveDraftButton.click(),
      this.page.waitForResponse(
        (r) => r.url().includes('/sales/v1/customer-returns/save-as-draft') && r.request().method() === 'POST',
        { timeout: 15000 },
      ),
    ]);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const record = (await response.json()).data.customerReturns;
    return { id: String(record.id), seriesNumber: record.series_number, status: record.status };
  }

  /**
   * Full (non-draft) Save, capturing id/series_number/status from the create API response - same
   * response-shape caveat as saveAsDraftAndCaptureId(). Only ever confirmed to actually succeed
   * when the form was reached via CrmDeliveryOrderPage.returnDeliveryButton (a Delivered order's
   * own "Return Delivery" action - see this file's header comment): that flow pre-links the item
   * entries to their originating Sales/Delivery Order, which the direct Add form's own item modal
   * has no field to do manually - a plain Save from a manually-built item entry is confirmed to
   * always be rejected with "Item <id> has no delivery record. Cannot process return." instead.
   * @returns {Promise<{id: string, seriesNumber: string, status: string}>}
   */
  async saveAndCaptureId() {
    const [, response] = await Promise.all([
      this.saveButton.click(),
      this.page.waitForResponse(
        (r) => r.url().endsWith('/sales/v1/customer-returns/') && r.request().method() === 'POST',
        { timeout: 15000 },
      ),
    ]);
    const body = await response.json();
    if (!body.success) {
      // CONFIRMED LIVE: a Return-Delivery-originated save can still be rejected on its own terms,
      // independent of the direct-create "no delivery record" issue - e.g. "Return quantity for
      // item <id> exceeds allowed limit" when the source Delivery Order already had some quantity
      // returned previously and the pre-filled default is the full originally-delivered quantity,
      // not the remaining returnable one. Surface the real message rather than crashing on
      // `.data` being absent from an error response - callers (e.g.
      // findReturnableDeliveryOrder's retry loop) pattern-match on it to decide whether to retry
      // with a different source order or treat it as a genuine failure.
      throw new Error(`CustomerReturnPage.saveAndCaptureId: save rejected - ${body.message}`);
    }
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const record = body.data.customerReturns;
    return { id: String(record.id), seriesNumber: record.series_number, status: record.status };
  }

  /** Finds the row matching `seriesNumber` on the (already-open) list page and returns its RMA Status text. */
  async getRowStatus(seriesNumber) {
    const row = this.page.locator('table tbody tr').filter({ hasText: seriesNumber }).first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    return (await row.locator('td').last().textContent().catch(() => '')).trim();
  }

  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/save step likely failed.`);
    await this.page.goto(`${this.listPath}/${id}/view-customer-returns`, { timeout: 60000 });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.statusChipOnView.waitFor({ state: 'visible', timeout: 15000 });
  }

  async getStatusOnView() {
    return (await this.statusChipOnView.textContent().catch(() => '')).trim();
  }

  // Neither Quick Approval's nor Accept's own success toast renders real confirmation text on
  // this module (#notistack-snackbar picks up unrelated breadcrumb text, "Customer Returns",
  // instead - see this file's own header comment) - always skip the toast assertion and rely on
  // the resulting button/status change instead.
  async quickApproval(userName) {
    return super.quickApproval(userName, { successToast: null });
  }

  async accept() {
    return super.accept({ successToast: null });
  }

  /**
   * Saves the GRN form reached via this.receiveButton, capturing id/series_number from the
   * create API response - see this file's own header comment on the response shape
   * (`data.customerReturnsGrn` is a single object, with its own `customer_return_id` back-link).
   * @returns {Promise<{id: string, seriesNumber: string, customerReturnId: string}>}
   */
  async createGrnAndCaptureId() {
    const [, response] = await Promise.all([
      this.grnSaveButton.click(),
      this.page.waitForResponse(
        (r) => /\/sales\/v1\/customer-returns\/\d+\/grn$/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 15000 },
      ),
    ]);
    const body = await response.json();
    if (!body.success) {
      throw new Error(`CustomerReturnPage.createGrnAndCaptureId: GRN save rejected - ${body.message}`);
    }
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const record = body.data.customerReturnsGrn;
    return { id: String(record.id), seriesNumber: record.series_number, customerReturnId: String(record.customer_return_id) };
  }
}

module.exports = CustomerReturnPage;
