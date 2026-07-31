// Work Center Categories (dashboard/manufacturing/settings/work-center-categories) -
// Manufacturing module's fifth spec, first of a new sub-flow: Work Center Categories -> Work
// Center -> Operation and Equipments -> Routing. This screen groups Work Centers by Type
// (Labour/Machine/Overhead) and is used FROM Work Center itself - no approval workflow, a plain
// master-data CRUD screen (Add/Edit/Delete only), matching Inventory's own master-data
// page-object tier rather than the document-lifecycle modules built so far in this directory.
//
// Two creation paths, BOTH confirmed working: "Save" creates directly (no status chip); "Save To
// Draft" creates with a "Draft" chip (`is_draft: true`, confirmed live) - Edit's own Save works
// for either and clears the Draft chip if present. See pages/WorkCenterCategoryPage.js's own
// header comment for the two confirmed live app quirks (a real typo in the page title, and a
// stray "$" prefix on the View page's own ID heading) - neither is a mistake introduced here.
const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const WorkCenterCategoryPage = require('../../pages/WorkCenterCategoryPage');

const wccData = testData.manufacturing.workCenterCategory;

test.describe.serial('Manufacturing - Work Center Categories', () => {
  test.describe.configure({ timeout: 150000 });

  let page;
  let wccPage;
  let seriesNumber; // carried through Create -> View -> Edit

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    wccPage = new WorkCenterCategoryPage(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── TC-WCC-01: Create ──────────────────────────────────────────────────────────────────────
  test('TC-WCC-01 [+] Create a Work Center Category directly (no Draft)', { tag: '@smoke' }, async () => {
    const name = `Automation_WCC_${Date.now()}`;

    await wccPage.goto();
    await wccPage.fillHeader({ name, narration: 'Automation test category' });
    await wccPage.selectType(wccData.type);
    await wccPage.selectItem(); // first available - see file header comment

    seriesNumber = await wccPage.save();
    expect(seriesNumber).toMatch(/^WCC-\d+$/);
  });

  // ── TC-WCC-02: View ────────────────────────────────────────────────────────────────────────
  test('TC-WCC-02 [+] View Work Center Category - verify saved field values and available actions', async () => {
    test.skip(!seriesNumber, 'requires TC-WCC-01 to have created a record first');

    await wccPage.openView(seriesNumber);

    await expect(page.getByText(seriesNumber, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(wccData.type, { exact: true }).first()).toBeVisible();
    // Created directly via Save (not Save To Draft) - no "Draft" chip should appear.
    await expect(page.getByText('Draft', { exact: true })).not.toBeVisible();

    await expect(wccPage.editButton).toBeVisible();
    await expect(wccPage.deleteButton).toBeVisible();
  });

  // ── TC-WCC-03: Edit ────────────────────────────────────────────────────────────────────────
  test('TC-WCC-03 [+] Edit a Work Center Category - update Narration', async () => {
    test.skip(!seriesNumber, 'requires TC-WCC-01 to have created a record first');
    const updatedNarration = `Automation_Updated_${Date.now()}`;

    await wccPage.openEdit(seriesNumber);
    await wccPage.fillHeader({ narration: updatedNarration });
    await wccPage.saveEdit();

    await wccPage.openView(seriesNumber);
    await expect(page.getByText(updatedNarration, { exact: true }).first()).toBeVisible();
  });

  // ── TC-WCC-04: Save To Draft, then Edit clears the Draft chip ─────────────────────────────
  test('TC-WCC-04 [+] Save To Draft creates a Draft record, and Edit -> Save clears the Draft chip', async () => {
    const draftName = `Automation_WCC_Draft_${Date.now()}`;

    await wccPage.goto();
    await wccPage.fillHeader({ name: draftName });
    await wccPage.selectType(wccData.type);
    await wccPage.selectItem();

    const draftSeriesNumber = await wccPage.saveToDraft();
    expect(draftSeriesNumber).toMatch(/^WCC-\d+$/);

    await wccPage.openView(draftSeriesNumber);
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();

    await wccPage.openEdit(draftSeriesNumber);
    await wccPage.saveEdit();

    await wccPage.openView(draftSeriesNumber);
    await expect(page.getByText('Draft', { exact: true })).not.toBeVisible();
  });

  // ── TC-WCC-05: Delete ──────────────────────────────────────────────────────────────────────
  // Uses its own, separate record rather than the one TC-WCC-01..03 carried through Edit - no
  // status restricts Delete here (confirmed live: available on both plain-saved and Draft
  // records), but a fresh record keeps this test independent of the others' own state.
  test('TC-WCC-05 [+] Delete a Work Center Category', async () => {
    const deleteName = `Automation_WCC_ForDelete_${Date.now()}`;

    await wccPage.goto();
    await wccPage.fillHeader({ name: deleteName });
    await wccPage.selectType(wccData.type);
    await wccPage.selectItem();
    const deleteSeriesNumber = await wccPage.save();

    await wccPage.openView(deleteSeriesNumber);
    await wccPage.deleteRecord();

    await expect(page).toHaveURL(/\/dashboard\/manufacturing\/settings\/work-center-categories(\?.*)?$/);
    await expect(page.locator('tr', { hasText: deleteSeriesNumber })).toHaveCount(0);
  });
});
