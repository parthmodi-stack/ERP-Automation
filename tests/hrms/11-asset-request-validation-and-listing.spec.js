const { test, expect } = require('@playwright/test');
const AssetRequestPage = require('../../pages/AssetRequestPage');
const LoginPage = require('../../pages/LoginPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

const { requester, approver } = testData.assetManagement.users;

async function freshSession(browser) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  return { page, loginPage: new LoginPage(page), assetRequestPage: new AssetRequestPage(page) };
}

// ── Validation (asset_request Yup schema, read in full from validation-schemas.ts) ────────────
// Each case fills every field VALID except the one under test, so the asserted error is
// unambiguous. Submit is always safe to click on an invalid form - React Hook Form + Yup blocks
// the network call client-side, so no record is ever created by these tests.
test.describe.serial('Asset Request - Validation', () => {
  test.describe.configure({ timeout: 120000 });

  let page;
  let loginPage;
  let assetRequestPage;

  test.beforeAll(async ({ browser }) => {
    ({ page, loginPage, assetRequestPage } = await freshSession(browser));
    expect(requester.password, 'REQUESTER_PASSWORD env var must be set - see .env.example').toBeTruthy();
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
  });

  test.afterAll(async () => {
    await loginPage.logout().catch(() => {});
    if (page) await page.close();
  });

  test('TC-AST-V01 [-] Submitting an empty Add Asset Request form shows every enforced required-field error', async () => {
    await assetRequestPage.gotoAdd();
    await assetRequestPage.attemptSubmit();

    // NOT asserting on "Required from date is required" - that field is pre-filled with today's
    // date by default (see fillRequestForm's own comment), so it can never actually be empty via
    // the UI. `requested_for_employee_id` is also schema-required but silently auto-filled from
    // the logged-in employee - not reachable via the UI either. "Asset category is required" and
    // "Reason/Purpose is required" are NOT asserted here either - CONFIRMED LIVE (see
    // TC-AST-V06/TC-AST-V07 below) that despite `assetRequestValidationSchema` declaring both
    // required, submitting with either empty is NOT blocked at all (no inline error, request
    // actually gets created) - a real app gap, not a missing locator.
    await assetRequestPage.expectValidationError('Asset name is required');
    await assetRequestPage.expectValidationError('Quantity is required');

    await assetRequestPage.discard();
  });

  // ── Known gaps: validation-schemas.ts (Yup) declares each of these rules, but
  // CONFIRMED LIVE none of them are actually enforced by the Add form - every one of the
  // sub-tests below navigates straight to the list with a real record created ("Asset request
  // created successfully" toast), never showing the schema's own error message. Two different
  // root causes, both confirmed by reading asset-request-form.tsx's JSX:
  //   - `asset_category_id`/`reason_purpose` have no `required` prop at all (unlike asset_name/
  //     quantity_needed/required_from_date, which all pass it explicitly) - required-ness is
  //     simply never wired to the UI for these two fields.
  //   - `asset_name`'s min(2)/`quantity_needed`'s min(1)/`reason_purpose`'s min(10) refinements
  //     ARE declared in the Yup schema, but only the bare "is it present" check actually runs -
  //     confirmed live: submitting Asset Name "A" (1 char) creates a real request instead of
  //     showing "Asset name must be at least 2 characters".
  // Same "keep the test, mark the gap" convention already used in
  // tests/procurement/03-rfq.spec.js's TC-RFQ-V03 - Playwright will flag these as an unexpected
  // pass (not a silent green) if/when the underlying form is fixed, which is the cue to remove
  // `test.fail()` from that specific case.
  test('TC-AST-V02 [-] Known gap: Asset Name shorter than 2 characters is not rejected', async () => {
    test.fail(true, 'Known gap: asset_name\'s min(2) Yup rule is not enforced - only its required check runs.');

    await assetRequestPage.gotoAdd();
    await assetRequestPage.fillRequestForm({
      assetName: 'A',
      quantity: '1',
      reason: testDataFactory.narration('Valid reason text for validation test'),
    });
    const response = await assetRequestPage.attemptSubmitExpectingBlock();

    // Expected (currently failing) behavior: no create-request call should fire.
    expect(response).toBeNull();
  });

  test('TC-AST-V03 [-] Quantity of 0 is rejected', async () => {
    // CONFIRMED LIVE: this one actually works, just with different wording than
    // validation-schemas.ts's own `min(1, 'Quantity must be at least 1')` message - the live
    // error is "Quantity must be positive" (some other/overriding check, not the Yup message
    // read from source). Trust the live text over the source-read one.
    await assetRequestPage.gotoAdd();
    await assetRequestPage.fillRequestForm({
      assetName: testDataFactory.uniqueName('Automation_Asset_V03'),
      quantity: '0',
      reason: testDataFactory.narration('Valid reason text for validation test'),
    });
    await assetRequestPage.attemptSubmit();
    await assetRequestPage.expectValidationError('Quantity must be positive');
    await assetRequestPage.discard();
  });

  test('TC-AST-V04 [-] Known gap: Reason/Purpose shorter than 10 characters is not rejected', async () => {
    test.fail(true, 'Known gap: reason_purpose\'s min(10) Yup rule is not enforced - only its required check runs (and only when asset_category_id/reason_purpose are non-empty at all - see TC-AST-V06/V07).');

    await assetRequestPage.gotoAdd();
    await assetRequestPage.fillRequestForm({
      assetName: testDataFactory.uniqueName('Automation_Asset_V04'),
      quantity: '1',
      reason: 'short',
    });
    const response = await assetRequestPage.attemptSubmitExpectingBlock();

    expect(response).toBeNull();
  });

  test('TC-AST-V05 [-/+] Correcting an empty required field (Asset Name) clears its inline error', async () => {
    // Built around the ONE rule confirmed to actually work (plain required-ness on Asset Name,
    // TC-AST-V01) rather than the min-length rule (TC-AST-V02), which never surfaces an error to
    // correct/clear at all.
    await assetRequestPage.gotoAdd();
    await assetRequestPage.fillRequestForm({
      assetName: '',
      quantity: '1',
      reason: testDataFactory.narration('Valid reason text for validation test'),
    });
    await assetRequestPage.attemptSubmit();
    await assetRequestPage.expectValidationError('Asset name is required');

    const assetNameInput = page.getByPlaceholder('Enter Name');
    await assetNameInput.fill(testDataFactory.uniqueName('Automation_Asset_V05'));
    await assetNameInput.blur();

    await assetRequestPage.expectNoValidationError('Asset name is required');
    await assetRequestPage.discard();
  });

  test('TC-AST-V06 [-] Known gap: Asset Category Needed left empty does not block submit', async () => {
    test.fail(true, 'Known gap: asset_category_id has no `required` prop in asset-request-form.tsx, so the Yup-required rule is never enforced.');

    await assetRequestPage.gotoAdd();
    await page.getByPlaceholder('Enter Name').fill(testDataFactory.uniqueName('Automation_Asset_V06'));
    await page.getByPlaceholder(/enter quantity/i).fill('1');
    await page.getByPlaceholder(/add reason/i).fill(testDataFactory.narration('Valid reason text for validation test'));
    const response = await assetRequestPage.attemptSubmitExpectingBlock();

    expect(response).toBeNull();
  });

  test('TC-AST-V07 [-] Known gap: Reason/Purpose left empty does not block submit', async () => {
    test.fail(true, 'Known gap: reason_purpose has no `required` prop in asset-request-form.tsx, so the Yup-required rule is never enforced.');

    await assetRequestPage.gotoAdd();
    await page.getByPlaceholder('Enter Name').fill(testDataFactory.uniqueName('Automation_Asset_V07'));
    await assetRequestPage.selectFirstOptionByLabel('Asset Category Needed');
    await page.getByPlaceholder(/enter quantity/i).fill('1');
    const response = await assetRequestPage.attemptSubmitExpectingBlock();

    expect(response).toBeNull();
  });
});

