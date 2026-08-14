// Bill of Material (dashboard/manufacturing/bill-of-material) - Manufacturing module's second
// spec. Unlike Demand Planning (01-demand-planning.spec.js), this IS a genuine CRUD/document
// screen - confirmed live: real Add/View/Edit/Delete/Duplicate actions, its Save button carries
// `form="bom"` matching the same backend-form-driven convention CLAUDE.md documents for
// Accounting's Settings-entity screens, AND a full approval workflow (see below) matching the
// same Submit/Accept pattern used elsewhere in this repo (Procurement, Accounting).
//
// Two field-order gotchas confirmed live and encoded in pages/BillOfMaterialPage.js (see its own
// header comment for the reasoning): selecting Item resets the Name field to an auto-generated
// default, so Name must be filled AFTER selectItem(); and a Materials row isn't part of the form
// until its own row-level save (disk) icon is clicked, not just the page's main Save.
//
// Approval workflow, confirmed live: clicking the Add form's "Save" (not "Save To Draft") submits
// straight to Pending status. From there: Pending --(Submit)--> Submitted --(Accept, then confirm
// the "Approved request" dialog's own Submit button)--> Approved. Edit/Actions/Submit are ALL
// available on a Pending record (Actions -> Duplicate/Delete). Once Approved, Delete is no longer
// offered (confirmed live: an Approved record's Actions menu only has Duplicate) - so TC-BOM-06
// (Delete) uses its OWN separate record created fresh and deleted while still Pending, rather than
// the one TC-BOM-01 through TC-BOM-05 carry through the full Submit/Approve lifecycle.
const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const BillOfMaterialPage = require('../../pages/BillOfMaterialPage');

const bomData = testData.manufacturing.billOfMaterial;

async function createBom(bomPage, page, { name, quantity }) {
  await bomPage.goto();
  // Item first - selecting it auto-generates Name, so fillHeader's own name overwrite must come
  // after (see pages/BillOfMaterialPage.js's own header comment).
  await bomPage.selectItem();
  // End Date MUST be set explicitly and be AFTER Start Date - confirmed live (a costly find):
  // leaving End Date untouched defaults it to TODAY, and if that's before your own Start Date
  // (as an earlier version of this helper did), the BOM saves and can even reach Approved status
  // with no validation error, but is then silently excluded from Work Order's own "Bill of
  // Material" picker for that item (confirmed by comparing against BOM-0087, a real BOM with a
  // valid Start < End range that DOES appear there) - a BOM with a broken date range isn't
  // usable downstream even though nothing about creating it looked wrong at the time.
  await bomPage.fillHeader({ name, quantity, startDate: '01-08-2026', endDate: '31-12-2027' });
  await bomPage.selectUOM();
  await bomPage.addMaterialRow({ quantity: bomData.materialQuantity });
  await bomPage.save();

  const row = page.locator('tr', { hasText: name });
  await expect(row).toBeVisible();
  await expect(row.getByText('Pending')).toBeVisible();

  // The ID column isn't the row's first <td> (this table's own row structure has a leading
  // expand/checkbox cell, confirmed live) - match the BOM-XXXX pattern directly instead of
  // relying on column position.
  const seriesNumber = (await row.getByText(/^BOM-\d+$/).first().textContent()).trim();
  expect(seriesNumber).toMatch(/^BOM-\d+$/);
  return seriesNumber;
}

test.describe.serial('Manufacturing - Bill of Material', () => {
  test.describe.configure({ timeout: 150000 });

  let page;
  let bomPage;
  let seriesNumber; // carried through Create -> View -> Edit -> Submit -> Approve (TC-BOM-01..05)

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    bomPage = new BillOfMaterialPage(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── TC-BOM-01: Create ───────────────────────────────────────────────────────────────────────
  test('TC-BOM-01 [+] Create a Bill of Material with one Material row', { tag: '@smoke' }, async () => {
    const bomName = `Automation_BOM_${Date.now()}`;
    seriesNumber = await createBom(bomPage, page, { name: bomName, quantity: bomData.quantity });
  });

  // ── TC-BOM-02: View ─────────────────────────────────────────────────────────────────────────
  test('TC-BOM-02 [+] View Bill of Material - verify saved field values and available actions', async () => {
    test.skip(!seriesNumber, 'requires TC-BOM-01 to have created a record first');

    await bomPage.openView(seriesNumber);

    // Not `exact: true` - the breadcrumb's ID text can carry a stray zero-width-space artifact
    // (the same MUI quirk BasePage's own field readers already strip elsewhere in this repo).
    await expect(page.getByText(seriesNumber, { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Pending', { exact: true })).toBeVisible();
    await expect(page.getByText(String(bomData.quantity), { exact: true }).first()).toBeVisible();

    // Edit/Actions/Submit are all available on a Pending record (confirmed live).
    await expect(bomPage.editButton).toBeVisible();
    await expect(bomPage.submitButton).toBeVisible();
    await bomPage.openActions();
    await expect(bomPage.duplicateMenuItem).toBeVisible();
    await expect(bomPage.deleteMenuItem).toBeVisible();
    await page.keyboard.press('Escape');
  });

  // ── TC-BOM-03: Edit ─────────────────────────────────────────────────────────────────────────
  test('TC-BOM-03 [+] Edit a Pending Bill of Material - update Quantity', async () => {
    test.skip(!seriesNumber, 'requires TC-BOM-01 to have created a record first');
    const updatedQuantity = bomData.quantity + 5;

    await bomPage.openEdit(seriesNumber);
    await bomPage.fillHeader({ quantity: updatedQuantity });
    await bomPage.save();

    await bomPage.openView(seriesNumber);
    await expect(page.getByText(String(updatedQuantity), { exact: true }).first()).toBeVisible();
  });

  // ── TC-BOM-04: Submit for Approval ──────────────────────────────────────────────────────────
  test('TC-BOM-04 [+] Submit moves a Pending Bill of Material to Submitted', async () => {
    test.skip(!seriesNumber, 'requires TC-BOM-01 to have created a record first');

    await bomPage.openView(seriesNumber);
    await bomPage.submitForApproval();

    await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
    await expect(bomPage.acceptButton).toBeVisible();
  });

  // ── TC-BOM-05: Accept/Approve ────────────────────────────────────────────────────────────────
  test('TC-BOM-05 [+] Accepting a Submitted Bill of Material approves it, after which Delete is no longer offered', async () => {
    test.skip(!seriesNumber, 'requires TC-BOM-04 to have submitted the record first');

    await bomPage.approve();

    await expect(page.getByText('Approved', { exact: true })).toBeVisible();
    await bomPage.openActions();
    await expect(bomPage.duplicateMenuItem).toBeVisible();
    await expect(bomPage.deleteMenuItem).not.toBeVisible();
    await page.keyboard.press('Escape');
  });

  // ── TC-BOM-06: Delete ───────────────────────────────────────────────────────────────────────
  // Uses its own, separate record (Delete is only available on Pending - see class/file header
  // comments), rather than the one TC-BOM-01..05 carried through to Approved.
  test('TC-BOM-06 [+] Delete a Pending Bill of Material', async () => {
    const deleteName = `Automation_BOM_ForDelete_${Date.now()}`;
    const deleteSeriesNumber = await createBom(bomPage, page, { name: deleteName, quantity: bomData.quantity });

    await bomPage.openView(deleteSeriesNumber);
    await bomPage.deleteRecord();

    await expect(page).toHaveURL(/\/dashboard\/manufacturing\/bill-of-material(\?.*)?$/);
    await expect(page.locator('tr', { hasText: deleteSeriesNumber })).toHaveCount(0);
  });
});
