const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const AssetRequestPage = require('../../pages/AssetRequestPage');
const AssetAllocationPage = require('../../pages/AssetAllocationPage');
const AssetTransferPage = require('../../pages/AssetTransferPage');
const MyAssetsPage = require('../../pages/MyAssetsPage');
const DamageLossClaimPage = require('../../pages/DamageLossClaimPage');
const LoginPage = require('../../pages/LoginPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

const { requester, approver } = testData.assetManagement.users;

// A minimal valid 1x1 PNG - the Evidence upload input's `accept` list includes image/png; a
// throwaway .txt (used elsewhere in this repo for attachment tests) risks client-side rejection
// here since png/pdf/doc are the only types actually listed in source.
const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function writeTempEvidenceFile() {
  const filePath = path.join(os.tmpdir(), `damage-loss-evidence-${Date.now()}.png`);
  fs.writeFileSync(filePath, Buffer.from(PNG_1X1_BASE64, 'base64'));
  return filePath;
}

async function freshSession(browser) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  return {
    page,
    loginPage: new LoginPage(page),
    assetRequestPage: new AssetRequestPage(page),
    assetAllocationPage: new AssetAllocationPage(page),
    assetTransferPage: new AssetTransferPage(page),
    myAssetsPage: new MyAssetsPage(page),
    damageLossClaimPage: new DamageLossClaimPage(page),
  };
}

// CONFIRMED LIVE (tests/tmp/inspect-category-pool.spec.js, tests/tmp/inspect-row-click.spec.js):
// this cumulative shared environment's asset categories get exhausted/depleted by this suite's
// own repeated runs over time (each real claim created permanently disables that asset's
// `can_raise_damage_claim`) - index-based category selection (0 "Customer Contracts", 1 "Customer
// Relationships", 3 "Employee Stock Options") all got drained down to 0 available within a run or
// two. Switched to selecting a specific category BY NAME instead - "Computer Hardware and
// Software" - a category confirmed by the user to hold healthy stock, rather than continuing to
// hunt through indices. Each block below provisions its own fresh asset(s) via this same
// Request -> Approve -> Assign -> Receive chain TC-DL-00 uses, rather than assuming Kashyap
// already holds an eligible one.
const DAMAGE_LOSS_ASSET_CATEGORY = 'Computer Hardware and Software';

async function provisionFreshAsset({ loginPage, assetRequestPage, assetAllocationPage, assetTransferPage, categoryName = DAMAGE_LOSS_ASSET_CATEGORY }) {
  const requestData = {
    assetName: testDataFactory.uniqueName('Automation_Asset_DamageLoss'),
    quantity: '1',
    reason: testDataFactory.narration('Automated E2E damage-loss provisioning'),
    categoryName,
  };

  // CONFIRMED LIVE: calling this function twice in a row (TC-DL-02 provisions two assets back to
  // back) left the requester STILL logged in from the first call's own final `acceptTransfer`
  // step (intentionally no logout there - see below) - the second call's `loginPage.goto()` then
  // just redirects straight to the dashboard (already authenticated), so the login form's email
  // input never appears and `loginAndWaitForDashboard` times out waiting for it. Force a clean
  // logged-out state at the start of every call regardless of what the previous caller left behind.
  await loginPage.logout().catch(() => {});

  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
  await assetRequestPage.gotoAdd();
  await assetRequestPage.submitRequest(requestData);
  const requestId = await assetRequestPage.openRequestByAssetName(requestData.assetName);
  await loginPage.logout();

  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(approver.email, approver.password);
  await assetRequestPage.approve(requestId);
  const receiveId = await assetAllocationPage.assignAsset(requestId);
  await loginPage.logout();

  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
  await assetTransferPage.acceptTransfer(receiveId);
}

