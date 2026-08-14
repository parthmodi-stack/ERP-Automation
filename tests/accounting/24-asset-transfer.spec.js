const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const AssetTransferPage = require('../../pages/accounting/AssetTransferPage');
const AssetManagementPage = require('../../pages/accounting/AssetManagementPage');

// =============================================================================
// Asset Transfer - single-file coverage
// =============================================================================
//
// Asset Transfer (Accounting > Assets > Asset Transfer) moves an existing Asset from its current
// (Source) Location/Department to a new (Destination) Location/Department, then goes through the
// same Submit -> Quick Approval -> Accept workflow as every other approval-gated document module
// in this suite - see pages/accounting/AssetTransferPage.js for full field/route/business-rule
// notes confirmed live against the running app, including:
//   - the list/add routes use singular "asset-transfer" but the view route (and the create API
//     endpoint) use plural "assets-transfer" - not a typo, both are real
//   - Save creates the record directly in "Pending" status (no separate Draft state, unlike every
//     other module in this suite)
//   - Current Location/Department are disabled, auto-populated from the selected Asset
//   - approving the transfer actually relocates the Asset itself (verified against
//     AssetManagementPage's own View page, not just the transfer record's own fields)
//
// Prerequisite: rather than reusing one of this shared environment's many duplicate-named assets
// (which selectDropdown()'s exact-match search can't reliably disambiguate), a fresh, uniquely
// named Asset is created with a real Source Location assigned, then used as this transfer's Asset.
//
//   TC-ATR-LIST-01    Listing page loads with expected Add control
//   TC-ATR-ADD-01     Add form required-field validation
//   TC-ATR-PREREQ-01  Create the prerequisite Asset with a Source Location assigned
//   TC-ATR-CRUD-01    Create an Asset Transfer to a different Destination Location/Department
//   TC-ATR-CRUD-02    View page displays the correct transfer details
//   TC-ATR-CRUD-03    Submit For Approval and Accept moves it to Approved
//   TC-ATR-CRUD-04    Approving the transfer relocates the Asset to the Destination Location/Department
//   TC-ATR-CRUD-05    Edit button is hidden once Approved
//   TC-ATR-CRUD-06    Known gap: Actions menu still offers Delete after Approval
//   TC-ATR-L01..L05   Listing page: search, sort, pagination, row action menu, status badge

async function waitForIdle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

// Hoisted to module scope (not inside the serial describe block below) so the Listing Page
// describe block - which runs after it in this same file, per this suite's "tests within one
// spec file always run in-order on the same worker" execution model - can search by the short,
// unique seriesNumber captured from the save response instead of the long timestamp-suffixed
// transferName text.
let prereqAssetName;
let created;
let destinationLocationName;

