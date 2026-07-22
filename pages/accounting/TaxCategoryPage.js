const SettingsEntityPage = require('../base/SettingsEntityPage');

/**
 * Tax Category (Settings > Tax Category).
 * Source: erpforce-fe modules/accounting/src/views/settings/tax-category/*
 * Routes: list /dashboard/accounting/settings/tax-category,
 * add /dashboard/accounting/settings/add-tax-category (NOT nested under /tax-category/, unlike
 * most other Settings screens - confirmed against the running app).
 * Confirmed against the running app: fields are name, sales_account_id (COA select),
 * purchase_account_id (COA select), description (optional textarea).
 */
class TaxCategoryPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_tax_category',
      listPath: '/dashboard/accounting/settings/tax-category',
      addPath: '/dashboard/accounting/settings/add-tax-category',
    });
  }

  /** Fills the add form; caller (or the shared settings-entity test contract) triggers save(). */
  async create({ sales_account_id, purchase_account_id, ...rest }) {
    if (sales_account_id) await this.selectField('sales_account_id', sales_account_id);
    if (purchase_account_id) await this.selectField('purchase_account_id', purchase_account_id);
    await this.fillForm(rest);
  }
}

module.exports = TaxCategoryPage;