// Test Suite 7+8 (Task.md) - Damage/Loss request + approval. This first block does the FULL
// fresh chain (Request -> Approve -> Assign -> Receive -> Report Damage/Loss), giving Kashyap a
// genuinely fresh asset from the "Computer Hardware and Software" category (see
// DAMAGE_LOSS_ASSET_CATEGORY's own comment above for why - every previously-tried category index
// got drained down to 0 available). Plain Assign is simpler and more reliable than
// Transfer+Handover+Receive (no dependency on any specific OTHER employee's current holdings/
// credentials). The Validation and Approval blocks below don't re-run this setup - they operate
// directly on whatever Kashyap already holds.
test.describe.serial('Asset Management - Damage/Loss Claim', () => {
  test.describe.configure({ timeout: 240000 });

  let page, loginPage, assetRequestPage, assetAllocationPage, assetTransferPage, myAssetsPage, damageLossClaimPage;
  let setupDone;
  let claimId;

  const setupRequestData = {
    assetName: testDataFactory.uniqueName('Automation_Asset_DamageLoss'),
    quantity: '1',
    reason: testDataFactory.narration('Automated E2E damage-loss setup request'),
    categoryName: DAMAGE_LOSS_ASSET_CATEGORY,
  };

  test.beforeAll(async ({ browser }) => {
    ({ page, loginPage, assetRequestPage, assetAllocationPage, assetTransferPage, myAssetsPage, damageLossClaimPage } = await freshSession(browser));
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  // ── Setup: Request (Kashyap) -> Approve (Dipen) -> Assign (Dipen) -> Receive (Kashyap) ────────
  test('TC-DL-00 [+] Setup: Kashyap requests, Dipen approves and assigns an asset to him', async () => {
    expect(requester.password, 'REQUESTER_PASSWORD must be configured - see .env.example').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
    await assetRequestPage.gotoAdd();
    await assetRequestPage.submitRequest(setupRequestData);
    const requestId = await assetRequestPage.openRequestByAssetName(setupRequestData.assetName);
    expect(requestId).toBeTruthy();
    await loginPage.logout();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);
    await assetRequestPage.approve(requestId);
    const receiveId = await assetAllocationPage.assignAsset(requestId);
    expect(receiveId).toBeTruthy();
    await loginPage.logout();

    // Kashyap receives the assigned asset.
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(requester.email, requester.password);
    await assetTransferPage.acceptTransfer(receiveId);

    setupDone = true;
  });

  // ── Test Suite 7: Damage/Loss Request ────────────────────────────────────────────────────────
  test('TC-DL-01 [+] Kashyap reports Damage/Loss on the received asset', async () => {
    expect(setupDone, 'TC-DL-00 must run first').toBeTruthy();

    await myAssetsPage.reportDamageLoss();

    const evidencePath = writeTempEvidenceFile();
    try {
      const response = await damageLossClaimPage.submitClaim({
        condition: 'Damaged',
        severity: 'High',
        // dateOfIncident omitted -> DamageLossClaimPage.fillClaimDetails() defaults it to today.
        description: testDataFactory.narration('Automated E2E damage report'),
        attachmentPath: evidencePath,
      });
      // CONFIRMED LIVE (tests/tmp/inspect-damage-loss-enter-on-description.spec.js): the create
      // response nests the record under `data.damage_loss_claim`, not `data` directly.
      claimId = response?.data?.damage_loss_claim?.id ?? response?.damage_loss_claim?.id ?? null;
    } finally {
      fs.unlinkSync(evidencePath);
    }

    expect(claimId, 'creating the claim should return an id').toBeTruthy();

    const status = await damageLossClaimPage.getStatus(claimId);
    expect(status).toMatch(/Submitted/i);

    await loginPage.logout();
  });
});

// ── Validation (Damage/Loss create form) - provisions its own fresh asset (see
// provisionFreshAsset's comment) rather than assuming Kashyap already holds an eligible one -
// runs independently of the block above. TC-DL-V01/V02/V03 are all client-side BLOCKED (no claim
// ever actually gets created), so the same single provisioned asset stays eligible across all
// three; only TC-DL-V04 creates a real claim, and it runs last in this block.
test.describe.serial('Damage/Loss Claim - Validation', () => {
  test.describe.configure({ timeout: 180000 });

  let page, loginPage, assetRequestPage, assetAllocationPage, assetTransferPage, myAssetsPage, damageLossClaimPage;

  test.beforeAll(async ({ browser }) => {
    // CONFIRMED LIVE: Playwright's `beforeAll` hook has its OWN default 30s timeout, separate from
    // `test.describe.configure({ timeout })` (which only extends each TEST's timeout, not hooks) -
    // provisionFreshAsset's multi-login Request->Approve->Assign->Receive chain reliably takes
    // 45-50s end-to-end, so the hook needs its own explicit extension or it gets force-torn-down
    // mid-navigation ("Target page, context or browser has been closed").
    test.setTimeout(120000);
    ({ page, loginPage, assetRequestPage, assetAllocationPage, assetTransferPage, myAssetsPage, damageLossClaimPage } = await freshSession(browser));
    expect(requester.password, 'REQUESTER_PASSWORD must be configured - see .env.example').toBeTruthy();
    await provisionFreshAsset({ loginPage, assetRequestPage, assetAllocationPage, assetTransferPage });
    // provisionFreshAsset's last step already leaves the session logged in as the requester.
  });

  test.afterAll(async () => {
    await loginPage.logout().catch(() => {});
    if (page) await page.close();
  });

  test('TC-DL-V01 [-] Submitting without an evidence attachment is rejected', async () => {
    await myAssetsPage.reportDamageLoss();
    await damageLossClaimPage.fillClaimDetails({
      condition: 'Damaged',
      severity: 'High',
      description: testDataFactory.narration('Validation check - no attachment'),
    });

    const response = await damageLossClaimPage.attemptSubmitExpectingBlock();
    expect(response).toBeNull();
    await damageLossClaimPage.expectValidationError('Evidence attachment is required');
  });

  test('TC-DL-V02 [-] Submitting without ever filling the asset details row is rejected', async () => {
    await myAssetsPage.reportDamageLoss();

    const evidencePath = writeTempEvidenceFile();
    try {
      await damageLossClaimPage.uploadEvidence(evidencePath);
      const response = await damageLossClaimPage.attemptSubmitExpectingBlock();
      expect(response).toBeNull();
      // CONFIRMED LIVE: leaving the row entirely untouched (never entering edit mode at all)
      // surfaces the Damage-Loss Details ACCORDION's own summary error, not a field-specific
      // "Condition is required" message - that only appears once the row has actually been
      // opened for editing (see TC-DL-V03, which does enter edit mode and leaves Date empty).
      await damageLossClaimPage.expectValidationError('Please Fill at least one asset details');
    } finally {
      fs.unlinkSync(evidencePath);
    }
  });

  test('TC-DL-V03 [-] Submitting without a Date of Incident is rejected', async () => {
    await myAssetsPage.reportDamageLoss();

    const evidencePath = writeTempEvidenceFile();
    try {
      await damageLossClaimPage.fillClaimDetails({ condition: 'Damaged', severity: 'High', dateOfIncident: null });
      await damageLossClaimPage.uploadEvidence(evidencePath);
      const response = await damageLossClaimPage.attemptSubmitExpectingBlock();
      expect(response).toBeNull();
      await damageLossClaimPage.expectValidationError(/date of incident/i);
    } finally {
      fs.unlinkSync(evidencePath);
    }
  });

  test('TC-DL-V04 [+] Condition "Loss" makes Severity optional (per validation-schemas.ts)', async () => {
    // NOT actually Condition="Loss"-specific - originally mismarked as a known gap after
    // extensive investigation pointed at the Loss-disables-Severity `disable` callback. The REAL
    // root cause (found by reading erpforce-common-hub-fe's material-editable-table.tsx +
    // erpforce-hrms-fe's report-damage-loss/form/form.tsx source): this table passes
    // `hideSaveButton={true}`, so its Save/Cancel icon buttons are CSS-hidden (display:none,
    // confirmed via getComputedStyle) - not just hard to find. The only real commit paths are
    // Enter (which re-opens a Select instead of committing when focus is on Condition/Severity -
    // CONFIRMED LIVE) or a genuine click OUTSIDE the whole table (suppressed for 300ms after any
    // MuiFormControl/MuiInputBase interaction - i.e. almost the entire row). DamageLossClaimPage.
    // fillClaimDetails() now presses Enter with focus left in the plain Description TEXT field
    // (last one filled), which commits cleanly regardless of Condition value - CONFIRMED LIVE via
    // tests/tmp/inspect-damage-loss-enter-on-description.spec.js (a real "Damaged" claim was
    // created end-to-end this way). This test provides a description, so it should now pass like
    // TC-DL-01/V01-V03 - no longer marked as a known gap.
    await myAssetsPage.reportDamageLoss();

    const evidencePath = writeTempEvidenceFile();
    try {
      const response = await damageLossClaimPage.submitClaim({
        condition: 'Loss',
        dateOfIncident: damageLossClaimPage.todayDdMmYyyy(),
        description: testDataFactory.narration('Validation check - Loss condition, no severity'),
        attachmentPath: evidencePath,
      });
      const id = response?.data?.damage_loss_claim?.id ?? response?.damage_loss_claim?.id ?? null;
      expect(id, 'a Loss-condition claim with no severity should still be created').toBeTruthy();
    } finally {
      fs.unlinkSync(evidencePath);
    }
  });
});

// ── Test Suite 8: Damage/Loss Approval (+ validation) - provisions its OWN two fresh assets
// (one to Approve, one to Reject) rather than assuming Kashyap already holds two eligible ones -
// same reasoning as the Validation block above.
test.describe.serial('Damage/Loss Claim - Approval', () => {
  test.describe.configure({ timeout: 240000 });

  let page, loginPage, assetRequestPage, assetAllocationPage, assetTransferPage, myAssetsPage, damageLossClaimPage;
  let claimId;
  let rejectClaimId;

  test.beforeAll(async ({ browser }) => {
    ({ page, loginPage, assetRequestPage, assetAllocationPage, assetTransferPage, myAssetsPage, damageLossClaimPage } = await freshSession(browser));
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  async function reportDamageLoss(severity) {
    await myAssetsPage.reportDamageLoss();
    const evidencePath = writeTempEvidenceFile();
    try {
      const response = await damageLossClaimPage.submitClaim({
        condition: 'Damaged',
        severity,
        description: testDataFactory.narration('Automated E2E damage report for approval testing'),
        attachmentPath: evidencePath,
      });
      return response?.data?.damage_loss_claim?.id ?? response?.damage_loss_claim?.id ?? null;
    } finally {
      fs.unlinkSync(evidencePath);
    }
  }

  test('TC-DL-02 [+] Setup: Kashyap creates two claims (one to Approve, one to Reject)', async () => {
    expect(requester.password, 'REQUESTER_PASSWORD must be configured - see .env.example').toBeTruthy();

    // Provision two fresh assets so each reportDamageLoss() below has its own eligible asset to
    // claim against, rather than assuming Kashyap already holds two unclaimed ones.
    await provisionFreshAsset({ loginPage, assetRequestPage, assetAllocationPage, assetTransferPage });
    await provisionFreshAsset({ loginPage, assetRequestPage, assetAllocationPage, assetTransferPage });
    // provisionFreshAsset's last step already leaves the session logged in as the requester.

    claimId = await reportDamageLoss('Medium');
    expect(claimId).toBeTruthy();

    rejectClaimId = await reportDamageLoss('Low');
    expect(rejectClaimId).toBeTruthy();

    await loginPage.logout();
  });

  test('TC-DL-03 [+] Approver approves the claim, filling the Approve Claim modal', async () => {
    expect(claimId, 'TC-DL-02 must run first').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);

    const response = await damageLossClaimPage.approveClaim(claimId, {
      estimatedRepairCost: '100',
      replacementCost: '250',
      liableTo: 'Employee',
      recoveryAmount: '50',
    });

    // CONFIRMED LIVE: nests under `data.damage_loss_claim.status`, same as the create response's
    // own `data.damage_loss_claim.id` nesting - not `data.status` directly.
    expect(response?.data?.damage_loss_claim?.status ?? response?.damage_loss_claim?.status).toBe('Approved');

    await loginPage.logout();
  });

  test('TC-DL-04 [-] Approve Claim blocks when both cost fields are left empty', async () => {
    expect(rejectClaimId, 'TC-DL-02 must run first').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);

    const dialog = await damageLossClaimPage.openApproveModal(rejectClaimId);
    // Deliberately leave Estimated Repair Cost AND Replacement Cost both empty.
    const submitButton = dialog.getByRole('button', { name: 'Approve & Claim', exact: true });
    const responsePromise = page
      .waitForResponse((r) => r.url().includes('damage-loss-claims') && r.url().includes('/status') && r.request().method() === 'PATCH', { timeout: 5000 })
      .catch(() => null);
    await submitButton.click();
    const response = await responsePromise;

    // Expected behavior: at least one of the two cost fields is required (approve-claim-modal
    // .tsx's own cross-required rule) - no PATCH should fire.
    expect(response).toBeNull();

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await loginPage.logout();
  });

  test('TC-DL-05 [+/-] Approver rejects the second claim', async () => {
    expect(rejectClaimId, 'TC-DL-02 must run first').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);

    const response = await damageLossClaimPage.rejectClaim(rejectClaimId);
    expect(response?.data?.damage_loss_claim?.status ?? response?.damage_loss_claim?.status).toBe('Rejected');

    await loginPage.logout();
  });
});