// ── Reject Flow (negative counterpart to TC-AST-02's Approve) ─────────────────────────────────
test.describe.serial('Asset Request - Reject Flow', () => {
  test.describe.configure({ timeout: 120000 });

  let page;
  let loginPage;
  let assetRequestPage;
  let rejectedRequestId;

  const rejectedRequestData = {
    assetName: testDataFactory.uniqueName('Automation_Asset_Reject'),
    quantity: '1',
    reason: testDataFactory.narration('Automated E2E reject-flow request'),
  };

  test.beforeAll(async ({ browser }) => {
    ({ page, loginPage, assetRequestPage } = await freshSession(browser));
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test('TC-AST-06 [+/-] Create a second, independent request and have the Approver Reject it', async () => {
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(requester.email, requester.password);

    await assetRequestPage.gotoAdd();
    await assetRequestPage.submitRequest(rejectedRequestData);

    const status = await assetRequestPage.getRequestStatus(rejectedRequestData.assetName);
    expect(status).toMatch(/Requested/i);

    rejectedRequestId = await assetRequestPage.openRequestByAssetName(rejectedRequestData.assetName);
    expect(rejectedRequestId).toBeTruthy();

    await loginPage.logout();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);

    await assetRequestPage.reject(rejectedRequestId);
    await expect(page.getByText(/Rejected/i).first()).toBeVisible();

    await loginPage.logout();
  });
});

// ── Listing Page (shared Listing/action-bar component, DEFAULT_TEST_CASES.md's TC-L0x set) ────
test.describe.serial('Asset Request - Listing Page', () => {
  test.describe.configure({ timeout: 150000 });

  let page;
  let loginPage;
  let assetRequestPage;

  const listingRequestData = {
    assetName: testDataFactory.uniqueName('Automation_Asset_Listing'),
    quantity: '1',
    reason: testDataFactory.narration('Automated E2E listing-page request'),
  };
  let listingRequestId;

  test.beforeAll(async ({ browser }) => {
    ({ page, loginPage, assetRequestPage } = await freshSession(browser));
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test('TC-AST-L00 [+] Setup: create and approve a request for listing checks', async () => {
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(requester.email, requester.password);

    await assetRequestPage.gotoAdd();
    await assetRequestPage.submitRequest(listingRequestData);
    listingRequestId = await assetRequestPage.openRequestByAssetName(listingRequestData.assetName);
    expect(listingRequestId).toBeTruthy();

    await loginPage.logout();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);
    await assetRequestPage.approve(listingRequestId);
    await loginPage.logout();

    // The "Requested Assets" tab is scoped to the LOGGED-IN employee's own requests
    // (`requested_for_employee_id.eq=${employeeId}`) - log back in as the requester so the
    // remaining listing checks in this block see this record.
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
  });

  test('TC-AST-L01 [+] Search Asset Request list by asset name', async () => {
    expect(listingRequestId, 'TC-AST-L00 must run first').toBeTruthy();
    await assetRequestPage.gotoList();
    await assetRequestPage.searchList(listingRequestData.assetName);
    await expect(assetRequestPage.rowByAssetName(listingRequestData.assetName)).toBeVisible();
  });

  test('TC-AST-L02 [+] Sort Asset Request list by ID column', async () => {
    await assetRequestPage.gotoList();
    await assetRequestPage.clearSearch().catch(() => {});

    const before = await assetRequestPage.getColumnAriaSort('ID');
    await assetRequestPage.clickColumnHeader('ID');
    await expect.poll(() => assetRequestPage.getColumnAriaSort('ID'), { timeout: 10000 }).not.toBe(before);

    const afterFirstClick = await assetRequestPage.getColumnAriaSort('ID');
    await assetRequestPage.clickColumnHeader('ID');
    await expect.poll(() => assetRequestPage.getColumnAriaSort('ID'), { timeout: 10000 }).not.toBe(afterFirstClick);
  });

  test('TC-AST-L03 [+] Paginate through the Asset Request list', async () => {
    await assetRequestPage.gotoList();
    await assetRequestPage.clearSearch().catch(() => {});

    const label = await assetRequestPage.getPaginationLabel();
    expect(label).toMatch(/Page \d+ of \d+/i);

    const match = label.match(/Page (\d+) of (\d+)/i);
    const totalPages = match ? Number(match[2]) : 1;

    await expect(assetRequestPage.prevPageButton()).toBeDisabled();

    if (totalPages > 1) {
      await assetRequestPage.nextPageButton().click();
      await expect.poll(() => assetRequestPage.getPaginationLabel(), { timeout: 10000 }).toMatch(/Page 2 of/i);
      await expect(assetRequestPage.prevPageButton()).toBeEnabled();
    } else {
      // Real, current state of the shared/cumulative dataset - not a silently-masked failure.
      console.log(`Asset Request list only has ${totalPages} page currently - Next/Prev interaction not exercised this run.`);
    }
  });

  test('TC-AST-L04 [+] Row action menu disables Edit for an Approved request', async () => {
    const disabled = await assetRequestPage.isEditDisabledForAsset(listingRequestData.assetName);
    expect(disabled).toBe(true);
  });

  test('TC-AST-L05 [+] Row status badge matches the Approved lifecycle state', async () => {
    const status = await assetRequestPage.getRequestStatus(listingRequestData.assetName);
    expect(status).toMatch(/Approved/i);
  });
});
