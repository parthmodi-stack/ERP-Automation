const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const AssetManagementPage = require('../../pages/accounting/AssetManagementPage');

// =============================================================================
// Asset Management - single-file coverage
// =============================================================================
//
// Asset Management (Accounting > Assets > Assets Management) has three account-select fields
// (Fixed Asset Account, Depreciation Account, Expense Account) with no inline "Create New
// Account" option - a missing account is created via ChartOfAccountsPage on a throwaway tab
// (see AssetManagementPage.createAccountOnNewTab), using:
//   Fixed Asset Account   -> parentType "Assets"  / accountType "Fixed Assets"
//   Depreciation Account  -> parentType "Assets"  / accountType "Fixed Assets"
//   Expense Account       -> parentType "Expense" / accountType "Expenses"
//
// Confirmed live: unlike every other document module in this suite, Asset Management has no
// approval workflow at all (the View page shows only Edit/Delete, no Submit/Actions/status chip)
// - create is the complete flow, so there's no separate Submit/Approve test here.
//
//   TC-AM-LIST-01  Listing page loads with expected Add control
//   TC-AM-ADD-01   Add form required-field validation
//   TC-AM-CRUD-01  Create an Asset, creating all three accounts on the fly

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe('Asset Management', () => {
  test('TC-AM-LIST-01 [+] Listing page loads with expected Add control', { tag: '@smoke' }, async ({ page }) => {
    const am = new AssetManagementPage(page);
    await am.gotoList();

    await expect(page.locator('main').getByText('Asset Management', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(am.addButton).toBeVisible();
  });

  test('TC-AM-ADD-01 [-] Add form blocks Save with required fields blank', async ({ page }) => {
    const am = new AssetManagementPage(page);
    await am.openAdd();

    await am.save();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/add-asset/);
  });

  test('TC-AM-CRUD-01 [+] Create an Asset, creating all three accounts on the fly', { tag: '@smoke' }, async ({ page }) => {
    test.setTimeout(150000);
    const data = testData.accounting.assetManagement;
    const am = new AssetManagementPage(page);

    await am.createAsset({
      assetType:           data.assetType,
      assetName:           data.assetName,
      seriesNumber:        data.seriesNumber,
      location:            data.location,
      department:          data.department,
      acquisitionDate:     data.acquisitionDate,
      assetValue:          data.assetValue,
      notDepreciableValue: data.notDepreciableValue,
      bookValue:           data.bookValue,
      depreciationMethod:  data.depreciationMethod,
      computation:         data.computation,
      fixedAssetAccount:   data.fixedAssetAccount,
      depreciationAccount: data.depreciationAccount,
      expenseAccount:      data.expenseAccount,
    });

    await am.save();
    await page.waitForURL(am.listPath, { timeout: 30000 });
    await waitForIdle(page);

    await am.openNewestRow();
    await expect(page.getByText(data.assetName).first()).toBeVisible({ timeout: 10000 });
  });
});
