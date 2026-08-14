const { selectDropdown } = require('../helpers/dropdown');

// CRM > Orders > Sales Orders (/dashboard/crm/orders/sales-orders).
//
// CONFIRMED AGAINST SOURCE (erpforce-fe modules/crm/src/views/orders/sales-order/{add-sales-order,
// form/components/basic-details-tab.tsx,item-entry-modal,utils/validator.ts,redux/actionCreator.ts}
// + .../quotation/view-quotation/view-quotation.tsx) + live UI field dump:
// - The real, deterministic Quotation->Sales Order link is QuotationPage.convertToSalesOrder()
//   (the "Create Order" button on the Quotation's view page, visible only once status ===
//   'Accepted' and no sales_order_id yet). It navigates here via router state
//   `{ quotation: { id: data.id } }`; this page's getData() then dispatches fetchQuotationId
//   (GET /v1/sales-orders/type/:id?type=quotation) and prefills quotation_id, customer_id, items,
//   addresses, shipping, currency, etc. from the response. Both `quotation_id` and `opportunity_id`
//   on this form are DISABLED read-only DynamicInputs (labels "Quotation"/"Opportunity") - never
//   manual/searchable locators.
// - Required per Yup (utils/validator.ts): date, expiration_date, customer_id, posting_time,
//   payment_term_id, company_id, currency_id, exchange_rate, location_id, transaction_type,
//   sales_order_items (min 1); sales_order_contacts.contact_person_id/shipping_address_id
//   additionally required when transaction_type==='credit'. Note: `po_number` renders with a
//   `required` UI prop but is NOT actually in the Yup schema - don't assume Save is blocked by it.
// - Most fields (Customer/Company/Currency/Exchange Rate/Date/Location/Items) arrive pre-filled
//   from the Quotation conversion - Payment Terms is the one most likely to still need filling
//   (same master-data-can-be-empty condition already proven for Procurement/Quotation).
class SalesOrderPage {
  constructor(page) {
    this.page = page;

    const byLabel = (label) => page.getByText(label, { exact: true }).first().locator('xpath=..').getByRole('combobox').first();
    this.paymentTermsDropdown = byLabel('Payment Terms *');
    this.locationDropdown = byLabel('Location *');

    this.addButton = page.getByRole('button', { name: /^\+?\s*Add$/ }).first();
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.itemModal = page.getByRole('dialog');
    this.itemsNoDataRow = page.getByText('No Data', { exact: true });

    // View page - approval workflow. Same shared "select merge strategy" caret + Menu/Dialog
    // components as every other approval-workflow module in this suite (Procurement,
    // QuotationPage) - see submitQuickApprovalAndAccept's own comment for the exact sequence.
    this.submitCaret = page.getByRole('button', { name: 'select merge strategy' });
    this.menu = page.getByRole('menu');
    this.confirmDialog = page.getByRole('dialog');

    // List / view page - Actions menu (same pattern as LeadPage.js/OpportunityPage.js/
    // QuotationPage.js).
    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.editMenuItem = page.getByRole('menuitem', { name: 'Edit' });
    this.deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete' });
  }

  async openViewById(id) {
    // CONFIRMED LIVE: the real route is "view-sales-orders" (plural) - "view-sales-order"
    // (singular, the original guess) 404s to a genuinely blank page with no error shown.
    await this.page.goto(`/dashboard/crm/orders/sales-orders/${id}/view-sales-orders`, { timeout: 60000 });
    // CONFIRMED LIVE (same class of bug as every other module in this suite): this view page can
    // get genuinely STUCK on its own bare loading spinner after navigation - retry with a reload
    // rather than trust one wait. Capped at ONE reload.
    const readySignal = this.page.getByRole('button', { name: 'Submit', exact: true })
      .or(this.page.getByText(/^ID/).first());
    for (let attempt = 1; attempt <= 2; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const visible = await readySignal.first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      if (visible) return;
      if (attempt === 2) return;
      await this.page.reload({ timeout: 60000 }).catch(() => {});
    }
  }

