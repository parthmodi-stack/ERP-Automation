const SettingsEntityPage = require('./base/SettingsEntityPage');

// Work Center (dashboard/manufacturing/settings/work-centers) - a master-data CRUD screen (no
// approval workflow) representing a physical/logical production resource. Standalone class, no
// shared base, same tier as WorkCenterCategoryPage. Only Work Centre (name) and Location are
// actually required (confirmed live via the empty-Save validation errors: "Work centre name is
// required" / "Location is required") - Work Centre Code, Alternate WC, Narration, every
// Production Details field, Equipment Details, Attachment, and Working Hours are all optional.
//
// Same two-creation-path shape as Work Center Category: "Save" creates directly (`is_draft:
// false`, no status chip); "Save To Draft" creates with `is_draft: true` (a "Draft" chip on
// View) - Edit's own single "Save" button works for both and clears the Draft chip if present.
// Unlike Work Center Category, Add and Edit forms share the SAME `work_centre.<field>` prefix
// (confirmed live - no prefix-mismatch bug here).
//
// Equipment Details' own Materials-grid-shaped table ("Equipment" / "Equipment Category" columns)
// stays "No Data" for now - it references the "Operation and Equipments" module, not yet built in
// this suite (next in the Work Center Categories -> Work Center -> Operation and Equipments ->
// Routing sequence) - left untouched here since it's optional.
//
// Two confirmed live app typos, not mistakes introduced here: Production Details' "Time
// Efficiency" field renders as "This Efficiency" on the View page, and the location field's own
// label is an untranslated locale key ("crm.salesOrder.fields.location_label"), same bug already
// documented on Work Center Category/Unbuild Order's own Location fields.
class WorkCenterPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'work_centre',
      listPath: '/dashboard/manufacturing/settings/work-centers',
      addPath: '/dashboard/manufacturing/settings/work-centers/add-work-centers',
    });

    this.addButton = page.getByRole('button', { name: 'Add', exact: true });
    this.nameInput = page.locator('input[name="work_centre.name"]');
    this.codeInput = page.locator('input[name="work_centre.code"]');
    this.narrationInput = page.locator('textarea[name="work_centre.narration"]');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft', exact: true });
    this.discardButton = page.getByRole('button', { name: 'Discard', exact: true });

    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.deleteButton = page.getByRole('button', { name: 'Delete', exact: true });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true });
  }

  async gotoList() {
    await this.page.goto('/dashboard/manufacturing/settings/work-centers');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-work-centers');
    await this.page.waitForLoadState('networkidle');
  }

  // Delegates to the inherited selectField() (pages/base/SettingsEntityPage.js -> helpers/
  // dropdown.js) for the full search -> exact-match -> first-available-fallback -> create-new/
  // throw chain - see WorkCenterCategoryPage.js's own selectDropdown for the rationale.
  async selectDropdown(fieldName, optionText, opts = {}) {
    const value = optionText || '';
    await this.selectField(fieldName, value, value, { optional: false, ...opts });
  }

  async selectLocation(locationName) {
    await this.selectDropdown('location', locationName);
  }

  async fillHeader({ name, code, narration } = {}) {
    if (name !== undefined) await this.nameInput.fill(name);
    if (code !== undefined) await this.codeInput.fill(code);
    if (narration !== undefined) await this.narrationInput.fill(narration);
  }

  // Creates directly (no Draft chip) - captures the series_number from the create response (flat
  // `data.workCentre.series_number`, confirmed live) since the post-save redirect lands on the
  // LIST, not this record's own view page.
  async save() {
    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && /\/work-centre\/?$/.test(new URL(res.url()).pathname)
    );
    await this.saveButton.click();
    const response = await responsePromise;
    const body = await response.json();
    await this.page.waitForURL('**/settings/work-centers', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return body.data.workCentre.series_number;
  }

  // Creates with `is_draft: true` (shown as a "Draft" chip on View) - same response shape/series
  // number location as save() above, different endpoint (.../save-as-draft).
  async saveToDraft() {
    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/work-centre/save-as-draft')
    );
    await this.saveToDraftButton.click();
    const response = await responsePromise;
    const body = await response.json();
    await this.page.waitForURL('**/settings/work-centers', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return body.data.workCentre.series_number;
  }

  async openView(seriesNumber) {
    await this.gotoList();
    await this.page.getByText(seriesNumber, { exact: true }).first().click();
    await this.page.waitForURL('**/view-work-centers');
    await this.page.waitForLoadState('networkidle');
  }

  async openEdit(seriesNumber) {
    await this.openView(seriesNumber);
    await this.editButton.click();
    await this.page.waitForURL('**/edit-work-centers');
    await this.page.waitForLoadState('networkidle');
  }

  // Edit's own Save (PUT) works for both creation paths and clears the "Draft" chip if the record
  // had one (confirmed live) - no separate Save/Save To Draft split here, just one Save button.
  async saveEdit() {
    await this.saveButton.click();
    await this.page.waitForURL('**/settings/work-centers', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }

  async deleteRecord() {
    await this.deleteButton.click();
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = WorkCenterPage;
