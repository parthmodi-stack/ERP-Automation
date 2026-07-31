const { expect } = require('@playwright/test');

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
class WorkCenterCategoryPage {
  constructor(page) {
    this.page = page;

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

  // Same `mui-component-select-<prefix>.<field>` pattern as every other Manufacturing form this
  // session - suffix-matched (see constructor's own comment) since Add/Edit use different
  // prefixes (`add_work_center_category` / `edit_work_center_category`).
  async selectDropdown(fieldName, optionText) {
    const trigger = this.page.locator(`[id^="mui-component-select-"][id$=".${fieldName}"]`);
    await trigger.click();
    const controlsId = await trigger.getAttribute('aria-controls');
    const menu = this.page.locator(`[id="${controlsId}"]`);
    await menu.waitFor({ state: 'visible', timeout: 5000 });
    await expect(async () => {
      expect(await menu.locator('li').count()).toBeGreaterThan(1);
    }).toPass({ timeout: 8000, intervals: [300] });
    if (optionText) {
      await menu.locator('input').pressSequentially(optionText, { delay: 60 });
      const exact = menu.locator('li').filter({ hasText: new RegExp(`^${optionText}$`) });
      await expect(exact.first()).toBeVisible({ timeout: 8000 });
      await exact.first().click();
    } else {
      await menu.locator('li').nth(1).click();
    }
    await menu.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
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
