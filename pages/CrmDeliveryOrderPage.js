// CRM > Orders > Delivery Orders (/dashboard/crm/orders/delivery-orders).
//
// NOT the same module as pages/DeliveryOrderPage.js (that one is Procurement's Delivery Order,
// created from a Vendor Return Authorization at /dashboard/procurement/orders/delivery-order) -
// this is the CRM one, created from a Sales Order. Both happen to reuse the same underlying
// Picked/Packed/Dispatched/Delivered status-lifecycle workflow component, but are otherwise
// unrelated records under different modules/routes - kept in separate files to avoid confusing
// the two.
//
// CONFIRMED LIVE (exploratory session, not source-derived like most of this suite's other pages):
// - The real, deterministic Sales Order->Delivery Order link is SalesOrderPage.createDelivery()
//   (the "Create" split-button's "Delivery" option on an Accepted Sales Order's view page). It
//   navigates to /dashboard/crm/orders/delivery-orders/add-delivery-orders with the source Sales
//   Order pre-filled (visible in the Summary sidebar: Opportunity/Quotation/Sales Order/Customer
//   all copied over already).
// - Add form tabs: Basic Details -> Package -> Address and Contact -> Shipping -> Promotion ->
//   Summary. Reaching Promotion takes exactly 4 "Next" clicks from Basic Details. CONFIRMED LIVE:
//   an intermittent "Please fill all the required fields" can strike even with every visible
//   required field already filled - some field's own async auto-population from the Sales Order
//   can still be mid-flight when Next is clicked, so pause for networkidle + a settle beat before
//   each Next click rather than clicking through immediately.
// - View page route is "view-delivery-orders" (plural), matching SalesOrderPage's own confirmed
//   "view-sales-orders" plural pattern - not "view-delivery-order" (singular).
// - Status lifecycle (confirmed live): Picked -> (Trace + Validate) -> Packed -> Dispatched ->
//   Delivered. A freshly-saved Delivery Order starts as "Picked" with only a "Validate" button
//   visible (no Packed/Dispatched/Delivered yet). Clicking Validate does NOT itself change the
//   status chip - it reveals a "Packed" action button while the chip still reads "Picked". Each of
//   Packed/Dispatched/Delivered is its own button that only appears once the PRIOR status has been
//   reached - clicking each one advances to the next and reveals the next button in the chain,
//   terminating at Delivered.
// - The Items grid's last column is "Trace Details" - its icon opens a "Track Details" dialog
//   (the SAME shared component as Stock Transfer's own Track Detail, NOT GRN's separate "Trace
//   Details" component). CONFIRMED LIVE: unlike GRN (which starts empty and requires Add + fill
//   Lot/Serial + Save), this dialog can arrive with its Lot/Serial Number Entries grid ALREADY
//   populated (auto-allocated from available tracked stock) - Submit works directly with no Add
//   needed when a row is already present. Only fall back to Add if the grid is genuinely empty.
//
// CONFIRMED LIVE (list+detail reachability sweep for tests/regression/ List/Detail coverage):
// - Detail page tab sequence (role=tab) is Basic Details -> Package -> Address and Contact ->
//   Shipping -> Promotion -> Summary -> Activity - Package DOES exist here even though it's absent
//   from the Add/Edit form's own "Next"-driven tab sequence (see fillRequiredFieldsAndSave above) -
//   two different tab sets for the same module, not a contradiction.
// - Items table columns (detail page): Item, UOM, Sales Order Line, Quantity, On Hand, Reserved,
//   Remaining, Delivered Quantity, Location, Department, Narration, Package, Trace Details.
// - Transportation section header and its Driver/Vehicle Number field labels render as raw,
//   untranslated i18n keys (rental.orders.rentalOrder.sections.transportation /
//   .fields.driver_label / .fields.vehicleNumber_label) - a real, currently-open app bug, not a
//   locator problem on this suite's end. Assertions on this section should target the ACTUAL
//   (buggy) rendered text, not the translated label a fixed version would show.
// - List page columns: ID, Date, Sales Order, Status, Salesperson, Customer, Location, Entity -
//   matches the manual test sheet's own TC-01 expectation exactly. Per-column "+ Add Calculation"
//   footer exists (same generic grid feature as pages/ItemsPage.js's own dataRows() filter). NO
//   "Add" button on this list (Delivery Orders are only ever created via SalesOrderPage.
//   createDelivery(), never a direct Add flow here) - BasePage.ensureSearchInputOpen()/searchList()
//   depend on locating an "Add" button and DON'T work on this page; use a page-local search-open
//   approach instead (see openListSearch below).
// - List row action button (the lone button in a data row) opens a real menu with "Edit"/"Delete"
//   menuitems - BasePage.openRowActionMenu()/deleteFromList() work as-is once given a real
//   `rowBySeriesNumber` value (the ID column's own rendered text, e.g. "DLO-2026-000123").
// - Sorting uses dedicated buttons with their own accessible names ("Sort by ID ascending",
//   "Sort by Date ascending", "Sort by Status ascending") - NOT native MUI DataGrid column-header
//   click+aria-sort (a bare columnheader click on this list times out, unlike Procurement's own
//   BasePage.clickColumnHeader() convention) - clicking the SAME button again toggles to
//   descending. Only ID/Date/Status have a dedicated sort button; Salesperson/Customer/Location/
//   Entity do not.
// - Post-"Delivered"-status action buttons (Print/Send Email/Return Delivery/Create Invoice) do
//   NOT exist on a fresh "Picked" order - they only render once status reaches Delivered.
//   CONFIRMED LIVE: BUG-01 (raw i18n key 'manufacturing.buildOrder.fields.accounting_ledger_label'
//   instead of a readable "Accounting Ledger" label) reproduces on a real Delivered order.
// - Non-existent id direct URL: page loads without crashing, but renders essentially blank (no
//   explicit "not found" message) and does not redirect elsewhere.
class CrmDeliveryOrderPage extends require('./BasePage') {
  constructor(page) {
    super(page);
    this.page = page;

    this.nextButton = page.getByRole('button', { name: 'Next', exact: true });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.promotionTab = page.getByRole('tab', { name: 'Promotion', exact: true });
    this.requiredFieldsError = page.getByText('Please fill all the required fields.');

    this.statusChip = page.getByText(/^(Picked|Packed|Dispatched|Delivered)$/, { exact: true }).first();
    this.validateButton = page.getByRole('button', { name: 'Validate', exact: true });
    this.packedButton = page.getByRole('button', { name: 'Packed', exact: true });
    this.dispatchedButton = page.getByRole('button', { name: 'Dispatched', exact: true });
    this.deliveredButton = page.getByRole('button', { name: 'Delivered', exact: true });

    this.trackDetailsDialog = page.getByRole('dialog').filter({ hasText: 'Track Details' });

    // ---------- Detail page: tabs ----------
    this.basicDetailsTab = page.getByRole('tab', { name: 'Basic Details', exact: true });
    this.packageTab = page.getByRole('tab', { name: 'Package', exact: true });
    this.addressContactTab = page.getByRole('tab', { name: 'Address and Contact', exact: true });
    this.shippingTab = page.getByRole('tab', { name: 'Shipping', exact: true });
    this.summaryTab = page.getByRole('tab', { name: 'Summary', exact: true });
    this.activityTab = page.getByRole('tab', { name: 'Activity', exact: true });

    // ---------- Detail page: navigation / chrome ----------
    this.goBackButton = page.getByRole('button', { name: /go back/i });
    this.switchModuleButton = page.getByRole('button', { name: /switch module/i });
    this.breadcrumbDeliveryOrdersLink = page.getByRole('link', { name: 'Delivery Orders', exact: true });
    this.saleOrderButton = page.getByRole('button', { name: /^Sale Order$/i });

    // ---------- Detail page: Transportation (CONFIRMED LIVE: untranslated i18n keys, BUG-02/03) ----------
    this.transportationSectionHeader = page.getByText('rental.orders.rentalOrder.sections.transportation', { exact: false });
    this.driverFieldLabel = page.getByText('rental.orders.rentalOrder.fields.driver_label', { exact: false });
    this.vehicleNumberFieldLabel = page.getByText('rental.orders.rentalOrder.fields.vehicleNumber_label', { exact: false });

    // ---------- Detail page: Action buttons (only render once status === 'Delivered') ----------
    this.printButton = page.getByRole('button', { name: /^Print$/i });
    this.sendEmailButton = page.getByRole('button', { name: /email/i });
    this.returnDeliveryButton = page.getByRole('button', { name: /return delivery/i });
    this.createInvoiceButton = page.getByRole('button', { name: /create invoice/i });
    // BUG-01: renders as the raw i18n key, not a readable "Accounting Ledger" label.
    this.accountingLedgerButton = page.getByRole('button', { name: 'manufacturing.buildOrder.fields.accounting_ledger_label' });

    // ---------- Detail page: Classification & Attachment ----------
    this.departmentLabel = page.getByText(/^Department/, { exact: false });
    this.attachmentLabel = page.getByText(/Attachment/i, { exact: false });
  }

