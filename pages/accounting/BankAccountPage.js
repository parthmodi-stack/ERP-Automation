const SettingsEntityPage = require('../base/SettingsEntityPage');

/**
 * Bank Account (Settings > Bank Account).
 * Source: erpforce-fe modules/accounting/src/views/settings/bank-account/*
 * Routes: pathname.accounting.ts PATHNAME_SETTINGS.{BANK_ACCOUNT,ADD_BANK_ACCOUNT}
 *
 * Confirmed against the running app: the field-array prefix is `add_bank_Account` (capital A),
 * NOT `add_bank_account` - real fields are name, bank_id, type_id, is_enabled (no prefix on this
 * one), party_type, party, iban_code, branch_code, account_number. `bank_id` is a
 * DynamicSearchSelect - handled via selectBank() since dropdowns can't be filled with .fill().
 */
class BankAccountPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_bank_Account',
      listPath: '/dashboard/accounting/settings/bank-account',
      addPath: '/dashboard/accounting/settings/add-bank-account',
    });
  }

  async selectBank(name) {
    await this.selectField('bank_id', name);
  }

  async selectAccountType(name) {
    await this.selectField('type_id', name);
  }

  /** Fills the add form; caller (or the shared settings-entity test contract) triggers save(). */
  async create({ bank, type_id, ...rest }) {
    if (bank) await this.selectBank(bank);
    if (type_id) await this.selectAccountType(type_id);
    await this.fillForm(rest);
  }
}

module.exports = BankAccountPage;
