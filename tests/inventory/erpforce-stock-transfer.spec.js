const { test, expect } = require('@playwright/test');
const StockTransferPage = require('../../pages/StockTransferPage');
const testData = require('../../config/testData');

// Extends TC-ST-04/06/07 in 03-bin.spec.js's sibling 08-stock-transfer.spec.js (create -> Ready ->
// Validate-is-blocked) all the way through the traceability process to Done. Runs standalone -
// creates its own Stock Transfer rather than depending on 08-stock-transfer.spec.js's createdId,
// since that variable isn't shared across files and this suite's own convention (see
// createApprovedPurchaseRequest.js) is for cross-file flows to build their own fixture instead of
// reaching into another spec file's state.
const data = testData.stockTransfer.valid;
const LOT_NUMBER = `LOT-ST-${Date.now()}`;

test.describe('ERPForce: Draft Stock Transfer to Done', () => {
  test('TC-ST-10 [+] Full cycle: Draft -> Ready -> Lot/Serial tracking -> Validate -> Done', { tag: '@smoke' }, async ({ page }) => {
    test.setTimeout(150000);

    const stockTransfer = new StockTransferPage(page);

    // ---------- 0. Navigate via the app's own UI (dashboard -> Inventory -> Stock Transfer) ----------
    // CONFIRMED LIVE: deep-linking straight to /dashboard/inventory/operations/stock-transfer as
    // the very first navigation of a fresh page/context can leave the SPA stuck on its own bare
    // loading spinner indefinitely - warming the shell up via the dashboard first (the same way a
    // real user would arrive) avoids it entirely, whereas 08-stock-transfer.spec.js never hits this
    // because its beforeAll already navigates through LocationPage first.
    await page.goto(`${testData.baseUrl}/dashboard`, { timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

    // ---------- 1. Create a Draft Stock Transfer ----------
    await stockTransfer.openAdd();
    await stockTransfer.selectEmployee();
    await stockTransfer.selectOperationType(data.operationType);
    // Pick whichever destination location is first available rather than testData's exact
    // name - this spec runs standalone and doesn't ensure that fixture location exists first
    // (unlike 08-stock-transfer.spec.js's beforeAll), so the exact name can legitimately not
    // exist yet on a given run. Read back whichever one actually got selected so the row can be
    // found by that same text afterward.
    await stockTransfer.selectDestinationLocation('');
    const destinationLocation = (await page
      .locator('[id="mui-component-select-add_stock_transfer.destination_location_id"]')
      .innerText()).trim();

    await stockTransfer.goToOperationalDetailTab();
    await stockTransfer.addOperationItem({
      item: '',
      requestQuantity: data.requestQuantity,
      rate: data.rate,
      transferQuantity: data.transferQuantity,
    });

    await stockTransfer.save();
    await page.waitForURL('**/operations/stock-transfer', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await stockTransfer.waitForListLoaded();

    const createdId = await stockTransfer.getIdForRow(destinationLocation);
    expect(createdId).toBeTruthy();
    console.log('DEBUG created Stock Transfer id:', createdId);

    // ---------- 2. Mark as to do (Draft -> Ready) ----------
    await stockTransfer.gotoView(createdId);
    await stockTransfer.markAsToDoButton.click();
    await stockTransfer.confirmDialogAction('Submit');
    await expect(page.locator('.viewStockTransfer--StatusChip--ready')).toBeVisible({ timeout: 10000 });

    console.log('✅ Step 2 – Marked as to do, status Ready');

    // ---------- 3. Operational Detail tab ----------
    await stockTransfer.selectTab('Operational Detail');

    console.log('✅ Step 3 – Operational Detail tab open');

    // ---------- 4. Open Track Detail for the item row ----------
    const trackDetailIndex = await page.getByRole('columnheader', { name: 'Track Detail' }).evaluate(
      (th) => Array.from(th.parentElement.children).indexOf(th)
    );
    const itemRow = page.locator('table tbody tr').first();
    await itemRow.locator('td').nth(trackDetailIndex).locator('button, svg, a').first().click();
    const trackDetailModal = page.getByRole('dialog').filter({ hasText: 'Track Detail' });
    await expect(trackDetailModal).toBeVisible();

    const requestQty = (await trackDetailModal.getByText('Request', { exact: true })
      .locator('xpath=following-sibling::*[1]').first().textContent() || '').trim();

    console.log('✅ Step 4 – Track Detail opened, Request quantity:', requestQty);

    // ---------- 5. Add a Lot/Serial entry ----------
    await trackDetailModal.getByRole('button', { name: 'Add', exact: true }).click();
    const lotSerialModal = page.getByRole('dialog').filter({ hasText: 'Lot/Serial number' });
    await expect(lotSerialModal).toBeVisible();

    // ---------- 6. Create a new Lot/Serial number ----------
    const lotSerialCombobox = lotSerialModal.getByText('Lot/Serial number *', { exact: true }).first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    await lotSerialCombobox.click();
    await page.getByPlaceholder('Search Lot/Serial number').fill(LOT_NUMBER);
    await page.waitForTimeout(500);
    await page.getByText('Create New Lot/Serial number', { exact: true }).click();
    await page.waitForTimeout(500);

    // "Create New Lot/Serial number" opens a further "Add Lot Number" modal on top - Type only
    // ever offers "Lot Number" on this dev environment's items, so pick it explicitly rather than
    // assuming index 0. The option renders in a portal outside the dialog's own DOM subtree (same
    // MUI popper pattern as selectMuiField), so it must be queried page-scoped, not dialog-scoped.
    const addLotNumberModal = page.getByRole('dialog').filter({ hasText: 'Add Lot Number' });
    await expect(addLotNumberModal).toBeVisible();
    await addLotNumberModal.getByText('Select Lot Number').click();
    await page.getByRole('option', { name: 'Lot Number', exact: true }).click();
    await addLotNumberModal.getByPlaceholder('Enter Lot Number').fill(LOT_NUMBER);
    await addLotNumberModal.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);

    console.log('✅ Step 6 – Created new Lot/Serial number:', LOT_NUMBER);

    // ---------- 7. Select the newly created lot and set its Quantity ----------
    // Saving "Add Lot Number" returns to the still-open Lot/Serial number modal, where the new lot
    // now appears as a selectable option in the (still open) dropdown - select it, then fill
    // Quantity (required; Bin number is left unset - this org's dev data has no bins to pick from
    // for this item/location, and Bin itself isn't required to Save).
    await page.getByText(LOT_NUMBER, { exact: true }).last().click();
    await page.waitForTimeout(300);
    await lotSerialModal.locator('input[name="add_stock_transfer.quantity"]').fill(data.transferQuantity);
    await lotSerialModal.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);

    console.log('✅ Step 7 – Lot/Serial number selected, Quantity set to', data.transferQuantity);

    // ---------- 8. Save Track Detail ----------
    await trackDetailModal.getByRole('button', { name: 'Save' }).click();
    await expect(trackDetailModal).toBeHidden({ timeout: 8000 });

    console.log('✅ Step 8 – Track Detail saved');

    // ---------- 9. Validate (Ready -> Done) ----------
    await stockTransfer.validateButton.click();
    await expect(
      page.getByText('Are you sure you want to mark Stock Transfer as Done ?')
    ).toBeVisible({ timeout: 5000 });
    await stockTransfer.confirmDialogAction('Submit');

    await expect(page.locator('.viewStockTransfer--StatusChip--done')).toBeVisible({ timeout: 10000 });

    console.log('✅ Step 9 – Validated, status Done');
  });
});
