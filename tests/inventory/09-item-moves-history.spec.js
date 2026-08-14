const { test, expect } = require('@playwright/test');
const ItemsPage = require('../../pages/ItemsPage');
const crmChain = require('../../config/crmChain');

// ── TC-IMH-01: Verify an item's Moves History shows its Stock Transfer (In), Purchase (In), and
// Sales (Out) movements ───────────────────────────────────────────────────────────────────────
// Cross-checks the SAME item used by tests/01-erpforce-full-inventory-to-procurement.spec.js
// (TC-FULLFLOW-01 - a Stock Transfer "In" movement, plus a separate Purchase Order -> GRN receipt
// "In" movement) and tests/02-erpforce-crm-lead-to-delivery-order.spec.js (TC-CRMFULL-01 - Sales
// Order -> Delivery Order dispatch, an "Out" movement) via config/crmChain.js's own fullFlowItem/
// fullFlowPurchaseQuantity/fullFlowTransferQuantity/crmSalesItemQuantity hand-off. Requires BOTH
// of those to have already run in the same session (this test does not build the chain itself -
// rebuilding it just to check a read-only report page would cost ~10+ minutes for no added
// coverage).
//
// The Stock Transfer's own "In" row and the PO/GRN's own "In" row can coincidentally carry the
// SAME quantity (both default to 10 in config/testData.js), so a quantity-only match can't tell
// them apart - it would pass even if one of the two rows were silently missing, as long as the
// other one's quantity happened to satisfy it. Each movement's own lot number prefix is unique
// (see LOT_NUMBER / P2P_CONFIG.lotSerialNumber in 01-erpforce-full-inventory-to-procurement.spec.js),
// so match on quantity AND lot prefix together for an unambiguous, specific check of all 3 rows.
test.describe('Inventory Item - Moves History', () => {

  test('TC-IMH-01 [+] Item Moves History shows Stock Transfer (In), Purchase Order/GRN (In), and Sales/Delivery Order (Out) movements', { tag: '@smoke2' }, async ({ page }) => {
    test.setTimeout(60000);

    const chain = crmChain.load();
    test.skip(
      !chain.fullFlowItem || !chain.fullFlowPurchaseQuantity || !chain.fullFlowTransferQuantity || !chain.crmSalesItemQuantity,
      'Requires TC-FULLFLOW-01 and TC-CRMFULL-01 to have both run first this session (config/crmChain.js is missing fullFlowItem/fullFlowPurchaseQuantity/fullFlowTransferQuantity/crmSalesItemQuantity).',
    );

    const items = new ItemsPage(page);
    await items.openItemByName(chain.fullFlowItem);
    await items.goToMovesHistoryTab();

    const rows = await items.getMovesHistoryRows();
    console.log('DEBUG Moves History rows for', chain.fullFlowItem, ':', JSON.stringify(rows));

    const expectedTransferQuantity = String(chain.fullFlowTransferQuantity);
    const expectedPurchaseQuantity = String(chain.fullFlowPurchaseQuantity);
    const expectedOutQuantity = `-${chain.crmSalesItemQuantity}`;
    const transferLotPrefix = chain.fullFlowTransferLotPrefix || 'LOT-FULL-';
    const purchaseLotPrefix = chain.fullFlowPurchaseLotPrefix || 'LOT-P2P-FULL-';

    const transferMove = rows.find((r) => r.moveType === 'In' && r.quantity === expectedTransferQuantity && r.lotSerialNumber.startsWith(transferLotPrefix));
    const purchaseMove = rows.find((r) => r.moveType === 'In' && r.quantity === expectedPurchaseQuantity && r.lotSerialNumber.startsWith(purchaseLotPrefix));
    const outMove = rows.find((r) => r.moveType === 'Out' && r.quantity === expectedOutQuantity);

    expect(transferMove, `Expected an "In" move with quantity ${expectedTransferQuantity} and lot prefix "${transferLotPrefix}" (this run's real Stock Transfer) - rows: ${JSON.stringify(rows)}`).toBeTruthy();
    expect(purchaseMove, `Expected an "In" move with quantity ${expectedPurchaseQuantity} and lot prefix "${purchaseLotPrefix}" (this run's real Purchase Order/GRN receipt) - rows: ${JSON.stringify(rows)}`).toBeTruthy();
    expect(outMove, `Expected an "Out" move with quantity ${expectedOutQuantity} (this run's real Sales Order/Delivery Order dispatch) - rows: ${JSON.stringify(rows)}`).toBeTruthy();

    console.log('🎉 Verified item', chain.fullFlowItem, '- In (Stock Transfer):', transferMove.quantity, '| In (PO/GRN):', purchaseMove.quantity, '| Out (Sales/Delivery):', outMove.quantity);
  });

});
