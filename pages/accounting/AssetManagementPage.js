const SettingsEntityPage = require('../base/SettingsEntityPage');
const { selectDropdown } = require('../../helpers/dropdown');
const ChartOfAccountsPage = require('./ChartOfAccountsPage');

/**
 * Asset Management (Accounting > Assets > Assets Management).
 * Source: erpforce-fe modules/accounting/src/views/assets/*
 * Routes confirmed against the running app:
 *   list  /dashboard/accounting/assets/assets-management
 *   add   /dashboard/accounting/assets/assets-management/add-asset
 *
 * Confirmed against the running app: extends SettingsEntityPage, NOT AccountingDocumentPage -
 * the View page has no Submit button, no Actions menu, and no status chip anywhere (confirmed
 * via the full accessibility tree, not just the visible viewport) - only Edit/Delete. Unlike
 * every other document module in this suite, Asset Management has no approval workflow; create
 * is the complete flow.
 *
 * Add form field-array prefix is `add_asset`. Header fields: asset_type_id, company_id (Entity,
 * pre-filled Trootech), location_id, department_id, reference_number (optional),
 * acquisition_date, put_to_use (optional), asset_value, not_depreciable_value, book_value,
 * narration (optional), depreciation ("Deprecation Method"), computation, written_off, plus
 * three account-select fields: fixed_asset_account_id, depreciation_account_id,
 * expense_account_id.
 *
 * These three account fields have no inline "Create New Account" footer option (confirmed live,
 * same as every other module's account_type/account_*_id field in this suite), so a missing
 * option is created via ChartOfAccountsPage on a throwaway browser tab (the `createIfMissing`
 * fallback documented in helpers/dropdown.js) rather than navigating this page away from its own
 * in-progress form.
 */
class AssetManagementPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_asset',
      listPath: '/dashboard/accounting/assets/assets-management',
      addPath: '/dashboard/accounting/assets/assets-management/add-asset',
    });

    this.addButton = page.getByRole('button', { name: /^Add$/i }).or(page.getByText(/^Add$/i)).first();
    this.saveButton = page.getByRole('button', { name: /^Save$/i }).last();
  }

  headerSelectTrigger(fieldFragment) {
    return this.page.locator(`[id*="mui-component-select-"][id*="${fieldFragment}"]`).first();
  }

  async selectHeaderDropdown(fieldFragment, optionText, opts = {}) {
    await selectDropdown(this.page, this.headerSelectTrigger(fieldFragment), optionText, optionText, opts);
  }

  async selectAssetType(name) {
    await this.selectHeaderDropdown('asset_type_id', name);
  }

  /**
   * Confirmed against the running app: this environment's Location master data list is
   * genuinely empty (no options at all, not even a fallback) - same "Location search box never
   * firing its filter API" app bug CLAUDE.md documents for other modules' own Location fields.
   * Marked optional so a missing match here never blocks the rest of the form.
   */
  async selectLocation(name) {
    await this.selectHeaderDropdown('location_id', name, { optional: true });
  }

  async selectDepartment(name) {
    await this.selectHeaderDropdown('department_id', name, { optional: true });
  }

  async selectDepreciationMethod(name) {
    await this.selectHeaderDropdown('add_asset.depreciation', name);
  }

  /** Required alongside Depreciation Method - confirmed live "Please fill all the required fields" blocks Save without it. */
  async selectComputation(name) {
    await this.selectHeaderDropdown('computation', name);
  }

  /**
   * Opens a fresh, throwaway tab, creates a Chart of Accounts record with the given
   * parentType/accountType, and closes the tab - the `createIfMissing` fallback
   * helpers/dropdown.js documents, used instead of navigating this page (and losing its
   * in-progress form) whenever an account field's dropdown has no matching/fallback option.
   *
   * KNOWN BACKEND ISSUE (paused - see 23-asset-management.spec.js): account_code is fetched from
   * a `getV1ChartOfAccountNextCode({ account_type_id, company_id })` API call, fired by the
   * frontend's own `account_type_id` change-watcher, whenever Account Type changes. For
   * (parentType "Assets", accountType "Fixed Assets") this environment already has one account
   * using the code it returns (e.g. "101001"), so every create attempt fails with "Account code
   * already exists" - confirmed live this is a genuine backend bug in that endpoint's own "next
   * code" calculation, not a frontend/timing issue: re-triggering the watcher (re-selecting
   * Parent Type then Account Type again, forcing a fresh API call) still returned the identical
   * stale code. Do not retry-harder here without a fix to getV1ChartOfAccountNextCode itself, or
   * a different (parentType, accountType) pair confirmed to have no existing root account.
   */
  async createAccountOnNewTab({ parentType, accountType, name }) {
    const newTab = await this.page.context().newPage();
    const coa = new ChartOfAccountsPage(newTab);
    await coa.openAdd();
    await coa.create({ parentType, accountType, name });
    await coa.save();
    // Verifies the create actually succeeded instead of silently closing the tab regardless -
    // a failed save here would otherwise surface later as a confusing "no options at all" error
    // on the original tab's dropdown.
    await newTab.waitForURL(coa.listPath, { timeout: 15000 });
    await newTab.waitForLoadState('networkidle').catch(() => {});
    await newTab.close();
  }

  /**
   * @param {string} fieldFragment - the mui-component-select fragment (e.g. "fixed_asset_account")
   * @param {string} name - the account name to search for/create
   * @param {{parentType: string, accountType: string}} createSpec - used only if `name` isn't found
   */
  async selectAccount(fieldFragment, name, createSpec) {
    await this.selectHeaderDropdown(fieldFragment, name, {
      createIfMissing: () => this.createAccountOnNewTab({ ...createSpec, name }),
    });
  }

  /** Fixed Asset Account - created under parentType "Assets" / accountType "Fixed Assets" if missing. */
  async selectFixedAssetAccount(name) {
    await this.selectAccount('fixed_asset_account', name, { parentType: 'Assets', accountType: 'Fixed Assets' });
  }

  /** Depreciation Account - created under parentType "Assets" / accountType "Fixed Assets" if missing (Assets or Expense both valid per business rule; Assets chosen as the default). */
  async selectDepreciationAccount(name) {
    await this.selectAccount('depreciation_account', name, { parentType: 'Assets', accountType: 'Fixed Assets' });
  }

  /** Expense Account - created under parentType "Expense" / accountType "Expenses" if missing. */
  async selectExpenseAccount(name) {
    await this.selectAccount('expense_account', name, { parentType: 'Expense', accountType: 'Expenses' });
  }

  async fillAssetName(value) {
    await this.fieldLocator('asset_name').fill(String(value));
  }

  async fillSeriesNumber(value) {
    await this.fieldLocator('series_number').fill(String(value));
  }

  async fillAcquisitionDate(value) {
    await this.fieldLocator('acquisition_date').fill(String(value));
  }

  async fillAssetValue(value) {
    await this.fieldLocator('asset_value').fill(String(value));
  }

  async fillNotDepreciableValue(value) {
    await this.fieldLocator('not_depreciable_value').fill(String(value));
  }

  async fillBookValue(value) {
    await this.fieldLocator('book_value').fill(String(value));
  }

  /**
   * @param {{assetType?: string, assetName?: string, seriesNumber?: string, location?: string,
   *   department?: string, acquisitionDate?: string, assetValue?: string|number,
   *   notDepreciableValue?: string|number, bookValue?: string|number,
   *   depreciationMethod?: string, computation?: string, fixedAssetAccount?: string,
   *   depreciationAccount?: string, expenseAccount?: string}} header
   */
  async fillHeader({
    assetType, assetName, seriesNumber, location, department, acquisitionDate,
    assetValue, notDepreciableValue, bookValue, depreciationMethod, computation,
    fixedAssetAccount, depreciationAccount, expenseAccount,
  } = {}) {
    if (assetType) await this.selectAssetType(assetType);
    if (assetName !== undefined) await this.fillAssetName(assetName);
    if (seriesNumber !== undefined) await this.fillSeriesNumber(seriesNumber);
    if (location) await this.selectLocation(location);
    if (department) await this.selectDepartment(department);
    if (acquisitionDate !== undefined) await this.fillAcquisitionDate(acquisitionDate);
    if (assetValue !== undefined) await this.fillAssetValue(assetValue);
    if (notDepreciableValue !== undefined) await this.fillNotDepreciableValue(notDepreciableValue);
    if (bookValue !== undefined) await this.fillBookValue(bookValue);
    if (depreciationMethod) await this.selectDepreciationMethod(depreciationMethod);
    if (computation) await this.selectComputation(computation);
    if (fixedAssetAccount) await this.selectFixedAssetAccount(fixedAssetAccount);
    if (depreciationAccount) await this.selectDepreciationAccount(depreciationAccount);
    if (expenseAccount) await this.selectExpenseAccount(expenseAccount);
  }

  async save() {
    await this.saveButton.click();
  }

  /** @param {object} header - see fillHeader() */
  async createAsset(header) {
    await this.openAdd();
    await this.fillHeader(header || {});
  }

  /** Opens the newest (list is sorted newest-first) row's View page. */
  async openNewestRow() {
    await this.gotoList();
    await this.page.waitForTimeout(500);
    const firstRow = this.page.locator('table tbody tr').first();
    await firstRow.waitFor({ state: 'visible', timeout: 10000 });
    await firstRow.locator('a').first().click();
    await this.page.waitForURL(/view-asset/, { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(800);
  }
}

module.exports = AssetManagementPage;
