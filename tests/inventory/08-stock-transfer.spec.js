const { test, expect } = require('@playwright/test');
const StockTransferPage = require('../../pages/StockTransferPage');
const LocationPage      = require('../../pages/LocationPage');
const testData          = require('../../config/testData');
const { videoContextOptions, finalizeSharedVideo } = require('../../helpers/sharedContextVideo');

test.describe('Stock Transfer Management', () => {

  let page;
  let stockTransfer;
  const data    = testData.stockTransfer.valid;
  const locData = testData.location.valid;

  let createdId;
  let duplicateId;

  test.beforeAll(async ({ browser }) => {
    // The default 30s hook timeout is tight for the cold-start path below
    // (creating the location from scratch involves ~10 slowMo'd actions) -
    // give it real headroom since that path only runs on a true first/
    // standalone run, not when 02-location.spec.js already created it.
    // CONFIRMED LIVE: 90000ms still wasn't enough under this account's real network latency on a
    // true standalone run (context got torn down mid-step, surfacing as a confusing "Target page
    // ... has been closed" error on whatever await happened to run next) - bumped to 150000 to
    // match this suite's own convention for slow multi-step flows (see erpforce-purchase-request's
    // comment on 01/02/04/05/07/09 using 150000).
    test.setTimeout(150000);

    const context = await browser.newContext({ storageState: 'auth.json', ...videoContextOptions() });
    page = await context.newPage();
    stockTransfer = new StockTransferPage(page);

    // Stock Transfer records have no name field of their own - this suite
    // identifies "its" records by the destination location it picks, so that
    // location must exist first. Ensured the same self-healing way
    // 03-bin.spec.js ensures its location dependency exists, so this spec can
    // also run standalone.
    const location = new LocationPage(page);
    const existsInList = (name) =>
      expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible({ timeout: 5000 })
        .then(() => true).catch(() => false);

    await location.gotoList();
    const updatedExists = await existsInList(locData.updatedName);
    if (!updatedExists) {
      const originalExists = await existsInList(locData.name);
      if (!originalExists) {
        await location.addButton.click();
        await page.waitForURL('**/add-location');
        await page.waitForLoadState('networkidle');
        await location.fillForm(locData);
        await location.ensureInventoryAvailable();
        await location.save();

        const createDuplicate = await location.duplicateNameError.isVisible({ timeout: 3000 }).catch(() => false);
        if (createDuplicate) {
          await location.gotoList();
        } else {
          await page.waitForURL('**/configuration/location', { timeout: 10000 });
          await page.waitForLoadState('networkidle');
        }
      }
      await location.openEdit(locData.name);
      await location.nameInput.fill(locData.updatedName);
      await location.save();

      const duplicate = await location.duplicateNameError.isVisible({ timeout: 3000 }).catch(() => false);
      if (duplicate) {
        await location.gotoList();
      } else {
        await page.waitForURL('**/configuration/location', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test.afterAll(async () => {
    await finalizeSharedVideo(page, __filename);
  });

  // ── TC-ST-01: Create Stock Transfer - empty form validation ──────────────
  test('TC-ST-01 [−] Create Stock Transfer - save with empty form shows required-field errors', async () => {
    await stockTransfer.openAdd();

    await stockTransfer.save();

    await expect(stockTransfer.requiredFieldsToast).toBeVisible({ timeout: 5000 });
    await expect(stockTransfer.employeeRequiredError).toBeVisible({ timeout: 5000 });
    await expect(stockTransfer.operationTypeRequiredError).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/.*\/add-stock-transfer/);

    await stockTransfer.gotoList();
  });

  // ── TC-ST-02: Internal Transfer requires both Source and Destination ─────
  // Operation type drives which location fields are required (see
  // add-stock-transfer.tsx's changeFormData): Internal Transfer is the only
  // type that requires both Source and Destination Location.
  test('TC-ST-02 [−] Create Stock Transfer - Internal Transfer without locations shows required errors', async () => {
    await stockTransfer.openAdd();

    await stockTransfer.selectEmployee();
    await stockTransfer.selectOperationType('Internal Transfer');
    await expect(page.getByText('Source Location *')).toBeVisible();
    await expect(page.getByText('Destination Location *')).toBeVisible();

    await stockTransfer.save();
    await expect(stockTransfer.sourceLocationRequiredError).toBeVisible({ timeout: 5000 });
    await expect(stockTransfer.destinationLocationRequiredError).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/.*\/add-stock-transfer/);

    await stockTransfer.gotoList();
  });

  // ── TC-ST-03: Add Item modal - empty save shows required-field errors ────
  test('TC-ST-03 [−] Add Item modal - save with empty fields shows required-field errors', async () => {
    await stockTransfer.openAdd();
    await stockTransfer.selectEmployee();
    await stockTransfer.selectOperationType(data.operationType);
    await stockTransfer.selectDestinationLocation(data.destinationLocation);

    await stockTransfer.goToOperationalDetailTab();
    await stockTransfer.openAddItemModal();
    await stockTransfer.itemModalSaveButton.click();

    await expect(stockTransfer.itemRequiredError).toBeVisible({ timeout: 5000 });
    await expect(stockTransfer.requestQuantityRequiredError).toBeVisible({ timeout: 5000 });
    await expect(stockTransfer.rateRequiredError).toBeVisible({ timeout: 5000 });
    await expect(stockTransfer.transferQuantityRequiredError).toBeVisible({ timeout: 5000 });

    await stockTransfer.itemModalCancelButton.click();
    await stockTransfer.gotoList();
  });

  // ── TC-ST-04: Create Stock Transfer ───────────────────────────────────────
  test('TC-ST-04 [+] Create Stock Transfer with an item and verify it appears in the list', { tag: '@smoke' }, async () => {
    await stockTransfer.openAdd();

    await stockTransfer.selectEmployee();
    await stockTransfer.selectOperationType(data.operationType);
    await stockTransfer.selectDestinationLocation(data.destinationLocation);

    await stockTransfer.goToOperationalDetailTab();
    await stockTransfer.addOperationItem({
      item:             '', // pick the first available item, same "first available" pattern 07-inventory-item.spec.ts uses for Location
      requestQuantity:  data.requestQuantity,
      rate:             data.rate,
      transferQuantity: data.transferQuantity,
    });

    // Row was added to the Operational Detail table before the header form is saved.
    // Transfer Amount = rate * transfer quantity, formatted with this org's AED currency.
    const transferAmount = (Number(data.rate) * Number(data.transferQuantity)).toLocaleString('en-US', { minimumFractionDigits: 4 });
    await expect(page.getByText(`AED ${transferAmount}`).first()).toBeVisible({ timeout: 5000 });

    await stockTransfer.save();
    await page.waitForURL('**/operations/stock-transfer', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await stockTransfer.waitForListLoaded();

    const row = stockTransfer.rowFor(data.destinationLocation).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.locator('.stockTransfer--Status-draft')).toBeVisible();

    createdId = await stockTransfer.getIdForRow(data.destinationLocation);
    expect(createdId).toBeTruthy();
  });

  // ── TC-ST-05: View Stock Transfer ─────────────────────────────────────────
  test('TC-ST-05 [+] View Stock Transfer - verify saved field values on detail page', async () => {
    test.skip(!createdId, 'Stock Transfer was not created in TC-ST-04');

    await stockTransfer.gotoView(createdId);

    await expect(page).toHaveURL(new RegExp(`/${createdId}/view-stock-transfer`));
    await expect(page.locator('.viewStockTransfer--StatusChip--draft')).toBeVisible();
    await expect(page.getByText(data.operationType, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(data.destinationLocation).first()).toBeVisible();

    await stockTransfer.selectTab('Operational Detail');
    await expect(page.getByText(data.transferQuantity, { exact: true }).first()).toBeVisible();
  });

  // ── TC-ST-06: Mark as to do (Draft → Ready) ───────────────────────────────
  test('TC-ST-06 [+] Edit → Mark as to do transitions Stock Transfer from Draft to Ready', async () => {
    test.skip(!createdId, 'Stock Transfer was not created in TC-ST-04');

    await stockTransfer.gotoView(createdId);
    await stockTransfer.markAsToDoButton.click();

    await expect(stockTransfer.confirmDialog.getByText('Mark as to do')).toBeVisible();
    await expect(
      stockTransfer.confirmDialog.getByText('Are you sure you want to mark Stock Transfer as Ready ?')
    ).toBeVisible();

    await stockTransfer.confirmDialogAction('Submit');

    await expect(page.locator('.viewStockTransfer--StatusChip--ready')).toBeVisible({ timeout: 10000 });
    await expect(stockTransfer.validateButton).toBeVisible();
  });

  // ── TC-ST-07: Validate is blocked until traceability is completed ────────
  // The item picked in TC-ST-04 is whichever one the app returns first for
  // this org - Validate blocks with this exact (untranslated-string-free but
  // typo'd in the app itself) message until every operation row's tracking
  // has been generated. This dev environment's items consistently require
  // that step, so the block is what this test asserts; it isn't asserting
  // that this item can never validate, only that it can't skip the process.
  test('TC-ST-07 [−] Validate is blocked until the traceability process is completed', async () => {
    test.skip(!createdId, 'Stock Transfer was not created in TC-ST-04');

    await stockTransfer.gotoView(createdId);
    await stockTransfer.validateButton.click();

    await expect(page.getByText('Please complete the traceibility process before validate')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.viewStockTransfer--StatusChip--ready')).toBeVisible();
  });

  // ── TC-ST-08: Duplicate Stock Transfer ────────────────────────────────────
  // Duplicate is only reachable from the list row's "..." menu - the view
  // page's own Actions dropdown trigger is commented out in the app.
  test('TC-ST-08 [+] Duplicate Stock Transfer - opens Add form pre-filled and saves as a new record', async () => {
    test.skip(!createdId, 'Stock Transfer was not created in TC-ST-04');

    await stockTransfer.gotoList();
    await stockTransfer.duplicateFromList(data.destinationLocation);

    await expect(page).toHaveURL(/.*\/add-stock-transfer/);
    await expect(page.getByText(data.operationType, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(data.destinationLocation).first()).toBeVisible();

    await stockTransfer.save();
    await page.waitForURL('**/operations/stock-transfer', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await stockTransfer.waitForListLoaded();

    const ids = await stockTransfer.getIdsForRow(data.destinationLocation);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    duplicateId = ids.find((id) => id !== createdId);
    expect(duplicateId).toBeTruthy();
  });

  // ── TC-ST-09: Delete duplicated Stock Transfer ────────────────────────────
  test('TC-ST-09 [+] Delete Stock Transfer - delete the duplicated record and verify it is removed', async () => {
    test.skip(!duplicateId, 'Duplicate was not created in TC-ST-08');

    await stockTransfer.gotoView(duplicateId);
    await stockTransfer.deleteButton.click();

    await expect(stockTransfer.confirmDialog.getByText('Delete StockTransfer', { exact: true })).toBeVisible();
    await stockTransfer.confirmDialogAction('Delete');

    await page.waitForURL('**/operations/stock-transfer', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await stockTransfer.waitForListLoaded();

    const ids = await stockTransfer.getIdsForRow(data.destinationLocation);
    expect(ids).not.toContain(duplicateId);
    expect(ids).toContain(createdId);
  });

});
