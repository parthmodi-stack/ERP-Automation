const { test, expect } = require('@playwright/test');

/**
 * Shared CRUD/search/delete test contract for the "Settings entity" archetype (Chart of
 * Accounts, Currency, Tax Code, Bank, Bank Account, ...). All of these screens share the same
 * ActionBar + MaterialTable + FormParser + ConfirmPopUp shape, so this factory avoids
 * re-writing the same ~9 test cases per entity spec file.
 *
 * Not a *.spec.js file itself (Playwright won't pick it up as a test file); import
 * `registerSettingsEntityTests` from an actual spec file and call it inside a test.describe().
 *
 * Each Page Object passed in must implement:
 *   - gotoList(), openAdd(), openEdit(name), save(), search(text), deleteRow(name)
 *   - create(data) -> fills the add form (including any dropdown fields) and does NOT save
 *     (tests call save() themselves so they can assert pre/post-save state)
 *   - fillForm(data) -> generic name-based field filling for plain text/number fields
 *
 * validData/requiredFieldMissingData/duplicateData use a common shape:
 *   { name, updatedName, ...entity-specific fields }
 */
function registerSettingsEntityTests({
  tcPrefix,
  PageClass,
  validData,
  requiredFieldMissingData,
  duplicateData,
}) {
  const makePage = (page) => new PageClass(page);
  // `updatedName` is test metadata for TC-05 (edit), not a real form field - strip it before
  // handing data to create(), otherwise fillForm() tries to locate a field literally named
  // "updatedName" and times out.
  const formFieldsOf = (data) => {
    const { updatedName, ...rest } = data;
    return rest;
  };

  test(`${tcPrefix}-01 [+] Navigate to list and verify page loads`, { tag: '@smoke' }, async ({ page }) => {
    const entity = makePage(page);
    await entity.gotoList();
    await expect(page.getByRole('main')).toBeVisible();
  });

  test(`${tcPrefix}-02 [+] Create with all fields`, { tag: '@smoke' }, async ({ page }) => {
    const entity = makePage(page);
    await entity.openAdd();
    await entity.create(formFieldsOf(validData));
    await entity.save();
    await page.waitForLoadState('networkidle');
    // Anchored with $ - addPath is listPath + '/add-...', so an unanchored regex would also
    // (wrongly) match while still stuck on the add form after a silent validation failure.
    await page.waitForURL(new RegExp(entity.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), {
      timeout: 10000,
    });
    await expect(page.getByText(validData.name).first()).toBeVisible();
  });

  if (requiredFieldMissingData) {
    test(`${tcPrefix}-03 [-] Create with required field blank shows validation error`, async ({ page }) => {
      const entity = makePage(page);
      await entity.openAdd();
      await entity.create(formFieldsOf(requiredFieldMissingData));
      await entity.save();
      // Required-field validation should block navigation away from the add form.
      await expect(page).toHaveURL(new RegExp(entity.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
  }

  if (duplicateData) {
    test(`${tcPrefix}-04 [-] Create with a duplicate unique field is rejected`, async ({ page }) => {
      const entity = makePage(page);
      await entity.openAdd();
      await entity.create(formFieldsOf(duplicateData));
      await entity.save();
      await expect(page).toHaveURL(new RegExp(entity.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await expect(entity.toastMessage).toBeVisible({ timeout: 5000 });
    });
  }

  test(`${tcPrefix}-05 [+] Edit updates a field and the change persists`, async ({ page }) => {
    // Two full edit -> save cycles (rename, then restore) plus playwright.config.js's global
    // slowMo: 500 add up past the 30s default - give this one more headroom.
    test.setTimeout(60000);
    const entity = makePage(page);
    await entity.openEdit(validData.name);
    await entity.fillForm({ name: validData.updatedName });
    await entity.save();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(validData.updatedName).first()).toBeVisible();

    // Restore the original name so later tests (search/delete) can keep referencing it.
    await entity.openEdit(validData.updatedName);
    await entity.fillForm({ name: validData.name });
    await entity.save();
    await page.waitForLoadState('networkidle');
  });

  test(`${tcPrefix}-06 [+] View shows the saved record`, async ({ page }) => {
    const entity = makePage(page);
    await entity.openRow(validData.name);
    await expect(page.getByText(validData.name).first()).toBeVisible();
  });

  test(`${tcPrefix}-07 [+] Search filters the list to matching rows`, async ({ page }) => {
    const entity = makePage(page);
    await entity.gotoList();
    await entity.search(validData.name);
    await expect(page.getByText(validData.name).first()).toBeVisible();
  });

  test(`${tcPrefix}-08 [-] Search with a non-existent term shows no matching rows`, async ({ page }) => {
    const entity = makePage(page);
    await entity.gotoList();
    await entity.search(`NoSuchRecord_${Date.now()}`);
    await expect(page.getByText(validData.name)).not.toBeVisible({ timeout: 15000 });
  });

  test(`${tcPrefix}-09 [-] Delete removes the record from the list`, async ({ page }) => {
    const entity = makePage(page);
    await entity.deleteRow(validData.name);
    await expect(page.getByRole('link', { name: validData.name, exact: true })).not.toBeVisible();
  });
}

module.exports = { registerSettingsEntityTests };
