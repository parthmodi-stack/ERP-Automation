const { test, expect } = require('@playwright/test');
const AssetRequestPage = require('../../pages/AssetRequestPage');
const LoginPage = require('../../pages/LoginPage');
const testData = require('../../config/testData');

const { requester, approver } = testData.assetManagement.users;

// Unlike every other suite in this repo, Asset Management genuinely needs two distinct real
// logins - the Requester creates the request, the Approver reviews and approves it - rather than
// the single shared admin account self-approving its own request via Quick Approval (see
// config/testData.js's comment on `assetManagement.users` for why). Both test cases still share
// ONE browser page/context, matching this repo's own `.describe.serial` convention (one
// `browser.newPage()` in `beforeAll`, reused/not closed between tests) - but storageState is
// explicitly reset to unauthenticated so each test's own login()/logout() step is what actually
// switches identity, the same override `tests/auth/login.spec.js` uses.
test.describe.serial('Asset Management - Asset Request & Approval', () => {
  test.describe.configure({ timeout: 120000 });

  let page;
  let loginPage;
  let assetRequestPage;
  let createdRequest = {};

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    page = await context.newPage();
    loginPage = new LoginPage(page);
    assetRequestPage = new AssetRequestPage(page);
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  // ── Test Suite 1: Asset Request Flow ─────────────────────────────────────────
  test('TC-AST-01 [+] Requester logs in and creates a new Asset Request', async () => {
    expect(requester.password, 'REQUESTER_PASSWORD env var must be set before running this suite - see .env.example').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
    await expect(page).toHaveURL(/dashboard/);

    const requestData = testData.assetManagement.assetRequest.valid;
    createdRequest = { ...requestData };

    await assetRequestPage.gotoAdd();
    await assetRequestPage.submitRequest(requestData);

    // Assertion: request appears in the requester's own listing with the correct asset name.
    const status = await assetRequestPage.getRequestStatus(requestData.assetName);
    // Real status vocabulary is "Requested" (source-confirmed), not the generic "Pending
    // Approval" business wording - see AssetRequestPage.getRequestStatus's own comment.
    expect(status).toMatch(/Requested/i);

    // Assertion: a Request ID (id) was generated and is resolvable back from the list.
    createdRequest.id = await assetRequestPage.openRequestByAssetName(requestData.assetName);
    expect(createdRequest.id).toBeTruthy();

    await loginPage.logout();
    await expect(page).toHaveURL(/\/login/);
  });

  // ── Test Suite 2: Request Approval ───────────────────────────────────────────
  test('TC-AST-02 [+] Approver logs in and approves the pending Asset Request', async () => {
    expect(createdRequest.id, 'TC-AST-01 must run first and capture a request id').toBeTruthy();
    expect(approver.password, 'Approver credentials must be configured in config/testData.js').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);
    await expect(page).toHaveURL(/dashboard/);

    // Assertion: status transitions from Requested -> Approved once the Approver acts on it.
    await assetRequestPage.approve(createdRequest.id);
    await expect(page.getByText(/Approved/i).first()).toBeVisible();

    await loginPage.logout();
    await expect(page).toHaveURL(/\/login/);
  });
});
