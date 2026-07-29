// Demand Planning (dashboard/manufacturing/demand-planning) - Manufacturing module, first spec
// ever written for this module (tests/manufacturing/ was empty before this file).
//
// Unlike every other module's suite, this is NOT a CRUD screen (create/view/edit/duplicate/
// delete) - it's a read-only reporting view: pick filters, get back a shortfall summary computed
// from Inventory Item + Reordering Rule + Stock data that lives in OTHER modules. So instead of
// the standard CRUD recipe (SKILLS.md §1), this file's shape is: seed real precondition data
// (mostly via the real UI, one gap via direct API - see below), then assert what Demand Planning's
// UI reports for it.
//
// ── Precondition data: how it's created, and why ──────────────────────────────────────────────
// 1. Inventory Item + Reordering Rule: fully UI-driven, via the same Add Inventory Item wizard as
//    tests/inventory/07-inventory-item.spec.ts, extended to actually fill the "Reordering Rules"
//    tab (that file's own comment notes this tab is only ever clicked through, never filled).
//    Adding a rule turns out to require Create -> Save -> Edit -> Reordering Rules -> "Add" (a
//    row-level Add button that is NOT present during initial creation, confirmed live) - fill
//    Location/Minimum Quantity/Maximum Quantity there, then Save.
// 2. Stock (the item's available_quantity at that location): there is NO complete UI path for
//    this, confirmed live two different ways - (a) Inventory Adjustment's own "Available
//    Quantity" field is permanently disabled/read-only wherever it's reached (it corrects
//    Reserve/Back Order against EXISTING stock, not new stock) and (b) it never even resolves to
//    a non-zero value after a full Save. So this one step calls the backend API directly
//    (helpers/apiSeed.js) using the same authenticated session's own token - everything else in
//    this file stays UI-driven.
// 3. Purchase Request (TC-DP-03's netting case): reuses the existing, working
//    pages/ProcurementRequestPage.js UI flow rather than a raw API call, so it never needs to
//    resolve numeric company/currency IDs blind.
//
// ── The critical correctness caveat this suite exists partly to guard ─────────────────────────
// Demand Planning's reorder point comes from `reordering_rules.minimum_quantity`, joined to the
// stock row as `LEFT JOIN reordering_rules rr ON wl.id = rr.location_id AND rr.item_id =
// sd.item_id`. If the Reordering Rule's location_id doesn't EXACTLY match the stock row's
// location_id, the join misses, reorder_point resolves NULL, and the backend's own `if
// (item.reorder_point === null) return;` silently drops the item from the summary - no error, it
// just never appears. TC-DP-02 below deliberately reproduces this mismatch to guard it as a real
// regression case, not just prose in a comment.
//
// ── Environment-specific fixture drift (read before "fixing" a failing selection) ─────────────
// This environment's real master data differs from what other specs in this repo assume:
// 07-inventory-item.spec.ts's CATEGORY='Electronics'/DEPARTMENT='Test Operations' and
// testData.procurementRequest's purchaseRepresentative='QA  Nikita' do NOT exist here (confirmed
// live via dropdown-option dumps) - config/testData.js's manufacturing.demandPlanning section
// below uses values confirmed live against THIS environment instead. If this suite ever runs
// against a different environment, re-dump each dropdown's real options before assuming these
// still apply.
const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const DemandPlanningPage = require('../../pages/DemandPlanningPage');
const ProcurementRequestPage = require('../../pages/ProcurementRequestPage');
const { seedStock } = require('../../helpers/apiSeed');

const dp = testData.manufacturing.demandPlanning;

async function waitForIdle(page, ms = 1200) {
  await page.waitForTimeout(ms);
}

