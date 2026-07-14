const SettingsEntityPage = require('../base/SettingsEntityPage');

/**
 * Fiscal Year (Settings > Fiscal Year).
 * Source: erpforce-fe modules/accounting/src/views/settings/fiscal-year/*
 * Routes: /dashboard/accounting/settings/fiscal-year (list),
 * /dashboard/accounting/settings/fiscal-year/add-fiscal-year (add).
 * Confirmed against the running app: fields are year_name, year_start_date, year_end_date and
 * company_ids (a select whose only real option in this single-company environment is
 * "Trootech" - see journalEntry's testData comment for the same fact). The display/identifying
 * field is year_name, not the generic "name".
 */
class FiscalYearPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_fiscal_year',
      listPath: '/dashboard/accounting/settings/fiscal-year',
      addPath: '/dashboard/accounting/settings/fiscal-year/add-fiscal-year',
      displayNameField: 'year_name',
    });
  }

  /** Fills the add form; caller (or the shared settings-entity test contract) triggers save(). */
  async create({ company_ids, ...rest }) {
    if (company_ids) await this.selectField('company_ids', company_ids);
    await this.fillForm(rest);
  }
}

module.exports = FiscalYearPage;
