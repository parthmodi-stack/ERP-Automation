// Routing (dashboard/manufacturing/settings/routing) - Manufacturing module's ninth spec, final
// step of the Work Center Categories -> Work Center -> Operation and Equipments -> Routing
// sequence. Ties together every module built earlier: Work Center Category (via Operation's own
// Costing Details), Work Center, an approved Bill of Material, and Operation - this file creates
// all of them fresh as setup, keeping this suite self-contained.
//
// Field relationship is the REVERSE of Work Order/Unbuild Order's own "select Item, then BOM gets
// scoped to it" - here you select Bill of Material FIRST, and Item auto-fills/stays disabled. See
// pages/RoutingPage.js's own header comment for the full field/behavior breakdown, including the
// confirmed live quirk that Routing Details (at least one row required) fails SILENTLY on Save
// with zero rows - no error message, no network request at all, unlike Operation's own visible
// "Atleast one costing details is required".
const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const WorkCenterCategoryPage = require('../../pages/WorkCenterCategoryPage');
const WorkCenterPage = require('../../pages/WorkCenterPage');
const OperationPage = require('../../pages/OperationPage');
const BillOfMaterialPage = require('../../pages/BillOfMaterialPage');
const RoutingPage = require('../../pages/RoutingPage');

const wcData = testData.manufacturing.workCenter;
const wccData = testData.manufacturing.workCenterCategory;
const bomData = testData.manufacturing.billOfMaterial;

