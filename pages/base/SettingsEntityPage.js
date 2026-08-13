const { expect } = require('@playwright/test');
const { selectDropdown } = require('../../helpers/dropdown');

// Depth-first search for a record shaped like `{ id, ...distinguishingKeys }` inside a save
// response whose nesting varies unpredictably between modules (and sometimes between requests to
// the same endpoint). Originally lived on AccountingDocumentPage only; moved up here so any
// Settings-entity page object (e.g. CommissionPlanPage, which has no approval workflow and so
// doesn't extend AccountingDocumentPage) can also capture id/series_number straight from its own
// save response instead of re-deriving them from a page render.
function findRecordWithId(node, distinguishingKeys, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (!Array.isArray(node) && 'id' in node && distinguishingKeys.some((k) => k in node)) {
    return node;
  }
  for (const value of Array.isArray(node) ? node : Object.values(node)) {
    const found = findRecordWithId(value, distinguishingKeys, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * Base Page Object for the "Settings entity" archetype used across the Accounting module
 * (Chart of Accounts, Currency, Tax Code, Bank, Bank Account, Tax Category, Tax Template,
 * Fiscal Year, Payment Term, Journal Types, Voucher Settings, Accounting Settings).
 *
 * These screens are entirely backend-schema-driven (FormParser fed by
 * getFormDataByResource(<resource>) - see erpforce-fe modules/accounting/src/views/settings/
 * chart-of-accounts/add-chart-of-accounts/add-chart-of-accounts.tsx). The field list is not
 * hardcoded in the frontend, so this base class fills fields generically by name rather than
 * exposing one locator property per field like the (static-form) Inventory page objects do.
 *
 * Every add/edit form's Save button carries `form="<entityKey>"` and `type="submit"`
 * (e.g. `<Button form='add_chart_of_account' type='submit'>`), which is the one universally
 * reliable selector across all Settings screens - use it instead of guessing button text.
 */
class SettingsEntityPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {{ entityKey: string, listPath: string, addPath: string, displayNameField?: string }} config
   *   entityKey - the FormParser fieldArrayName, e.g. 'add_chart_of_account' (also the form= id)
   *   listPath  - absolute path to the list screen, e.g. '/dashboard/accounting/settings/chart-of-accounts'
   *   addPath   - absolute path to the add screen, e.g. '/dashboard/accounting/settings/chart-of-accounts/add-chart-of-accounts'
   *   displayNameField - the real backend field that holds the row's display name
   *     (e.g. 'account_name', 'currency_name'). Defaults to 'name'. Lets test data / shared test
   *     contracts always use the generic key `name` without needing to know each entity's schema.
   */
  constructor(page, { entityKey, listPath, addPath, displayNameField = 'name' }) {
    this.page = page;
    this.entityKey = entityKey;
    // Confirmed against the running app: the Edit form uses a separate FormParser
    // fieldArrayName/form-id ('edit_<entity>') from the Add form ('add_<entity>') - e.g.
    // edit-chart-of-accounts.tsx uses fieldArrayName='edit_chart_of_account' and
    // form='edit_chart_of_account', distinct from add-chart-of-accounts.tsx's 'add_chart_of_account'.
    this.editEntityKey = entityKey.replace(/^add_/, 'edit_');
    this.listPath = listPath;
    this.addPath = addPath;
    this.displayNameField = displayNameField;

    // ActionBar. The search field is hidden behind a plain icon button (MUI auto-generates
    // data-testid="SearchIcon" on its own <SearchIcon> component - confirmed via live DOM
    // inspection) until clicked; it is not present in the DOM at all beforehand.
    this.addButton = page.getByRole('button', { name: 'Add' });
    this.searchTrigger = page.locator('.action-bar--RightContent [data-testid="SearchIcon"]');
    this.searchInput = page.getByPlaceholder('Search', { exact: true });
    this.exportButton = page.getByRole('button', { name: /export/i });
    this.importButton = page.getByRole('button', { name: /import/i });

    // Form actions - present as a CSS selector list so the same locator works whether the
    // current page is the Add form (form="add_<entity>") or the Edit form (form="edit_<entity>").
    this.saveButton = page.locator(
      `button[form="${entityKey}"][type="submit"], button[form="${this.editEntityKey}"][type="submit"]`
    );
    this.discardButton = page.locator(`.${this.entityCssPrefix()}--DiscardButton`)
      .or(page.getByRole('button', { name: /discard/i }));

    // Row actions: confirmed against the running app that Accounting Settings view pages
    // (e.g. view-chart-of-accounts.tsx) render direct "Edit"/"Delete" buttons in the page
    // header rather than a combined "Actions" dropdown menu (unlike Inventory's LocationPage).
    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.deleteButton = page.getByRole('button', { name: 'Delete', exact: true });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete' });

    // Feedback surfaces
    this.toastMessage = page.locator('#notistack-snackbar');
  }

  /** e.g. 'add_chart_of_account' -> 'addChartOfAccount' (matches the BEM class prefix used in scss/tsx) */
  entityCssPrefix() {
    return this.entityKey.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }

  async gotoList() {
    await this.page.goto(this.listPath);
    await this.page.waitForLoadState('networkidle');
  }

  async openAdd() {
    await this.gotoList();
    await this.addButton.click();
    await this.page.waitForURL(`**${this.addPath}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Locator for a FormParser field by its bare name, e.g. fieldLocator('account_code').
   * Matches either the Add or Edit form's field-array prefix (only one is ever on screen at
   * once), so page objects don't need to know which page they're currently on.
   */
  fieldLocator(fieldName) {
    return this.page.locator(
      `[name="${this.entityKey}.${fieldName}"], [name="${this.editEntityKey}.${fieldName}"]`
    );
  }

  /** MUI helper-text / error message rendered under a given field, if any */
  fieldError(fieldName) {
    return this.fieldLocator(fieldName)
      .locator('xpath=ancestor::*[contains(@class,"MuiFormControl-root")][1]')
      .locator('.MuiFormHelperText-root');
  }

  async fillField(fieldName, value) {
    const locator = this.fieldLocator(fieldName);
    if (typeof value === 'boolean') {
      const checked = await locator.isChecked().catch(() => null);
      if (checked !== null && checked !== value) await locator.click();
      return;
    }
    await locator.fill(String(value));
  }

  /**
   * Fill multiple fields from a plain object; keys are bare field names (no entityKey prefix).
   * The generic key `name` is remapped to this entity's real displayNameField.
   */
  async fillForm(data = {}) {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      const fieldName = key === 'name' ? this.displayNameField : key;
      await this.fillField(fieldName, value);
    }
  }

  /**
   * DynamicSelect/DynamicSearchSelect fields render as a MUI Select: `[name="..."]` resolves to
   * a hidden `<input aria-hidden="true" class="MuiSelect-nativeInput">` that only mirrors the
   * form value - it isn't clickable (a visible sibling intercepts pointer events, which is why
   * clicking fieldLocator() times out). The actual clickable trigger is the sibling
   * `<div role="combobox" id="mui-component-select-<name>">`, confirmed against the running app.
   */
  selectTriggerLocator(fieldName) {
    return this.page.locator(
      `[id="mui-component-select-${this.entityKey}.${fieldName}"], ` +
      `[id="mui-component-select-${this.editEntityKey}.${fieldName}"]`
    );
  }

  async selectField(fieldName, searchText, optionText = searchText, opts = {}) {
    await selectDropdown(this.page, this.selectTriggerLocator(fieldName), searchText, optionText, opts);
  }

  /**
   * Reads back whatever value a selectField() call actually landed on - needed because the
   * fallback chain (exact match -> first-available -> create-new) means the selected value isn't
   * always the literal `optionText` a caller asked for. Callers that need to assert on "what got
   * selected" downstream (e.g. on a View page) should capture this right after selectField(),
   * not assume their own requested value stuck.
   */
  async getFieldDisplayText(fieldName) {
    return (await this.selectTriggerLocator(fieldName).textContent()).trim();
  }

  async save() {
    await this.saveButton.click();
  }

  async discard() {
    await this.discardButton.click();
  }

  async search(text) {
    if (!(await this.searchInput.isVisible().catch(() => false))) {
      await this.searchTrigger.click();
      await this.searchInput.waitFor({ state: 'visible' });
    }
    await this.searchInput.fill('');
    // ActionBar search is debounced ~1.2s (confirmed against the running app - a fixed 650ms
    // wait fires before the debounced request even goes out, so waitForLoadState('networkidle')
    // resolves against stale, unfiltered network activity and the list never actually filters).
    // Wait for the real debounced request/response instead of guessing a timeout.
    const waitForSearchResponse = text
      ? this.page
          .waitForResponse((res) => res.url().includes(`search=${encodeURIComponent(text)}`), { timeout: 10000 })
          .catch(() => null)
      : null;
    await this.searchInput.type(text);
    if (waitForSearchResponse) await waitForSearchResponse;
    await this.page.waitForLoadState('networkidle');
    // Same stale-backdrop quirk as the MUI Select dropdowns (helpers/dropdown.js): opening the
    // search box leaves an invisible full-viewport backdrop mounted with pointer-events: auto,
    // which then blocks hovering/clicking table rows underneath it. Confirmed against the
    // running app.
    await this.page.mouse.click(2, 2);
    await this.page.waitForTimeout(200);
  }

  /**
   * This app's MaterialTable rows carry no ARIA role="row" (confirmed against the running app -
   * `getByRole('row')` matches nothing), so rows must be scoped via plain CSS instead.
   */
  row(rowText) {
    return this.page.locator('table tbody tr').filter({ hasText: rowText });
  }

  rowLink(rowText) {
    return this.page.getByRole('link', { name: rowText, exact: true }).first();
  }

  /**
   * Searches first, same reasoning as openRowMenu() below: with this suite's accumulated test
   * data (including orphaned records left behind by earlier failed runs), a target row can land
   * past the default list's first page, so a plain gotoList()+click can't find it even though the
   * record genuinely exists.
   */
  async openRow(rowText) {
    await this.gotoList();
    await this.search(rowText);
    await this.rowLink(rowText).click();
    await this.page.waitForLoadState('networkidle');
  }

  async openEdit(rowText) {
    await this.openRow(rowText);
    await this.editButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async deleteRow(rowText) {
    await this.gotoList();
    await this.search(rowText);
    const row = this.row(rowText);
    await expect(row.first()).toBeVisible({ timeout: 15000 });
    await row.hover();
    await row.locator('button').first().click();
    await this.page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await this.confirmDeleteButton.waitFor({ state: 'visible' });
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /** Status chip for a given row, e.g. `.coa--StatusChip--Enabled` (pass the entity's CSS slug). */
  statusChip(rowText, cssSlug) {
    return this.row(rowText).locator(`[class*="${cssSlug}--StatusChip"]`);
  }

  /**
   * Every list in this app (confirmed for both Chart of Accounts and Payment Entry, both
   * MaterialTable-based) has a hover-revealed three-dot menu per row (a plain IconButton, no
   * accessible name) offering View/Edit/Duplicate/Delete/etc depending on the entity. Searches
   * first: with this suite's accumulated test data, a freshly created row can land past the
   * default (paginated) first page.
   */
  async openRowMenu(identifier) {
    await this.search(identifier);
    const row = this.row(identifier);
    await row.hover();
    await row.locator('button').first().click();
    await this.page.getByRole('menuitem').first().waitFor({ state: 'visible' });
  }

  async clickRowMenuItem(identifier, label) {
    await this.gotoList();
    await this.openRowMenu(identifier);
    await this.page.getByRole('menuitem', { name: label, exact: true }).click();
  }

  async viewViaMenu(identifier) {
    await this.clickRowMenuItem(identifier, 'View');
    await this.page.waitForLoadState('networkidle');
  }

  async editViaMenu(identifier) {
    await this.clickRowMenuItem(identifier, 'Edit');
    await this.page.waitForLoadState('networkidle');
  }

  async deleteViaMenu(identifier) {
    await this.clickRowMenuItem(identifier, 'Delete');
    await this.confirmDeleteButton.waitFor({ state: 'visible' });
  }

  async sortByColumn(headerText) {
    await this.page.getByRole('columnheader', { name: headerText }).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * The page-number input is a plain MUI TextField with id="outlined-required" and no associated
   * <label> (no htmlFor), so it has no accessible name for a role-based lookup - same shared
   * pagination component pages/BasePage.js's own goToPage() documents for Procurement. There is
   * no clickable numbered page button in this app's pagination UI; fill-and-Enter is the only
   * way to jump pages.
   */
  async goToPage(pageNumber) {
    const input = this.page.locator('#outlined-required');
    await input.fill(String(pageNumber));
    await input.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Clicks the given Save-family button, captures its own POST response, and extracts
   * `{ id, seriesNumber }` directly from that response - not from a subsequent list refetch or a
   * View-page render, either of which can be wrong or crash outright for reasons unrelated to
   * whether the save itself actually succeeded.
   * @param {import('@playwright/test').Locator} button
   * @param {string[]} distinguishingKeys - fields (besides `id`) that identify this module's own
   *   record shape - needed because the response node also contains `id` on unrelated nested rows.
   * @param {string} [urlFragment] - defaults to the entity's own listPath segment.
   */
  async saveAndCaptureId(button, distinguishingKeys, urlFragment) {
    const fragment = urlFragment || this.listPath.split('/').filter(Boolean).pop();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes(fragment),
        { timeout: 15000 }
      ),
      button.click(),
    ]);
    await this.page.waitForLoadState('networkidle').catch(() => {});

    const body = await response.json();
    const record = findRecordWithId(body?.data, distinguishingKeys);
    if (!record?.id) {
      throw new Error(
        `saveAndCaptureId: could not find a matching record in the save response (got: ${JSON.stringify(body?.data)})`
      );
    }
    return { id: String(record.id), seriesNumber: record.series_number };
  }
}

module.exports = SettingsEntityPage;