  async openEditById(id) {
    await this.openViewById(id);
    await this.actionsButton.click();
    await this.editMenuItem.waitFor({ state: 'visible' });
    await this.editMenuItem.click();
    await this.page.waitForURL('**/edit-sales-order**', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }

  // Opens the "Submit"/caret split-button's own menu - same shared component + "select merge
  // strategy" accessible name as every other approval-workflow module in this suite. Retries the
  // whole open-then-click sequence since MUI's Menu popover can keep remounting its MenuList
  // right after opening.
  async openSplitButtonMenuAndPick(menuItemNamePattern) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.submitCaret.click();
      try {
        await this.menu.waitFor({ state: 'visible', timeout: 3000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.keyboard.press('Escape').catch(() => {});
      }
    }
    await this.page.getByRole('menuitem', { name: menuItemNamePattern }).click();
  }

  // Submit -> Quick Approval -> select approver -> Send Request -> (reload as that approver) ->
  // Accept dropdown -> Accept -> confirm Submit. Same sequence already proven for
  // QuotationPage.submitQuickApprovalAndAccept - kept here as a UNVERIFIED-LIVE first pass for
  // Sales Order specifically (this page's exact button/dialog wording hasn't been run yet), so
  // expect to adjust locators (e.g. "Approve" vs "Accept" split-button, "Submit" vs "Approve"
  // confirm button) once actually exercised against the app.
  async submitQuickApprovalAndAccept(approverName) {
    await this.openSplitButtonMenuAndPick('Quick Approval');
    // Same broken-i18n-key risk already confirmed on QuotationPage's own Quick Approval modal
    // ("crm.quotation.quickApproval" instead of "Quick Approval") - tolerate both forms.
    const approvalModal = this.page.getByRole('dialog').filter({ hasText: /Quick\s*Approval/i });
    await approvalModal.waitFor({ state: 'visible', timeout: 10000 });
    await approvalModal.getByText('Select', { exact: false }).first().click();
    await this.page.getByRole('listbox').getByRole('option', { name: new RegExp(approverName) }).first().click();
    await this.page.keyboard.press('Escape');
    await approvalModal.getByRole('button', { name: /Send Request/i }).click();
    await this.page.getByText(/Pending Approval|Submitted/i).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    // Now acting as the assigned approver (same logged-in account, matching every other
    // approval-workflow module's own Quick Approval convention in this suite). This view page can
    // get genuinely stuck on its own loading spinner after the reload - retry with ONE reload.
    const acceptButton = this.page.getByRole('button', { name: 'Accept', exact: true });
    for (let attempt = 1; attempt <= 2; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const visible = await acceptButton.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      if (visible) break;
      if (attempt === 2) break;
      await this.page.reload({ timeout: 60000 }).catch(() => {});
    }
    const acceptCaret = acceptButton.locator('xpath=following-sibling::button[1]');
    for (let attempt = 1; attempt <= 4; attempt++) {
      await acceptCaret.click();
      try {
        await this.menu.waitFor({ state: 'visible', timeout: 3000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.keyboard.press('Escape').catch(() => {});
      }
    }
    await this.page.getByRole('menuitem', { name: 'Accept', exact: true }).click();
    const confirmButton = this.confirmDialog.getByRole('button', { name: /^Submit$/i });
    if (await confirmButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmButton.click();
    }
    await this.page.getByText('Accepted', { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  }

  // Same sequence as submitQuickApprovalAndAccept but stops short of selecting an approver -
  // mirrors QuotationPage.openQuickApprovalWithoutApprover's own confirmed-live finding: "Send
  // Request" is disabled (a UI-level guard) with zero approvers selected.
  async openQuickApprovalWithoutApprover() {
    await this.openSplitButtonMenuAndPick('Quick Approval');
    const approvalModal = this.page.getByRole('dialog').filter({ hasText: /Quick\s*Approval/i });
    await approvalModal.waitFor({ state: 'visible', timeout: 10000 });
    const sendRequestButton = approvalModal.getByRole('button', { name: /Send Request/i });
    return { approvalModal, sendRequestButton };
  }

  // Mirrors submitQuickApprovalAndAccept, but picks "Reject" instead of "Accept" from the
  // Accept/Reject split-button's own dropdown - same confirm-dialog flow.
  async submitQuickApprovalAndReject(approverName) {
    await this.openSplitButtonMenuAndPick('Quick Approval');
    const approvalModal = this.page.getByRole('dialog').filter({ hasText: /Quick\s*Approval/i });
    await approvalModal.waitFor({ state: 'visible', timeout: 10000 });
    await approvalModal.getByText('Select', { exact: false }).first().click();
    await this.page.getByRole('listbox').getByRole('option', { name: new RegExp(approverName) }).first().click();
    await this.page.keyboard.press('Escape');
    await approvalModal.getByRole('button', { name: /Send Request/i }).click();
    await this.page.getByText(/Pending Approval|Submitted/i).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    const acceptButton = this.page.getByRole('button', { name: 'Accept', exact: true });
    for (let attempt = 1; attempt <= 2; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const visible = await acceptButton.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      if (visible) break;
      if (attempt === 2) break;
      await this.page.reload({ timeout: 60000 }).catch(() => {});
    }
    const acceptCaret = acceptButton.locator('xpath=following-sibling::button[1]');
    for (let attempt = 1; attempt <= 4; attempt++) {
      await acceptCaret.click();
      try {
        await this.menu.waitFor({ state: 'visible', timeout: 3000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.keyboard.press('Escape').catch(() => {});
      }
    }
    await this.page.getByRole('menuitem', { name: 'Reject', exact: true }).click();
    const confirmButton = this.confirmDialog.getByRole('button', { name: /^Reject$|^Submit$/i });
    if (await confirmButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmButton.click();
    }
    await this.page.getByText('Rejected', { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
  }

  // CONFIRMED LIVE: the "Create" split-button on an Accepted Sales Order's view page has its OWN
  // dedicated caret (a following-sibling button, NOT the shared "select merge strategy" caret
  // used by Submit/Approve) - its menu offers "Quick Delivery", "Delivery", "Advance", "Invoice".
  // Use an EXACT match for "Delivery" - a substring/regex match also hits "Quick Delivery".
  async createDelivery() {
    const createButton = this.page.getByRole('button', { name: 'Create', exact: true });
    const caret = createButton.locator('xpath=following-sibling::button[1]');
    const deliveryItem = this.page.getByRole('menuitem', { name: 'Delivery', exact: true });
    // Same MUI-menu-remounting instability documented on openSplitButtonMenuAndPick above - the
    // menu can keep detaching/re-rendering its own MenuList right after opening, so retry the
    // whole open-then-click sequence rather than a single click.
    for (let attempt = 1; attempt <= 4; attempt++) {
      await caret.click();
      try {
        await deliveryItem.waitFor({ state: 'visible', timeout: 3000 });
        await deliveryItem.click({ timeout: 5000 });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(300);
      }
    }
    await this.page.waitForURL('**/add-delivery-orders**', { timeout: 15000 });
  }

  async gotoList() {
    await this.page.goto('/dashboard/crm/orders/sales-orders', { timeout: 60000 });
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      try {
        await this.addButton.waitFor({ state: 'visible', timeout: 15000 });
        return;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.reload({ timeout: 60000 }).catch(() => {});
      }
    }
  }

  async selectIfEmpty(combobox, searchText, opts = {}) {
    const currentText = ((await combobox.textContent().catch(() => '')) || '').replace(/[​﻿]/g, '').trim();
    if (currentText && !/^Search /i.test(currentText)) return;
    await selectDropdown(this.page, combobox, searchText || '', searchText || '', opts);
  }

  // Same master-data-can-be-empty condition already proven for Procurement
  // (erpforce-procure-to-pay.spec.js) and Quotation (QuotationPage.selectPaymentTermsIfEmpty) -
  // reuse the identical allowCreateNew fallback rather than assume a real option exists.
  async selectPaymentTermsIfEmpty() {
    const currentText = ((await this.paymentTermsDropdown.textContent().catch(() => '')) || '')
      .replace(/[​﻿]/g, '').trim();
    if (currentText && !/^Search /i.test(currentText)) return;
    const newTermName = `Auto_Payment_Term_${Date.now()}`;
    await selectDropdown(this.page, this.paymentTermsDropdown, newTermName, newTermName, {
      allowCreateNew: true,
      createNewFields: { due_date_based_on: "Day's after Invoice date", credit_days: '30' },
    });
  }

  async addItem({ itemSearchText = '', quantity } = {}) {
    await this.addButton.click();
    await this.itemModal.waitFor({ state: 'visible', timeout: 10000 });

    const itemCombobox = this.itemModal.getByText(/^Item(s)?\s*\*?$/i).first().locator('xpath=..').getByRole('combobox').first();
    await itemCombobox.click();
    await this.page.waitForTimeout(500);
    if (itemSearchText) {
      const searchInput = this.page.locator('input[placeholder*="Search"]').last();
      await searchInput.fill(itemSearchText);
      await this.page.waitForTimeout(600);
    }
    const options = this.page.getByRole('listbox').locator('[role="option"]:not([aria-disabled="true"])')
      .filter({ hasNot: this.page.locator('input') })
      .filter({ hasNotText: /Select|No data available|Create New/ });
    await options.first().waitFor({ state: 'visible', timeout: 8000 });
    await options.first().click();
    await this.page.waitForTimeout(500);

    const qtyInput = this.itemModal.getByText(/^Quantity\s*\*?$/i).first().locator('xpath=..').locator('input');
    if (await qtyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await qtyInput.fill(String(quantity ?? 1));
    }
    await this.page.waitForTimeout(500);

    const taxCombobox = this.itemModal.getByText(/^Tax Template\s*\*?$/i).first().locator('xpath=..').getByRole('combobox').first();
    const taxText = ((await taxCombobox.textContent().catch(() => '')) || '').replace(/[​﻿]/g, '').trim();
    if (!taxText || /^Search /i.test(taxText)) {
      await taxCombobox.click();
      await this.page.waitForTimeout(500);
      const taxOptions = this.page.getByRole('listbox').locator('[role="option"]:not([aria-disabled="true"])')
        .filter({ hasNot: this.page.locator('input') })
        .filter({ hasNotText: /Select|No data available|Create New/ });
      if (await taxOptions.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await taxOptions.first().click();
        await this.page.waitForTimeout(300);
      }
    }

    const modalSaveButton = this.itemModal.getByRole('button', { name: 'Save', exact: true });
    await modalSaveButton.click();
    const closed = await this.itemModal.waitFor({ state: 'hidden', timeout: 8000 }).then(() => true).catch(() => false);
    if (!closed) {
      throw new Error('Sales Order item modal did not close after Save - likely a validation error inside it');
    }
  }

  async save() {
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.mouse.click(2, 2).catch(() => {});
    await this.page.waitForTimeout(300);
    const urlBefore = this.page.url();
    await this.saveButton.click();
    await this.page.waitForTimeout(2000);
    if (this.page.url() === urlBefore) {
      await this.saveButton.click();
    }
  }

  // Call this once already on the Add Sales Order page (reached via
  // QuotationPage.convertToSalesOrder()) - fills whatever wasn't copied over from the Quotation.
  async fillRequiredFieldsAndSave(data = {}) {
    await this.selectPaymentTermsIfEmpty();
    await this.selectIfEmpty(this.locationDropdown, data.locationSearchText);
    // Items usually arrive already copied from the Quotation - only add one if the table is
    // genuinely still empty, rather than assume either way.
    const itemsEmpty = await this.itemsNoDataRow.isVisible({ timeout: 3000 }).catch(() => false);
    if (itemsEmpty) {
      await this.addItem({ itemSearchText: data.itemSearchText, quantity: data.itemQuantity });
    }
    await this.save();
  }
}

module.exports = SalesOrderPage;
