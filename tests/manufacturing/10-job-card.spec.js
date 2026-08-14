// Job Card (dashboard/manufacturing/job-cards) - Manufacturing module's tenth spec, reachable ONLY
// from a Completed Work Order's own Actions menu ("Create Job Cards" - confirmed live that
// navigating directly to .../job-cards/add-job-cards produces a completely empty form with no
// pre-filled context). Builds its own dedicated Work Center Category -> Work Center -> Operation ->
// Bill of Material -> Routing chain (same shape as 09-routing.spec.js's own setup), then a Work
// Order with that Routing selected, taken all the way through Release -> Issue Material -> Build ->
// Build Order's own Mark Completed (see 03-work-order.spec.js for that lifecycle) to reach
// "Completed" - only from there does "Create Job Cards" appear.
//
// See pages/JobCardPage.js's own header comment for the full behavior/bug rundown this suite
// exercises, most importantly: a Job Card's own OVERALL status (Pending -> Released (immediately,
// no visible "Release" step) -> In progress -> Completed) is a SEPARATE concept from each Routing
// Details row's own status (Ready -> In progress -> Completed or Blocked); Record Completion is a
// two-step flow (an Operations List selection dialog, then a full Add Record Completion page) that
// EXCLUDES Blocked rows entirely (confirmed live: "No Data", Next stays disabled) - the mechanism
// behind "after block we can not Record Completion". Blocking is NOT a permanent dead end though -
// it auto-creates a ticket in a wholly separate module, Equipment Failure
// (pages/EquipmentFailurePage.js), and confirming THAT ticket's own "Maintanance Completed" action
// is what reverts the row from Blocked back to Ready (a full reset, not "In progress" or
// "Completed" - the whole Start/Complete/Record Completion sequence runs again from there, see
// TC-JC-05). Separately, Mark Complete (Actions menu) has NO dependency on any of this - confirmed
// live to succeed even with a row still sitting Blocked and its own Equipment Failure ticket never
// resolved (TC-JC-06 documents this real gap, on its own third Job Card).
const { test, expect } = require('@playwright/test');
const testData = require('../../config/testData');
const WorkCenterCategoryPage = require('../../pages/WorkCenterCategoryPage');
const WorkCenterPage = require('../../pages/WorkCenterPage');
const OperationPage = require('../../pages/OperationPage');
const BillOfMaterialPage = require('../../pages/BillOfMaterialPage');
const RoutingPage = require('../../pages/RoutingPage');
const WorkOrderPage = require('../../pages/WorkOrderPage');
const BuildOrderPage = require('../../pages/BuildOrderPage');
const JobCardPage = require('../../pages/JobCardPage');
const EquipmentFailurePage = require('../../pages/EquipmentFailurePage');
const StockTransferPage = require('../../pages/StockTransferPage');
const { seedMaterialStockViaReceipt } = require('../../helpers/manufacturingStock');

const jcData = testData.manufacturing.jobCard;

