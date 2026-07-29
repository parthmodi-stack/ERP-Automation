// Work Order (dashboard/manufacturing/orders/work-order) - Manufacturing module's third spec.
// Reached by DIRECT navigation (not the empty-stub `/dashboard/manufacturing/work-order` route,
// and not the one-click "Create Work Order" shortcut from Demand Planning's Detail view, which
// produces a minimal Draft record missing Location and other fields - see
// 01-demand-planning.spec.js's TC-DP-06 for that separate, narrower flow).
//
// Critical dependency this suite exists partly to guard (per direct instruction): "Bill of
// Material *" is required on the Add form, and its own option list is scoped to whichever Item is
// selected - an item with no BOM at all shows "No data available" there. pages/WorkOrderPage.js's
// ensureBomForItem() creates one on the fly when missing (via BillOfMaterialPage), matching this
// repo's established self-healing-dependency pattern (see 03-bin.spec.js's Location check for the
// precedent) - TC-WO-01 deliberately uses a freshly-selected item so this path actually runs
// rather than coincidentally finding an existing BOM.
//
// Status lifecycle covered here: Add -> Planned --(Release)--> Released --(Issue Material, its
// own document)--> Material Issued --(Build, ANOTHER separate document - see
// pages/BuildOrderPage.js)--> In progress --(Build Order's own Mark Completed)--> Completed. The
// Work Order's own "Close" button is NOT part of this path - confirmed live it's a mislabeled/
// buggy action that reverts status back to "Released" instead of completing anything (see
// WorkOrderPage.js's own header comment). Delete is DISABLED once Released (confirmed live via
// screenshot: the Actions menu's Delete item is grayed out/aria-disabled, and the header instead
// shows Cancel/Issue Material) - same "Delete only works on the pre-approval status" shape as
// Bill of Material, even though an earlier assumption here claimed otherwise. So TC-WO-07 uses its
// own separate, freshly-created Planned record for Delete, matching
// 02-bill-of-material.spec.js's TC-BOM-06 precedent, rather than the one TC-WO-01..06 carries
// through to Completed.
const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const WorkOrderPage = require('../../pages/WorkOrderPage');
const BillOfMaterialPage = require('../../pages/BillOfMaterialPage');
const StockTransferPage = require('../../pages/StockTransferPage');
const BuildOrderPage = require('../../pages/BuildOrderPage');

const woData = testData.manufacturing.workOrder;

// Shared by TC-WO-01 and TC-WO-05 (its own separate Delete-only record, since Delete is disabled
// once Released - see file header comment) - creates one Work Order, auto-creating a BOM for the
// freshly-selected Item if it has none, and returns the new record's series number.
async function createWorkOrder(woPage, bomPage, page) {
  await woPage.goto();
  await woPage.selectItem(); // first available - deliberately NOT pinned, see file header comment
  const itemText = await woPage.getSelectedItemText();

  await woPage.ensureBomForItem(bomPage, itemText);
  // ensureBomForItem() leaves us on a fresh Add form with the same item re-selected either way
  // (whether it created a BOM or the item already had one) - select whichever BOM is now first.
  await woPage.selectDropdown('bom_id');
  await woPage.fillHeader({ date: '01-08-2026' });
  await woPage.selectLocation(woData.location);
  // Quantity gets auto-filled from the selected BOM's own value MORE THAN ONCE (confirmed live:
  // it isn't just BOM selection that (re)triggers this - selectLocation() above also silently
  // resets it back to the BOM's own quantity moments later, even after an explicit 1s settle-wait
  // right after selecting the BOM). Filling it dead last, right before Save, with nothing after
  // it that could re-trigger the same auto-fill, is what actually sticks.
  await woPage.fillHeader({ quantity: woData.quantity });

  await woPage.save();
  await expect(page).toHaveURL(/\/dashboard\/manufacturing\/orders\/work-order(\?.*)?$/);

  const row = page.locator('tr', { hasText: 'Planned' }).first();
  await expect(row).toBeVisible();
  const seriesNumber = (await row.getByText(/^WO-\d{4}-\d+$/).first().textContent()).trim();
  expect(seriesNumber).toMatch(/^WO-\d{4}-\d+$/);
  return seriesNumber;
}