// Same `mui-component-select-add_inventory_item.<field>` / `menu-add_inventory_item.<field>`
// pattern as 07-inventory-item.spec.ts's own selectFromDropdown, with one fix: that file's
// version can mis-click a disabled "Select ..." placeholder when the typed search text is itself
// a substring of the placeholder's own label (confirmed live - "Unit" matches "Select Unit of
// Measurement"), so this scopes to non-disabled options and matches the exact accessible name.
async function selectFromDropdown(page, fieldName, optionText) {
  await page.locator(`[id="mui-component-select-add_inventory_item.${fieldName}"]`).click();
  const menu = page.locator(`[id="menu-add_inventory_item.${fieldName}"]`);
  await menu.waitFor({ state: 'visible', timeout: 5000 });
  await expect(async () => {
    expect(await menu.locator('li').count()).toBeGreaterThan(1);
  }).toPass({ timeout: 8000, intervals: [300] });

  if (optionText) {
    await menu.locator('input').fill(optionText);
    await waitForIdle(page, 600);
    await menu.locator('li[aria-disabled="false"], li:not([aria-disabled])')
      .filter({ hasText: new RegExp(`^${optionText}$`) })
      .first()
      .click();
  } else {
    await menu.locator('li').nth(1).click();
  }
  await menu.waitFor({ state: 'hidden', timeout: 5000 });
}

