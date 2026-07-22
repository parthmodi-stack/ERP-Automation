const SettingsEntityPage = require('../base/SettingsEntityPage');

/**
 * Tax Template (Settings > Tax Template).
 * Source: erpforce-fe modules/accounting/src/views/settings/tax-template/*
 * Routes: list /dashboard/accounting/settings/tax-template,
 * add /dashboard/accounting/settings/add-tax-template (NOT nested under /tax-template/, same
 * flat-under-/settings/ routing quirk as Tax Category - confirmed against the running app).
 * Confirmed against the running app: fields are `name` and `tax_codes`, a searchable select of
 * existing Tax Code records. This environment has zero surviving Tax Code rows by default (any
 * created by 03-tax-code.spec.js's own CRUD lifecycle get deleted at the end of that file), so
 * `tax_codes` renders "No data available" until at least one Tax Code exists - see
 * 12-tax-template.spec.js's beforeAll, which seeds a dedicated, never-deleted one.
 */
class TaxTemplatePage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_tax_template',
      listPath: '/dashboard/accounting/settings/tax-template',
      addPath: '/dashboard/accounting/settings/add-tax-template',
    });
  }

  /** Fills the add form; caller (or the shared settings-entity test contract) triggers save(). */
  async create({ tax_codes, ...rest }) {
    if (tax_codes) await this.selectField('tax_codes', tax_codes);
    await this.fillForm(rest);
  }
}

module.exports = TaxTemplatePage;
