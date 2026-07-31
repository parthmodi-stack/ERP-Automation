const { expect } = require('@playwright/test');

// Equipment (dashboard/manufacturing/settings/equipments) - third step of the Work Center
// Categories -> Work Center -> Operation and Equipments -> Routing sequence. Unlike Work Center
// Category/Work Center (plain master data, no visible status), Equipment has a REAL status
// workflow: "Save" creates it as Pending; "Save To Draft" creates it as Draft (confirmed live via
// both the create response's own `status` field AND a visible status chip on View - Equipment
// does NOT have Work Center's own "Draft chip never renders" gap). Edit's own form has BOTH
// "Save To Draft" and "Save" buttons (unlike Work Center Category/Work Center's Edit, which only
// has "Save") - Edit's "Save" transitions Draft -> Pending, confirmed live.
//
// Only Equipment Name, Equipment Category, and Work Centre are required (confirmed live via
// empty-Save validation errors: "Equipment name is required" / "Equipment category is required" /
// "Work Centre is required"). Equipment Category is a fixed enum dropdown (Audio/Visual
// Equipment, Safety Equipment, Production Equipment, Office Equipment, Software, Tools, Vehicles,
// Phones, Furniture, Computers - no "+Create New", confirmed live), not a separate manageable
// master-data entity. Work Centre references records from the Work Center module built earlier in
// this sequence (WorkCenterPage) - this suite creates its own dedicated Work Center as setup
// rather than relying on "first available" existing data, keeping this spec self-contained.
//
// Add and Edit share the SAME `equipment.<field>` prefix (confirmed live - no prefix-mismatch bug
// the way Work Center Category's Add/Edit forms have). The Delete confirmation dialog's own title
// is "Delete Item" rather than "Delete Equipment" (confirmed live - a real inconsistency, not a
// mistake introduced here), though its body text does say "...delete Equipment: EQ-XXXX ?".
class EquipmentPage {
  constructor(page) {
    this.page = page;

    this.addButton = page.getByRole('button', { name: 'Add', exact: true });
    this.nameInput = page.locator('input[name="equipment.name"]');
    this.narrationInput = page.locator('textarea[name="equipment.narration"]');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft', exact: true });
    this.discardButton = page.getByRole('button', { name: 'Discard', exact: true });

    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.deleteButton = page.getByRole('button', { name: 'Delete', exact: true });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true });
  }

  async gotoList() {
    await this.page.goto('/dashboard/manufacturing/settings/equipments');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-equipments');
    await this.page.waitForLoadState('networkidle');
  }

  // Same `mui-component-select-equipment.<field>` pattern as every other Manufacturing form.
  async selectDropdown(fieldName, optionText) {
    await this.page.locator(`[id="mui-component-select-equipment.${fieldName}"]`).click();
    const menu = this.page.locator(`[id="menu-equipment.${fieldName}"]`);
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

  async selectEquipmentCategory(category) {
    await this.selectDropdown('equipment_category_id', category);
  }

  async selectWorkCentre(workCentreName) {
    await this.selectDropdown('work_centre_id', workCentreName);
  }

  async fillHeader({ name, narration } = {}) {
    if (name !== undefined) await this.nameInput.fill(name);
    if (narration !== undefined) await this.narrationInput.fill(narration);
  }

  // Creates as Pending - captures the series_number from the create response (flat
  // `data.equipments.series_number`, confirmed live) since the post-save redirect lands on the
  // LIST, not this record's own view page.
  async save() {
    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && /\/equipments\/?$/.test(new URL(res.url()).pathname)
    );
    await this.saveButton.click();
    const response = await responsePromise;
    const body = await response.json();
    await this.page.waitForURL('**/settings/equipments', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return body.data.equipments.series_number;
  }

  // Creates as Draft (status: "Draft", confirmed live via both the response and a visible chip on
  // View) - same response shape/series number location as save() above, different endpoint
  // (.../save-as-draft).
  async saveToDraft() {
    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/equipments/save-as-draft')
    );
    await this.saveToDraftButton.click();
    const response = await responsePromise;
    const body = await response.json();
    await this.page.waitForURL('**/settings/equipments', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return body.data.equipments.series_number;
  }

  async openView(seriesNumber) {
    await this.gotoList();
    await this.page.getByText(seriesNumber, { exact: true }).first().click();
    await this.page.waitForURL('**/view-equipments');
    await this.page.waitForLoadState('networkidle');
  }

  async openEdit(seriesNumber) {
    await this.openView(seriesNumber);
    await this.editButton.click();
    await this.page.waitForURL('**/edit-equipments');
    await this.page.waitForLoadState('networkidle');
  }

  // Draft -> Pending. Edit's own "Save" (distinct from its own "Save To Draft", which keeps it in
  // Draft) works the same way the CREATE page's does - confirmed live via the status chip
  // flipping from "Draft" to "Pending" after this call.
  async saveEdit() {
    await this.saveButton.click();
    await this.page.waitForURL('**/settings/equipments', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }

  async deleteRecord() {
    await this.deleteButton.click();
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = EquipmentPage;
