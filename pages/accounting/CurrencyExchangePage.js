const SettingsEntityPage = require('../base/SettingsEntityPage');

/**
 * Currency Exchange (Settings > Currency Exchange).
 * Source: erpforce-fe modules/accounting/src/views/settings/currency-exchange/*
 * Routes: list /dashboard/accounting/settings/currency-exchange,
 * add /dashboard/accounting/settings/currency-exchange/add-currency-exchange.
 *
 * Unlike every other Settings entity in this suite, there is no free-text "name" field - each
 * row is identified only by an auto-generated series number (e.g. "CEX-2026-000007", confirmed
 * against the running app), known only after Save. The View/row-menu surface otherwise matches
 * the standard archetype exactly (header Edit/Delete buttons, row menu with View/Edit/Delete),
 * so this Page Object still extends SettingsEntityPage and reuses its editButton/deleteButton/
 * search()/deleteRow() as-is - only `create()` is custom, and this entity is exercised by a
 * dedicated spec file rather than the shared registerSettingsEntityTests factory (which assumes
 * a name known before creation).
 *
 * Confirmed against the running app: from_currency_id/to_currency_id are searchable selects
 * scoped to this suite's own custom Currency (Settings > Currency) records, NOT the broader
 * currency list Purchase Invoice/Payment Entry's "Currency" fields draw from - searching "US
 * Dollars" or "INR" here returns "No data available" even though both work as a Purchase
 * Invoice/Payment Entry currency. `for_selling`/`for_buying` are plain checkboxes NOT prefixed
 * with the entityKey (name="for_selling"/"for_buying" verbatim).
 */
class CurrencyExchangePage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_currency_exchange',
      listPath: '/dashboard/accounting/settings/currency-exchange',
      addPath: '/dashboard/accounting/settings/currency-exchange/add-currency-exchange',
    });

    this.forSellingCheckbox = page.locator('input[name="for_selling"]');
    this.forBuyingCheckbox = page.locator('input[name="for_buying"]');
  }

  /** Fills the add form; caller triggers save() itself. */
  async create({ from_currency_id, to_currency_id, forSelling, forBuying, ...rest }) {
    if (from_currency_id) await this.selectField('from_currency_id', from_currency_id);
    if (to_currency_id) await this.selectField('to_currency_id', to_currency_id);
    await this.fillForm(rest);
    if (forSelling !== undefined) {
      const checked = await this.forSellingCheckbox.isChecked().catch(() => null);
      if (checked !== null && checked !== forSelling) await this.forSellingCheckbox.click();
    }
    if (forBuying !== undefined) {
      const checked = await this.forBuyingCheckbox.isChecked().catch(() => null);
      if (checked !== null && checked !== forBuying) await this.forBuyingCheckbox.click();
    }
  }

  /** Opens the newest (list is sorted newest-first) row's View page and returns its series number. */
  async openNewestRow() {
    await this.gotoList();
    await this.page.waitForTimeout(500);
    const firstRow = this.page.locator('table tbody tr').first();
    await firstRow.waitFor({ state: 'visible', timeout: 10000 });
    const link = firstRow.locator('a').first();
    const seriesNumber = await link.innerText();
    await link.click();
    await this.page.waitForURL(/view-currency-exchange/, { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return seriesNumber;
  }
}

module.exports = CurrencyExchangePage;
