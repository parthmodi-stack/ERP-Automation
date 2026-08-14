// Seeds real, Available stock for a manufacturing material via the actual Stock Transfer
// "Receipt" UI flow (Add -> Track Detail's own Lot/Serial Number traceability -> Mark as to do ->
// Validate) - confirmed live that seeding directly via the backend API (POST inventory/v1/stock,
// apiSeed.js's seedStock) does NOT satisfy Work Order Release's own material-availability check;
// only a fully-Validated Receipt does (see tests/manufacturing/03-work-order.spec.js's TC-WO-04
// for how this was originally discovered).
//
// Call this ONLY when Release/a similar check has already failed with "insufficient material" -
// per explicit instruction, don't run it unconditionally on every run just because a pinned
// material (e.g. RM1) COULD theoretically be depleted by prior runs' consumption.
async function seedMaterialStockViaReceipt(stockTransfer, { itemName, availableQuantity, location }) {
  const page = stockTransfer.page;

  await stockTransfer.openAdd();
  await stockTransfer.selectEmployee();
  await stockTransfer.selectOperationType('Receipt');
  await stockTransfer.selectDestinationLocation(location);
  await stockTransfer.goToOperationalDetailTab();
  await stockTransfer.addOperationItem({
    item: itemName,
    requestQuantity: String(availableQuantity),
    rate: '10',
    transferQuantity: String(availableQuantity),
  });
  await stockTransfer.save();
  await page.waitForURL('**/operations/stock-transfer', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await stockTransfer.waitForListLoaded();
  const receiptId = await stockTransfer.getIdForRow(location);

  await stockTransfer.gotoView(receiptId);
  await stockTransfer.markAsToDoButton.click();
  await stockTransfer.confirmDialog.waitFor({ state: 'visible' });
  await stockTransfer.confirmDialogAction('Submit');

  await stockTransfer.selectTab('Operational Detail');
  await stockTransfer.addTrackDetail({ itemName, quantity: availableQuantity });
  await stockTransfer.validate();
}

module.exports = { seedMaterialStockViaReceipt };
