const { expect } = require('@playwright/test');

// Routing (dashboard/manufacturing/settings/routing) - final step of the Work Center Categories
// -> Work Center -> Operation and Equipments -> Routing sequence. Ties together Bill of Material,
// Item, Location, Operation, and Work Center - the culmination of every module built earlier in
// this sequence.
//
// Field relationship is the REVERSE of Work Order/Unbuild Order's own "select Item, then BOM gets
// scoped to it": here you select Bill of Material FIRST, and Item becomes disabled/auto-filled
// from that BOM's own associated item (confirmed live) - Item can never be picked independently.
//
// Only Name, Bill of Material, Item (auto-filled), Location, and AT LEAST ONE Routing Details row
// are required - confirmed live, but the Routing Details requirement is NOT surfaced as a visible
// error message the way Operation's own "Atleast one costing details is required" is: clicking
// Save with zero rows fires NO network request at all and shows no error text, it just silently
// does nothing. addRoutingDetailRow() below is not optional for this reason, unlike Operation's
// analogous Costing Details row which merely happens to also be required.
//
// Routing Details row fields: Operation* (references the Operation module built earlier),
// Operation Sequence* (plain number, field name "sequence"), Raw Materials* (scoped to the
// header's own selected BOM - confirmed live, "No data available" until a BOM is chosen), Work
// Center* (references the Work Center module), Actual Duration Computation (a REAL two-option
// dropdown here - "Compute Based on Tracked Time" / "Set Duration Manually" - unlike Operation's
// own broken single-SVG-icon version of the same concept), Duration (In Minutes), Narration (both
// optional). Same "row isn't part of the form until its own row-level save (disk) icon is
// clicked" pattern as every other grid in this module.
//
// Same two-creation-path shape as the rest of this sequence: "Save" creates as status "Pending";
// "Save To Draft" creates as status "Draft" - but, matching Work Center/Operation's own gap (not
// Equipment's), NO visible chip renders anywhere on View to distinguish them. Edit's own form has
// only "Discard"/"Save" (no separate "Save To Draft" - matching Work Center Category/Work
// Center's Edit shape, not Equipment/Operation's). Unlike Equipment/Operation, the Delete
// confirmation dialog's own title IS correctly "Delete Route" here (confirmed live - not every
// module in this sequence has the "Delete Item" mislabeling bug).
//
// The header's own dropdowns (and the Routing Details row's own dropdowns) can leave a stale
// backdrop mounted after a selection that blocks the very next click - same bug class already
// fixed in WorkOrderPage.js's own getBomOptionsForSelectedItem() - selectDropdown() below applies
// the same force-click-the-backdrop workaround.
//
// CONFIRMED LIVE BUG: the Edit page never hydrates the Location dropdown from the saved record -
// it renders blank ("Search Location") even though every OTHER field (Name/BOM/Item/Entity) does
// correctly show its saved value, and the Summary sidebar even shows the right Location too.
// Saving Edit without re-selecting it fails client-side with "Location is required" (no
// navigation, no request). There is no workaround other than re-selecting Location on every Edit
// - callers must pass it to saveEdit() below rather than treating Edit as a no-op resubmission.
class RoutingPage {
  constructor(page) {
    this.page = page;

    this.addButton = page.getByRole('button', { name: 'Add', exact: true });
    this.nameInput = page.locator('input[name="routing.route_name"]');
    this.narrationInput = page.locator('textarea[name="routing.narration"]');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft', exact: true });
    this.discardButton = page.getByRole('button', { name: 'Discard', exact: true });

    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.deleteButton = page.getByRole('button', { name: 'Delete', exact: true });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true });
  }

  async gotoList() {
    await this.page.goto('/dashboard/manufacturing/settings/routing');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL('**/add-routing');
    await this.page.waitForLoadState('networkidle');
  }

  // Generic MUI select helper, used for BOTH the header's own `routing.<field>`-prefixed
  // dropdowns and the Routing Details row's own unprefixed dropdowns (operation/raw_materials/
  // work_centre/duration_computation) - pass the full id (with or without the `routing.` prefix)
  // as `fieldId`. Force-clicks a stale backdrop after selection (see class header comment).
  async selectDropdown(fieldId, optionText) {
    const trigger = this.page.locator(`[id="mui-component-select-${fieldId}"]`);
    await trigger.click();
    const menu = this.page.locator(`[id="menu-${fieldId}"]`);
    await menu.waitFor({ state: 'visible', timeout: 5000 });
    await expect(async () => {
      expect(await menu.locator('li').count()).toBeGreaterThan(0);
    }).toPass({ timeout: 8000, intervals: [300] });
    if (optionText) {
      // Confirmed live: the unconditional Escape + force-click-the-backdrop below can, on its own,
      // cause the WRONG option to end up selected (e.g. selecting "Mumbai" here has actually saved
      // as an unrelated "Automation_Location_..." record instead) - re-verify the field's own
      // displayed text actually landed on optionText afterward and retry the whole selection from
      // a known-clean (menu open) state if not, rather than trusting a clean click() alone.
      await expect(async () => {
        if (!(await menu.isVisible())) {
          await trigger.click();
          await menu.waitFor({ state: 'visible', timeout: 5000 });
        }
        // Settle before typing - confirmed live that typing immediately after the menu reports
        // itself visible (no pause) can race with this field's own async default/last-used-value
        // hydration, ending in an unrelated option (e.g. Location silently landing on some
        // "Automation_Location_..." record instead of "Mumbai") even though the typed search and
        // click both otherwise behave correctly.
        await this.page.waitForTimeout(500);
        await menu.locator('input').pressSequentially(optionText, { delay: 60 });
        await this.page.waitForTimeout(1000);
        const exact = menu.locator('li').filter({ hasText: new RegExp(`^${optionText}$`) });
        await expect(exact.first()).toBeVisible({ timeout: 8000 });
        await exact.first().click();
        await this.page.waitForTimeout(500);
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(300);
        const staleBackdrop = this.page.locator('.MuiBackdrop-root.MuiModal-backdrop').first();
        if (await staleBackdrop.count()) {
          await staleBackdrop.click({ force: true }).catch(() => {});
        }
        await this.page.waitForTimeout(500);
        if ((await trigger.textContent()).trim() !== optionText) {
          await trigger.click();
          await menu.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        }
        expect((await trigger.textContent()).trim()).toBe(optionText);
      }).toPass({ timeout: 20000, intervals: [500] });
    } else {
      // Raw Materials can have NO placeholder option (confirmed live: a single real item with no
      // "Select..." entry above it) - use whichever is first rather than assuming index 1 always
      // skips a placeholder.
      const options = await menu.locator('li').allTextContents();
      const index = /^Select /.test(options[0] || '') ? 1 : 0;
      await menu.locator('li').nth(index).click();
      await this.page.keyboard.press('Escape').catch(() => {});
      const staleBackdrop = this.page.locator('.MuiBackdrop-root.MuiModal-backdrop').first();
      if (await staleBackdrop.count()) {
        await staleBackdrop.click({ force: true }).catch(() => {});
      }
      await this.page.waitForTimeout(300);
    }
  }

  async selectBOM(bomName) {
    await this.selectDropdown('routing.bom_id', bomName);
  }

  async selectLocation(locationName) {
    await this.selectDropdown('routing.location_id', locationName);
  }

  async fillHeader({ name, narration } = {}) {
    if (name !== undefined) await this.nameInput.fill(name);
    if (narration !== undefined) await this.narrationInput.fill(narration);
  }

  // Adds one Routing Details row - Operation, Operation Sequence, Raw Materials, and Work Center
  // are all required within the row; Actual Duration Computation/Duration/Narration are left at
  // their defaults. Call AFTER selectBOM(), since Raw Materials' own option list is scoped to
  // whichever BOM is currently selected (confirmed live).
  async addRoutingDetailRow({ operationName, sequence, rawMaterialName, workCentreName } = {}) {
    await this.page.getByText('Routing Details', { exact: false }).first().scrollIntoViewIfNeeded();
    await this.page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await this.page.waitForTimeout(500);

    await this.selectDropdown('operation', operationName);
    await this.page.locator('input[name="sequence"]').fill(String(sequence ?? 1));
    await this.page.waitForTimeout(300);
    await this.selectDropdown('raw_materials', rawMaterialName);
    await this.selectDropdown('work_centre', workCentreName);

    const row = this.page.locator('table tbody tr')
      .filter({ has: this.page.locator('[id="mui-component-select-operation"]') });
    await row.locator('button').nth(1).click();
    await this.page.waitForTimeout(500);
  }

  // Creates directly as status "Pending" (no visible chip - see class header comment) - captures
  // the series_number from the create response (flat `data.routing.series_number`, confirmed
  // live) since the post-save redirect lands on the LIST, not this record's own view page.
  async save() {
    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && /\/routing\/?$/.test(new URL(res.url()).pathname)
    );
    await this.saveButton.click();
    const response = await responsePromise;
    const body = await response.json();
    await this.page.waitForURL('**/settings/routing', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return body.data.routing.series_number;
  }

  // Creates as status "Draft" (confirmed live via the response - but same as Work Center/
  // Operation, NO visible chip anywhere proves it) - same response shape/series number location
  // as save() above, different endpoint (.../save-as-draft).
  async saveToDraft() {
    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/routing/save-as-draft')
    );
    await this.saveToDraftButton.click();
    const response = await responsePromise;
    const body = await response.json();
    await this.page.waitForURL('**/settings/routing', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return body.data.routing.series_number;
  }

  async openView(seriesNumber) {
    await this.gotoList();
    await this.page.getByText(seriesNumber, { exact: true }).first().click();
    await this.page.waitForURL('**/view-routing');
    await this.page.waitForLoadState('networkidle');
  }

  async openEdit(seriesNumber) {
    await this.openView(seriesNumber);
    await this.editButton.click();
    await this.page.waitForURL('**/edit-routing');
    await this.page.waitForLoadState('networkidle');
  }

  // Edit's own (only) Save works for both creation paths (confirmed live - no visible chip to
  // change either way, matching Work Center/Operation's own gap). MUST re-select Location first -
  // see class header comment on why the Edit page never hydrates that field from the saved
  // record, unlike every other field.
  async saveEdit({ location } = {}) {
    if (location !== undefined) await this.selectLocation(location);
    await this.saveButton.click();
    await this.page.waitForURL('**/settings/routing', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }

  async deleteRecord() {
    await this.deleteButton.click();
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = RoutingPage;
