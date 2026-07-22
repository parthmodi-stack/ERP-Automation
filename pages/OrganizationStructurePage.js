const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// IMPORTANT - read before extending this file:
// Organization Structure is NOT a flat add/edit form like Location/Bin/UOM. Per
// erpforce-hrms-fe (src/views/organization-structure/), it's a React Flow graph/org-chart
// canvas: Add/Edit lands you on an empty (or populated) canvas, clicking the canvas-level
// "Add" button opens a small menu to pick a node type (Company/Department/Designation/Team),
// and each node type has its own small Yup-validated form in a right-hand Drawer ("sidebar"),
// saved into the node via a "Save & Add" footer button - only THEN does the page-level
// Save/Save To Draft button persist the whole graph.
//
// This first pass only covers the Company node (the only node type available on an empty
// canvas, per add-organization-structure.tsx - Department/Designation/Team nodes are added as
// children of an existing node, and the exact in-canvas trigger for that wasn't confirmed
// against a live app before writing this, so Department/Designation/Team sidebars and
// multi-node hierarchy/node-delete-blocked-by-children tests are intentionally NOT implemented
// here - see the TODO comments in the spec file. Extend this page object when that's verified
// live, following the same pattern as fillCompanySidebar/openNodeTypeMenu below.
//
// All locators here come from reading erpforce-hrms-fe source and its translation strings
// (translations/hrms.json in erpforce-be), not from live DOM inspection - if a selector
// doesn't match on first run, that's expected; fix it up against the real rendered app rather
// than assuming the source-derived guess was wrong in spirit.
class OrganizationStructurePage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    // Listing page (shared MaterialTable component, same "Add" button pattern as every module)
    this.listAddButton = page.getByRole('button', { name: 'Add' }).first();

    // Canvas-level "Add" button - only enabled/present node-type option on an empty canvas is
    // "Company" (add-organization-structure.tsx:507), so this page object only wires that one up.
    this.canvasAddButton = page.getByRole('button', { name: 'Add', exact: true });
    this.companyNodeTypeOption = this.canvasAddButton.locator('xpath=..').getByText('Company', { exact: true });

    // Company sidebar (GenericSidebar Drawer) - field labels/placeholders from
    // translations/hrms.json (hrms.organization_structure.fields.* / .placeholders.*).
    this.companyNameField = 'Company Name';
    this.locationField = 'Location';
    this.designationField = 'Designation';
    this.employeeField = 'Employee';
    this.sidebarSaveButton = page.getByRole('button', { name: 'Save & Add' });

    // Validation error text (hrms.organization_structure.validation.*) - exact strings from
    // translations/hrms.json, not guessed.
    this.companyRequiredError = page.getByText(/Company name is required|hrms\.organization_structure\.validation\.company_required/i);
    this.designationRequiredError = page.getByText('Designation is required');

    // Page-level actions (outside any sidebar) - "Save To Draft" label matches the existing
    // shared common.buttons.saveAsDraft_label wording already confirmed live by
    // ProcurementRequestPage (same i18n key), reused here rather than guessed independently.
    this.discardButton = page.getByRole('button', { name: 'Discard' });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    // View page
    this.viewActionsButton = page.getByRole('button', { name: 'Actions' });
    this.viewEditMenuItem = page.getByRole('menuitem', { name: 'Edit', exact: true });
  }

  async gotoList() {
    await this.page.goto('/dashboard/hrms/organization-structure', { waitUntil: 'networkidle' });
    await this.listAddButton.waitFor({ state: 'visible', timeout: 30000 });
  }

  async goto() {
    await this.gotoList();
    await this.listAddButton.click();
    await this.page.waitForURL('**/add-organization-structure');
    await this.page.waitForLoadState('networkidle');
  }


  async openNodeTypeMenu() {
    await this.canvasAddButton.click();
  }

  // Opens the Company sidebar from an EMPTY canvas (Add flow). For Edit, click the existing
  // Company node on the canvas instead (see openExistingCompanyNode below) - the sidebar re-uses
  // the same fields either way.
  async openAddCompanySidebar() {
    await this.openNodeTypeMenu();
    await this.companyNodeTypeOption.click();
  }

  // Clicking an existing node re-opens its sidebar in edit mode (confirmed via
  // company-sidebar.tsx's title toggling Add/Edit based on whether a node is selected). Node
  // cards aren't locator-confirmed beyond "renders company name" - scoped to matching by the
  // company name text already known from creation, since that's the only node on the canvas in
  // this first-pass suite (single Company node, no children).
  async openExistingCompanyNode(companyName) {
    await this.page.getByText(companyName, { exact: false }).first().click();
  }

  // Company sidebar Drawer portals outside the <main> landmark (confirmed live: BasePage's
  // default scope of page.getByRole('main') matches zero elements for any sidebar field), so any
  // helper that needs to reach into the sidebar must scope to this locator explicitly instead.
  sidebarScope() {
    return this.page.locator('div').filter({ hasText: 'Save & Add' }).first();
  }

  // Helper to clear the auto-selected company value for validation tests
  async clearCompanySelection() {
    const sidebar = this.sidebarScope();
    const combobox = sidebar.getByText(this.companyNameField).first().locator('xpath=following::*[@role="combobox"][1]');
    await combobox.hover();
    await sidebar.getByRole('button', { name: 'clear selection' }).first().click();
  }

  // Override getEditComboboxValue to scope it to the sidebar drawer, avoiding background table header collisions
  async getEditComboboxValue(label) {
    const text = await this.sidebarScope()
      .getByText(label, { exact: true })
      .first()
      .locator("xpath=following-sibling::*[1]")
      .innerText();
    return text.replace(/[\u200B\uFEFF]/g, "").trim();
  }

  // The sidebar's Company Name/Location/Designation/Employee fields are FLAT siblings under one
  // shared Box (confirmed live via a failed run's page snapshot) - each field is a bare
  // `<p>` label immediately followed by its own combobox wrapper, NOT individually wrapped in a
  // per-field container. BasePage's default field lookup (`getByText(label).locator('xpath=..')`)
  // assumes the label's parent contains only that field's own combobox, which holds for every
  // other module's forms but not this one: here that parent is the WHOLE shared Box, so
  // `.getByRole('combobox').first()` always resolves to Company Name's combobox (the first field
  // in DOM order) no matter which label was actually searched. Use the label's own
  // following-sibling instead - same fix already applied to getEditComboboxValue above.
  sidebarFieldCombobox(labelText, scope = this.sidebarScope()) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
    return scope
      .getByText(labelRegex)
      .first()
      .locator('xpath=following-sibling::*[1]')
      .getByRole('combobox')
      .first();
  }

  // Reuses BasePage's click/retry/typing logic (selectInCombobox) against a correctly-scoped
  // sidebar combobox - see sidebarFieldCombobox above for why the plain selectFieldByLabel isn't
  // safe to use directly on this sidebar's fields.
  async selectSidebarFieldByLabel(labelText, optionText, { scope = this.sidebarScope() } = {}) {
    return this.selectInCombobox(this.sidebarFieldCombobox(labelText, scope), optionText, { labelForError: labelText });
  }

  // Same reasoning as BasePage.selectFirstOptionByLabel: for a field whose exact live option set
  // in this state is unverified/unstable, pick whatever renders first instead of pinning to a
  // literal string. Designation is filtered by Company (filterFields), so with Company cleared
  // (TC-ORG-04's validation scenario) it falls back to an unfiltered, live-data-dependent option
  // list - confirmed live that a fixed "Manager" string isn't reliably the option that appears
  // there (a different entry whose text happens to contain "Manager" can render first instead).
  async selectFirstAvailableSidebarOption(labelText, { scope = this.sidebarScope() } = {}) {
    return this.selectFirstAvailableOption(this.sidebarFieldCombobox(labelText, scope));
  }

  // Overrides BasePage.createLocationFromFooter only to fix which combobox gets clicked open -
  // same underlying flat-sibling DOM issue as sidebarFieldCombobox above (confirmed live: this
  // was silently clicking the already-selected Company combobox instead of Location's, then
  // hanging waiting for "Create New Location" text that never appears in a list of company
  // options). Everything after the initial click (footer click, dialog fill, selecting Company
  // *inside* the dialog, and the fallback re-select) is unchanged from BasePage's version -
  // the LocationAddModal dialog is a normal individually-wrapped form, so BasePage's own
  // selectFieldByLabel is correct there.
  async createLocationFromFooter(locationName, companyName, { scope = this.sidebarScope() } = {}) {
    const combobox = this.sidebarFieldCombobox(this.locationField, scope);

    // 1. Click the combobox to open the listbox
    await combobox.click();

    // 2. Click "+ Create New Location" from the footer
    await this.page.getByText('Create New Location', { exact: false }).click();

    // 3. Wait for the dialog to be visible
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });

    // 4. Fill in Location Name and a unique Location Code
    await dialog.getByPlaceholder(/Enter Name|location_name_placeholder/i).fill(locationName);
    const code = 'LOC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    await dialog.getByPlaceholder(/Enter Short Code|location_code_placeholder/i).fill(code);

    // 5. Select Company inside the dialog
    try {
      await this.selectFieldByLabel('Company', companyName, { exact: false, scope: dialog, timeout: 5000 });
    } catch (e) {
      await this.selectFirstOptionByLabel('Company', { scope: dialog }).catch(() => {});
    }

    // 6. Save the new location
    await dialog.getByRole('button', { name: 'Save' }).click();

    // 7. Wait for the dialog to close
    await dialog.waitFor({ state: 'hidden' });

    // 8. Select the newly created location from the open listbox
    const selected = await this.selectOptionFromListbox(locationName, { timeout: 7000 });
    if (!selected) {
      // Ensure any dialog/backdrop is fully hidden/detached before manual selection fallback
      await this.page.waitForSelector('.MuiDialog-root', { state: 'detached', timeout: 5000 }).catch(() => {});
      await this.page.waitForSelector('.MuiBackdrop-root', { state: 'detached', timeout: 5000 }).catch(() => {});
      await this.selectSidebarFieldByLabel(this.locationField, locationName, { scope });
    }
  }

  // Fills the Company sidebar's fields and reads back whichever values actually got selected.
  // NOTE: selectFieldByLabel does NOT fall back to "first available option" on its own (only
  // selectFirstOptionByLabel does) - it throws if the requested testData value isn't present.
  // Location specifically has no stable/pinnable set of real names in this account's master
  // data (confirmed live), so it's always created fresh via the dropdown's own "Create New
  // Location" footer instead of guessing an existing name.
  // Returns the values actually chosen, for later assertions.
  async fillCompanySidebar({ company, location, designation }) {
    const sidebar = this.sidebarScope();
    if (company) {
      await this.selectSidebarFieldByLabel(this.companyNameField, company, { scope: sidebar });
    }
    if (location) {
      await this.createLocationFromFooter(location, company || 'erp-force', { scope: sidebar });
    }
    if (designation) {
      await this.selectSidebarFieldByLabel(this.designationField, designation, { scope: sidebar });
    }

    return {
      company: await this.getEditComboboxValue(this.companyNameField).catch(() => company),
      location: location
        ? await this.getEditComboboxValue(this.locationField).catch(() => location)
        : undefined,
      designation: await this.getEditComboboxValue(this.designationField).catch(() => designation),
    };
  }

  async saveNodeToSidebar() {
    await this.sidebarSaveButton.click();
  }

  // ---------- Save actions ----------
  // Same reasoning as ProcurementRequestPage.saveAndCaptureId: the list is a shared, persistent
  // dataset, so capture the just-created record straight from the list's own refetch JSON
  // instead of assuming DOM row order. Response shape per actionCreators.ts: list refetch body
  // is `{ data: { organisation_structures: [...] } }`, record's DB id is `_id`; the rendered "ID"
  // column key is `series_number` (default-data.ts) - NOT verified live whether that key is
  // actually present on each row object (vs. computed client-side), so this falls back to
  // reading the list's first row text directly if `series_number` is missing from the payload.
  async saveAndCaptureId(buttonLocator) {
    const listResponsePromise = this.page.waitForResponse(
      (r) => r.url().includes('organisation-structure') && r.request().method() === 'GET',
      { timeout: 15000 },
    ).catch(() => null);

    await buttonLocator.click();
    const listResponse = await listResponsePromise;
    await this.page.waitForLoadState('networkidle').catch(() => {});
    const body = listResponse ? await listResponse.json().catch(() => null) : null;
    const record = body?.data?.organisation_structures?.[0];

    const id = record?._id ? String(record._id) : undefined;
    let seriesNumber = record?.series_number;
    if (!seriesNumber) {
      const cellText = await this.page
        .locator('table tbody tr')
        .first()
        .locator('td')
        .first()
        .innerText()
        .catch(() => undefined);
      if (cellText) {
        seriesNumber = cellText.replace(/[\u200B\uFEFF]/g, '').trim();
      }
    }
    return { id, seriesNumber };
  }

  async save() {
    return this.saveAndCaptureId(this.saveButton);
  }

  async saveAsDraft() {
    return this.saveAndCaptureId(this.saveToDraftButton);
  }

  // ---------- View / row status ----------
  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Draft|Published/);
  }

  async openViewFromList(seriesNumber) {
    await this.searchList(seriesNumber);
    await this.rowBySeriesNumber(seriesNumber).first().click();
    await this.page.waitForURL('**/view-organization-structure');
    await this.page.waitForLoadState('networkidle');
  }

  async openEditFromView() {
    await this.viewActionsButton.click();
    await this.viewEditMenuItem.waitFor({ state: 'visible' });
    await this.viewEditMenuItem.click();
    await this.page.waitForURL('**/edit-organization-structure');
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = OrganizationStructurePage;