test.describe.serial('Manufacturing - Job Card', () => {
  test.describe.configure({ timeout: 200000 });

  let page;
  let wccPage;
  let wcPage;
  let opPage;
  let bomPage;
  let routingPage;
  let woPage;
  let buildOrderPage;
  let jobCardPage;
  let equipmentFailurePage;

  // Shared across all three Job Cards this suite creates (TC-JC-01's happy-path one, TC-JC-04's
  // Block-then-resolve one, and TC-JC-06's Block-then-never-resolve one) - a Work Center
  // Category/Work Center/Operation/Bill of Material/Routing chain is a reusable static definition,
  // not a one-per-record thing the way a Work Order/Job Card is.
  let workCentreName;
  let operationName;
  let bomName;
  let routingName;
  let itemDisplayText;
  let materialItemName;

  let jobCardSeriesNumber; // carried through TC-JC-01 -> TC-JC-03 (happy path)
  let blockedJobCardSeriesNumber; // carried through TC-JC-04 -> TC-JC-05 (Block, then resolved)
  let blockedWorkCentreName; // that Job Card's own dedicated Work Centre - see createBlockableJobCard()

  // Builds a fresh Work Center Category -> Work Center -> Operation -> Bill of Material -> Routing
  // chain, all named with the given prefix - factored out of beforeAll so the Block-path tests can
  // each get their OWN dedicated Work Centre rather than sharing TC-JC-01's. This matters because
  // Equipment Failure tickets (see EquipmentFailurePage.js) can only be found back by matching this
  // Work Centre's own name - two Blocked Job Cards sharing one Work Centre would make that lookup
  // ambiguous.
  async function buildManufacturingChain(prefix) {
    const categoryName = `Automation_WCC_${prefix}_${Date.now()}`;
    await wccPage.goto();
    await wccPage.fillHeader({ name: categoryName });
    await wccPage.selectType('Machine');
    await wccPage.selectItem();
    await wccPage.save();

    const workCentreName = `Automation_WC_${prefix}_${Date.now()}`;
    await wcPage.goto();
    await wcPage.fillHeader({ name: workCentreName });
    await wcPage.selectLocation(jcData.location);
    await wcPage.save();

    const operationName = `Automation_OP_${prefix}_${Date.now()}`;
    await opPage.goto();
    await opPage.fillHeader({ name: operationName });
    await opPage.selectWorkCentre(workCentreName);
    await opPage.selectLocation(jcData.location);
    await opPage.addCostingRow({ categoryName });
    await opPage.save();

    // A dedicated, Approved Bill of Material - Work Order's own BOM dropdown only offers Approved
    // records with a sane Start < End date range (see WorkOrderPage.js's own header comment).
    // Item/material are both left to "first available" (see BillOfMaterialPage.js) rather than a
    // pinned literal, matching 02-bill-of-material.spec.js's own reasoning.
    const bomName = `Automation_BOM_${prefix}_${Date.now()}`;
    await bomPage.goto();
    await bomPage.selectItem();
    const itemDisplayText = (await page.locator('[id="mui-component-select-bom.item_id"]').textContent()).trim();
    await bomPage.fillHeader({
      name: bomName,
      quantity: 10,
      startDate: '01-08-2026',
      endDate: '31-12-2027',
    });
    await bomPage.selectUOM();
    const materialItemName = await bomPage.addMaterialRow({ quantity: 1 });
    await bomPage.save();
    const bomRow = page.locator('tr', { hasText: bomName });
    const bomSeriesNumber = (await bomRow.getByText(/^BOM-\d+$/).first().textContent()).trim();
    await bomPage.openView(bomSeriesNumber);

    // Submit For Approval hangs indefinitely (no visible error) when the Materials row's own
    // item has no real stock (confirmed live this session, see WorkOrderPage.js's own comment on
    // ensureBomForItem) - stock it in via a real Stock Transfer Receipt before attempting Submit.
    // Destination location is left to "first available" - Submit For Approval doesn't check
    // location at all, that's only Release's own separate, Location-scoped concern.
    // addMaterialRow() returns "<SKU> - <Name>", but Stock Transfer's own Operational Detail row
    // shows only the plain Name (confirmed live) - strip the SKU prefix back off.
    const materialPlainName = materialItemName.includes(' - ')
      ? materialItemName.slice(materialItemName.indexOf(' - ') + 3)
      : materialItemName;
    await seedMaterialStockViaReceipt(new StockTransferPage(page), {
      itemName: materialPlainName,
      availableQuantity: 500,
    });
    await bomPage.openView(bomSeriesNumber);
    await bomPage.submitForApproval();
    await bomPage.approve();

    // Routing is scoped by BOTH BOM and Location together on Work Order's own form (confirmed
    // live) - select both there before expecting this Routing to appear.
    const routingName = `Automation_RT_${prefix}_${Date.now()}`;
    await routingPage.goto();
    await routingPage.fillHeader({ name: routingName, narration: 'For Job Card automation' });
    await routingPage.selectBOM(bomName);
    await routingPage.selectLocation(jcData.location);
    await routingPage.addRoutingDetailRow({ operationName, sequence: 1, workCentreName });
    await routingPage.save();

    return { workCentreName, operationName, bomName, routingName, itemDisplayText, materialItemName };
  }

  // Builds one Work Order against the given chain, releases it (self-healing stock the same way
  // 03-work-order.spec.js's TC-WO-04 does if Release reports insufficient material), issues
  // material, builds and marks the resulting Build Order Completed - the whole prerequisite chain
  // "Create Job Cards" needs to even appear. Returns the Work Order's own series number.
  async function createCompletedWorkOrder(chain) {
    await woPage.goto();
    await woPage.selectItem(chain.itemDisplayText);
    // "Category" - only required for certain items (e.g. Coil-type raw materials) - see
    // WorkOrderPage.js's own selectCategoryIfPresent() comment for why this is always called
    // rather than only when the item is known to need it.
    await woPage.selectCategoryIfPresent();
    await woPage.selectBOM(chain.bomName);
    await woPage.selectLocation(jcData.location);
    await woPage.selectRouting(chain.routingName);
    await woPage.fillHeader({ date: '01-08-2026', quantity: jcData.quantity });
    await woPage.save();

    const row = page.locator('tr', { hasText: 'Planned' }).first();
    await expect(row).toBeVisible();
    const woSeriesNumber = (await row.getByText(/^WO-\d{4}-\d+$/).first().textContent()).trim();

    await woPage.openView(woSeriesNumber);
    const outcome = await woPage.release();
    if (outcome === 'insufficient_material') {
      await seedMaterialStockViaReceipt(new StockTransferPage(page), {
        itemName: chain.materialItemName,
        availableQuantity: 500,
        location: jcData.location,
      });
      await woPage.openView(woSeriesNumber);
      expect(await woPage.release()).toBe('released');
    } else {
      expect(outcome).toBe('released');
    }

    await woPage.openView(woSeriesNumber);
    await woPage.issueMaterial();

    await woPage.openView(woSeriesNumber);
    await woPage.openBuildForm();
    const buildOrderSeriesNumber = await buildOrderPage.fillAndSave({
      quantity: jcData.quantity,
      finishedGoodCost: 100,
    });
    await buildOrderPage.openView(buildOrderSeriesNumber);
    await buildOrderPage.markCompleted();

    await woPage.openView(woSeriesNumber);
    // .first() - this environment's accumulated automation data means a Work Order sharing the
    // same Item as many earlier runs can have more than one "Completed" text on its own View page
    // (confirmed live, not unique to this test) - see 03-work-order.spec.js's own equivalent
    // assertion for the single-match case this doesn't always hold on a busier data set.
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
    return woSeriesNumber;
  }

  // Builds an entirely fresh chain + Work Order + Job Card dedicated to one Block scenario (see
  // buildManufacturingChain()'s own comment on why this can't reuse TC-JC-01's shared Work Centre).
  // Returns the new Job Card's own series number and its Work Centre's name (needed afterward to
  // find the Equipment Failure ticket the Block action creates).
  async function createBlockableJobCard(prefix) {
    const chain = await buildManufacturingChain(prefix);
    const woSeriesNumber = await createCompletedWorkOrder(chain);

    await woPage.openView(woSeriesNumber);
    await woPage.openCreateJobCardsForm();
    const jcSeriesNumber = await jobCardPage.fillAndSave({
      productionStartDate: '01-08-2026',
      productionEndDate: '10-08-2026',
    });
    return { jcSeriesNumber, workCentreName: chain.workCentreName };
  }

  // Explicit hook timeout - describe.configure's own 200000 above only applies to tests
  // themselves, not to beforeAll/afterAll (confirmed live: this hook's own WCC -> WC -> Operation
  // -> Bill of Material -> Routing chain can exceed Playwright's separate 60000ms hook default).
  // Bumped from 120000: the BOM step now also stocks its own material in via a real Stock
  // Transfer Receipt (create + Lot creation + Validate) before Submit For Approval can succeed
  // at all (see WorkOrderPage.js's own comment on ensureBomForItem) - real, added time, not slack.
  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(240000);
    page = await browser.newPage();
    wccPage = new WorkCenterCategoryPage(page);
    wcPage = new WorkCenterPage(page);
    opPage = new OperationPage(page);
    bomPage = new BillOfMaterialPage(page);
    routingPage = new RoutingPage(page);
    woPage = new WorkOrderPage(page);
    buildOrderPage = new BuildOrderPage(page);
    jobCardPage = new JobCardPage(page);
    equipmentFailurePage = new EquipmentFailurePage(page);

    // TC-JC-01's own shared chain - the Block-path tests each build their own separate one via
    // createBlockableJobCard() instead of reusing this (see buildManufacturingChain()'s comment).
    ({ workCentreName, operationName, bomName, routingName, itemDisplayText, materialItemName } =
      await buildManufacturingChain('ForJC'));
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── TC-JC-01: Create (from a Completed Work Order with Routing selected) ──────────────────────
  test('TC-JC-01 [+] Create a Job Card from a Completed Work Order with Routing selected', { tag: '@smoke' }, async () => {
    const woSeriesNumber = await createCompletedWorkOrder({
      itemDisplayText, bomName, routingName, materialItemName,
    });

    await woPage.openView(woSeriesNumber);
    await woPage.openCreateJobCardsForm();
    jobCardSeriesNumber = await jobCardPage.fillAndSave({
      productionStartDate: '01-08-2026',
      productionEndDate: '10-08-2026',
      narration: 'Automation test job card',
    });
    expect(jobCardSeriesNumber).toMatch(/^JC-\d{4}-\d+$/);

    // A freshly created Job Card is already "Released" with no visible separate Release step
    // (confirmed live - see JobCardPage.js's own header comment).
    await jobCardPage.openView(jobCardSeriesNumber);
    await expect(page.getByText('Released', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(routingName, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(bomName, { exact: true }).first()).toBeVisible();
  });

  // ── TC-JC-02: Start ─────────────────────────────────────────────────────────────────────────
  test('TC-JC-02 [+] Start a Routing Details row moves it and the Job Card to In progress', async () => {
    test.skip(!jobCardSeriesNumber, 'requires TC-JC-01 to have created a record first');

    await jobCardPage.openView(jobCardSeriesNumber);
    await jobCardPage.startRow();

    await expect(page.getByText('In progress', { exact: true }).first()).toBeVisible();
    expect(await jobCardPage.rowStatus()).toBe('In progress');
  });

  // ── TC-JC-03: Complete row -> Record Completion -> Mark Complete ───────────────────────────────
  test('TC-JC-03 [+] Complete a row, Record Completion, then Mark Complete completes the Job Card', async () => {
    test.skip(!jobCardSeriesNumber, 'requires TC-JC-02 to have started the row first');

    await jobCardPage.openView(jobCardSeriesNumber);
    await jobCardPage.completeRow();
    expect(await jobCardPage.rowStatus()).toBe('Completed');

    expect(await jobCardPage.recordCompletion()).toBe('completed');

    await jobCardPage.markComplete();
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
  });

  // ── TC-JC-04: Block prevents Record Completion ─────────────────────────────────────────────────
  // Uses its OWN, separate chain/Work Order/Job Card (via createBlockableJobCard()) - a row can't
  // be both Completed (TC-JC-03's own path) and Blocked, and this Job Card's own Work Centre needs
  // to stay unique for TC-JC-05's Equipment Failure lookup to unambiguously find "its own" ticket.
  test('TC-JC-04 [+/-] Block a Routing Details row leaves no eligible operations for Record Completion', async () => {
    const created = await createBlockableJobCard('ForBlock');
    blockedJobCardSeriesNumber = created.jcSeriesNumber;
    blockedWorkCentreName = created.workCentreName;

    await jobCardPage.openView(blockedJobCardSeriesNumber);
    await jobCardPage.startRow();
    await jobCardPage.blockRow({ reason: jcData.reason, useAlternativeEquipment: 'No' });
    expect(await jobCardPage.rowStatus()).toBe('Blocked');

    // Confirmed live: Record Completion's own "Operations List" selection dialog excludes Blocked
    // rows entirely - with this Job Card's only row now Blocked, nothing is left to select at all.
    expect(await jobCardPage.recordCompletion()).toBe('no_eligible_operations');
  });

  // ── TC-JC-05: Resolving the Equipment Failure ticket un-blocks the row, all the way to Completed
  // Blocking auto-creates a ticket in a wholly separate module (Equipment Failure) - confirming
  // that ticket's own "Maintanance Completed" is what reverts the row from Blocked back to Ready
  // (a full reset, not straight to Completed), so the entire Start -> Complete -> Record Completion
  // sequence runs again from scratch on it, matching TC-JC-02/03's own happy-path shape.
  test('TC-JC-05 [+] Resolving the Equipment Failure ticket resets the row to Ready, then completes normally', async () => {
    test.skip(!blockedJobCardSeriesNumber, 'requires TC-JC-04 to have created and blocked a record first');

    await equipmentFailurePage.openViewByWorkCentre(blockedWorkCentreName);
    await equipmentFailurePage.completeMaintenance();

    await jobCardPage.openView(blockedJobCardSeriesNumber);
    expect(await jobCardPage.rowStatus()).toBe('Ready');

    await jobCardPage.startRow();
    await jobCardPage.completeRow();
    expect(await jobCardPage.rowStatus()).toBe('Completed');
    expect(await jobCardPage.recordCompletion()).toBe('completed');

    await jobCardPage.markComplete();
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
  });

  // ── TC-JC-06: Mark Complete still succeeds despite a Blocked row whose Equipment Failure ticket
  // was NEVER resolved - CONFIRMED LIVE GAP (not a mistake in this test): Mark Complete has no
  // dependency on Record Completion (or the Equipment Failure ticket) having actually resolved - it
  // force-completes the whole Job Card regardless. Uses its own third, separate chain/Job Card
  // rather than TC-JC-04's own (which TC-JC-05 already resolved and completed).
  test('TC-JC-06 [+/-] Mark Complete succeeds even with a Blocked row whose Equipment Failure ticket is unresolved', async () => {
    const { jcSeriesNumber } = await createBlockableJobCard('ForBlockUnresolved');

    await jobCardPage.openView(jcSeriesNumber);
    await jobCardPage.startRow();
    await jobCardPage.blockRow({ reason: jcData.reason, useAlternativeEquipment: 'No' });
    expect(await jobCardPage.rowStatus()).toBe('Blocked');

    await jobCardPage.markComplete();
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
  });
});
