const SettingsEntityPage = require('../base/SettingsEntityPage');

/**
 * Tax Code (Settings > Tax Code).
 * Source: erpforce-fe modules/accounting/src/views/settings/tax-code/*
 * Routes: pathname.accounting.ts PATHNAME_SETTINGS.{TAX_CODE,ADD_TAX_CODE}
 * Confirmed against the running app: fields include name, rate, effective_start_date,
 * effective_end_date, tax_category_id, applies_to, reverse_charge_code, description.
 */
class TaxCodePage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_tax_code',
      listPath: '/dashboard/accounting/settings/tax-code',
      addPath: '/dashboard/accounting/settings/tax-code/add-tax-code',
    });
  }

  /** Fills the add form; caller (or the shared settings-entity test contract) triggers save(). */
  async create({ tax_category_id, applies_to, ...rest }) {
    if (tax_category_id) await this.selectField('tax_category_id', tax_category_id);
    if (applies_to) await this.selectField('applies_to', applies_to);
    await this.fillForm(rest);
  }
}

module.exports = TaxCodePage;
