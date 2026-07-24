const SettingsEntityPage = require('../base/SettingsEntityPage');
const { selectDropdown } = require('../../helpers/dropdown');

/**
 * Accounting Settings (Settings > Accounting Settings).
 * Source: erpforce-fe modules/accounting/src/views/settings/accounting-settings/*
 * Routes: list /dashboard/accounting/settings/accounting-settings,
 * add /dashboard/accounting/settings/accounting-settings/add-accounting-setting.
 *
 * Unlike every other Settings entity in this suite, there is no free-text "name" field at all -
 * a row is a per-(company, department, location) configuration profile, and the list already has
 * many pre-existing rows for other companies/departments/locations. Confirmed against the running
 * app: company_id/department_id/location_id are the ONLY required fields - every other field
 * (currency_id and ~33 account-mapping selects: exchange_profit, income_account, payable_account,
 * etc.) saved successfully with nothing else set. Saving a (company, department, location)
 * combination that already has a row rejects with the snackbar "Configuration entity with this
 * combination already exists" and stays on the add form - there is no separate duplicate-name
 * check to worry about, this triple IS the uniqueness key.
 *
 * The View/row-menu surface otherwise matches the standard archetype exactly (header Edit/Delete
 * buttons, row menu with View/Edit/Delete), so this still extends SettingsEntityPage and reuses
 * its editButton/deleteButton/search()/deleteRow() as-is - only `create()` is custom, and (like
 * Currency Exchange) this entity is exercised by a dedicated spec file rather than the shared
 * registerSettingsEntityTests factory, which assumes a name known before creation.
 */
class AccountingSettingPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_accounting_setting',
      listPath: '/dashboard/accounting/settings/accounting-settings',
      addPath: '/dashboard/accounting/settings/accounting-settings/add-accounting-setting',
    });
  }

  /**
   * Fills the add form; caller triggers save() itself.
   * The single `inventory_valuation` field this suite originally assumed has since been split
   * into two real fields, `inventory_valuation_in`/`inventory_valuation_out` (confirmed live via
   * the current form's own select ids) - both now auto-fill a default once Company is selected,
   * same as every other Settings field, so neither needs explicit selection any more.
   * `createNewLocation` - a specific Location value can only ever be used successfully ONCE
   * across this environment's whole lifetime (confirmed live/reported): even deleting the
   * Accounting Setting row that used it doesn't free the Location back up for reuse, it just
   * silently fails Save again. Deliberately does NOT go through selectField()/selectDropdown()'s
   * generic `allowCreateNew` here - that helper only ever reaches its create-new branch when the
   * list is genuinely EMPTY; the Location list already has several real, enabled options (Delhi,
   * Mumbai, ...), so its normal fallback picks one of those first every time, silently reusing an
   * already-used location instead of creating a new one. createNewLocationDirect() below always
   * opens "Create New Location" unconditionally instead.
   */
  async create({ company_id, department_id, location_id, createNewLocation = false, ...rest }) {
    if (company_id) await this.selectField('company_id', company_id);
    if (department_id) await this.selectField('department_id', department_id);
    if (location_id) {
      if (createNewLocation) {
        await this.createNewLocationDirect(location_id);
      } else {
        await this.selectField('location_id', location_id);
      }
    }
    await this.fillForm(rest);
  }

  /**
   * Always creates a brand new Location via the dropdown's own "Create New Location" option,
   * rather than letting selectDropdown() fall back to reusing an existing one. Confirmed live the
   * modal's own dialog fields are: Name (location_data.name), Short Code (location_data.
   * short_name, required), Entity (location_data.company_id, required - a real DynamicSelect
   * combobox, not a plain text input despite its `[name=...]` mirror input having type="text").
   */
  async createNewLocationDirect(name, companyName = 'Trootech') {
    const trigger = this.selectTriggerLocator('location_id');
    await trigger.click();
    await this.page.waitForTimeout(500);
    const listbox = this.page.locator('[role="listbox"]').last();
    await listbox.getByRole('option', { name: /^Create New/i }).last().click();

    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    await dialog.locator('input[name="location_data.name"]').fill(name);
    await dialog.locator('input[name="location_data.short_name"]').fill(name.replace(/[^A-Za-z0-9]/g, '').slice(-10));
    await selectDropdown(
      this.page,
      dialog.locator('[id="mui-component-select-location_data.company_id"]'),
      companyName,
      companyName
    );
    await dialog.getByRole('button', { name: /^Save$/i }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 10000 });
    await this.page.waitForTimeout(500);

    // Same lingering-open-select-menu quirk selectDropdown() itself documents.
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.mouse.click(2, 2);
    await this.page.waitForTimeout(200);

    // Creating the Location record via this modal does NOT auto-select it back on the outer
    // Location field - it's just been added as a real, searchable master-data record, so a
    // normal selectField() now finds a genuine exact match instead of falling back to reusing an
    // existing option.
    await this.selectField('location_id', name);
  }

  /** Opens the row matching `companyText`/`departmentText`/`locationText` and returns its View URL. */
  async openRowByCombo(companyText, departmentText, locationText) {
    await this.gotoList();
    // Confirmed live: this list's own search box doesn't match against the Location column at
    // all (searching a real, just-created Location's name returns "No Data") - check the plain
    // unfiltered list instead. Newest rows sort first, so a just-created record should still land
    // on the default first page.
    await this.page.waitForTimeout(500);
    const row = this.page.locator('table tbody tr')
      .filter({ hasText: companyText })
      .filter({ hasText: departmentText })
      .filter({ hasText: locationText })
      .first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    await row.locator('a').first().click();
    await this.page.waitForURL(/view-accounting-setting/, { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return this.page.url();
  }
}

module.exports = AccountingSettingPage;
