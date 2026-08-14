// Demand Planning's precondition data (Inventory Item + Reordering Rule + Stock) has one gap
// with no UI path at all: creating stock from zero. Inventory Adjustment's "Available Quantity"
// field is read-only (confirmed live - it corrects Reserve/Back Order against EXISTING stock, not
// new stock), and there's no dedicated Reordering Rules endpoint either (only nested inside the
// Inventory Item payload, per the app's own backend). This helper seeds that one gap directly
// against the backend API the frontend itself calls, authenticated with the same session's own
// token - everything else (item + reordering rule) goes through the real UI.
const testData = require('../config/testData');

// The frontend stores its auth token in localStorage under `_tid` and sends it as the `x-token`
// header (confirmed live via network capture - NOT `Authorization: Bearer`, which this backend
// rejects with 401).
async function getAuthToken(page) {
  const token = await page.evaluate(() => window.localStorage.getItem('_tid'));
  if (!token) {
    throw new Error('No _tid auth token in localStorage - is this page using the shared auth.json session?');
  }
  return token;
}

// Mirrors `POST inventory/v1/stock` from the reverse-engineered backend summary. locationId must
// be the exact same numeric id used on the item's Reordering Rule (see
// DemandPlanningPage.addReorderingRule's return value) - a mismatch here is the documented cause
// of the item silently vanishing from Demand Planning's summary.
async function seedStock(page, { itemId, availableQuantity, locationId }) {
  const token = await getAuthToken(page);
  const response = await page.request.post(`${testData.manufacturing.apiBaseUrl}/inventory/v1/stock`, {
    headers: { 'x-token': token },
    data: { item_id: itemId, available_quantity: availableQuantity, location_id: locationId },
  });
  if (!response.ok()) {
    throw new Error(`Stock seed failed (${response.status()}): ${await response.text()}`);
  }
  return (await response.json()).data.stock;
}

module.exports = { getAuthToken, seedStock };
