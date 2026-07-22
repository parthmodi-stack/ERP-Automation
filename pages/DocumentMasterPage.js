const BasePage = require('./BasePage');

// Document Master (erpforce-hrms-fe: src/views/document-master/) - a flat Add/Edit form (Document
// Type free text + Company dropdown + Active/Inactive toggle) with one repeatable "Documents" grid
// (Document Name/Remarks/Validity Check per row). Unlike Organization Structure, this is a normal
// form, not a canvas - but the Documents grid is NOT a modal-based item-add like Procurement's
// Items grid; it's `MaterialEditableTable`, a different shared component with its own quirks
// (confirmed by reading @erpsquad/common's compiled source, not live DOM inspection - see the
// per-method comments below):
//   - New rows are added inline at the BOTTOM via a "+ Add" button (class `add-row-btn`), not a modal.
//   - There is no visible per-row Save/Cancel button - typing in a row's fields and pressing Enter
//     commits it (`onKeyUp` handler dispatches to save-creating-row/save-editing-row on Enter);
//     Escape cancels. Clicking a different row's cell auto-saves the row you were just editing.
//   - An EXISTING row is edited by clicking directly on one of its cells (not a pencil icon - the
//     default row-actions edit icon is suppressed by this module's config), which drops that row
//     into the same inline-input edit mode as a newly created row.
//   - Row inputs use a real `name` attribute equal to their field name (`document_name`, `remarks`,
//     `is_validity_check`), confirmed in InlineEditFields' TextField/Checkbox props - use those
//     instead of placeholder text, since several of this module's placeholder i18n keys
//     (`hrms.document_master.fields.document_name_placeholder` etc.) don't have an English
//     translation entry in translations/hrms.json and may render as the raw untranslated key.
//   - Row delete is a trash icon (`className: 'delete-row'`) that opens a confirm popup
//     ("Delete Item" / "Are you sure you want to delete entry ?") - reuse BasePage.confirmDelete().
class DocumentMasterPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.listAddButton = page.getByRole('button', { name: 'Add' }).first();

    // Basic Details
    this.documentTypeInput = page.getByPlaceholder('Enter document type');
    this.companyField = 'Company';
    this.statusToggle = page.locator('input[name="status"]');

    // Documents grid
    this.addRowButton = page.locator('.add-row-btn');
    this.documentNameInput = page.locator('input[name="document_name"]');
    this.remarksInput = page.locator('input[name="remarks"]');
    this.validityCheckbox = page.locator('input[name="is_validity_check"]');

    // Validation error text - "Documents"/"Document Type"/"Company" come from the shared
    // `{{field}} is required` template (translations/common.json); "Document Name is required"
    // for a grid row is a hardcoded msg_en in default-data.ts, not run through that template.
    this.documentTypeRequiredError = page.getByText('Document Type is required');
    this.companyRequiredError = page.getByText('Company is required');
    this.documentsRequiredError = page.getByText('Documents is required');
    this.documentNameRowRequiredError = page.getByText('Document Name is required');

    // Page-level actions - same shared i18n keys/wording already confirmed live by
    // ProcurementRequestPage (Save/Discard) and reused for Organization Structure (Save To Draft).
    this.discardButton = page.getByRole('button', { name: 'Discard' });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    // View/Edit page actions
    this.viewActionsButton = page.getByRole('button', { name: 'Actions' });
  }

  async gotoList() {
    await this.page.goto('/dashboard/hrms/company-master-policy/document-master');
    await this.page.waitForLoadState('load');
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  async goto() {
    await this.gotoList();
    await this.listAddButton.click();
    await this.page.waitForURL('**/add-document-master');
    await this.page.waitForLoadState('load');
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  async fillBasicDetails({ documentType, company }) {
    if (documentType !== undefined) {
      await this.documentTypeInput.fill(documentType);
    }
    if (company) {
      await this.selectFieldByLabel(this.companyField, company, { exact: false });
    }
  }

  async toggleStatus() {
    await this.statusToggle.click();
  }

  // Adds one row to the Documents grid and commits it with Enter (see class comment - there is
  // no visible per-row Save button on this shared grid component).
  async addDocumentRow({ documentName, remarks, validityCheck }) {
    await this.addRowButton.click();
    if (documentName !== undefined) {
      await this.documentNameInput.fill(documentName);
    }
    if (remarks !== undefined) {
      await this.remarksInput.fill(remarks);
    }
    if (validityCheck) {
      await this.validityCheckbox.check();
    }
    await this.page.keyboard.press('Enter');
  }

  async addDocumentRows(documents) {
    for (const doc of documents) {
      await this.addDocumentRow(doc);
    }
  }

  // Clicking any cell in an existing row (identified by its current Document Name text) drops
  // that row into inline edit mode - see class comment.
  async editDocumentRowByName(existingDocumentName, { documentName, remarks, validityCheck } = {}) {
    const row = this.page.locator('tr', { has: this.page.getByText(existingDocumentName, { exact: true }) });
    await row.locator('td').nth(1).click();

    if (documentName !== undefined) {
      await this.documentNameInput.fill(documentName);
    }
    if (remarks !== undefined) {
      await this.remarksInput.fill(remarks);
    }
    if (validityCheck !== undefined) {
      const isChecked = await this.validityCheckbox.isChecked();
      if (isChecked !== validityCheck) {
        await this.validityCheckbox.click();
      }
    }
    await this.page.keyboard.press('Enter');
  }

  async deleteDocumentRow(documentName) {
    const row = this.page.locator('tr', { has: this.page.getByText(documentName, { exact: true }) });
    await row.locator('.delete-row').click();
    await this.confirmDelete();
  }

  // ---------- Save actions ----------
  // Same reasoning as OrganizationStructurePage.saveAndCaptureId: capture the just-created/updated
  // record from the list's own refetch JSON rather than assuming DOM row order. List response
  // shape per actionCreator.ts: `{ data: { document_master: [...] } }` (a flat array here, unlike
  // Organization Structure's `organisation_structures` key), each row has a numeric `id` and the
  // "ID" column's `series_number`.
  async saveAndCaptureId(buttonLocator) {
    const listResponsePromise = this.page.waitForResponse((r) =>
      r.url().includes('document-master') && r.request().method() === 'GET',
    );
    await buttonLocator.click();
    const listResponse = await listResponsePromise;
    await this.page.waitForLoadState('load');
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    const body = await listResponse.json().catch(() => null);
    const record = body?.data?.document_master?.[0];

    const id = record?.id !== undefined ? String(record.id) : undefined;
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

  // ---------- Row status / navigation ----------
  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Draft|Active|Inactive/);
  }

  async openEditFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await this.page.waitForURL('**/edit-document-master');
    await this.page.waitForLoadState('load');
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  async openViewFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'View', exact: true }).click();
    await this.page.waitForURL('**/view-document-master');
    await this.page.waitForLoadState('load');
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }
}

module.exports = DocumentMasterPage;
