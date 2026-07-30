const { test, expect } = require('@playwright/test');
const MyAssetsPage = require('../../pages/MyAssetsPage');
const AssetTransferPage = require('../../pages/AssetTransferPage');
const LoginPage = require('../../pages/LoginPage');
const testData = require('../../config/testData');

const { secondUser, assetReceiver } = testData.assetManagement.users;

// Test Suite 5 (Task.md) - Asset Return. Two distinct real logins: Nishit (secondUser, currently
// holds assets from earlier suites' allocations) returns one from "My Assets", then the fixed
// receiving account (admin@gmail.com - CONFIRMED LIVE the backend hardcodes this recipient
// regardless of who returned the asset, see config/testData.js's own comment on `assetReceiver`)
// logs in and completes the receive from Asset Return -> View Asset Return.
//
// Relies on Nishit ALREADY holding at least one received asset from earlier suites
// (10-asset-allocation-and-transfer.spec.js / 12-inter-user-asset-transfer.spec.js both leave him
// holding assets) rather than provisioning a fresh one here - same reasoning
// 12-inter-user-asset-transfer.spec.js documents for reusing Kashyap's existing asset instead of
// fighting the depleted "Customer Contracts" available-asset pool.
//
// CONFIRMED LIVE, real constraint (not a code bug): this file and 12-inter-user-asset-transfer
// .spec.js both mutate NISHIT'S SAME account (`secondUser`) - Playwright runs different spec
// files concurrently across workers by default, so running both together races "does Nishit
// currently hold an asset" and can fail with "My Assets: No Data" if this file's own TC-AST-13
// happens to check before file 12's transfer lands. Verified: passes reliably run alone, or after
// file 12 has already completed in the same session. Run with `--workers=1` (or this file alone)
// if this ever flakes in a full suite run.
test.describe.serial('Asset Management - Asset Return', () => {
  test.describe.configure({ timeout: 120000 });

  let page;
  let loginPage;
  let myAssetsPage;
  let assetTransferPage;
  let returnRequestId;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    page = await context.newPage();
    loginPage = new LoginPage(page);
    myAssetsPage = new MyAssetsPage(page);
    assetTransferPage = new AssetTransferPage(page);
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test('TC-AST-13 [+] Nishit returns an asset from My Assets', async () => {
    expect(secondUser.password, 'secondUser credentials must be configured in config/testData.js').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(secondUser.email, secondUser.password);

    returnRequestId = await myAssetsPage.returnAsset();
    // Assertion: the return created a Receive request (id resolvable from the network response) -
    // this is the record the fixed receiving account needs to act on next.
    expect(returnRequestId).toBeTruthy();

    await loginPage.logout();
  });

  test('TC-AST-14 [+] admin@gmail.com receives the returned asset from Asset Return', async () => {
    expect(returnRequestId, 'TC-AST-13 must run first and capture a return request id').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(assetReceiver.email, assetReceiver.password);

    const completeResponse = await assetTransferPage.acceptReturn(returnRequestId);
    expect(completeResponse?.data?.request?.status ?? completeResponse?.request?.status).toBe('Completed');

    await loginPage.logout();
  });
});
