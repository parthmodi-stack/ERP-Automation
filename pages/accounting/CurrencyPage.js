const SettingsEntityPage = require('../base/SettingsEntityPage');

/**
 * Currency (Settings > Currency).
 * Source: erpforce-fe modules/accounting/src/views/settings/currency/*
 * Routes: pathname.accounting.ts PATHNAME_SETTINGS.{CURRENCY,ADD_CURRENCY}
 * Confirmed against the running app: real fields are currency_name, fraction, fraction_unit,
 * smallest_fraction_value, symbol, number_format, exchange_rate. There is no currency_code field.
 */
class CurrencyPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_currency',
      listPath: '/dashboard/accounting/settings/currency',
      addPath: '/dashboard/accounting/settings/currency/add-currency',
      displayNameField: 'currency_name',
    });
  }

  /** Fills the add form; caller (or the shared settings-entity test contract) triggers save(). */
  async create(data) {
    await this.fillForm(data);
  }
}

module.exports = CurrencyPage;
