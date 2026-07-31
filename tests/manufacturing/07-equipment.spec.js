// Equipment (dashboard/manufacturing/settings/equipments) - Manufacturing module's seventh spec,
// third step of the Work Center Categories -> Work Center -> Operation and Equipments -> Routing
// sequence. Unlike Work Center Category/Work Center (plain master data, no status), Equipment has
// a real status workflow: Save -> Pending, Save To Draft -> Draft (WITH a visible chip - Equipment
// does not have Work Center's own "Draft chip never renders" gap) --(Edit -> Save)--> Pending. See
// pages/EquipmentPage.js's own header comment for the full field/behavior breakdown.
//
// Work Centre is required and references a real Work Center record - this file creates its own
// dedicated Work Center as setup (via WorkCenterPage, matching 03-work-order.spec.js's own
// "create a fresh dependency per spec" pattern) rather than relying on "first available" existing
// data, keeping this spec self-contained and independent of other suites' own churn.
const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const WorkCenterPage = require('../../pages/WorkCenterPage');
const EquipmentPage = require('../../pages/EquipmentPage');

const wcData = testData.manufacturing.workCenter;
const eqData = testData.manufacturing.equipment;

test.describe.serial('Manufacturing - Equipment', () => {
  test.describe.configure({ timeout: 150000 });

  let page;
  let wcPage;
  let eqPage;
  let workCentreName;
  let seriesNumber; // carried through Create -> View -> Edit

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    wcPage = new WorkCenterPage(page);
    eqPage = new EquipmentPage(page);

    // Dedicated Work Center for this suite's own Equipment records to reference.
    workCentreName = `Automation_WC_ForEquipment_${Date.now()}`;
    await wcPage.goto();
    await wcPage.fillHeader({ name: workCentreName });
    await wcPage.selectLocation(wcData.location);
    await wcPage.save();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── TC-EQ-01: Create ───────────────────────────────────────────────────────────────────────
  test('TC-EQ-01 [+] Create an Equipment directly (status Pending)', { tag: '@smoke' }, async () => {
    const name = `Automation_EQ_${Date.now()}`;

    await eqPage.goto();
    await eqPage.fillHeader({ name, narration: 'Automation test equipment' });
    await eqPage.selectEquipmentCategory(eqData.category);
    await eqPage.selectWorkCentre(workCentreName);

    seriesNumber = await eqPage.save();
    expect(seriesNumber).toMatch(/^EQ-\d+$/);
  });

  // ── TC-EQ-02: View ─────────────────────────────────────────────────────────────────────────
  test('TC-EQ-02 [+] View Equipment - verify saved field values and status', async () => {
    test.skip(!seriesNumber, 'requires TC-EQ-01 to have created a record first');

    await eqPage.openView(seriesNumber);

    await expect(page.getByText(seriesNumber, { exact: false }).first()).toBeVisible();
    // "Pending" renders TWICE (confirmed live: the status chip AND a redundant "Status" field
    // further down in General Detail) - .first() rather than assuming a single match.
    await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(eqData.category, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(workCentreName, { exact: true }).first()).toBeVisible();

    await expect(eqPage.editButton).toBeVisible();
    await expect(eqPage.deleteButton).toBeVisible();
  });

  // ── TC-EQ-03: Edit ─────────────────────────────────────────────────────────────────────────
  test('TC-EQ-03 [+] Edit an Equipment - update Narration', async () => {
    test.skip(!seriesNumber, 'requires TC-EQ-01 to have created a record first');
    const updatedNarration = `Automation_Updated_${Date.now()}`;

    await eqPage.openEdit(seriesNumber);
    await eqPage.fillHeader({ narration: updatedNarration });
    await eqPage.saveEdit();

    await eqPage.openView(seriesNumber);
    await expect(page.getByText(updatedNarration, { exact: true }).first()).toBeVisible();
  });

  // ── TC-EQ-04: Save To Draft, then Edit -> Save transitions Draft -> Pending ─────────────────
  test('TC-EQ-04 [+] Save To Draft creates a Draft record, and Edit -> Save moves it to Pending', async () => {
    const draftName = `Automation_EQ_Draft_${Date.now()}`;

    await eqPage.goto();
    await eqPage.fillHeader({ name: draftName });
    await eqPage.selectEquipmentCategory(eqData.category);
    await eqPage.selectWorkCentre(workCentreName);

    const draftSeriesNumber = await eqPage.saveToDraft();
    expect(draftSeriesNumber).toMatch(/^EQ-\d+$/);

    await eqPage.openView(draftSeriesNumber);
    // "Draft"/"Pending" each render TWICE (status chip + redundant "Status" field - see TC-EQ-02's
    // own comment) - .first() throughout rather than assuming a single match.
    await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();

    await eqPage.openEdit(draftSeriesNumber);
    await eqPage.saveEdit();

    await eqPage.openView(draftSeriesNumber);
    await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
  });

  // ── TC-EQ-05: Delete ───────────────────────────────────────────────────────────────────────
  // Uses its own, separate record rather than the one TC-EQ-01..03 carried through Edit - no
  // status restricts Delete here (confirmed live: available on both Pending and Draft records),
  // but a fresh record keeps this test independent of the others' own state.
  test('TC-EQ-05 [+] Delete an Equipment', async () => {
    const deleteName = `Automation_EQ_ForDelete_${Date.now()}`;

    await eqPage.goto();
    await eqPage.fillHeader({ name: deleteName });
    await eqPage.selectEquipmentCategory(eqData.category);
    await eqPage.selectWorkCentre(workCentreName);
    const deleteSeriesNumber = await eqPage.save();

    await eqPage.openView(deleteSeriesNumber);
    await eqPage.deleteRecord();

    await expect(page).toHaveURL(/\/dashboard\/manufacturing\/settings\/equipments(\?.*)?$/);
    await expect(page.locator('tr', { hasText: deleteSeriesNumber })).toHaveCount(0);
  });
});