test.describe.serial('Manufacturing - Routing', () => {
  test.describe.configure({ timeout: 150000 });

  let page;
  let wccPage;
  let wcPage;
  let opPage;
  let bomPage;
  let routingPage;
  let workCentreName;
  let operationName;
  let bomName;
  let seriesNumber; // carried through Create -> View -> Edit
  // Location's own search is confirmed live to be unreliable - selectLocation(wcData.location) can
  // legitimately fall back to "first available" instead of matching wcData.location exactly.
  // Capture what was ACTUALLY selected and assert against that on View, not the requested literal.
  let selectedLocationText;

  test.beforeAll(async ({ browser }) => {
    // describe.configure's own 150000ms timeout above governs test bodies, not this hook - it
    // defaults to the global 60000ms config timeout instead. This chain (Work Center Category ->
    // Work Center -> Operation -> an Approved Bill of Material) already ran close to that budget
    // before; each dropdown selection now goes through the shared, more thorough helpers/
    // dropdown.js engine (search -> exact-match -> first-available fallback -> verify), which adds
    // real per-call latency over the old bare click-and-hope logic - bump explicitly rather than
    // let it flake.
    test.setTimeout(150000);
    page = await browser.newPage();
    wccPage = new WorkCenterCategoryPage(page);
    wcPage = new WorkCenterPage(page);
    opPage = new OperationPage(page);
    bomPage = new BillOfMaterialPage(page);
    routingPage = new RoutingPage(page);

    // Work Center Category, for Operation's own Costing Details row.
    const categoryName = `Automation_WCC_ForRouting_${Date.now()}`;
    await wccPage.goto();
    await wccPage.fillHeader({ name: categoryName });
    await wccPage.selectType(wccData.type);
    await wccPage.selectItem();
    await wccPage.save();

    // Work Center, for both Operation's own header and Routing Details' own row.
    workCentreName = `Automation_WC_ForRouting_${Date.now()}`;
    await wcPage.goto();
    await wcPage.fillHeader({ name: workCentreName });
    await wcPage.selectLocation(wcData.location);
    await wcPage.save();

    // Operation, for Routing Details' own row.
    operationName = `Automation_OP_ForRouting_${Date.now()}`;
    await opPage.goto();
    await opPage.fillHeader({ name: operationName });
    await opPage.selectWorkCentre(workCentreName);
    await opPage.selectLocation(wcData.location);
    await opPage.addCostingRow({ categoryName });
    await opPage.save();

    // A real, Approved Bill of Material with one Material row - Routing's own "Raw Materials"
    // dropdown is scoped to whichever BOM is selected, so it needs a real material to offer.
    bomName = `Automation_BOM_ForRouting_${Date.now()}`;
    await bomPage.goto();
    await bomPage.selectItem();
    await bomPage.fillHeader({
      name: bomName,
      quantity: bomData.quantity,
      startDate: '01-08-2026',
      endDate: '31-12-2027',
    });
    await bomPage.selectUOM();
    await bomPage.addMaterialRow({ quantity: bomData.materialQuantity });
    await bomPage.save();
    const bomRow = page.locator('tr', { hasText: bomName });
    const bomSeriesNumber = (await bomRow.getByText(/^BOM-\d+$/).first().textContent()).trim();
    await bomPage.openView(bomSeriesNumber);
    await bomPage.submitForApproval();
    await bomPage.approve();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── TC-RT-01: Create ───────────────────────────────────────────────────────────────────────
  test('TC-RT-01 [+] Create a Route with one Routing Details row', { tag: '@smoke' }, async () => {
    const name = `Automation_RT_${Date.now()}`;

    await routingPage.goto();
    await routingPage.fillHeader({ name, narration: 'Automation test route' });
    await routingPage.selectBOM(bomName);
    await routingPage.selectLocation(wcData.location);
    selectedLocationText = await routingPage.getFieldDisplayText('routing.location_id');
    await routingPage.addRoutingDetailRow({ operationName, sequence: 1, workCentreName });

    seriesNumber = await routingPage.save();
    expect(seriesNumber).toMatch(/^RT-\d+$/);
  });

  // ── TC-RT-02: View ─────────────────────────────────────────────────────────────────────────
  test('TC-RT-02 [+] View Route - verify saved field values and available actions', async () => {
    test.skip(!seriesNumber, 'requires TC-RT-01 to have created a record first');

    await routingPage.openView(seriesNumber);

    await expect(page.getByText(seriesNumber, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(bomName, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(selectedLocationText, { exact: true }).first()).toBeVisible();

    await expect(routingPage.editButton).toBeVisible();
    await expect(routingPage.deleteButton).toBeVisible();
  });

  // ── TC-RT-03: Edit ─────────────────────────────────────────────────────────────────────────
  test('TC-RT-03 [+] Edit a Route - update Narration', async () => {
    test.skip(!seriesNumber, 'requires TC-RT-01 to have created a record first');
    const updatedNarration = `Automation_Updated_${Date.now()}`;

    await routingPage.openEdit(seriesNumber);
    await routingPage.fillHeader({ narration: updatedNarration });
    // Location must be re-selected - the Edit page never hydrates it from the saved record
    // (confirmed live - see RoutingPage.js's own header/saveEdit() comments).
    await routingPage.saveEdit({ location: wcData.location });

    await routingPage.openView(seriesNumber);
    await expect(page.getByText(updatedNarration, { exact: true }).first()).toBeVisible();
  });

  // ── TC-RT-04: Save To Draft ────────────────────────────────────────────────────────────────
  // Same "no visible Draft indicator anywhere" gap as Work Center/Operation (confirmed live) -
  // this test can only verify the record via save-as-draft still creates successfully and
  // remains fully editable, not that any visible status changes (see class header comment).
  test('TC-RT-04 [+] Save To Draft creates a record via the save-as-draft endpoint', async () => {
    const draftName = `Automation_RT_Draft_${Date.now()}`;

    await routingPage.goto();
    await routingPage.fillHeader({ name: draftName });
    await routingPage.selectBOM(bomName);
    await routingPage.selectLocation(wcData.location);
    await routingPage.addRoutingDetailRow({ operationName, sequence: 1, workCentreName });

    const draftSeriesNumber = await routingPage.saveToDraft();
    expect(draftSeriesNumber).toMatch(/^RT-\d+$/);

    await routingPage.openView(draftSeriesNumber);
    await expect(page.getByText(draftName, { exact: true }).first()).toBeVisible();

    await routingPage.openEdit(draftSeriesNumber);
    await routingPage.saveEdit({ location: wcData.location });

    await routingPage.openView(draftSeriesNumber);
    await expect(page.getByText(draftName, { exact: true }).first()).toBeVisible();
  });

  // ── TC-RT-05: Delete ───────────────────────────────────────────────────────────────────────
  // Uses its own, separate record rather than the one TC-RT-01..03 carried through Edit - no
  // status restricts Delete here (confirmed live), but a fresh record keeps this test
  // independent of the others' own state.
  test('TC-RT-05 [+] Delete a Route', async () => {
    const deleteName = `Automation_RT_ForDelete_${Date.now()}`;

    await routingPage.goto();
    await routingPage.fillHeader({ name: deleteName });
    await routingPage.selectBOM(bomName);
    await routingPage.selectLocation(wcData.location);
    await routingPage.addRoutingDetailRow({ operationName, sequence: 1, workCentreName });
    const deleteSeriesNumber = await routingPage.save();

    await routingPage.openView(deleteSeriesNumber);
    await routingPage.deleteRecord();

    await expect(page).toHaveURL(/\/dashboard\/manufacturing\/settings\/routing(\?.*)?$/);
    await expect(page.locator('tr', { hasText: deleteSeriesNumber })).toHaveCount(0);
  });
});
