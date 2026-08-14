// Operation (dashboard/manufacturing/settings/operations) - Manufacturing module's eighth spec,
// fourth step of the Work Center Categories -> Work Center -> Operation and Equipments -> Routing
// sequence. Requires both a Work Center Category (for its own Costing Details grid's "Category"
// column - confirmed live this is where WCC actually gets referenced/used, not directly on Work
// Center itself) and a Work Center - this file creates both fresh as setup, matching
// 07-equipment.spec.js's own "create a dedicated Work Center per spec" pattern, keeping this suite
// self-contained.
//
// Only Operation Name, Work Centre, Location, and at least one Costing Details row (with Category
// selected) are required - see pages/OperationPage.js's own header comment for the full field/
// behavior breakdown, including two confirmed live quirks shared with other modules in this
// sequence (no visible "Draft" chip anywhere despite `is_draft: true`, matching Work Center's own
// gap; and the Delete dialog's own title says "Delete Item" instead of "Delete Operation").
const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const WorkCenterCategoryPage = require('../../pages/WorkCenterCategoryPage');
const WorkCenterPage = require('../../pages/WorkCenterPage');
const OperationPage = require('../../pages/OperationPage');

const wcData = testData.manufacturing.workCenter;
const wccData = testData.manufacturing.workCenterCategory;

test.describe.serial('Manufacturing - Operation', () => {
  test.describe.configure({ timeout: 150000 });

  let page;
  let wccPage;
  let wcPage;
  let opPage;
  let workCentreName;
  let categoryName;
  let seriesNumber; // carried through Create -> View -> Edit
  // Location's own search is confirmed live to be unreliable - selectLocation(wcData.location) can
  // legitimately fall back to "first available" instead of matching wcData.location exactly.
  // Capture what was ACTUALLY selected and assert against that on View, not the requested literal.
  let selectedLocationText;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    wccPage = new WorkCenterCategoryPage(page);
    wcPage = new WorkCenterPage(page);
    opPage = new OperationPage(page);

    // Dedicated Work Center Category (for Costing Details' own "Category" column) and Work Center
    // for this suite's own Operation records to reference.
    categoryName = `Automation_WCC_ForOperation_${Date.now()}`;
    await wccPage.goto();
    await wccPage.fillHeader({ name: categoryName });
    await wccPage.selectType(wccData.type);
    await wccPage.selectItem();
    await wccPage.save();

    workCentreName = `Automation_WC_ForOperation_${Date.now()}`;
    await wcPage.goto();
    await wcPage.fillHeader({ name: workCentreName });
    await wcPage.selectLocation(wcData.location);
    await wcPage.save();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── TC-OP-01: Create ───────────────────────────────────────────────────────────────────────
  test('TC-OP-01 [+] Create an Operation with one Costing Details row', { tag: '@smoke' }, async () => {
    const name = `Automation_OP_${Date.now()}`;

    await opPage.goto();
    await opPage.fillHeader({ name, narration: 'Automation test operation' });
    await opPage.selectWorkCentre(workCentreName);
    await opPage.selectLocation(wcData.location);
    selectedLocationText = await opPage.getFieldDisplayText('location');
    await opPage.addCostingRow({ categoryName });

    seriesNumber = await opPage.save();
    expect(seriesNumber).toMatch(/^OP-\d+$/);
  });

  // ── TC-OP-02: View ─────────────────────────────────────────────────────────────────────────
  test('TC-OP-02 [+] View Operation - verify saved field values and available actions', async () => {
    test.skip(!seriesNumber, 'requires TC-OP-01 to have created a record first');

    await opPage.openView(seriesNumber);

    await expect(page.getByText(seriesNumber, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(workCentreName, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(selectedLocationText, { exact: true }).first()).toBeVisible();

    await expect(opPage.editButton).toBeVisible();
    await expect(opPage.deleteButton).toBeVisible();
  });

  // ── TC-OP-03: Edit ─────────────────────────────────────────────────────────────────────────
  test('TC-OP-03 [+] Edit an Operation - update Narration', async () => {
    test.skip(!seriesNumber, 'requires TC-OP-01 to have created a record first');
    const updatedNarration = `Automation_Updated_${Date.now()}`;

    await opPage.openEdit(seriesNumber);
    await opPage.fillHeader({ narration: updatedNarration });
    await opPage.saveEdit();

    await opPage.openView(seriesNumber);
    await expect(page.getByText(updatedNarration, { exact: true }).first()).toBeVisible();
  });

  // ── TC-OP-04: Save To Draft ────────────────────────────────────────────────────────────────
  // Same "no visible Draft indicator anywhere" gap as Work Center (confirmed live) - this test
  // can only verify the record via save-as-draft still creates successfully and remains fully
  // editable, not that any visible status changes (see class header comment).
  test('TC-OP-04 [+] Save To Draft creates a record via the save-as-draft endpoint', async () => {
    const draftName = `Automation_OP_Draft_${Date.now()}`;

    await opPage.goto();
    await opPage.fillHeader({ name: draftName });
    await opPage.selectWorkCentre(workCentreName);
    await opPage.selectLocation(wcData.location);
    await opPage.addCostingRow({ categoryName });

    const draftSeriesNumber = await opPage.saveToDraft();
    expect(draftSeriesNumber).toMatch(/^OP-\d+$/);

    await opPage.openView(draftSeriesNumber);
    await expect(page.getByText(draftName, { exact: true }).first()).toBeVisible();

    await opPage.openEdit(draftSeriesNumber);
    await opPage.saveEdit();

    await opPage.openView(draftSeriesNumber);
    await expect(page.getByText(draftName, { exact: true }).first()).toBeVisible();
  });

  // ── TC-OP-05: Delete ───────────────────────────────────────────────────────────────────────
  // Uses its own, separate record rather than the one TC-OP-01..03 carried through Edit - no
  // status restricts Delete here (confirmed live), but a fresh record keeps this test
  // independent of the others' own state.
  test('TC-OP-05 [+] Delete an Operation', async () => {
    const deleteName = `Automation_OP_ForDelete_${Date.now()}`;

    await opPage.goto();
    await opPage.fillHeader({ name: deleteName });
    await opPage.selectWorkCentre(workCentreName);
    await opPage.selectLocation(wcData.location);
    await opPage.addCostingRow({ categoryName });
    const deleteSeriesNumber = await opPage.save();

    await opPage.openView(deleteSeriesNumber);
    await opPage.deleteRecord();

    await expect(page).toHaveURL(/\/dashboard\/manufacturing\/settings\/operations(\?.*)?$/);
    await expect(page.locator('tr', { hasText: deleteSeriesNumber })).toHaveCount(0);
  });
});
