const { test, expect } = require('@playwright/test');
const { registerSettingsEntityTests } = require('./settings-entity.contract');
const ChartOfAccountsPage = require('../../pages/accounting/ChartOfAccountsPage');
const testData = require('../../config/testData');

test.describe('Chart of Accounts Management', () => {
  const data = testData.accounting.chartOfAccounts;

  registerSettingsEntityTests({
    tcPrefix: 'TC-COA',
    PageClass: ChartOfAccountsPage,
    validData: data.valid,
    requiredFieldMissingData: data.missingRequired,
  });

  // Entity-specific: Parent Type -> Account Type cascade auto-derives a read-only account_code
  // (add-chart-of-accounts.tsx:184-223). This is COA's one piece of real client-side logic
  // beyond generic FormParser rendering, so it gets its own dedicated test.
  test('TC-COA-10 [+] Selecting Account Type auto-populates a read-only Account Code', async ({ page }) => {
    const coa = new ChartOfAccountsPage(page);
    await coa.openAdd();
    await coa.selectParentType(data.valid.parentType);
    await coa.selectAccountType(data.valid.accountType);

    await expect(coa.accountCodeField()).not.toHaveValue('');
    await expect(coa.accountCodeField()).toBeDisabled();
  });

  test.describe('Chart of Accounts - CRUD', () => {
    const data = testData.accounting.chartOfAccounts.crud;
    // `updatedName` is test metadata, not a real form field - strip it before handing data to
    // create(), otherwise fillForm() tries to locate a field literally named "updatedName".
    const formFields = (overrides) => {
      const { updatedName, ...rest } = data.valid;
      return { ...rest, ...overrides };
    };

    test('TC-COA-CRUD-01 [+] List view loads with the expected controls', { tag: '@smoke' }, async ({ page }) => {
      const coa = new ChartOfAccountsPage(page);
      await coa.gotoList();
      await expect(page).toHaveURL(coa.listPath);
      await expect(page.getByRole('main').getByText('Chart of Accounts', { exact: true })).toBeVisible();
      await expect(coa.addButton).toBeVisible();
      await expect(coa.searchTrigger).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Account Name/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Account Code/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Status/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /Account Type/i })).toBeVisible();
      // Documents a real gap vs the originally-assumed spec: there is no Filter button/modal here.
      await expect(page.getByRole('button', { name: 'Filter', exact: true })).toHaveCount(0);
    });

    test('TC-COA-CRUD-02 [+] Add flow: list -> add -> save -> back to list with the new row visible', { tag: '@smoke' }, async ({ page }) => {
      const coa = new ChartOfAccountsPage(page);
      const name = `${data.valid.name}_ADD`;

      await coa.gotoList();
      await coa.addButton.click();
      await expect(page).toHaveURL(new RegExp(coa.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));

      await coa.create(formFields({ name }));
      await coa.save();

      await expect(page).toHaveURL(new RegExp(coa.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), {
        timeout: 10000,
      });
      await coa.search(name);
      await expect(page.getByText(name).first()).toBeVisible();
      await expect(coa.row(name)).toContainText(data.valid.accountType);
    });

    test('TC-COA-CRUD-03 [-] Add validation: saving with required fields blank shows inline errors and stays on the form', async ({ page }) => {
      const coa = new ChartOfAccountsPage(page);
      await coa.openAdd();
      await coa.save();
      await expect(page).toHaveURL(new RegExp(coa.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
      await expect(page.getByText('Account Type is required')).toBeVisible();
      await expect(page.getByText('Account Code is required')).toBeVisible();
    });

    test('TC-COA-CRUD-04 [-] Discard on Add: no record is created and the list is unaffected', async ({ page }) => {
      const coa = new ChartOfAccountsPage(page);
      const name = `${data.valid.name}_DISCARDED`;

      await coa.openAdd();
      await coa.create(formFields({ name }));
      await coa.discard();

      await expect(page).toHaveURL(new RegExp(coa.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
      await coa.search(name);
      await expect(page.getByText(name)).not.toBeVisible();
    });

    test.describe.serial('Record lifecycle (view -> edit -> delete the same record)', () => {
      const name = `${data.valid.name}_LIFECYCLE`;
      const updatedName = `${data.valid.updatedName}_LIFECYCLE`;
      let recordId;

      test('TC-COA-CRUD-05 [+] Create the record used by the rest of this lifecycle', async ({ page }) => {
        const coa = new ChartOfAccountsPage(page);
        await coa.openAdd();
        await coa.create(formFields({ name }));
        await coa.save();
        await expect(page).toHaveURL(new RegExp(coa.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), {
          timeout: 10000,
        });
      });

      test('TC-COA-CRUD-06 [+] View flow: row menu -> View shows the saved fields and an Activities entry', async ({ page }) => {
        const coa = new ChartOfAccountsPage(page);
        await coa.viewViaMenu(name);
        await expect(page).toHaveURL(/\/view-chart-of-accounts$/);
        // Wait for real data to render before reading the ID, rather than racing the page's fetch.
        await expect(page.getByText(name, { exact: true }).first()).toBeVisible();

        const pageText = await page.locator('body').innerText();
        const idMatch = pageText.match(/COA-\d{4}-\d+/);
        expect(idMatch).toBeTruthy();
        recordId = idMatch[0];

        await expect(page.getByText(data.valid.accountType).first()).toBeVisible();
        await expect(page.getByText('Enabled', { exact: true }).first()).toBeVisible();
        await expect(page.getByText(/Created by .* ago/i)).toBeVisible();
      });

      test('TC-COA-CRUD-07 [+] Edit flow via row menu: Parent Type/Account Type/Account Code are disabled, Save returns to the list', async ({ page }) => {
        const coa = new ChartOfAccountsPage(page);
        await coa.editViaMenu(name);
        await expect(page).toHaveURL(/\/edit-chart-of-accounts$/);

        await expect(coa.selectTriggerLocator('parent_type_id')).toBeDisabled();
        await expect(coa.selectTriggerLocator('account_type_id')).toBeDisabled();
        await expect(coa.accountCodeField()).toBeDisabled();

        await coa.fillForm({ name: updatedName, description: 'Updated by the CRUD spec' });
        await coa.setStatusEnabled(false);
        await coa.save();

        // Confirmed against the running app: edit-chart-of-accounts.tsx always navigates back to
        // the list on success, never back to the originating View page.
        await expect(page).toHaveURL(new RegExp(coa.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), {
          timeout: 10000,
        });
        await coa.search(updatedName);
        await expect(page.getByText(updatedName).first()).toBeVisible();
        await expect(coa.statusPill(updatedName)).toHaveText('Disabled');
      });

      test('TC-COA-CRUD-08 [-] Delete flow: Cancel keeps the row, Delete removes it', async ({ page }) => {
        const coa = new ChartOfAccountsPage(page);

        await coa.deleteViaMenu(updatedName);
        await expect(page.getByRole('dialog')).toContainText('Delete Chart of Account');
        if (recordId) {
          await expect(page.getByRole('dialog')).toContainText(recordId);
        }
        await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(page.getByRole('dialog')).not.toBeVisible();
        await coa.gotoList();
        await coa.search(updatedName);
        await expect(page.getByText(updatedName).first()).toBeVisible();

        await coa.deleteViaMenu(updatedName);
        await coa.confirmDeleteButton.click();
        await expect(page).toHaveURL(new RegExp(coa.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), {
          timeout: 10000,
        });
        await coa.search(updatedName);
        await expect(page.getByText(updatedName)).not.toBeVisible();
      });
    });
  });

});