test.describe('Asset Transfer Management', () => {
  test('TC-ATR-LIST-01 [+] Listing page loads with expected Add control', async ({ page }) => {
    const at = new AssetTransferPage(page);
    await at.gotoList();

    await expect(page.locator('main').getByText('Asset Transfer', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(at.addButton).toBeVisible();
  });

  test('TC-ATR-ADD-01 [-] Add form blocks Save with required fields blank', async ({ page }) => {
    const at = new AssetTransferPage(page);
    await at.openAdd();

    await at.saveButton.click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/add-asset-transfer/);
  });
});

test.describe.serial('Asset Transfer - Create, Approve, and Verify Asset Relocation', () => {
  const data = testData.accounting.assetTransfer;

  test('TC-ATR-PREREQ-01 [+] Create the prerequisite Asset with a Source Location assigned', async ({ page }) => {
    test.setTimeout(150000);
    const am = new AssetManagementPage(page);
    const asset = data.prereqAsset;
    prereqAssetName = asset.assetName;

    await am.createAsset({
      assetType:           asset.assetType,
      assetName:           asset.assetName,
      seriesNumber:        asset.seriesNumber,
      location:            asset.location,
      department:          asset.department,
      acquisitionDate:     asset.acquisitionDate,
      assetValue:          asset.assetValue,
      notDepreciableValue: asset.notDepreciableValue,
      bookValue:           asset.bookValue,
      depreciationMethod:  asset.depreciationMethod,
      computation:         asset.computation,
      fixedAssetAccount:   asset.fixedAssetAccount,
      depreciationAccount: asset.depreciationAccount,
      expenseAccount:      asset.expenseAccount,
    });
    await am.save();
    await page.waitForURL(am.listPath, { timeout: 30000 });
    await waitForIdle(page);

    await am.openNewestRow();
    await expect(page.getByText(prereqAssetName).first()).toBeVisible({ timeout: 10000 });
    // Confirms the prerequisite's Source Location actually saved - the rest of this suite depends
    // on this exact value being the transfer's own "Current Location" after selecting the asset.
    // exact: true matters here - a loose match let this silently pass even when the dropdown
    // actually landed on "Navi Mumbai" instead of "Mumbai" (confirmed live: TC-ATR-CRUD-01's own
    // exact getSourceLocationText() comparison caught the real mismatch one test later, after this
    // one had already reported success).
    await expect(page.getByText(asset.location, { exact: true }).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-ATR-CRUD-01 [+] Create an Asset Transfer to a different Destination Location/Department', async ({ page }) => {
    test.setTimeout(90000);
    test.skip(!prereqAssetName, 'depends on TC-ATR-PREREQ-01 creating the prerequisite Asset first');
    const at = new AssetTransferPage(page);

    await at.openAdd();
    await at.selectAsset(prereqAssetName);
    await page.waitForTimeout(1000);

    // Current Location is a disabled, auto-populated field - confirms it picked up the
    // prerequisite Asset's own Source Location rather than staying blank or showing a stale value.
    const sourceLocationText = await at.getSourceLocationText();
    expect(sourceLocationText).toBe(data.prereqAsset.location);

    destinationLocationName = await at.selectDestinationLocation(data.destinationLocationPrefix);

    await at.fillHeader({
      referenceNumber:       data.referenceNumber,
      transferName:          data.transferName,
      transferDate:          at.formatDateToday(),
      destinationDepartment: data.destinationDepartment,
    });

    created = await at.save();
    expect(created.id).toBeTruthy();
    expect(created.seriesNumber).toBeTruthy();

    await page.waitForURL(at.listPath, { timeout: 20000 });
    await waitForIdle(page);
    await expect(at.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });
  });

  test('TC-ATR-CRUD-02 [+] View page displays the correct transfer details', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!created, 'depends on TC-ATR-CRUD-01 creating the transfer first');
    const at = new AssetTransferPage(page);

    await at.gotoView(created.id);
    await expect(page.getByText(`ID: ${created.seriesNumber}`, { exact: false })).toBeVisible();
    await expect(page.getByText(prereqAssetName).first()).toBeVisible();
    await expect(page.getByText(data.transferName).first()).toBeVisible();
    await expect(page.getByText(data.prereqAsset.location).first()).toBeVisible();
    await expect(page.getByText(destinationLocationName).first()).toBeVisible();
    await expect(page.getByText(data.destinationDepartment).first()).toBeVisible();
    // Newly created record is directly Pending (no Draft state) - Submit and Edit are both
    // available at this point; the split-button caret ("select merge strategy") drives approval.
    await expect(at.approvalStatusChipOnView()).toHaveText(/Pending/i);
    await expect(page.getByRole('button', { name: /^Submit$/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /^Edit$/i })).toBeVisible({ timeout: 10000 });
  });

  test('TC-ATR-CRUD-03 [+] Submit For Approval and Accept moves it to Approved', async ({ page }) => {
    test.setTimeout(90000);
    test.skip(!created, 'depends on TC-ATR-CRUD-01 creating the transfer first');
    const at = new AssetTransferPage(page);

    await at.gotoView(created.id);
    await expect(page.getByRole('button', { name: /^Submit$/i })).toBeVisible({ timeout: 10000 });

    // Uses AccountingDocumentPage's own caret-menu approval flow (openSubmitMenu/
    // clickSubmitMenuItem) - the page's main "Accept" button is a no-op decoy sitting in the same
    // split-button group as the caret (confirmed on Expense Reimbursement/Cash Expense; see
    // acceptApproval()'s doc comment in AccountingDocumentPage.js).
    await at.quickApproval(testData.accounting.paymentEntry.approverName);
    await waitForIdle(page, 1000);
    await at.acceptApproval();
    await waitForIdle(page, 1500);

    await expect(at.approvalStatusChipOnView()).toHaveText(/Approved/i, { timeout: 15000 });
  });

  test('TC-ATR-CRUD-04 [+] Approving the transfer relocates the Asset to the Destination Location/Department', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!created, 'depends on TC-ATR-CRUD-03 approving the transfer first');
    const am = new AssetManagementPage(page);

    await am.gotoList();
    await page.waitForTimeout(500);
    const assetRow = page.locator('tr', { has: page.getByText(prereqAssetName, { exact: true }) });
    await assetRow.locator('a').first().click();
    await waitForIdle(page);

    // Core business-rule validation: this is a LIVE mutation of the Asset's own record, not just
    // a historical field on the transfer - confirmed live the Asset's Location/Department here
    // change from the prerequisite's original values to the transfer's Destination values.
    await expect(page.getByText(destinationLocationName).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(data.destinationDepartment).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(data.prereqAsset.location, { exact: true })).toHaveCount(0);
  });

  test('TC-ATR-CRUD-05 [+] Edit button is hidden once the transfer is Approved', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!created, 'depends on TC-ATR-CRUD-03 approving the transfer first');
    const at = new AssetTransferPage(page);

    await at.gotoView(created.id);
    await expect(at.approvalStatusChipOnView()).toHaveText(/Approved/i, { timeout: 10000 });
    await expect(page.getByRole('button', { name: /^Edit$/i })).toHaveCount(0);
  });

  test('TC-ATR-CRUD-06 [-] Known gap: Actions menu still offers Delete after Approval', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!created, 'depends on TC-ATR-CRUD-03 approving the transfer first');
    // Same confirmed app-wide gap as Purchase Agreement's TC-PAGR-11/12: the View page's Actions
    // menu still offers Delete for a non-Draft (here, Approved) status, with no server-side or
    // full UI enforcement of this business rule (confirmed live: Delete menuitem count is 1, not 0).
    test.fail(true, 'Known gap: View page Actions menu allows deleting an Approved asset transfer.');
    const at = new AssetTransferPage(page);

    await at.gotoView(created.id);
    await at.actionsMenuButton.click();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  });
});

