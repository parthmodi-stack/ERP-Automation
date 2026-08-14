const SettingsEntityPage = require('./base/SettingsEntityPage');
const { selectDropdown } = require('../helpers/dropdown');

// Operation (dashboard/manufacturing/settings/operations) - fourth step of the Work Center
// Categories -> Work Center -> Operation and Equipments -> Routing sequence (Equipment itself was
// the third step - "Operation" is its own separate settings screen, not combined with Equipment
// the way the sequence name might suggest). Only Operation Name, Work Centre, Location, and AT
// LEast one Costing Details row are required (confirmed live via empty-Save validation errors:
// "Name is required" / "Work centre is required" / "Location is required" / "Atleast one costing
// details is required"). "Copy From" above the Costing Details grid renders with a required-style
// asterisk but is NOT actually validated as required (confirmed live - no matching error fires) -
// a real label bug, not a mistake introduced here.
//
// The Costing Details grid's own "Category" column is where Work Center Category (built earlier
// in this sequence) actually gets referenced/used - confirmed live via its own dropdown listing
// this suite's own "Automation_WCC_*" records. Only Category itself is required within a row;
// Value Per Hour/Value Per Minute/Fix Rate are all optional. Same "row isn't part of the form
// until its own row-level save (disk) icon is clicked" pattern as Bill of Material's own Materials
// grid - addCostingRow() below handles that.
//
// "Actual Duration Computation" is a custom radio-style field rendered as a single SVG icon with
// an `options="[object Object],[object Object]"` attribute rather than real accessible radio
// inputs (confirmed live - no `input[type="radio"]` elements exist on this form at all) - left
// untouched here since it already has a valid default ("tracked_time") and isn't required.
//
// Same two-creation-path shape as every other module in this sequence: "Save" creates directly
// (`is_draft: false`); "Save To Draft" creates with `is_draft: true` - but Operation has the SAME
// "Draft chip never renders anywhere" gap as Work Center (confirmed live), unlike Equipment where
// the chip does show. Edit's own form has BOTH "Save To Draft" and "Save" buttons (matching
// Equipment's Edit, not Work Center Category/Work Center's Edit-only-has-Save shape). The Delete
// confirmation dialog's own title is "Delete Item" rather than "Delete Operation" (confirmed live,
// same inconsistency as Equipment's own Delete dialog).
class OperationPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'operation',
      listPath: '/dashboard/manufacturing/settings/operations',
      addPath: '/dashboard/manufacturing/settings/operations/add-operations',
    });

    this.addButton = page.getByRole('button', { name: 'Add', exact: true });
    this.nameInput = page.locator('input[name="operation.operation_name"]');
    this.narrationInput = page.locator('textarea[name="operation.narration"]');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft', exact: true });
    this.discardButton = page.getByRole('button', { name: 'Discard', exact: true });

    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.deleteButton = page.getByRole('button', { name: 'Delete', exact: true });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true });
  }

  async gotoList() {
    await this.page.goto('/dashboard/manufacturing/settings/operations');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-operations');
    await this.page.waitForLoadState('networkidle');
  }

  // Delegates to the inherited selectField() (pages/base/SettingsEntityPage.js -> helpers/
  // dropdown.js) for the full search -> exact-match -> first-available-fallback -> create-new/
  // throw chain - see WorkCenterCategoryPage.js's own selectDropdown for the rationale.
  async selectDropdown(fieldName, optionText, opts = {}) {
    const value = optionText || '';
    await this.selectField(fieldName, value, value, { optional: false, ...opts });
  }

  async selectWorkCentre(workCentreName) {
    await this.selectDropdown('work_centre_id', workCentreName);
  }

  async selectLocation(locationName) {
    await this.selectDropdown('location', locationName);
  }

  async fillHeader({ name, narration } = {}) {
    if (name !== undefined) await this.nameInput.fill(name);
    if (narration !== undefined) await this.narrationInput.fill(narration);
  }

  // Adds one Costing Details row - Category is the only required field within the row (Value Per
  // Hour/Per Minute/Fix Rate all optional, left blank here). The row's own "Category" dropdown
  // uses an UNPREFIXED `mui-component-select-category` id (same pattern as Bill of Material's own
  // Materials-row item dropdown) - clicking the row's own save (disk) icon, the 2nd of its 3
  // buttons (cancel/save/some third action - confirmed live), is what actually commits it into
  // the form's data.
  async addCostingRow({ categoryName } = {}) {
    // The section heading's own text node is "Costing Details*" (asterisk included, no space) -
    // not an exact "Costing Details" match, confirmed live.
    await this.page.getByText('Costing Details*', { exact: true }).scrollIntoViewIfNeeded();
    // Costing Details' own "+ Add" button comes before Instructions' own "+ Add" in DOM order -
    // .first() targets the right one.
    await this.page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await this.page.waitForTimeout(500);

    const value = categoryName || '';
    await selectDropdown(
      this.page,
      this.page.locator('[id="mui-component-select-category"]'),
      value,
      value,
      { optional: false }
    );
    await this.page.waitForTimeout(300);

    const costingRow = this.page.locator('table tbody tr')
      .filter({ has: this.page.locator('[id="mui-component-select-category"]') });
    await costingRow.locator('button').nth(1).click();
    await this.page.waitForTimeout(500);
  }

  // Creates directly (no Draft chip anywhere - see class header comment) - captures the
  // series_number from the create response (flat `data.operation.series_number`, confirmed live)
  // since the post-save redirect lands on the LIST, not this record's own view page.
  async save() {
    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && /\/operations\/?$/.test(new URL(res.url()).pathname)
    );
    await this.saveButton.click();
    const response = await responsePromise;
    const body = await response.json();
    await this.page.waitForURL('**/settings/operations', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return body.data.operation.series_number;
  }

  // Creates with `is_draft: true` (confirmed live via the response - but same as Work Center, NO
  // visible chip appears anywhere on View to prove it) - same response shape/series number
  // location as save() above, different endpoint (.../save-as-draft).
  async saveToDraft() {
    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/operations/save-as-draft')
    );
    await this.saveToDraftButton.click();
    const response = await responsePromise;
    const body = await response.json();
    await this.page.waitForURL('**/settings/operations', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return body.data.operation.series_number;
  }

  async openView(seriesNumber) {
    await this.gotoList();
    await this.page.getByText(seriesNumber, { exact: true }).first().click();
    await this.page.waitForURL('**/view-operations');
    await this.page.waitForLoadState('networkidle');
  }

  async openEdit(seriesNumber) {
    await this.openView(seriesNumber);
    await this.editButton.click();
    await this.page.waitForURL('**/edit-operations');
    await this.page.waitForLoadState('networkidle');
  }

  // Edit's own Save (PUT) works for both creation paths (confirmed live - no visible chip to
  // change either way, unlike Equipment).
  async saveEdit() {
    await this.saveButton.click();
    await this.page.waitForURL('**/settings/operations', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }

  async deleteRecord() {
    await this.deleteButton.click();
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = OperationPage;
