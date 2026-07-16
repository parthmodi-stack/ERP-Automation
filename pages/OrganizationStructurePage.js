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
    await this.page.goto('/dashboard/hrms/organization-structure');
    await this.page.waitForLoadState('networkidle');
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

  // Helper to clear the auto-selected company value for validation tests
  async clearCompanySelection() {
    const sidebar = this.page.locator('div').filter({ hasText: 'Save & Add' }).first();
    const combobox = sidebar.getByText(this.companyNameField).first().locator('xpath=following::*[@role="combobox"][1]');
    await combobox.hover();
    await sidebar.getByRole('button', { name: 'clear selection' }).first().click();
  }

  // Override getEditComboboxValue to scope it to the sidebar drawer, avoiding background table header collisions
  async getEditComboboxValue(label) {
    const sidebar = this.page.locator('div').filter({ hasText: 'Save & Add' }).first();
    const text = await sidebar
      .getByText(label, { exact: true })
      .first()
      .locator("xpath=following-sibling::*[1]")
      .innerText();
    return text.replace(/[\u200B\uFEFF]/g, "").trim();
  }

  // Fills the Company sidebar's fields and reads back whichever values actually got selected.
  // NOTE: selectFieldByLabel does NOT fall back to "first available option" on its own (only
  // selectFirstOptionByLabel does) - it throws if the requested testData value isn't present.
  // Location specifically has no stable/pinnable set of real names in this account's master
  // data (confirmed live), so it's always created fresh via the dropdown's own "Create New
  // Location" footer instead of guessing an existing name.
  // Returns the values actually chosen, for later assertions.
  async fillCompanySidebar({ company, location, designation }) {
    const sidebar = this.page.locator('div').filter({ hasText: 'Save & Add' }).first();
    if (company) {
      await this.selectFieldByLabel(this.companyNameField, company, { exact: false, scope: sidebar });
    }
    if (location) {
      await this.createLocationFromFooter(location, company || 'erp-force', { scope: sidebar });
    }
    if (designation) {
      await this.selectFieldByLabel(this.designationField, designation, { exact: false, scope: sidebar });
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
    const listResponsePromise = this.page.waitForResponse((r) =>
      r.url().includes('organisation-structure') && r.request().method() === 'GET',
    );
    await buttonLocator.click();
    const listResponse = await listResponsePromise;
    await this.page.waitForLoadState('networkidle');
    const body = await listResponse.json().catch(() => null);
    const record = body?.data?.organisation_structures?.[0];

    const id = record?._id ? String(record._id) : undefined;
    let seriesNumber = record?.series_number;
    if (!seriesNumber) {
      seriesNumber = await this.page.locator('table tbody tr').first().innerText();
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
