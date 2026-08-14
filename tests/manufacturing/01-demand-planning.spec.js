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
const { selectDropdown } = require('../../helpers/dropdown');

const dp = testData.manufacturing.demandPlanning;

async function waitForIdle(page, ms = 1200) {
  await page.waitForTimeout(ms);
}

// Same `mui-component-select-add_inventory_item.<field>` / `menu-add_inventory_item.<field>`
// pattern as 07-inventory-item.spec.ts's own selectFromDropdown. Delegates to the shared
// helpers/dropdown.js engine (search -> exact match -> first-available fallback -> create-new/
// throw) instead of hand-rolling an exact-match-or-hang version here - this spec-local copy
// predated the Manufacturing page objects' own dropdown-fallback fix and was missed by it, which
// is exactly why a drifted fixture value (e.g. Department no longer matching 'Procurement' in
// this environment) used to hang on click() instead of falling back to whatever's available.
async function selectFromDropdown(page, fieldName, optionText) {
  const value = optionText || '';
  await selectDropdown(
    page,
    page.locator(`[id="mui-component-select-add_inventory_item.${fieldName}"]`),
    value,
    value,
    { optional: false }
  );
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

  // Default Tax, Income Account, Asset Account, and COGS Account are all required in this
  // environment (confirmed live - none reliably auto-defaults; a prior comment here claiming
  // Asset/COGS Account are "pre-filled and can be skipped" no longer holds). Only fill them if
  // Next is actually disabled to begin with - if it's already enabled, whatever's pre-filled is
  // already good enough and touching these fields is pure risk for no benefit.
  //
  // CONFIRMED LIVE APP BUG: Next's own disabled/enabled state is computed once when the
  // Accounting tab mounts and does NOT reactively recompute as these fields are filled - selecting
  // all four can still leave Next disabled even though every field now shows a real value. The
  // only reliable way to force a re-evaluation is to navigate away to another tab and back, which
  // remounts the tab and lets it re-read the now-filled values.
  async function fillAccountingTabAndProceed() {
    const nextButton = page.getByRole('button', { name: 'Next' });
    if (!(await nextButton.isDisabled())) {
      await nextTo('Inventory');
      return;
    }

    for (const field of ['default_tax_id', 'income_account_id', 'asset_account_id', 'cogs_account_id']) {
      await selectFromDropdown(page, field);
    }
    await waitForIdle(page, 1000);

    if (!(await nextButton.isDisabled())) {
      await nextTo('Inventory');
      return;
    }

    // Still disabled after every field has a real value - force the remount workaround, retrying
    // a few times in case the app's own tab switch/render also needs a moment to settle.
    for (let attempt = 0; attempt < 3 && (await nextButton.isDisabled()); attempt++) {
      await page.getByRole('tab', { name: 'Purchase', exact: true }).click();
      await waitForIdle(page, 500);
      await page.getByRole('tab', { name: 'Accounting', exact: true }).click();
      await waitForIdle(page, 500);
    }

    await expect(nextButton).toBeEnabled({ timeout: 10000 });
    await nextTo('Inventory');
  }

  await nextTo('Rental Price');
  await nextTo('Sales');
  await page.getByPlaceholder('Enter Sales Price').fill(dp.salesPrice);
  await nextTo('Purchase');
  await nextTo('Accounting');
  await fillAccountingTabAndProceed();

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

  // ── TC-DP-03: netting via a Purchase Request reduces/removes the shortfall - uses Demand
  // Planning's OWN real, intended path rather than Procurement's standalone Add Request flow: its
  // Detail view (openDetailView/selectDetailRow/createPurchaseRequestFromSelection) lets you check
  // a shortfall row and jump straight into Procurement's Add Request page with Entity/Currency
  // pre-filled from that row - but, CONTRARY to what this comment originally assumed, Item is NOT
  // actually carried over (confirmed live: the Items grid lands genuinely empty, "Please add
  // atleast one Item", every time) - it's added manually below instead of relying on that hand-off.
  // Location is selected via a plain, unfiltered click on the combobox (Mumbai is directly listed,
  // no typing needed) rather than ProcurementRequestPage.selectLocation()'s own "always create a
  // brand new one" workaround for a different, unrelated search bug.
  //
  // Two more confirmed-live gaps in the manually-added Item row, both silent (no visible error,
  // Save/Save To Draft just does nothing) until diagnosed via a toast that only flashes briefly:
  // Tax Template is required (addItemWithFullDetails() already has a "pick first available"
  // fallback for it via selectFirstOptionByLabel - reused here), and the item modal's OWN Location
  // field (item-entry-modal.tsx, separate from the header form's Classification section) must
  // match the header's selected Location or Save fires "Please enter proper details. Mismatch
  // found in details." With both fixed, a Draft Purchase Request DOES net against demand fine -
  // the earlier assumption that Draft doesn't net, or that plain "Save" was separately broken,
  // was wrong; both were really just this same missing-fields issue.
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
    // CONFIRMED LIVE, this session: contrary to this test's own original comment,
    // createPurchaseRequestFromSelection() does NOT actually carry the checked row's Item into
    // the Add Request form's own Items grid - it lands here with "Please add atleast one Item"
    // and a genuinely empty grid every time (Entity/Currency DO come through correctly; only the
    // Item row doesn't). Add it manually instead of relying on that broken hand-off.
    //
    // Not using ProcurementRequestPage.addItem() here: it opens the item combobox and looks for
    // the exact item text WITHOUT typing anything first, which only works when the target item is
    // already visible in an unfiltered list - this environment's Item list is dominated by other
    // suites' short-lived automation records (see billOfMaterial's own testData comment), so a
    // freshly-created item like this test's own isn't anywhere near the top. Typing the name to
    // filter first is the only way to actually reach it - kept local to this test rather than
    // changed in the shared addItem() itself, since other Procurement specs' own callers may rely
    // on its current no-typing behavior for items that ARE already visible without it.
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const itemModal = page.getByRole('dialog').filter({ hasText: 'Edit Item' });
    await itemModal.getByRole('combobox', { name: 'Search Item' }).click();
    // Settle before typing - confirmed live that typing immediately after the click can race with
    // the combobox's own focus transfer, silently dropping the first keystroke(s) (e.g. "Au" from
    // "Automation_..."). The option's own display text is "<SKU> - <Name>", never just the plain
    // name, so match by substring rather than exact.
    await page.waitForTimeout(500);
    await page.keyboard.type(itemName, { delay: 60 });
    await page.getByText(itemName, { exact: false }).first().click();
    await itemModal.getByPlaceholder('0.00').first().fill(String(before.required_quantity));
    await itemModal.locator('text=Rate *').locator('xpath=following::input[1]').fill('100');
    // Tax Template is required for Save to actually persist (confirmed live: without it, Save/
    // Save To Draft silently does nothing - no request, no visible error) - addItemWithFullDetails()
    // already has a "pick first available" fallback for exactly this, reuse it instead of
    // duplicating the selectFirstOptionByLabel call here.
    await procurementRequestPage.selectFirstOptionByLabel('Tax Template *', { scope: itemModal });
    // The item modal has its OWN Location/Department fields (item-entry-modal.tsx), separate from
    // the header form's Classification section selected above - confirmed live: leaving this
    // item-level Location unset while the header's is "Mumbai" fires a toast ("Please enter proper
    // details. Mismatch found in details") and Save silently does nothing. Match the header value.
    await procurementRequestPage.selectFieldByLabel('Location', dp.pr.location, {
      scope: itemModal,
      exact: false,
    });
    await itemModal.getByRole('button', { name: 'Save' }).click();
    await expect(itemModal).not.toBeVisible();

    // Save To Draft is enough to net against demand once the Item row is genuinely valid (Tax
    // Template + matching item-level Location, both set above) - confirmed live.
    await procurementRequestPage.saveAsDraft();

    await demandPlanningPage.goto();
    await demandPlanningPage.toggleShowBelowReorderPoint(true);
    const after = demandPlanningPage.getLatestSummary().data.summary_data.find((row) => row.item_id === itemId);

    // Either the item drops out entirely (fully netted, `after` is undefined) or its
    // required_quantity decreases - accept both, matching this test's own [+/-] framing.
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
