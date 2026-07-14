const SettingsEntityPage = require('../base/SettingsEntityPage');

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

  /** Fills the add form; caller triggers save() itself. */
  async create({ company_id, department_id, location_id, ...rest }) {
    if (company_id) await this.selectField('company_id', company_id);
    if (department_id) await this.selectField('department_id', department_id);
    if (location_id) await this.selectField('location_id', location_id);
    await this.fillForm(rest);
  }

  /** Opens the row matching `companyText`/`departmentText`/`locationText` and returns its View URL. */
  async openRowByCombo(companyText, departmentText, locationText) {
    await this.gotoList();
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
