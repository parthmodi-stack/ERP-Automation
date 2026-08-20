const CrmDeliveryOrderPage = require('../../../pages/CrmDeliveryOrderPage');
const CustomerReturnPage = require('../../../pages/CustomerReturnPage');

// Customer Returns' "Return Delivery" flow (CustomerReturnPage's own header comment - "way 3" of
// the three ways a Customer Return can be created) needs a Delivered CRM Delivery Order that can
// still actually be returned. Two separate, CONFIRMED LIVE reasons a given candidate can fail:
// 1. A Delivery Order's own status chip stays "Delivered" even AFTER it's been fully used for a
//    return - the Return Delivery button itself just stops rendering once fully used, with no
//    other visible signal on the list/view page.
// 2. Even when the button IS still visible, the order may have already been PARTIALLY returned -
//    the button doesn't disappear until fully consumed, but the resulting form's item entries
//    still pre-fill to the full ORIGINALLY delivered quantity, not the remaining returnable one,
//    so Save gets rejected with "Return quantity for item <id> exceeds allowed limit. Delivered:
//    X, Already Returned: Y, Available to Return: Z, Requested: X". Rather than burning through
//    this environment's fixed, ever-shrinking pool of pre-existing Delivered orders by skipping to
//    a fresh candidate every time (2), parse Z straight out of that message and clamp the item's
//    own quantity down to it via CustomerReturnPage.editFirstItemQuantity(), then retry Save on
//    the SAME candidate - only actually move on to a different Delivery Order for (1), or if Z
//    itself is 0 (nothing left to return here at all).
// This environment already has many pre-existing Delivered orders (real fixture data, not
// something this suite creates itself) - scan those rather than building a brand-new Lead ->
// Opportunity -> Quotation -> Sales Order -> Delivery Order chain (that chain-building helper,
// createDeliveryOrderFromFreshSalesOrder, has its own unrelated, currently-live flakiness in
// LeadPage.js's Address tab - out of scope here, left as-is per explicit instruction not to touch
// it).
async function createCustomerReturnViaReturnDelivery(page, { maxCandidates = 15 } = {}) {
  const delivery = new CrmDeliveryOrderPage(page);
  await delivery.gotoList();
  await page.waitForTimeout(500);

  const rows = page.locator('tbody tr').filter({ hasNotText: 'Add Calculation' }).filter({ hasText: 'Delivered' });
  const rowCount = Math.min(await rows.count(), maxCandidates);
  if (rowCount === 0) {
    throw new Error('createCustomerReturnViaReturnDelivery: no Delivered rows found on the Delivery Orders list at all.');
  }

  const ids = [];
  for (let i = 0; i < rowCount; i++) {
    const href = await rows.nth(i).locator('a').first().getAttribute('href').catch(() => null);
    const id = href && (href.match(/\/delivery-orders\/(\d+)\//) || [])[1];
    if (id) ids.push(id);
  }

  const attemptErrors = [];
  for (const deliveryOrderId of ids) {
    await delivery.openViewById(deliveryOrderId);
    const buttonAvailable = await delivery.returnDeliveryButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (!buttonAvailable) continue;

    await delivery.returnDeliveryButton.click();
    const navigated = await page.waitForURL('**/add-customer-returns', { timeout: 15000 }).then(() => true).catch(() => false);
    if (!navigated) {
      attemptErrors.push(`${deliveryOrderId}: Return Delivery click didn't reach the Add Customer Return form`);
      continue;
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const cr = new CustomerReturnPage(page);
    // Up to one retry on this SAME candidate after clamping quantity down to what's available.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await cr.saveAndCaptureId();
        return { deliveryOrderId, cr, ...result };
      } catch (e) {
        const match = e.message.match(/Available to Return:\s*([\d.]+)/i);
        if (match && attempt === 1) {
          const available = Number(match[1]);
          if (available <= 0) {
            attemptErrors.push(`${deliveryOrderId}: nothing left to return (${e.message})`);
            break;
          }
          await cr.editFirstItemQuantity(available);
          continue; // retry Save on this same candidate with the clamped quantity
        }
        attemptErrors.push(`${deliveryOrderId}: ${e.message}`);
        break;
      }
    }
  }

  throw new Error(
    `createCustomerReturnViaReturnDelivery: none of ${ids.length} Delivered candidates could complete a return:\n${attemptErrors.join('\n')}`,
  );
}

module.exports = { createCustomerReturnViaReturnDelivery };