// Creates a real Inventory Item + Reordering Rule via the actual UI (Add wizard, then Edit ->
// Reordering Rules -> Add row) and returns { itemId, locationId } - locationId is read back from
// the saved rule's own hidden input rather than assumed, so callers get the exact numeric id this
// environment resolved "location" to (needed to either match it for a real shortfall, or
// deliberately mismatch it for TC-DP-02).
async function createItemWithReorderingRule(page, { itemName, sku, location, minimumQuantity, maximumQuantity }) {
  await page.goto('/dashboard/inventory/product-management/items');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.waitForURL('**/add-inventory-item');
  await page.waitForLoadState('networkidle');
  await waitForIdle(page);

  await page.getByPlaceholder('Enter Name').fill(itemName);
  await selectFromDropdown(page, 'category', dp.category);
  await selectFromDropdown(page, 'unit_of_measurement', dp.uom);
  await selectFromDropdown(page, 'costing_method', dp.costingMethod);
  await selectFromDropdown(page, 'location', location);
  await selectFromDropdown(page, 'department', dp.department);

  const skuInput = page.getByPlaceholder('Enter Number');
  await skuInput.fill(sku);
  // .fill() alone doesn't blur the field - this form's Next-enabled state doesn't recompute
  // until blur, confirmed live (Next stays disabled indefinitely without this).
  await page.keyboard.press('Tab');
  await waitForIdle(page, 2000);

  async function nextTo(label) {
    await page.getByRole('button', { name: 'Next' }).click();
    await waitForIdle(page);
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText(new RegExp(label, 'i'));
  }

  await nextTo('Rental Price');
  await nextTo('Sales');
  await page.getByPlaceholder('Enter Sales Price').fill(dp.salesPrice);
  await nextTo('Purchase');
  await nextTo('Accounting');
  // Default Tax and Income Account are required and NOT auto-defaulted in this environment
  // (Asset Account/COGS Account are pre-filled and can be skipped) - confirmed live.
  await selectFromDropdown(page, 'default_tax_id');
  await selectFromDropdown(page, 'income_account_id');
  await nextTo('Inventory');

  await page.getByPlaceholder('Enter Default Lead Time in Days').fill(dp.leadTime);
  await page.getByPlaceholder('Enter Weight').fill(dp.weight);
  await page.getByPlaceholder('Enter HSN Code').fill(dp.hsnCode);
  await page.getByPlaceholder('Enter Average Cost').fill(dp.averageCost);

  for (const tabName of ['Price Rules/Sales', 'Update Quantity', 'Moves History', 'Reordering Rules', 'Variant']) {
    await nextTo(tabName);
  }

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL('**/items', { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  await page.getByText(itemName, { exact: false }).first().click();
  await page.waitForURL('**/view-inventory-item', { timeout: 15000 });
  const itemId = Number(page.url().match(/items\/(\d+)\//)[1]);

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.waitForURL('**/edit-inventory-item', { timeout: 15000 });
  await page.getByRole('tab', { name: 'Reordering Rules' }).click();
  await waitForIdle(page);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await waitForIdle(page);

  await page.locator('[id="mui-component-select-reordering_rules.location"]').click();
  const locMenu = page.locator('[id="menu-reordering_rules.location"]');
  await locMenu.waitFor({ state: 'visible', timeout: 5000 });
  await expect(async () => {
    expect(await locMenu.locator('li').count()).toBeGreaterThan(1);
  }).toPass({ timeout: 8000, intervals: [300] });
  await locMenu.locator('input').fill(location);
  await waitForIdle(page, 600);
  await locMenu.locator('li[aria-disabled="false"], li:not([aria-disabled])')
    .filter({ hasText: new RegExp(`^${location}$`) })
    .first()
    .click();
  await locMenu.waitFor({ state: 'hidden', timeout: 5000 });

  await page.locator('input[name="reordering_rules.minimum_quantity"]').fill(String(minimumQuantity));
  await page.locator('input[name="reordering_rules.maximum_quantity"]').fill(String(maximumQuantity));
  await waitForIdle(page, 500);

  // Read back the numeric location id the rule actually saved with, rather than assuming it -
  // this is the exact value the backend's join needs to match against the stock row.
  const locationId = Number(await page.locator('input[name="reordering_rules.location"]').inputValue());

  await page.getByRole('button', { name: 'Save', exact: true }).last().click();
  await waitForIdle(page);
  await page.locator('button:has-text("Save")').first().click();
  await waitForIdle(page, 2000);

  return { itemId, locationId };
}

test.describe.serial('Manufacturing - Demand Planning', () => {
  test.describe.configure({ timeout: 150000 });

  let page;
  let demandPlanningPage;
  let mumbaiLocationId; // captured in TC-DP-01, reused by TC-DP-02 to build a deliberate mismatch

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    demandPlanningPage = new DemandPlanningPage(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── TC-DP-01: shortfall appears with the correct Required quantity ─────────────────────────
  test('TC-DP-01 [+] Item below its reordering rule minimum shows correct Required quantity', { tag: '@smoke' }, async () => {
    const itemName = `Automation_DemandPlanning_Item_${Date.now()}`;
    const sku = `SKU-DP-${Date.now()}`;

    const { itemId, locationId } = await createItemWithReorderingRule(page, {
      itemName,
      sku,
      location: dp.location,
      minimumQuantity: dp.minimumQuantity,
      maximumQuantity: dp.maximumQuantity,
    });
    mumbaiLocationId = locationId;

    const stock = await seedStock(page, {
      itemId,
      availableQuantity: dp.availableQuantity,
      locationId,
    });
    expect(stock.location_id).toBe(locationId); // confirm the seeded row actually landed at the right location

    await demandPlanningPage.goto();
    // Deliberately NOT using filterByItem() here - confirmed live it can silently resolve to a
    // DIFFERENT, older item when searched within roughly a minute of creation (see that method's
    // own doc comment). toggleShowBelowReorderPoint() alone already returns this brand-new item
    // correctly in its unfiltered response.
    await demandPlanningPage.toggleShowBelowReorderPoint(true);
    const body = demandPlanningPage.getLatestSummary();

    const summaryRow = body.data.summary_data.find((row) => row.item_id === itemId);
    expect(summaryRow, 'item should appear in the demand-planning summary').toBeTruthy();
    expect(summaryRow.required_quantity).toBe(dp.minimumQuantity - dp.availableQuantity);

    await expect(demandPlanningPage.rowByItemName(itemName)).toBeVisible();
    expect(await demandPlanningPage.getRequiredQuantity(itemName)).toBe(dp.minimumQuantity - dp.availableQuantity);
  });

  // ── TC-DP-02: mismatched location_id silently drops the item (regression guard) ────────────
  test('TC-DP-02 [-] Reordering Rule location mismatched with stock location hides the item entirely', async () => {
    test.skip(!mumbaiLocationId, 'requires TC-DP-01 to have captured a real location id first');

    const itemName = `Automation_DemandPlanning_Mismatch_${Date.now()}`;
    const sku = `SKU-DP-MISMATCH-${Date.now()}`;

    // Rule is created at mismatchLocation (Baroda); stock is deliberately seeded at
    // mumbaiLocationId instead of this item's OWN resolved location id - reproducing exactly the
    // join failure described in this file's header comment.
    const { itemId, locationId: barodaLocationId } = await createItemWithReorderingRule(page, {
      itemName,
      sku,
      location: dp.mismatchLocation,
      minimumQuantity: dp.minimumQuantity,
      maximumQuantity: dp.maximumQuantity,
    });
    expect(barodaLocationId).not.toBe(mumbaiLocationId); // sanity check the mismatch is real, not accidental

    await seedStock(page, {
      itemId,
      availableQuantity: dp.availableQuantity, // still below minimumQuantity - a real shortfall exists
      locationId: mumbaiLocationId, // deliberately the WRONG location id for this item's rule
    });

    await demandPlanningPage.goto();
    // No filterByItem() here either - see its doc comment; toggling alone is enough to check
    // presence/absence in the unfiltered reorder-point list.
    await demandPlanningPage.toggleShowBelowReorderPoint(true);

    expect(await demandPlanningPage.isItemVisible(itemName)).toBe(false);
  });

  // ── TC-DP-03: netting via a Purchase Request reduces/removes the shortfall (optional per the
  // original scenario) - uses Demand Planning's OWN real, intended path rather than Procurement's
  // standalone Add Request flow: its Detail view (openDetailView/selectDetailRow/
  // createPurchaseRequestFromSelection) lets you check a shortfall row and jump straight into
  // Procurement's Add Request page with Item/Quantity/Rate/Entity/Currency already pre-filled
  // from that row (confirmed live) - only Location still needs filling there, via
  // ProcurementRequestPage.selectLocation (itself fixed in pages/BasePage.js this round - see
  // createLocationFromFooter's own comments for the two real bugs found and fixed: an ambiguous
  // page-wide listbox query, and a broken .inputValue()-based verification that always triggered
  // the wrong fallback company). Whether a Draft (not yet Submitted/Approved) Purchase Request is
  // enough to net against demand is NOT confirmed live - if this fails for THAT reason, the most
  // likely fix is adding a Submit step before re-checking rather than treating it as a broken test.
  test('TC-DP-03 [+/-] Purchase Request covering the shortfall reduces the Required quantity', async () => {
    const itemName = `Automation_DemandPlanning_Netting_${Date.now()}`;
    const sku = `SKU-DP-NETTING-${Date.now()}`;

    const { itemId, locationId } = await createItemWithReorderingRule(page, {
      itemName,
      sku,
      location: dp.location,
      minimumQuantity: dp.minimumQuantity,
      maximumQuantity: dp.maximumQuantity,
    });
    await seedStock(page, { itemId, availableQuantity: dp.availableQuantity, locationId });

    await demandPlanningPage.goto();
    // No filterByItem() here either - see its doc comment.
    await demandPlanningPage.toggleShowBelowReorderPoint(true);
    const before = demandPlanningPage.getLatestSummary().data.summary_data.find((row) => row.item_id === itemId);
    expect(before.required_quantity).toBe(dp.minimumQuantity - dp.availableQuantity);

    await demandPlanningPage.openDetailView();
    await demandPlanningPage.selectDetailRow(itemName);
    await demandPlanningPage.createPurchaseRequestFromSelection();

    // Select the EXISTING "Mumbai" location directly rather than
    // ProcurementRequestPage.selectLocation()'s "always create a brand new one" behavior - that
    // method's own header comment justifies always-create as a workaround for a real search bug
    // (typing into this field's search box never actually filters), but a plain, unfiltered click
    // on the combobox already lists Mumbai directly (confirmed live) - no need to go through the
    // "+ Create New Location" dialog and its own Entity-selection quirks at all for a location
    // that already exists and is already visible without any typing.
    const locationLabel = page.getByText('Location *', { exact: true })
      .or(page.getByText('crm.salesOrder.fields.location_label *', { exact: true }));
    const locationCombobox = locationLabel.locator('xpath=following::*[@role="combobox"][1]');
    await locationCombobox.click();
    await page.getByRole('option', { name: dp.pr.location, exact: true }).click();

    const procurementRequestPage = new ProcurementRequestPage(page);
    await procurementRequestPage.saveAsDraft();

    await demandPlanningPage.goto();
    await demandPlanningPage.toggleShowBelowReorderPoint(true);
    const after = demandPlanningPage.getLatestSummary().data.summary_data.find((row) => row.item_id === itemId);

    // Either the item drops out entirely (fully netted) or its required_quantity decreases -
    // accept both since the backend summary this suite was built from described it that way.
    if (after) {
      expect(after.required_quantity).toBeLessThan(before.required_quantity);
    }
  });

  // ── TC-DP-04/05: filter UI behavior, no seeded data required ────────────────────────────────
  test('TC-DP-04 [-] Clear All resets an applied Item filter back to its placeholder', async () => {
    await demandPlanningPage.goto();
    await demandPlanningPage.itemFilterTrigger.click();
    await page.keyboard.press('Escape');
    await demandPlanningPage.clearAll();
    await expect(demandPlanningPage.itemFilterTrigger).toHaveText(/Search Item/);
  });

  // Below-reorder-point items (Reordering Rule shortfalls, TC-DP-01/02/03's own test items) and
  // Production/Procurement-type general-demand items (TC-DP-06's pinned item) are DISJOINT
  // categories, confirmed live - unchecking does NOT simply broaden the same list to a superset,
  // so this only asserts the toggle actually reaches the backend with the correct `is_reorder`
  // flag each time and both states return a valid list, not a row-count ordering between them
  // (an earlier version of this test wrongly assumed "unchecked >= checked" and failed live once
  // enough Production-type items existed to make checked > unchecked).
  test('TC-DP-05 [-] Toggling "Show Below Reorder Point" sends the correct is_reorder flag and returns a valid list either way', async () => {
    const requestPayloads = [];
    const captureRequest = (req) => {
      if (req.url().includes('demand-planning/summary') && req.method() === 'POST') {
        try {
          requestPayloads.push(JSON.parse(req.postData()));
        } catch {
          // ignore bodies that fail to parse as JSON
        }
      }
    };
    page.on('request', captureRequest);

    await demandPlanningPage.goto();
    await demandPlanningPage.toggleShowBelowReorderPoint(true);
    expect(await demandPlanningPage.getTotalCount()).toBeGreaterThanOrEqual(0);

    await demandPlanningPage.toggleShowBelowReorderPoint(false);
    expect(await demandPlanningPage.getTotalCount()).toBeGreaterThanOrEqual(0);

    page.off('request', captureRequest);

    const isReorderValues = requestPayloads.map((body) => body.is_reorder);
    expect(isReorderValues).toContain(true);
    expect(isReorderValues).toContain(false);
  });

  // ── TC-DP-06: Type='Production' + unchecked reorder point -> Create Work Order ────────────
  // Mirrors TC-DP-03's netting flow but for the OTHER demand type. With Type='Production' and
  // "Show Below Reorder Point" unchecked, the Detail view's action button becomes "Create Work
  // Order" instead of "Purchase Request" (confirmed live) - and unlike Purchase Request, it
  // creates the Work Order immediately (POST manufacturing/v1/work-order/demand-planning/
  // save-as-draft) with no form to fill at all. Uses a pinned existing item (see
  // config/testData.js's manufacturing.demandPlanning.production comment for why - there's no
  // confirmed way to generate Production-type demand ourselves yet).
  test('TC-DP-06 [+] Selecting a Production-type item and clicking Create Work Order creates a Draft Work Order', async () => {
    const itemName = dp.production.itemName;

    await demandPlanningPage.goto();
    await demandPlanningPage.selectType('Production');
    await demandPlanningPage.toggleShowBelowReorderPoint(false);

    await demandPlanningPage.openDetailView();
    await demandPlanningPage.selectDetailRow(itemName);
    const body = await demandPlanningPage.createWorkOrderFromSelection();

    const workOrder = body.data.workOrder[0];
    expect(workOrder.item_id).toBeTruthy();
    expect(workOrder.quantity).toBeGreaterThan(0);
    expect(workOrder.status).toBe('Draft');
    expect(workOrder.series_number).toMatch(/^WO-\d{4}-\d+$/);

    await expect(page.getByText('Work Order created Successfully', { exact: false })).toBeVisible();
    await expect(page.getByText(workOrder.series_number, { exact: false })).toBeVisible();
  });
});
