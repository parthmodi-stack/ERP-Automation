const { test, expect } = require('@playwright/test');
const AssetRequestPage = require('../../pages/AssetRequestPage');
const AssetAllocationPage = require('../../pages/AssetAllocationPage');
const AssetTransferPage = require('../../pages/AssetTransferPage');
const LoginPage = require('../../pages/LoginPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

const { requester, approver } = testData.assetManagement.users;

// Self-contained (does not depend on 09-asset-request-flow.spec.js's own request still existing)
// per this repo's "tests must be independent and runnable individually" convention - creates its
// own fresh request+approval, then continues into Allocation (Suite 3) and Receive (Suite 4).
//
// Allocation is performed by the Approver (Dipen Modi) account, same as the approval step -
// there's no separate "Asset Manager" test account available, and `AssetAllocation.requests.
// actions.assign`/`.transfer.canAdd` are dynamic per-role RBAC permissions with no hardcoded role
// name anywhere in erpforce-hrms-fe/erpforce-be (confirmed by reading utils/permissions.ts and the
// backend's rbac.helper.js) - Dipen Modi's admin account is the best available candidate to
// actually hold these permissions, but this is a live-data fact, not a code fact. If the "Assign
// Assets" button renders disabled for this account, that's a real finding to report, not a
// selector bug.
test.describe.serial('Asset Management - Allocation & Receive', () => {
  test.describe.configure({ timeout: 150000 });

  let page;
  let loginPage;
  let assetRequestPage;
  let assetAllocationPage;
  let assetTransferPage;
  let requestId;
  let transferId;

  const requestData = {
    assetName: testDataFactory.uniqueName('Automation_Asset_Alloc'),
    quantity: '1',
    reason: testDataFactory.narration('Automated E2E allocation and receive request'),
  };

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

  // ── Setup: fresh request + approval (same pattern as 09-asset-request-flow.spec.js) ─────────
  test('TC-AST-03 [+] Requester creates a request and Approver approves it (setup)', async () => {
    expect(requester.password, 'REQUESTER_PASSWORD env var must be set before running this suite - see .env.example').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
    await assetRequestPage.gotoAdd();
    await assetRequestPage.submitRequest(requestData);

    const status = await assetRequestPage.getRequestStatus(requestData.assetName);
    expect(status).toMatch(/Requested/i);

    requestId = await assetRequestPage.openRequestByAssetName(requestData.assetName);
    expect(requestId).toBeTruthy();

    await loginPage.logout();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);
    await assetRequestPage.approve(requestId);

    await loginPage.logout();
  });

  // ── Test Suite 3: Asset Allocation ───────────────────────────────────────────────────────────
  test('TC-AST-04 [+] Approver allocates an available asset against the approved request', async () => {
    expect(requestId, 'TC-AST-03 must run first and capture a request id').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);

    transferId = await assetAllocationPage.assignAsset(requestId);
    // Assertion: allocation created a receive_handover_request (id resolvable from the network
    // response) - this IS the transfer record required for the requester to receive the asset.
    expect(transferId).toBeTruthy();

    // Assertion: asset status transitions from Approved -> Assigned/PartialAssigned.
    await assetAllocationPage.expectStatus(requestId, /Assigned|PartialAssigned/i);

    await loginPage.logout();
  });

  // ── Test Suite 4: Receive Asset ──────────────────────────────────────────────────────────────
  test('TC-AST-05 [+] Requester receives the allocated asset', async () => {
    expect(transferId, 'TC-AST-04 must run first and capture a receive_handover_request id').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(requester.email, requester.password);

    await assetTransferPage.acceptTransfer(transferId);

    await loginPage.logout();
  });
});
