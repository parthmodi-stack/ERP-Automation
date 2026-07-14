const { test, expect } = require('@playwright/test');
const AccountingSettingPage = require('../../pages/accounting/AccountingSettingPage');
const testData = require('../../config/testData');

// =============================================================================
// Accounting Settings (Settings)
// =============================================================================
//
// Doesn't use the shared registerSettingsEntityTests factory (see settings-entity.contract.js):
// there is no free-text "name" field at all - each row is a per-(company, department, location)
// configuration profile (confirmed live: company_id/department_id/location_id are the ONLY
// required fields among ~37; see AccountingSettingPage.js), and the (company, department,
// location) triple itself is the uniqueness key, not a separate duplicate-name check.

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe('Accounting Settings (Settings)', () => {
  const data = testData.accounting.accountingSetting;

  test('TC-ACST-01 [+] Navigate to list and verify page loads', { tag: '@smoke' }, async ({ page }) => {
    const acs = new AccountingSettingPage(page);
    await acs.gotoList();
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('TC-ACST-02 [-] Create with an already-used company/department/location is rejected', async ({ page }) => {
    // Confirmed live: this exact combination already exists in this environment (seeded during
    // this suite's own discovery) - reused here specifically to exercise the duplicate-combo path.
    const acs = new AccountingSettingPage(page);
    await acs.openAdd();
    await acs.create(data.duplicate);
    await acs.save();
    await expect(page).toHaveURL(new RegExp(acs.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(acs.toastMessage).toContainText(/already exists/i, { timeout: 5000 });
  });

  test.describe.serial('Create -> View -> Edit -> Delete lifecycle', () => {
    let viewUrl;

    test('TC-ACST-03 [+] Create with a fresh company/department/location combination', { tag: '@smoke' }, async ({ page }) => {
      test.setTimeout(60000);
      const acs = new AccountingSettingPage(page);
      await acs.openAdd();
      await acs.create(data.valid);
      await acs.save();
      await page.waitForURL(new RegExp(acs.listPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), {
        timeout: 15000,
      });
      await waitForIdle(page);

      viewUrl = await acs.openRowByCombo(data.valid.company_id, data.valid.department_id, data.valid.location_id);
      expect(viewUrl).toContain('view-accounting-setting');

      await expect(page.getByText(data.valid.company_id).first()).toBeVisible();
      await expect(page.getByText(data.valid.department_id).first()).toBeVisible();
      await expect(page.getByText(data.valid.location_id).first()).toBeVisible();
    });

    test('TC-ACST-04 [+] Edit changes the location and the change persists', async ({ page }) => {
      test.skip(!viewUrl, 'depends on TC-ACST-03 creating a row first');
      test.setTimeout(60000);
      const acs = new AccountingSettingPage(page);

      await page.goto(viewUrl);
      await waitForIdle(page);
      await acs.editButton.click();
      await page.waitForURL(/edit-accounting-setting/, { timeout: 15000 });
      await waitForIdle(page);

      await acs.selectField('location_id', data.updatedLocation);
      await acs.save();
      await waitForIdle(page);

      viewUrl = await acs.openRowByCombo(data.valid.company_id, data.valid.department_id, data.updatedLocation);
      await expect(page.getByText(data.updatedLocation).first()).toBeVisible();
    });

    test('TC-ACST-05 [-] Delete via row menu: Cancel keeps it, Confirm removes it', async ({ page }) => {
      test.skip(!viewUrl, 'depends on TC-ACST-03 creating a row first');
      const acs = new AccountingSettingPage(page);

      await acs.gotoList();
      await waitForIdle(page);
      const row = page.locator('table tbody tr')
        .filter({ hasText: data.valid.company_id })
        .filter({ hasText: data.valid.department_id })
        .filter({ hasText: data.updatedLocation })
        .first();
      await expect(row).toBeVisible({ timeout: 10000 });

      await row.hover();
      await row.locator('button').first().click();
      await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
      await acs.confirmDeleteButton.waitFor({ state: 'visible' });
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(row).toBeVisible();

      await row.hover();
      await row.locator('button').first().click();
      await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
      await acs.confirmDeleteButton.click();
      await waitForIdle(page);

      const rowAfterDelete = page.locator('table tbody tr')
        .filter({ hasText: data.valid.company_id })
        .filter({ hasText: data.valid.department_id })
        .filter({ hasText: data.updatedLocation });
      await expect(rowAfterDelete).not.toBeVisible();
    });
  });
});
