// Unbuild Order (dashboard/manufacturing/orders/unbuild-order) - Manufacturing module's fourth
// spec. Reverses a Build: consumes an Item's own built stock and produces its BOM's raw
// materials back. Two creation paths, both covered here:
// - TC-UO-01..05: via a COMPLETED Build Order's own Actions menu ("Unbuild") - this file creates
//   its own full Work Order -> Release -> Issue Material -> Build -> Completed chain (same flow
//   as 03-work-order.spec.js's TC-WO-01..06) purely as setup, via createCompletedBuildOrder().
// - TC-UO-06: direct navigation to /unbuild-order/add-unbuild-order - the Items dropdown's own API
//   used to return a 500 ("Unknown column 'items.purchase_tax_id' in 'on clause'"), confirmed
//   live earlier this session; that backend bug has since been fixed, so this path is now
//   exercised directly rather than only through a Build Order.
//
// Status lifecycle: (Save To Draft - the CREATE page's own "Save" button crashes client-side
// before any request fires, a separate confirmed bug) -> Draft --(Edit -> Save, which works
// correctly)--> In progress --(see UnbuildOrderPage.completeUnbuild() for the full two-step
// Track Detail sequence: the Materials row's own Trace Detail, only responsive on the EDIT
// page, THEN Adjust Inventory's own Finished-Item Track Detail on the View page)--> Completed.
const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const WorkOrderPage = require('../../pages/WorkOrderPage');
const BillOfMaterialPage = require('../../pages/BillOfMaterialPage');
const StockTransferPage = require('../../pages/StockTransferPage');
const BuildOrderPage = require('../../pages/BuildOrderPage');
const UnbuildOrderPage = require('../../pages/UnbuildOrderPage');
const { seedMaterialStockViaReceipt } = require('../../helpers/manufacturingStock');

const woData = testData.manufacturing.workOrder;
const uoData = testData.manufacturing.unbuildOrder;

// Shared setup, not itself a test case - carries a fresh Work Order all the way to a Completed
// Build Order, matching 03-work-order.spec.js's TC-WO-01..06 flow, so this file can create its
// own Unbuild Order records independently of that suite's own state.
async function createCompletedBuildOrder(page, woPage, bomPage, buildOrderPage) {
  await woPage.goto();
  await woPage.selectItem(); // first available - same "not pinned" reasoning as 03-work-order.spec.js
  const itemText = await woPage.getSelectedItemText();

  await woPage.ensureBomForItem(bomPage, itemText);
  await woPage.selectDropdown('bom_id');
  await woPage.fillHeader({ date: '01-08-2026' });
  await woPage.selectLocation(woData.location);
  await woPage.fillHeader({ quantity: woData.quantity });
  await woPage.save();

  const row = page.locator('tr', { hasText: 'Planned' }).first();
  const woSeriesNumber = (await row.getByText(/^WO-\d{4}-\d+$/).first().textContent()).trim();

  // Try Release first - only seed RM1's stock via the real Stock Transfer Receipt flow if it
  // actually reports insufficient material (confirmed live: seeding unconditionally, or via the
  // backend API directly, is either wasteful or doesn't satisfy this check at all - see
  // 03-work-order.spec.js's TC-WO-04 for the full reasoning).
  await woPage.openView(woSeriesNumber);
  const releaseOutcome = await woPage.release();
  if (releaseOutcome === 'insufficient_material') {
    const releaseMaterial = woData.releaseMaterial;
    await seedMaterialStockViaReceipt(new StockTransferPage(page), {
      itemName: releaseMaterial.itemName,
      availableQuantity: releaseMaterial.availableQuantity,
      location: woData.location,
    });
    await woPage.openView(woSeriesNumber);
    expect(await woPage.release()).toBe('released');
  }

  await woPage.issueMaterial();

  await woPage.openView(woSeriesNumber);
  await woPage.openBuildForm();
  const boSeriesNumber = await buildOrderPage.fillAndSave({
    quantity: woData.quantity,
    finishedGoodCost: 100,
  });

  await buildOrderPage.openView(boSeriesNumber);
  await buildOrderPage.markCompleted();

  return boSeriesNumber;
}