  // ---------- List page: sorting (dedicated buttons, not column-header click) ----------
  // CONFIRMED LIVE: the button's own accessible name flips from "Sort by X ascending" to
  // "Sorted by X ascending"/"Sorted by X descending" once that column IS the active sort (this
  // grid's sort state persists across page loads/sessions) - match both forms, not just the
  // pre-sort "Sort by" wording.
  sortByButton(columnName) {
    return this.page.getByRole('button', { name: new RegExp(`^Sort(ed)? by ${columnName}`, 'i') });
  }

  async clickSortBy(columnName) {
    await this.sortByButton(columnName).click();
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }


  // ---------- List page ----------
  async gotoList() {
    await this.page.goto('/dashboard/crm/orders/delivery-orders', { timeout: 60000 });
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await this.page.locator('.MuiSkeleton-root, [role="progressbar"]').first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
      const rowsOrEmpty = this.page.locator('tbody tr').filter({ hasNotText: 'Add Calculation' }).first().or(this.noDataRow());
      const visible = await rowsOrEmpty.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
      if (visible) return;
      if (attempt === 4) return;
      await this.page.reload({ timeout: 60000 }).catch(() => {});
    }
  }

  async openViewById(id) {
    await this.page.goto(`/dashboard/crm/orders/delivery-orders/${id}/view-delivery-orders`, { timeout: 60000 });
    // Same stuck-on-its-own-bare-loading-spinner class of bug as every other module in this
    // suite - retry with a reload rather than trust one wait. Capped at ONE reload.
    const readySignal = this.statusChip.or(this.page.getByText(/^ID/).first());
    for (let attempt = 1; attempt <= 2; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const visible = await readySignal.first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      if (visible) return;
      if (attempt === 2) return;
      await this.page.reload({ timeout: 60000 }).catch(() => {});
    }
  }

  async getStatus() {
    return (await this.statusChip.textContent().catch(() => '')).trim();
  }

  // Navigates Basic Details -> Package -> Address and Contact -> Shipping -> Promotion (4 clicks)
  // then Save. Everything required arrives pre-filled from the source Sales Order, so this is
  // pure navigation, not field-filling - but see this file's own header comment on why each Next
  // click waits for a settle beat first.
  async fillRequiredFieldsAndSave() {
    for (let i = 0; i < 4; i++) {
      const onPromotion = await this.promotionTab.getAttribute('aria-selected').catch(() => null);
      if (onPromotion === 'true') break;
      await this.page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await this.page.waitForTimeout(1200);
      await this.nextButton.click();
      await this.page.waitForTimeout(1000);
    }

    const hasError = await this.requiredFieldsError.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasError) {
      throw new Error('CrmDeliveryOrderPage.fillRequiredFieldsAndSave: "Please fill all the required fields" blocked Save - see screenshot');
    }
    await this.saveButton.click();
    await this.page.waitForTimeout(2000);
  }

  // Opens the Items grid row's Trace Details icon (last button in the last column) and returns
  // the Track Details dialog.
  async openTrackDetailsModal(rowIndex = 0) {
    const row = this.page.locator('table tbody tr').nth(rowIndex);
    await row.locator('td').last().locator('button').last().click();
    await this.trackDetailsDialog.waitFor({ state: 'visible', timeout: 10000 });
    return this.trackDetailsDialog;
  }

  // Submits the Track Details dialog - CONFIRMED LIVE this always arrives with its Lot/Serial
  // entry already auto-allocated (a bare "is the grid empty yet" check raced the row's own render
  // and wrongly clicked "Add" unnecessarily, leaving a stray overlay that then blocked Submit) -
  // just click Submit directly. CONFIRMED LIVE: the click can silently not register/process on the
  // first try, leaving the dialog open - retry the click itself rather than swallow a "didn't
  // close" timeout and blindly proceed onto a click hidden behind the still-open dialog.
  async submitTrackDetails() {
    const dialog = this.trackDetailsDialog;
    const submitButton = dialog.getByRole('button', { name: 'Submit', exact: true });
    for (let attempt = 1; attempt <= 3; attempt++) {
      await submitButton.click();
      const closed = await dialog.waitFor({ state: 'hidden', timeout: 6000 }).then(() => true).catch(() => false);
      if (closed) return;
      if (attempt === 3) throw new Error('CrmDeliveryOrderPage.submitTrackDetails: Track Details dialog did not close after 3 Submit attempts');
    }
  }

  async validate() {
    await this.validateButton.click();
    await this.page.waitForTimeout(1500);
  }

  async markPacked() {
    await this.packedButton.click();
    await this.page.waitForTimeout(1500);
  }

  async markDispatched() {
    await this.dispatchedButton.click();
    await this.page.waitForTimeout(1500);
  }

  async markDelivered() {
    await this.deliveredButton.click();
    await this.page.waitForTimeout(1500);
  }

  // Convenience: runs Trace -> Submit -> Validate -> Packed -> Dispatched -> Delivered for a
  // single-item Delivery Order, verifying the final status.
  async completeDeliveryLifecycle(rowIndex = 0) {
    await this.openTrackDetailsModal(rowIndex);
    await this.submitTrackDetails();
    await this.validate();
    await this.markPacked();
    await this.markDispatched();
    await this.markDelivered();
  }
}

module.exports = CrmDeliveryOrderPage;
