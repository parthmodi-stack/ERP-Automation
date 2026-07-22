const SettingsEntityPage = require('../base/SettingsEntityPage');

/**
 * Chart of Accounts (Settings > Chart of Accounts).
 * Source: erpforce-fe modules/accounting/src/views/settings/chart-of-accounts/*
 * Routes: pathname.accounting.ts PATHNAME_SETTINGS.{CHART_OF_ACCOUNTS,ADD_CHART_OF_ACCOUNTS}
 *
 * Confirmed against the running app - full add-form field list: parent_type_id,
 * account_type_id, parent_account_id, account_code, account_name, allowed_journal_id,
 * company_ids ("Add Entity", a multi-select), currency_id, description, plus a standalone
 * (no entity prefix) `is_active` checkbox for Status.
 *
 * There is no "Filter" modal/button on this list page (only Search) - confirmed both in
 * chart-of-accounts.tsx's ActionBar props (no `filters` prop passed) and live in the running
 * app. Do not write tests expecting one.
 *
 * Each row does have a hover-revealed three-dot menu (a plain IconButton, no accessible name)
 * offering View/Edit/Delete, in addition to every cell being a link straight to the View page -
 * both confirmed against the running app.
 */
class ChartOfAccountsPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_chart_of_account',
      listPath: '/dashboard/accounting/settings/chart-of-accounts',
      addPath: '/dashboard/accounting/settings/chart-of-accounts/add-chart-of-accounts',
      displayNameField: 'account_name',
    });

    this.statusCheckbox = page.locator('input[name="is_active"]');
  }

  /** account_code is auto-derived server-side once Account Type is chosen; always read-only. */
  accountCodeField() {
    return this.fieldLocator('account_code');
  }

  async selectParentType(name) {
    await this.selectField('parent_type_id', name);
  }

  async selectAccountType(name) {
    await this.selectField('account_type_id', name);
  }

  async selectParentAccount(name) {
    await this.selectField('parent_account_id', name);
  }

  async selectAllowedJournal(name) {
    await this.selectField('allowed_journal_id', name);
  }

  async selectCurrency(name) {
    await this.selectField('currency_id', name);
  }

  /**
   * The "Status" checkbox is inverted from what its own label implies: it sits next to a
   * static "Disabled" label while unchecked, but the add/edit handlers submit
   * `is_active: !rest.is_active` - so leaving it unchecked (the default) produces an ENABLED
   * record, and checking it produces a DISABLED one. Confirmed empirically against the running
   * app (create with checkbox checked -> list shows "Disabled"). This method hides that
   * confusion behind a plain enabled/disabled API; see ACCOUNTING_FINDINGS.md for the UX gap.
   */
  async setStatusEnabled(enabled) {
    const shouldBeChecked = !enabled;
    if ((await this.statusCheckbox.isChecked()) !== shouldBeChecked) {
      await this.statusCheckbox.click();
    }
  }

  /** Fills the add form; caller (or the shared settings-entity test contract) triggers save(). */
  async create({ parentType, accountType, parentAccount, allowedJournal, currency, enabled, ...rest }) {
    if (parentType) await this.selectParentType(parentType);
    if (accountType) await this.selectAccountType(accountType);
    if (parentAccount) await this.selectParentAccount(parentAccount);
    if (allowedJournal) await this.selectAllowedJournal(allowedJournal);
    if (currency) await this.selectCurrency(currency);
    await this.fillForm(rest);
    if (enabled !== undefined) await this.setStatusEnabled(enabled);
  }

  /** Status pill text ("Enabled"/"Disabled") for a given row, identified by any visible cell text (ID, name, code...). */
  statusPill(identifier) {
    return this.row(identifier).locator('[class*="StatusChip"]').first();
  }
}

module.exports = ChartOfAccountsPage;
