const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Goods Receipt Note (GRN) - erpforce-fe: modules/procurement/.../purchase-orders/
// goods-receipt-notes/. A GRN is a CHILD of a Purchase Order, not a standalone module:
//   - Routes are nested under the PO: /purchase-order/:poId/grn(/add-grn|/:id/view-grn|/:id/edit-grn)
//     (source: pathname.procurement.ts + goods-receipt-notes routes.tsx).
//   - Creation is launched from an APPROVED PO's View page via the "Receive" button
//     (PurchaseOrderPage.clickReceive), which navigates to add-grn with the PO in router state.
//     The Add screen ALSO reads :poId from the URL and refetches the PO, so a deep-link goto()
//     works too (used by gotoAdd(poId)).
//   - The form has only two buttons: Discard + Save. There is NO Save-to-Draft, NO Submit, and
//     NO approval workflow (the Submit/Quick-Approval menu in the JSX has empty handlers).
//   - Header fields (Vendor/Currency/Company/Location) and item rows AUTO-POPULATE from the PO.
//     Item rows CANNOT be manually added; only received Quantity/Rate are editable (inline row
//     edit), and only Reference No./Narration are editable header fields.
//   - Status is derived from the boolean `is_validated`: "Pending" -> "Validated". Validation
//     happens on the GRN VIEW page ("Validate" button), and is BLOCKED until every item has
//     traceability (tracking_generated). Validate calls POST .../grn/:grnId/inventory-adjustment.
//   - Traceability is a per-item icon in the "Trace Details" cell (View page only). It opens a
//     "Trace Details" modal (a grid of lot/serial rows) whose "Add" opens a nested "Lot/Serial
//     number" modal. Trace rows are only persisted when the Trace Details modal's "Submit" is
//     clicked.
//
// UNVERIFIED LIVE: like PurchaseOrderPage, this was written from FE source reading, not iterative
// live debugging - expect some locator/flow adjustments on first real run. Locators favor
// structural/regex lookups and real i18n strings pulled from en.ts to reduce drift.
class GoodsReceiptNotePage extends BasePage {
  base(poId) {
    return `/dashboard/procurement/purchase-order/${poId}/grn`;
  }

  currentPoId() {
    const m = this.page.url().match(/purchase-order\/(\d+)\/grn/);
    return m ? m[1] : undefined;
  }

  // ---------- Navigation ----------
  // Deep-link to the Add GRN form. Works because the Add screen reads :poId from the URL and
  // refetches the PO itself (it does not strictly depend on the router state the Receive button
  // passes). Prefer launching via PurchaseOrderPage.clickReceive() + waitForCreateReady() when
  // exercising the real user path; use this for isolated/edit setups.
  async gotoAdd(poId) {
    if (!poId) throw new Error(`GRN gotoAdd() called with a falsy poId (${poId}) - the source PO create/approve step likely failed.`);
    await this.page.goto(`${this.base(poId)}/add-grn`);
    await this.waitForCreateReady();
  }