test.describe('Asset Transfer - Listing Page', () => {
  // Reuses the record created/approved by the lifecycle tests above - searched by its short,
  // unique seriesNumber (e.g. "AT-2026-000057") rather than the long timestamp-suffixed
  // transferName text, for a faster and more reliable exact-row match.
  test('TC-ATR-L01 [+] Search/filter the list', async ({ page }) => {
    test.skip(!created, 'depends on the lifecycle tests above creating a transfer first');
    const at = new AssetTransferPage(page);
    await at.gotoList();

    await at.search(created.seriesNumber);
    await expect(at.row(created.seriesNumber)).toBeVisible({ timeout: 10000 });

    await at.search('no-such-asset-transfer-zzz-999');
    await expect(page.getByText('No Data')).toBeVisible({ timeout: 10000 });

    await at.search('');
  });

  test('TC-ATR-L02 [+] Sort a column ascending/descending', async ({ page }) => {
    const at = new AssetTransferPage(page);
    await at.gotoList();

    const idColumn = page.getByRole('columnheader', { name: /^ID/i });
    const initialSort = await idColumn.getAttribute('aria-sort');
    expect(initialSort === null || initialSort === 'none').toBeTruthy();

    await at.sortByColumn(/^ID/i);
    const afterFirstClick = await idColumn.getAttribute('aria-sort');
    expect(['ascending', 'descending']).toContain(afterFirstClick);

    await at.sortByColumn(/^ID/i);
    const afterSecondClick = await idColumn.getAttribute('aria-sort');
    expect(afterSecondClick).not.toBe(afterFirstClick);
    expect(['ascending', 'descending']).toContain(afterSecondClick);
  });

  test('TC-ATR-L03 [+] Paginate between pages', async ({ page }) => {
    const at = new AssetTransferPage(page);
    await at.gotoList();

    const paginationLabel = page.getByText(/Page\s*1\s*of\s*\d+/i);
    await expect(paginationLabel).toBeVisible({ timeout: 10000 });

    await at.goToPage(2);
    await expect(page.getByText(/Page\s*2\s*of\s*\d+/i)).toBeVisible({ timeout: 10000 });
  });

  test('TC-ATR-L04 [+] Row action menu shows View/Edit/Delete', async ({ page }) => {
    test.skip(!created, 'depends on the lifecycle tests above creating a transfer first');
    const at = new AssetTransferPage(page);
    await at.gotoList();

    await at.openRowMenu(created.seriesNumber);
    await expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible();
  });

  test('TC-ATR-L05 [+] Row status badge matches the record\'s lifecycle state', async ({ page }) => {
    test.skip(!created, 'depends on the lifecycle tests above creating a transfer first');
    const at = new AssetTransferPage(page);
    await at.gotoList();

    const status = await at.getRowStatus(created.seriesNumber);
    expect(status).toContain('Approved');
  });
});
