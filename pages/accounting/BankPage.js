const SettingsEntityPage = require('../base/SettingsEntityPage');

/**
 * Bank (Settings > Bank).
 * Source: erpforce-fe modules/accounting/src/views/settings/bank/*
 * Routes: pathname.accounting.ts PATHNAME_SETTINGS.{BANK,ADD_BANK}
 * Confirmed against the running app: fields are name, swift_number.
 */
class BankPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_bank',
      listPath: '/dashboard/accounting/settings/bank',
      addPath: '/dashboard/accounting/settings/bank/add-bank',
    });
  }

  /** Fills the add form; caller (or the shared settings-entity test contract) triggers save(). */
  async create(data) {
    await this.fillForm(data);
  }
}

module.exports = BankPage;
