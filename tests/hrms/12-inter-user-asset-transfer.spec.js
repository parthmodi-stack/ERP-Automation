const { test, expect } = require('@playwright/test');
const AssetRequestPage = require('../../pages/AssetRequestPage');
const AssetAllocationPage = require('../../pages/AssetAllocationPage');
const AssetTransferPage = require('../../pages/AssetTransferPage');
const LoginPage = require('../../pages/LoginPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

const { requester, approver, secondUser } = testData.assetManagement.users;

// Test Suite 9 (Task.md) - Asset Transfer Between Users. Three distinct real logins: Kashyap
// (current asset holder), Dipen Modi (Approver, performs the allocation-side Transfer action),
// and Parth (secondUser, the new owner). Read in full from erpforce-be's
// receive-handover.service.js before writing this - a Transfer creates a "Handover" record for
// the CURRENT holder (not a "Receive" record for the new owner straight away): the holder must
// Approve it (Requested -> InTransit) then complete/Submit it (-> Completed), and ONLY THEN does
// the backend auto-create a companion "Receive" record for the new owner to accept. See
// AssetAllocationPage.transferAsset/AssetTransferPage.approveHandover's own comments for the
// exact API-level evidence.
test.describe.serial('Asset Management - Inter-User Asset Transfer', () => {
  test.describe.configure({ timeout: 240000 });

  let page;
  let loginPage;
  let assetRequestPage;
  let assetAllocationPage;
  let assetTransferPage;

  // Relies on Kashyap ALREADY holding at least one in-use asset from an earlier suite
  // (tests/hrms/10-asset-allocation-and-transfer.spec.js's TC-AST-05) rather than provisioning a
  // fresh one here - CONFIRMED LIVE that the "Customer Contracts" asset category's available-
  // asset pool is now fully depleted (every automated Assign in this whole suite draws from the
  // same category via `selectFirstOptionByLabel`), so an extra "give Kashyap a fresh asset" setup
  // step here would itself fail with "No assets available." If this suite is ever run against a
  // fully fresh environment where Kashyap holds nothing yet, run
  // 10-asset-allocation-and-transfer.spec.js first (or a different, non-depleted asset category)
  // to seed one.
  const parthRequestData = {
    assetName: testDataFactory.uniqueName('Automation_Asset_Parth'),
    quantity: '1',
    reason: testDataFactory.narration('Automated E2E inter-user transfer - Parth request'),
  };
  let parthRequestId;
  let handoverRequestId;
  let receiveRequestId;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    page = await context.newPage();
    loginPage = new LoginPage(page);
    assetRequestPage = new AssetRequestPage(page);
    assetAllocationPage = new AssetAllocationPage(page);
    assetTransferPage = new AssetTransferPage(page);
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  // ── Step 1: Create Asset Request with parth.modi+1007@trootech.com ───────────────────────────
  test('TC-AST-08 [+] Parth logs in and creates a new Asset Request', async () => {
    expect(secondUser.password, 'secondUser credentials must be configured in config/testData.js').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(secondUser.email, secondUser.password);
    await assetRequestPage.gotoAdd();
    await assetRequestPage.submitRequest(parthRequestData);

    const status = await assetRequestPage.getRequestStatus(parthRequestData.assetName);
    expect(status).toMatch(/Requested/i);

    parthRequestId = await assetRequestPage.openRequestByAssetName(parthRequestData.assetName);
    expect(parthRequestId).toBeTruthy();

    await loginPage.logout();
  });

  // ── Step 2: Approve request with Dipen Modi ───────────────────────────────────────────────────
  test("TC-AST-09 [+] Approver approves Parth's request", async () => {
    expect(parthRequestId, 'TC-AST-08 must run first and capture a request id').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);
    await assetRequestPage.approve(parthRequestId);
    await loginPage.logout();
  });

  // ── Step 3: Transfer Asset from Asset Allocation ──────────────────────────────────────────────
  test("TC-AST-10 [+] Approver transfers Kashyap's in-use asset to Parth's approved request", async () => {
    expect(parthRequestId, 'TC-AST-09 must run first').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);

    // Selects the "Assets In Use" row currently held by Kashyap specifically (not just whichever
    // row sorts first) - creates a "Handover" type receive_handover_request for Kashyap.
    handoverRequestId = await assetAllocationPage.transferAsset(parthRequestId, requester.displayName);
    expect(handoverRequestId).toBeTruthy();

    await loginPage.logout();
  });

  // ── Step 4: Handover asset from Asset Transfer with Kashyap Jivani user ───────────────────────
  test('TC-AST-11 [+] Kashyap approves and completes the handover of his asset', async () => {
    expect(handoverRequestId, 'TC-AST-10 must run first and capture a handover request id').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(requester.email, requester.password);

    // Two distinct backend actions, both performed by the current holder: Approve (Requested ->
    // InTransit) then Submit (marks the item physically handed over, -> Completed) - see this
    // page's own top-of-file comment for why these can't be collapsed into one step.
    await assetTransferPage.approveHandover(handoverRequestId);
    const completeResponse = await assetTransferPage.acceptTransfer(handoverRequestId);

    receiveRequestId = await assetTransferPage.getCompanionReceiveRequestId(completeResponse);
    expect(receiveRequestId, 'completing the handover should auto-create a Receive request for Parth').toBeTruthy();

    await loginPage.logout();
  });

  // ── Step 5: Receive Asset from Asset Transfer with the secondUser ("Parth") account ───────────
  test('TC-AST-12 [+] Parth receives the transferred asset', async () => {
    expect(receiveRequestId, 'TC-AST-11 must run first and capture the companion receive request id').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(secondUser.email, secondUser.password);

    await assetTransferPage.acceptTransfer(receiveRequestId);

    await loginPage.logout();
  });
});