test.describe.serial('Manufacturing - Unbuild Order', () => {
  test.describe.configure({ timeout: 150000 });

  let page;
  let woPage;
  let bomPage;
  let buildOrderPage;
  let unbuildOrderPage;
  let seriesNumber; // carried through Create -> View -> Edit -> Adjust Inventory attempt

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    woPage = new WorkOrderPage(page);
    bomPage = new BillOfMaterialPage(page);
    buildOrderPage = new BuildOrderPage(page);
    unbuildOrderPage = new UnbuildOrderPage(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── TC-UO-01: Create (from a Completed Build Order, via Save To Draft) ─────────────────────
  test('TC-UO-01 [+] Create an Unbuild Order from a Completed Build Order', { tag: '@smoke' }, async () => {
    const boSeriesNumber = await createCompletedBuildOrder(page, woPage, bomPage, buildOrderPage);

    await buildOrderPage.openUnbuildForm();
    seriesNumber = await unbuildOrderPage.fillAndSaveAsDraft({ quantityToUnbuild: uoData.quantityToUnbuild });
    expect(seriesNumber).toMatch(/^UO-\d{4}-\d+$/);
  });

  // ── TC-UO-02: View ─────────────────────────────────────────────────────────────────────────
  test('TC-UO-02 [+] View Unbuild Order - verify saved field values and available actions', async () => {
    test.skip(!seriesNumber, 'requires TC-UO-01 to have created a record first');

    await unbuildOrderPage.openView(seriesNumber);

    await expect(page.getByText(seriesNumber, { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    // Rendered as a fixed 2-decimal value ("5.00"), confirmed live - not the plain integer.
    await expect(page.getByText(`${uoData.quantityToUnbuild}.00`, { exact: true }).first()).toBeVisible();

    // "Adjust Inventory" only appears once In progress (confirmed live) - not yet on Draft.
    await expect(unbuildOrderPage.editButton).toBeVisible();
    await expect(unbuildOrderPage.adjustInventoryButton).not.toBeVisible();
    await unbuildOrderPage.openActions();
    await expect(unbuildOrderPage.deleteMenuItem).toBeVisible();
    await page.keyboard.press('Escape');
  });

  // ── TC-UO-03: Edit ─────────────────────────────────────────────────────────────────────────
  // Draft -> In progress. Edit's own "Save" works correctly here (confirmed live: a real PUT) -
  // only the CREATE page's own Save is broken (see file/class header comments).
  test('TC-UO-03 [+] Edit a Draft Unbuild Order - Save moves it to In progress', async () => {
    test.skip(!seriesNumber, 'requires TC-UO-01 to have created a record first');

    await unbuildOrderPage.openEdit(seriesNumber);
    await unbuildOrderPage.save();

    await unbuildOrderPage.openView(seriesNumber);
    await expect(page.getByText('In progress', { exact: true })).toBeVisible();
    await expect(unbuildOrderPage.adjustInventoryButton).toBeVisible();
  });

  // ── TC-UO-04: Complete (Materials Trace Detail -> Adjust Inventory -> Mark Completed) ────────
  test('TC-UO-04 [+] Completing an In progress Unbuild Order moves it to Completed', async () => {
    test.skip(!seriesNumber, 'requires TC-UO-03 to have moved the record to In progress first');

    await unbuildOrderPage.completeUnbuild(seriesNumber);

    await unbuildOrderPage.openView(seriesNumber);
    await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  });

  // ── TC-UO-05: Delete ───────────────────────────────────────────────────────────────────────
  // Uses its own, separate Draft record (Delete is available on Draft, confirmed live via Actions
  // menu in TC-UO-02) rather than the one TC-UO-01..04 carried through to Completed.
  test('TC-UO-05 [+] Delete a Draft Unbuild Order', async () => {
    const boSeriesNumber = await createCompletedBuildOrder(page, woPage, bomPage, buildOrderPage);
    await buildOrderPage.openUnbuildForm();
    const deleteSeriesNumber = await unbuildOrderPage.fillAndSaveAsDraft({ quantityToUnbuild: uoData.quantityToUnbuild });

    await unbuildOrderPage.openView(deleteSeriesNumber);
    await unbuildOrderPage.deleteRecord();

    await expect(page).toHaveURL(/\/dashboard\/manufacturing\/orders\/unbuild-order(\?.*)?$/);
    await expect(page.locator('tr', { hasText: deleteSeriesNumber })).toHaveCount(0);
  });

  // ── TC-UO-06: Direct creation (no Work Order/Build Order link) ─────────────────────────────
  // Confirms the OTHER creation path works as far as the app currently allows: select an Item
  // directly, self-heal a BOM for it if missing (matching WorkOrderPage.ensureBomForItem()'s own
  // established pattern), then carry the record through Draft -> In progress.
  //
  // Stops at "In progress" rather than calling completeUnbuild() - confirmed live (re-verified
  // directly via request payload logging after this session's materials-serialization fix
  // attempt) that a direct-creation Unbuild Order's Materials array is NEVER included in any
  // save-draft/edit payload, unlike the Build-Order-linked path (TC-UO-01..04) where materials
  // resolve server-side from the linked Build Order's own already-persisted consumption records.
  // With no Materials row ever actually saved, the Edit page's own Materials grid stays "No Data"
  // permanently for this path, so confirmMaterialsTraceDetail() (completeUnbuild()'s own first
  // step) has no row to click - there is currently no way to reach "Completed" without a linked
  // Build Order. Revisit this once that gap is fixed - completeUnbuild() itself needs no changes.
  test('TC-UO-06 [+] Create an Unbuild Order directly, without linking a Work Order or Build Order', async () => {
    await unbuildOrderPage.gotoAdd();
    await unbuildOrderPage.selectItem(); // first available - same "not pinned" reasoning as elsewhere
    const itemText = await unbuildOrderPage.getSelectedItemText();

    await unbuildOrderPage.ensureBomForItem(bomPage, itemText);
    // ensureBomForItem() leaves us on a fresh Add form with the same item re-selected either way -
    // select whichever BOM is now available for it.
    await unbuildOrderPage.selectLocation(woData.location);
    await unbuildOrderPage.selectDropdown('bom_id');
    await unbuildOrderPage.waitForMaterialsRow();

    const directSeriesNumber = await unbuildOrderPage.fillAndSaveAsDraft({ quantityToUnbuild: uoData.quantityToUnbuild });
    expect(directSeriesNumber).toMatch(/^UO-\d{4}-\d+$/);

    await unbuildOrderPage.openView(directSeriesNumber);
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();

    await unbuildOrderPage.openEdit(directSeriesNumber);
    await unbuildOrderPage.save();
    await unbuildOrderPage.openView(directSeriesNumber);
    await expect(page.getByText('In progress', { exact: true })).toBeVisible();
  });
});