  async gotoList(poId) {
    if (!poId) throw new Error(`GRN gotoList() called with a falsy poId (${poId}).`);
    await this.page.goto(this.base(poId));
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  async gotoView(poId, grnId) {
    if (!poId || !grnId) throw new Error(`GRN gotoView() needs poId+grnId (got ${poId}, ${grnId}).`);
    await this.page.goto(`${this.base(poId)}/${grnId}/view-grn`);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.getByText(/^ID:/).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  }

  async gotoEdit(poId, grnId) {
    if (!poId || !grnId) throw new Error(`GRN gotoEdit() needs poId+grnId (got ${poId}, ${grnId}).`);
    await this.page.goto(`${this.base(poId)}/${grnId}/edit-grn`);
    await this.waitForCreateReady();
  }

  // Shared readiness wait for the Add/Edit GRN form - the "ID" field is always present once the
  // PO-derived form has rendered. recoverFromStuckLoadingFields guards the same DynamicSelect
  // dependent-fetch race every sibling module hits on load.
  async waitForCreateReady() {
    await this.page.waitForURL(/\/grn\/(add-grn|\d+\/edit-grn)/, { timeout: 15000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.getByText('ID', { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await this.recoverFromStuckLoadingFields();
  }

  // ---------- Basic Details (only Reference No. + Narration are editable) ----------
  async fillBasicDetails({ referenceNumber, narration } = {}) {
    if (referenceNumber !== undefined) {
      await this.page.getByPlaceholder('Enter Reference No.').fill(referenceNumber).catch(async () => {
        // Placeholder text is unverified for GRN specifically - fall back to the labeled field.
        await this.fieldInputByLabel('Reference No.').fill(referenceNumber);
      });
    }
    if (narration !== undefined) {
      await this.page.getByPlaceholder('Enter Narration').fill(narration);
    }
  }

  // grn_date is required with max = today; it defaults to today, so this is usually a no-op, but
  // needed if a GRN form is revisited on a later day. CONFIRMED LIVE (same pattern as
  // PurchaseOrderPage.setDateToToday): the label renders as "Date *" with a trailing asterisk, so
  // an exact:true match against "Date" alone finds ZERO matches and hangs.
  async setDateToToday() {
    const dateLabel = this.page.getByText(/^Date\s*\*?$/, { exact: false }).first();
    await dateLabel.locator('xpath=following::input[1]').fill(this.formatDateToday());
  }

  // ---------- Items grid (inline ROW edit) ----------
  // Editable via the row's pencil (Edit) icon -> inline inputs name="received_quantity" (the
  // quantity-to-receive) and name="rate" -> commit with the row's Save (floppy) icon (source:
  // MaterialTable editDisplayMode="row"; utils/default-data.ts itemColumns). Receiving more than
  // the line's remaining_quantity is rejected with a "quantity exceeds" snackbar and the row
  // reverts, which negative tests assert on.
  async editItemRow(index = 0, { quantity, rate } = {}) {
    const row = this.page.locator('table tbody tr').nth(index);
    // Enter row-edit mode via the pencil icon (Tooltip title "Edit").
    await row.getByRole('button', { name: 'Edit' }).click().catch(async () => {
      // The icon may expose no accessible name in some builds - fall back to the first action button.
      await row.locator('button').first().click();
    });

    if (quantity !== undefined) {
      await this.page.locator('input[name="received_quantity"]').fill(String(quantity));
    }
    if (rate !== undefined) {
      await this.page.locator('input[name="rate"]').fill(String(rate));
    }

    // Commit the row via the Save (floppy) action icon. CONFIRMED LIVE: an unscoped page-wide
    // getByRole('button', {name:'Save'}) is ambiguous while a row is in edit mode - the page's own
    // top-level Save button coexists with this row's Save icon at the same time, and clicking the
    // wrong one leaves the row stuck in edit mode (its icon lingers, later causing a strict-mode
    // violation on GoodsReceiptNotePage.save()'s own Save-button lookup). Scope to the row itself.
    await row.getByRole('button', { name: 'Save' }).first().click().catch(async () => {
      await row.locator('button').nth(1).click();
    });
    await this.page.waitForTimeout(300);
  }

  // Reads a cell's text within an item row by its 0-based column index (for asserting the
  // read-only Remaining/Available/On Hand columns after a partial receipt).
  async getItemCellText(rowIndex, colIndex) {
    const cell = this.page.locator('table tbody tr').nth(rowIndex).locator('td').nth(colIndex);
    return ((await cell.textContent()) || '').trim();
  }

  async getItemRowCount() {
    return this.page.locator('table tbody tr').filter({ hasNot: this.page.getByText('No Data') }).count();
  }

  // ---------- Save ----------
  // Create/Update GRN -> POST/PUT .../purchase-orders/:poId/grn(/:grnId). The exact success-
  // response JSON key is UNVERIFIED, so extract the created record defensively across a few likely
  // shapes; poId is read back from the URL. Returns { id, seriesNumber, poId }.
  async save() {
    const poId = this.currentPoId();
    const [, response] = await Promise.all([
      this.page.getByRole('button', { name: 'Save', exact: true }).click(),
      this.page.waitForResponse(
        (r) => /\/purchase-orders\/\d+\/grn(\/\d+)?(\?|$)/.test(r.url()) && ['POST', 'PUT'].includes(r.request().method()),
        { timeout: 20000 },
      ),
    ]);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // CONFIRMED LIVE: create (POST) and update (PUT) return genuinely DIFFERENT response shapes -
    // create: data.grn.{id,series_number}; update: data.updatedGRN.data.{id,series_number} (note
    // the extra nested .data under updatedGRN). Handle both explicitly rather than guessing a
    // single shared shape.
    const body = await response.json().catch(() => null);
    const d = body && body.data ? body.data : body;
    const rec =
      (d && (d.grn || d.goods_receipt_note || d.purchase_grn)) ||
      (d && d.updatedGRN && d.updatedGRN.data) ||
      (d && Array.isArray(d.grns) && d.grns[0]) ||
      (d && Array.isArray(d.goods_receipt_notes) && d.goods_receipt_notes[0]) ||
      d;
    return {
      id: rec && rec.id != null ? String(rec.id) : undefined,
      seriesNumber: rec && rec.series_number ? rec.series_number : undefined,
      poId: poId || this.currentPoId(),
    };
  }

  // ---------- List / status ----------
  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Pending|Validated/);
  }

  // ---------- Traceability (GRN View page) ----------
  // The trigger is an unlabeled IconButton in each item row's "Trace Details" cell (AddCircle when
  // not yet traced, TickCircle when done). We click the row's icon then wait for the "Trace
  // Details" dialog by title - if the wrong control was hit, that wait fails fast and clearly.
  async openTraceModal(rowIndex = 0) {
    const row = this.page.locator('table tbody tr').nth(rowIndex);
    // Trace Details is the trailing custom cell; its icon is the last button in the row.
    await row.locator('button').last().click();
    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Trace Details' });
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    return dialog;
  }

  traceDialog() {
    return this.page.getByRole('dialog').filter({ hasText: 'Trace Details' });
  }

  // Adds ONE trace row via the nested "Lot/Serial number" modal. Persisted to the grid only (not
  // the server) until saveTrace() clicks the Trace Details modal's Submit.
  //   lotSerial - required text (lot/serial number)
  //   bin       - optional; only present when the item use_bins (DynamicSelect "Bin number")
  //   quantity  - required; disabled/locked to 1 for Serial Number Tracking items
  async addTraceDetail({ lotSerial, bin, quantity } = {}) {
    const trace = this.traceDialog();
    await trace.getByRole('button', { name: 'Add', exact: true }).click();

    // CONFIRMED LIVE: a hasText filter matches TWO dialogs simultaneously and PERMANENTLY - the
    // parent Trace Details modal ALSO contains "Lot/serial Number" as its own grid column header
    // text, so it substring-matches this same regex for its entire lifetime (not just while the
    // nested modal is open), making a "not visible" wait on it never resolve even after the
    // nested modal genuinely closes. Filter on a descendant unique to the nested form instead -
    // its own "Select Lot/Serial number" placeholder INPUT, which the parent's plain text column
    // header does not have.
    const addModal = this.page.getByRole('dialog').filter({ has: this.page.getByPlaceholder('Select Lot/Serial number') });
    await addModal.waitFor({ state: 'visible', timeout: 10000 });

    if (lotSerial !== undefined) {
      await addModal.getByPlaceholder('Select Lot/Serial number').fill(String(lotSerial));
    }
    if (bin !== undefined) {
      await this.selectModalDropdown(addModal, 'Bin number', bin === true ? true : bin);
    }
    if (quantity !== undefined) {
      const qty = addModal.getByPlaceholder('Enter Quantity');
      // Serial-tracking locks quantity to 1 (disabled) - skip silently in that case.
      if (await qty.isEditable().catch(() => false)) {
        await qty.fill(String(quantity));
      }
    }

    await addModal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(addModal).not.toBeVisible({ timeout: 10000 });
  }

  // Persists all staged trace rows: the Trace Details modal's "Submit" (source: common.submit).
  async saveTrace() {
    const trace = this.traceDialog();
    await trace.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(trace).not.toBeVisible({ timeout: 15000 });
  }

  async cancelTrace() {
    const trace = this.traceDialog();
    await trace.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(trace).not.toBeVisible({ timeout: 10000 });
  }

  async getTraceRowCount() {
    return this.traceDialog().locator('table tbody tr').filter({ hasNot: this.page.getByText('No Data') }).count();
  }

  // Per-row edit/delete inside the Trace Details grid (only rendered while the modal is in edit
  // mode). Delete goes through the shared ConfirmPopUp (BasePage.confirmDelete).
  async deleteTraceRow(rowIndex = 0) {
    const row = this.traceDialog().locator('table tbody tr').nth(rowIndex);
    await row.getByRole('button', { name: 'Delete' }).click().catch(async () => {
      await row.locator('button').last().click();
    });
    await this.confirmDelete();
  }

  // Convenience: full traceability for one item row = open -> add one detail matching the
  // received quantity -> submit. `quantity` should equal the row's received quantity, since the
  // Trace Details modal rejects Submit unless the traced total equals received (source:
  // "The added quantity is more/less than the received quantity").
  async addTraceabilityForItem(rowIndex, { lotSerial, bin, quantity } = {}) {
    await this.openTraceModal(rowIndex);
    await this.addTraceDetail({ lotSerial, bin, quantity });
    await this.saveTrace();
  }

  // ---------- Validate (GRN View page) ----------
  // "Validate" is disabled until every item is traced (tracking_generated). Clicking it POSTs the
  // inventory adjustment; on success the GRN flips to "Validated". If tracking is missing the app
  // shows "Please add the tracking details to validate" instead.
  isValidateDisabled() {
    return this.page.getByRole('button', { name: 'Validate', exact: true }).isDisabled();
  }

  async validate({ successToast = /validated|Traceability is Completed/i } = {}) {
    const [, response] = await Promise.all([
      this.page.getByRole('button', { name: 'Validate', exact: true }).click(),
      this.page
        .waitForResponse((r) => /inventory-adjustment/.test(r.url()) && r.request().method() === 'POST', { timeout: 20000 })
        .catch(() => null),
    ]);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    if (successToast) {
      await expect(this.page.getByText(successToast).first()).toBeVisible({ timeout: 10000 });
    }
    return response;
  }
}

module.exports = GoodsReceiptNotePage;
