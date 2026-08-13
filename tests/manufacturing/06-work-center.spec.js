// Work Center (dashboard/manufacturing/settings/work-centers) - Manufacturing module's sixth
// spec, second step of the Work Center Categories -> Work Center -> Operation and Equipments ->
// Routing sequence. Same plain master-data CRUD shape as Work Center Category (no approval
// workflow) - see pages/WorkCenterPage.js's own header comment for the full field/behavior
// breakdown (only Name and Location are required; the Equipment Details grid stays empty until
// Operation and Equipments exists; two confirmed live app quirks documented there too).
const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const WorkCenterPage = require('../../pages/WorkCenterPage');

const wcData = testData.manufacturing.workCenter;

test.describe.serial('Manufacturing - Work Center', () => {
  test.describe.configure({ timeout: 150000 });

  let page;
  let wcPage;
  let seriesNumber; // carried through Create -> View -> Edit
  // The Location field's own search is confirmed live to be unreliable (see pages/WorkCenterPage.js
  // -> helpers/dropdown.js) - selectLocation(wcData.location) can legitimately fall back to
  // "first available" instead of matching wcData.location exactly. Capture what was ACTUALLY
  // selected right after choosing it, and assert against that on View - not the requested literal.
  let selectedLocationText;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    wcPage = new WorkCenterPage(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── TC-WC-01: Create ───────────────────────────────────────────────────────────────────────
  test('TC-WC-01 [+] Create a Work Center directly (no Draft)', { tag: '@smoke' }, async () => {
    const name = `Automation_WC_${Date.now()}`;

    await wcPage.goto();
    await wcPage.fillHeader({ name, narration: 'Automation test work center' });
    await wcPage.selectLocation(wcData.location);
    selectedLocationText = await wcPage.getFieldDisplayText('location');

    seriesNumber = await wcPage.save();
    expect(seriesNumber).toMatch(/^WC-\d+$/);
  });

  // ── TC-WC-02: View ─────────────────────────────────────────────────────────────────────────
  test('TC-WC-02 [+] View Work Center - verify saved field values and available actions', async () => {
    test.skip(!seriesNumber, 'requires TC-WC-01 to have created a record first');

    await wcPage.openView(seriesNumber);

    await expect(page.getByText(seriesNumber, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(selectedLocationText, { exact: true }).first()).toBeVisible();
    // Created directly via Save (not Save To Draft) - no "Draft" chip should appear.
    await expect(page.getByText('Draft', { exact: true })).not.toBeVisible();

    await expect(wcPage.editButton).toBeVisible();
    await expect(wcPage.deleteButton).toBeVisible();
  });

  // ── TC-WC-03: Edit ─────────────────────────────────────────────────────────────────────────
  test('TC-WC-03 [+] Edit a Work Center - update Narration', async () => {
    test.skip(!seriesNumber, 'requires TC-WC-01 to have created a record first');
    const updatedNarration = `Automation_Updated_${Date.now()}`;

    await wcPage.openEdit(seriesNumber);
    await wcPage.fillHeader({ narration: updatedNarration });
    await wcPage.saveEdit();

    await wcPage.openView(seriesNumber);
    await expect(page.getByText(updatedNarration, { exact: true }).first()).toBeVisible();
  });

  // ── TC-WC-04: Save To Draft ────────────────────────────────────────────────────────────────
  // Unlike Work Center Category, Work Center's own View/List pages never render a "Draft"
  // indicator at all (confirmed live - no chip anywhere, even though the create response's own
  // `is_draft: true` proves the backend tracks it) - this test can only verify the record via
  // save-as-draft still creates successfully and remains fully editable, not that any visible
  // status changes.
  test('TC-WC-04 [+] Save To Draft creates a record via the save-as-draft endpoint', async () => {
    const draftName = `Automation_WC_Draft_${Date.now()}`;

    await wcPage.goto();
    await wcPage.fillHeader({ name: draftName });
    await wcPage.selectLocation(wcData.location);

    const draftSeriesNumber = await wcPage.saveToDraft();
    expect(draftSeriesNumber).toMatch(/^WC-\d+$/);

    await wcPage.openView(draftSeriesNumber);
    await expect(page.getByText(draftName, { exact: true }).first()).toBeVisible();

    await wcPage.openEdit(draftSeriesNumber);
    await wcPage.saveEdit();

    await wcPage.openView(draftSeriesNumber);
    await expect(page.getByText(draftName, { exact: true }).first()).toBeVisible();
  });

  // ── TC-WC-05: Delete ───────────────────────────────────────────────────────────────────────
  // Uses its own, separate record rather than the one TC-WC-01..03 carried through Edit - no
  // status restricts Delete here (confirmed live: available on both plain-saved and Draft
  // records), but a fresh record keeps this test independent of the others' own state.
  test('TC-WC-05 [+] Delete a Work Center', async () => {
    const deleteName = `Automation_WC_ForDelete_${Date.now()}`;

    await wcPage.goto();
    await wcPage.fillHeader({ name: deleteName });
    await wcPage.selectLocation(wcData.location);
    const deleteSeriesNumber = await wcPage.save();

    await wcPage.openView(deleteSeriesNumber);
    await wcPage.deleteRecord();

    await expect(page).toHaveURL(/\/dashboard\/manufacturing\/settings\/work-centers(\?.*)?$/);
    await expect(page.locator('tr', { hasText: deleteSeriesNumber })).toHaveCount(0);
  });
});
