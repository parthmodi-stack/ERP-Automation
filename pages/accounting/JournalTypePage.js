const SettingsEntityPage = require('../base/SettingsEntityPage');

/**
 * Journal Type (Settings > Journal Types).
 * Source: erpforce-fe modules/accounting/src/views/settings/journal-types/*
 * Routes: /dashboard/accounting/settings/journal-types (list),
 * /dashboard/accounting/settings/journal-types/add-journal-type (add).
 * Confirmed against the running app: the only fields are `name` (add_journal_type.name) and
 * `is_payment`, a plain checkbox NOT prefixed with the entityKey (name="is_payment" verbatim,
 * not "add_journal_type.is_payment") - so it needs its own locator rather than fieldLocator().
 * This environment currently has zero custom Journal Type rows (list renders "No Data"), even
 * though journal entries elsewhere reference types like "Journal Voucher" - those are built-in
 * system defaults, not rows managed by this screen.
 */
class JournalTypePage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_journal_type',
      listPath: '/dashboard/accounting/settings/journal-types',
      addPath: '/dashboard/accounting/settings/journal-types/add-journal-type',
    });

    this.isPaymentCheckbox = page.locator('input[name="is_payment"]');
  }

  /** Fills the add form; caller (or the shared settings-entity test contract) triggers save(). */
  async create({ isPayment, ...rest }) {
    await this.fillForm(rest);
    if (isPayment !== undefined) {
      const checked = await this.isPaymentCheckbox.isChecked().catch(() => null);
      if (checked !== null && checked !== isPayment) await this.isPaymentCheckbox.click();
    }
  }
}

module.exports = JournalTypePage;
