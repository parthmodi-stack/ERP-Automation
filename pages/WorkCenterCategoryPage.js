const SettingsEntityPage = require('./base/SettingsEntityPage');

// Work Center Categories (dashboard/manufacturing/settings/work-center-categories) - a plain
// master-data CRUD screen used to group Work Centers by Type (Labour/Machine/Overhead), reused
// when creating a Work Center. Unlike the document modules (Bill of Material, Work Order, Build
// Order, Unbuild Order), this has NO approval workflow - just Add/Edit/Delete, standalone class
// with no shared base, matching Inventory's own master-data page-object tier (Location/Bin/UOM)
// rather than BasePage.
//
// Two creation paths, BOTH confirmed working (unlike Unbuild Order's own broken Add-page Save):
// - "Save" creates the record directly - no status chip appears on its View page.
// - "Save To Draft" creates it with `is_draft: true` server-side, shown as a "Draft" chip on View.
//   Edit's own "Save" works for both paths and clears the Draft chip if present (confirmed live) -
//   same "Edit -> Save transitions out of Draft" shape as Unbuild Order.
//
// The page's own breadcrumb/title has a real app typo ("Work Centre Categoreis") and the View
// page's own ID heading renders with a stray leading "$" (e.g. "$WCC-0034") - both confirmed live,
// not mistakes introduced here.
class WorkCenterCategoryPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_work_center_category',
      listPath: '/dashboard/manufacturing/settings/work-center-categories',
      addPath: '/dashboard/manufacturing/settings/work-center-categories/add-work-center-categories',
    });

    this.addButton = page.getByRole('button', { name: 'Add', exact: true });
    // Suffix-matched, not a hardcoded prefix - the Add form uses `add_work_center_category.*`
    // field names but Edit uses a DIFFERENT prefix, `edit_work_center_category.*` (confirmed
    // live) - matching on the field name's own suffix works for both without tracking which page
    // is currently open.
    this.nameInput = page.locator('input[name$=".name"]');
    this.narrationInput = page.locator('textarea[name$=".narration"]');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft', exact: true });
    this.discardButton = page.getByRole('button', { name: 'Discard', exact: true });

    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.deleteButton = page.getByRole('button', { name: 'Delete', exact: true });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true });
  }

  async gotoList() {
    await this.page.goto('/dashboard/manufacturing/settings/work-center-categories');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-work-center-categories');
    await this.page.waitForLoadState('networkidle');
  }

  // Delegates to the inherited selectField() (pages/base/SettingsEntityPage.js -> helpers/
  // dropdown.js) for the full search -> exact-match -> first-available-fallback -> create-new/
  // throw chain, instead of this file's own exact-match-or-throw reimplementation. Passing '' for
  // both searchText/optionText when the caller omits a name reliably finds no real match, which
  // sends the shared helper straight into its first-available branch - same "no name -> pick
  // something available" behavior this class's callers already depend on, but verified rather
  // than a blind `li.nth(1)` click.
  async selectDropdown(fieldName, optionText, opts = {}) {
    const value = optionText || '';
    await this.selectField(fieldName, value, value, { optional: false, ...opts });
  }

  async selectType(type) {
    await this.selectDropdown('type', type);
  }

  async selectItem(itemName) {
    await this.selectDropdown('item_id', itemName);
  }

  async fillHeader({ name, narration } = {}) {
    if (name !== undefined) await this.nameInput.fill(name);
    if (narration !== undefined) await this.narrationInput.fill(narration);
  }

  // Creates directly (no Draft chip) - captures the series_number from the create response (flat
  // `data.workCentreCategories.series_number`, confirmed live) since the post-save redirect lands
  // on the LIST, not this record's own view page.
  async save() {
    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && /\/work-centre-categories\/?$/.test(new URL(res.url()).pathname)
    );
    await this.saveButton.click();
    const response = await responsePromise;
    const body = await response.json();
    await this.page.waitForURL('**/settings/work-center-categories', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return body.data.workCentreCategories.series_number;
  }

  // Creates with `is_draft: true` (shown as a "Draft" chip on View) - same response shape/series
  // number location as save() above, different endpoint (.../save-as-draft).
  async saveToDraft() {
    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/work-centre-categories/save-as-draft')
    );
    await this.saveToDraftButton.click();
    const response = await responsePromise;
    const body = await response.json();
    await this.page.waitForURL('**/settings/work-center-categories', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return body.data.workCentreCategories.series_number;
  }

  async openView(seriesNumber) {
    await this.gotoList();
    await this.page.getByText(seriesNumber, { exact: true }).first().click();
    await this.page.waitForURL('**/view-work-center-categories');
    await this.page.waitForLoadState('networkidle');
  }

  async openEdit(seriesNumber) {
    await this.openView(seriesNumber);
    await this.editButton.click();
    await this.page.waitForURL('**/edit-work-center-categories');
    await this.page.waitForLoadState('networkidle');
  }

  // Edit's own Save (PUT) works for both creation paths and clears the "Draft" chip if the record
  // had one (confirmed live) - no separate Save/Save To Draft split here, just one Save button.
  async saveEdit() {
    await this.saveButton.click();
    await this.page.waitForURL('**/settings/work-center-categories', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }

  async deleteRecord() {
    await this.deleteButton.click();
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = WorkCenterCategoryPage;