test.describe.serial('Manufacturing - Work Order', () => {
  test.describe.configure({ timeout: 150000 });

  let page;
  let woPage;
  let bomPage;
  let buildOrderPage;
  let seriesNumber; // carried through Create -> View -> Edit -> Release -> Issue Material -> Build

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    woPage = new WorkOrderPage(page);
    bomPage = new BillOfMaterialPage(page);
    buildOrderPage = new BuildOrderPage(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── TC-WO-01: Create (auto-creates a BOM if the selected item has none) ────────────────────
  test('TC-WO-01 [+] Create a Work Order, creating a Bill of Material first if the item has none', { tag: '@smoke' }, async () => {
    seriesNumber = await createWorkOrder(woPage, bomPage, page);
  });

  // ── TC-WO-02: View ─────────────────────────────────────────────────────────────────────────
  test('TC-WO-02 [+] View Work Order - verify saved field values and available actions', async () => {
    test.skip(!seriesNumber, 'requires TC-WO-01 to have created a record first');

    await woPage.openView(seriesNumber);

    await expect(page.getByText(seriesNumber, { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Planned', { exact: true })).toBeVisible();
    await expect(page.getByText(String(woData.quantity), { exact: true }).first()).toBeVisible();
    await expect(page.getByText(woData.location, { exact: true }).first()).toBeVisible();

    await expect(woPage.editButton).toBeVisible();
    await expect(woPage.releaseButton).toBeVisible();
    await woPage.openActions();
    await expect(woPage.deleteMenuItem).toBeVisible();
    await page.keyboard.press('Escape');
  });

  // ── TC-WO-03: Edit ─────────────────────────────────────────────────────────────────────────
  // Quantity stays at woData.updatedQuantity for the rest of this suite - TC-WO-06's own Build
  // Order has to fully account for whatever the Work Order's ACTUAL quantity is, or the Work
  // Order only partially builds and stays "In progress" instead of "Completed" (confirmed live).
  test('TC-WO-03 [+] Edit a Planned Work Order - update Quantity', async () => {
    test.skip(!seriesNumber, 'requires TC-WO-01 to have created a record first');

    await woPage.openEdit(seriesNumber);
    await woPage.fillHeader({ quantity: woData.updatedQuantity });
    await woPage.save();

    await woPage.openView(seriesNumber);
    await expect(page.getByText(String(woData.updatedQuantity), { exact: true }).first()).toBeVisible();
  });

  // ── TC-WO-04: Release ──────────────────────────────────────────────────────────────────────
  test('TC-WO-04 [+] Release moves a Planned Work Order to Released', async () => {
    test.skip(!seriesNumber, 'requires TC-WO-01 to have created a record first');

    // Release checks whether the BOM's material (RM1 - ensureBomForItem's auto-created BOM
    // always uses it) actually has Available stock - confirmed live via direct network capture
    // (PATCH .../status returned 400 "Cannot release work order. Required materials are not
    // available in sufficient quantity.") the first time this suite ran, because RM1's stock was
    // fully reserved/committed elsewhere. Seeding via the backend API directly (POST
    // inventory/v1/stock, the same helper Demand Planning's own suite uses for ITS zero-stock
    // gap) does NOT fix this - confirmed live it writes a real stock row but Release still
    // blocked. Only going through the real Stock Transfer "Receipt" flow (Add -> Track Detail's
    // own per-row Lot/Serial Number traceability step -> Mark as to do -> Validate) actually
    // clears it - so that's what this test does before attempting Release, using RM1's own
    // BOM-required Materials-row item and this Work Order's own Location.
    const releaseMaterial = woData.releaseMaterial;
    const stockTransfer = new StockTransferPage(page);
    await stockTransfer.openAdd();
    await stockTransfer.selectEmployee();
    await stockTransfer.selectOperationType('Receipt');
    await stockTransfer.selectDestinationLocation(woData.location);
    await stockTransfer.goToOperationalDetailTab();
    await stockTransfer.addOperationItem({
      item: releaseMaterial.itemName,
      requestQuantity: String(releaseMaterial.availableQuantity),
      rate: '10',
      transferQuantity: String(releaseMaterial.availableQuantity),
    });
    await stockTransfer.save();
    await page.waitForURL('**/operations/stock-transfer', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await stockTransfer.waitForListLoaded();
    const receiptId = await stockTransfer.getIdForRow(woData.location);

    await stockTransfer.gotoView(receiptId);
    await stockTransfer.markAsToDoButton.click();
    await stockTransfer.confirmDialog.waitFor({ state: 'visible' });
    await stockTransfer.confirmDialogAction('Submit');
    await page.waitForTimeout(1500);

    await stockTransfer.selectTab('Operational Detail');
    await stockTransfer.addTrackDetail({
      itemName: releaseMaterial.itemName,
      quantity: releaseMaterial.availableQuantity,
    });
    await stockTransfer.validate();

    await woPage.openView(seriesNumber);
    await woPage.release();

    await expect(page.getByText('Released', { exact: true })).toBeVisible();
    // Release's own button is gone once Released - the record instead offers Cancel/Issue
    // Material (confirmed live).
    await expect(woPage.releaseButton).not.toBeVisible();
  });

  // ── TC-WO-05: Issue Material ───────────────────────────────────────────────────────────────
  test('TC-WO-05 [+] Issue Material moves a Released Work Order to Material Issued', async () => {
    test.skip(!seriesNumber, 'requires TC-WO-01 to have created a record first');

    await woPage.openView(seriesNumber);
    await woPage.issueMaterial();

    await expect(page.getByText('Material Issued', { exact: true })).toBeVisible();
  });

  // ── TC-WO-06: Build (completes the Work Order via its own separate Build Order document) ───
  test('TC-WO-06 [+] Build creates a Build Order whose own Mark Completed completes the Work Order', async () => {
    test.skip(!seriesNumber, 'requires TC-WO-05 to have issued materials first');

    await woPage.openView(seriesNumber);
    await woPage.openBuildForm();
    const buildOrderSeriesNumber = await buildOrderPage.fillAndSave({
      quantity: woData.updatedQuantity, // must match the Work Order's ACTUAL quantity (see
      // TC-WO-03's own comment) or it only partially builds and stays "In progress"
      finishedGoodCost: 100,
    });
    expect(buildOrderSeriesNumber).toMatch(/^BO-\d{4}-\d+$/);

    await buildOrderPage.openView(buildOrderSeriesNumber);
    await buildOrderPage.markCompleted();

    await woPage.openView(seriesNumber);
    await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  });

  // ── TC-WO-07: Delete ───────────────────────────────────────────────────────────────────────
  // Uses its own, separate Planned record (Delete is disabled once Released - see file header
  // comment), rather than the one TC-WO-01..06 carried through to Completed.
  test('TC-WO-07 [+] Delete a Planned Work Order', async () => {
    const deleteSeriesNumber = await createWorkOrder(woPage, bomPage, page);

    await woPage.openView(deleteSeriesNumber);
    await woPage.deleteRecord();

    await expect(page).toHaveURL(/\/dashboard\/manufacturing\/orders\/work-order(\?.*)?$/);
    await expect(page.locator('tr', { hasText: deleteSeriesNumber })).toHaveCount(0);
  });
});
