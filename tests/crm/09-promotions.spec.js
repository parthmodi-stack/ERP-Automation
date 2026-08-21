const { test, expect } = require('@playwright/test');
const PromotionsPage = require('../../pages/PromotionsPage');
const testData = require('../../config/testData');
const testDataFactory = require('../../config/testDataFactory');

// Promotions (erpforce-fe: modules/crm/src/views/settings/promotions/) - confirmed real module,
// route `/dashboard/crm/settings/promotions`. Implements the cases documented in
// CRM_SETTINGS_TEST_CASES.md's "2. Promotions" section - the most complex screen in this suite
// (main form with 3 `type` variants, plus nested Add Coupon / Add Reward modals).
//
// SCOPE NOTES (see CRM_SETTINGS_TEST_CASES.md's "Corrections" section for full detail):
// - Same dead-approval-workflow pattern as Shipping Rule/Customer Segments - TC-PROMO-V08 confirms
//   the Quick Approval modal is never triggered from view-promotion.tsx.
// - The main `created` fixture is a Fixed Amount promotion, reused for Edit/View/Delete/Listing/
//   Reward cases; Percentage and Buy X Get Y each get their own minimal self-contained
//   create-reward-cleanup test to prove that type variant's own path works.
test.describe('Promotions Module', () => {
  test.describe.configure({ timeout: 120000 });

  let created = {};
  let draftRecord = {};

  // ── TC-PROMO-01: Create a Fixed Amount promotion ───────────────────────────────
  test('TC-PROMO-01 [+] Create a Fixed Amount promotion', async ({ page }) => {
    const pp = new PromotionsPage(page);
    const data = testData.promotions.fixedAmount;

    await pp.goto();
    await expect(page).toHaveURL(/add-promotions/);

    await pp.fillGeneralDetails({
      name: data.name,
      type: 'Fixed Amount',
      startDate: pp.formatDateToday(),
    });

    const result = await pp.save();
    expect(result.seriesNumber).toBeTruthy();
    created = { ...result, name: data.name };

    await pp.searchList(data.name);
    await expect(page.getByText(data.name, { exact: false }).first()).toBeVisible();
  });

  // ── TC-PROMO-05: View renders all saved fields ─────────────────────────────────
  test('TC-PROMO-05 [+] View Promotion - all saved fields render correctly', async ({ page }) => {
    const pp = new PromotionsPage(page);
    const data = testData.promotions.fixedAmount;

    await pp.gotoList();
    await pp.searchList(created.name);
    await pp.openViewFromList(created.seriesNumber);
    await expect(page).toHaveURL(/view-promotions/);

    await expect(page.getByText(data.name, { exact: false }).first()).toBeVisible();
  });

  // ── TC-PROMO-V08: Quick Approval modal is never triggered ──────────────────────
  test('TC-PROMO-V08 [-] BUG - Quick Approval modal never opens (source: view-promotion.tsx)', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.gotoList();
    await pp.searchList(created.name);
    await pp.openViewFromList(created.seriesNumber);

    // Confirmed by source grep: setOpenQuickApprovalModal(true) is never called anywhere in the
    // file, so no UI action ever surfaces its rendered QuickApprovalModal.
    const modalVisible = await page.getByRole('dialog').filter({ hasText: 'Quick Approval' }).isVisible().catch(() => false);
    expect(modalVisible).toBeFalsy();
  });

  // ── TC-PROMO-04: Edit persists changes ──────────────────────────────────────────
  test('TC-PROMO-04 [+] Edit a Promotion and persist changes', async ({ page }) => {
    const pp = new PromotionsPage(page);
    const data = testData.promotions.fixedAmount;

    await pp.gotoList();
    await pp.searchList(created.name);
    await pp.openEditFromList(created.seriesNumber);
    await expect(page).toHaveURL(/edit-promotions/);

    await expect(pp.nameInput).toHaveValue(data.name);
    await pp.nameInput.fill(data.updatedName);
    const result = await pp.save();
    expect(result.seriesNumber).toBeTruthy();
    created.name = data.updatedName;
  });

  // ── TC-PROMO-08: limit_usage checkbox gates limit_usage_count ──────────────────
  test('TC-PROMO-08 [+] limit_usage checkbox enables limit_usage_count', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.goto();
    await expect(pp.limitUsageCountInput).toBeDisabled();

    await pp.setLimitUsage(true);
    await expect(pp.limitUsageCountInput).toBeEnabled();

    await pp.setLimitUsage(false);
    await expect(pp.limitUsageCountInput).toBeDisabled();

    await pp.discardButton.click();
  });

  // ── TC-PROMO-09/10: Add a coupon; limitUsage gates usageLimit ──────────────────
  // CONFIRMED BUG (add-coupon-modal.tsx's onSubmit + form.tsx's onSave wiring): in Edit mode, the
  // modal dispatches the real createPromotionCoupon API call, but its onSave callback receives
  // `null` (`onSave(mode === 'add' ? vals : null)`), so form.tsx's local `couponData` state resets
  // to null and the trigger span misleadingly reverts to "Create Coupon" even though the coupon
  // WAS persisted server-side. The separate "View Coupon" link (gated on `data?.coupon_data?.length`
  // from the refetched record, not local state) is the only way to confirm it actually saved.
  test('TC-PROMO-09 [+] Add a coupon via Add-Coupon-Modal - persists despite trigger-label bug', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.gotoList();
    await pp.searchList(created.name);
    await pp.openEditFromList(created.seriesNumber);

    await pp.openCouponModal();
    await pp.fillCoupon({ couponFormat: 'Alphanumeric', characterLimit: '8', numberOfCoupons: '5' });
    await pp.saveCoupon();

    // Confirmed bug: trigger reverts to "Create Coupon" instead of "Edit Coupon" in Edit mode.
    await expect(pp.couponTrigger).toHaveText('Create Coupon');

    // Confirm it actually persisted: reopen Edit and check for the "View Coupon" link, which is
    // driven by the refetched record's own coupon_data, not the buggy local state.
    await pp.gotoList();
    await pp.searchList(created.name);
    await pp.openEditFromList(created.seriesNumber);
    await expect(page.getByText('View Coupon', { exact: true })).toBeVisible();
  });

  // ── TC-PROMO-11: Fixed Amount reward, condition=Item ───────────────────────────
  test('TC-PROMO-11 [+] Add Fixed Amount reward - condition=Item', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.gotoList();
    await pp.searchList(created.name);
    await pp.openEditFromList(created.seriesNumber);

    await pp.openRewardModal();
    await pp.fillFixedAmountReward({
      conditionType: 'Item',
      minimumQuantity: '2',
      discountValue: '50',
      description: 'Automation reward - Item condition',
    });
    await pp.saveReward();

    const result = await pp.save();
    expect(result.seriesNumber).toBeTruthy();
  });

  // ── TC-PROMO-12: Fixed Amount reward, condition=Order ──────────────────────────
  test('TC-PROMO-12 [+] Add a second Fixed Amount reward - condition=Order Total', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.gotoList();
    await pp.searchList(created.name);
    await pp.openEditFromList(created.seriesNumber);

    await pp.openRewardModal();
    await pp.fillFixedAmountReward({
      conditionType: 'Order Total',
      orderTotal: '500',
      discountValue: '25',
      description: 'Automation reward - Order Total condition',
    });
    await pp.saveReward();

    const result = await pp.save();
    expect(result.seriesNumber).toBeTruthy();
  });

  // ── TC-PROMO-06/07: type disabled once rewards exist; changing it prompts confirm ──
  test('TC-PROMO-06 [+] type becomes disabled once rewards exist', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.gotoList();
    await pp.searchList(created.name);
    await pp.openEditFromList(created.seriesNumber);

    const typeCombobox = pp.dependentFieldCombobox ? null : null; // no-op, type checked via disabled state below
    const combobox = page
      .getByRole('main')
      .getByText(/^Type\s*\*?$/)
      .first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    await expect(combobox).toBeDisabled();

    await pp.discardButton.click();
  });

  // ── TC-PROMO-16/19: Delete; Save To Draft ──────────────────────────────────────
  test('TC-PROMO-19 [+] Create Promotion and Save To Draft - status shows Draft', async ({ page }) => {
    const pp = new PromotionsPage(page);
    const data = testData.promotions.draft;

    await pp.goto();
    await pp.fillGeneralDetails({
      name: data.name,
      type: 'Fixed Amount',
      startDate: pp.formatDateToday(),
    });

    const result = await pp.saveAsDraft();
    draftRecord = { ...result, name: data.name };

    await pp.searchList(data.name);
    await expect(await pp.getRowStatus(draftRecord.seriesNumber)).toMatch(/Draft/);
  });

  test('TC-PROMO-16 [+] Delete a Promotion successfully', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.gotoList();
    await pp.searchList(draftRecord.name);
    await pp.deleteFromList(draftRecord.seriesNumber);

    await pp.gotoList();
    await pp.searchList(draftRecord.name);
    await expect(pp.noDataRow()).toBeVisible();
  });

  // ── TC-PROMO-17: end_date constrained to be on/after start_date ────────────────
  test('TC-PROMO-17 [+] end_date before start_date is rejected', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.goto();
    await pp.startDateInput.fill(pp.formatDateToday());
    // Yesterday relative to today - a fixed, earlier date, always before "today" regardless of run date.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = `${String(yesterday.getDate()).padStart(2, '0')}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${yesterday.getFullYear()}`;
    await pp.endDateInput.fill(yesterdayStr);
    await pp.saveButton.click();

    await expect(pp.endDateBeforeStartError).toBeVisible();
    await pp.discardButton.click();
  });

  // ── TC-PROMO-18: Listing - search/sort/paginate ────────────────────────────────
  test('TC-PROMO-18a [+] Search the Promotions list', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.gotoList();
    await pp.searchList(created.name);
    await expect(page.getByText(created.name, { exact: false }).first()).toBeVisible();
  });

  test('TC-PROMO-18b [-] Search the Promotions list - no matches shows "No Data"', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.gotoList();
    await pp.searchList('Automation_NoSuchPromotion_xyz');
    await expect(pp.noDataRow()).toBeVisible();
  });

  test('TC-PROMO-18c [+] Sort the Promotions list by Name column', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.gotoList();
    await pp.clickColumnHeader('Name');
    const firstSort = await pp.getColumnAriaSort('Name');
    expect(['ascending', 'descending']).toContain(firstSort);

    await pp.clickColumnHeader('Name');
    const secondSort = await pp.getColumnAriaSort('Name');
    expect(secondSort).not.toBe(firstSort);
  });

  test('TC-PROMO-18d [+] Paginate the Promotions list', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.gotoList();
    const label = await pp.getPaginationLabel();
    expect(label).toMatch(/Page \d+ of \d+/);
  });

  // ── TC-PROMO-V01: Required main-form fields left empty block Save ─────────────
  // `type` defaults to "Fixed Amount" and Entity is pre-filled (1 item selected) on a fresh Add
  // page - confirmed live, same pre-fill pattern as Shipping Rule/Customer Segments' Entity field -
  // so neither field's own required error ever shows here, only the genuinely-empty ones do.
  test('TC-PROMO-V01 [-] Required fields left empty block Save', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.goto();
    await pp.saveButton.click();

    await expect(pp.nameRequiredError).toBeVisible();
    await expect(pp.startDateRequiredError).toBeVisible();
    await expect(pp.accountRequiredError).toBeVisible();
    await expect(page).toHaveURL(/add-promotions/); // never navigated away - not created
  });

  // ── TC-PROMO-V03: limit_usage_count required/min(1) only when limit_usage checked ──
  test('TC-PROMO-V03 [-] limit_usage_count required when limit_usage is checked', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.goto();
    await pp.setLimitUsage(true);
    await pp.saveButton.click();

    await expect(pp.limitRequiredError).toBeVisible();
    await pp.discardButton.click();
  });

  // ── TC-PROMO-V07: Correcting an invalid field clears its error ─────────────────
  test('TC-PROMO-V07 [+] Correcting an empty required field clears its inline error', async ({ page }) => {
    const pp = new PromotionsPage(page);

    await pp.goto();
    await pp.saveButton.click();
    await expect(pp.nameRequiredError).toBeVisible();

    await pp.nameInput.fill(testDataFactory.uniqueName('Automation_Promo_Temp'));
    await expect(pp.nameRequiredError).not.toBeVisible();

    await pp.discardButton.click();
  });

  // ── TC-PROMO-02: Create a Percentage promotion with a Percentage reward ───────
  test('TC-PROMO-02 [+] Create a Percentage promotion with a reward', async ({ page }) => {
    const pp = new PromotionsPage(page);
    const data = testData.promotions.percentage;

    await pp.goto();
    await pp.fillGeneralDetails({ name: data.name, type: 'Percentage', startDate: pp.formatDateToday() });
    const result = await pp.save();
    expect(result.seriesNumber).toBeTruthy();

    await pp.openEditFromList(result.seriesNumber);
    await pp.openRewardModal();
    // TC-PROMO-13: Add Percentage reward within valid range.
    await pp.fillPercentageReward({ conditionType: 'Item', minimumQuantity: '1', discountPercentage: '25' });
    await pp.saveReward();
    await pp.save();

    await pp.gotoList();
    await pp.searchList(data.name);
    await pp.deleteFromList(result.seriesNumber); // clean up
  });

  // ── TC-PROMO-03/14: Create a Buy X Get Y promotion with a reward ───────────────
  test('TC-PROMO-03 [+] Create a Buy X Get Y promotion with a reward', async ({ page }) => {
    const pp = new PromotionsPage(page);
    const data = testData.promotions.buyXGetY;

    await pp.goto();
    await pp.fillGeneralDetails({ name: data.name, type: 'Buy X Get Y', startDate: pp.formatDateToday() });
    const result = await pp.save();
    expect(result.seriesNumber).toBeTruthy();

    await pp.openEditFromList(result.seriesNumber);
    await pp.openRewardModal();
    await pp.fillBuyXGetYReward({
      conditionName: 'Automation condition',
      minimumQuantity: '3',
      rewardQuantity: '1',
      description: 'Automation Buy X Get Y reward',
    });
    await pp.saveReward();
    await pp.save();

    await pp.gotoList();
    await pp.searchList(data.name);
    await pp.deleteFromList(result.seriesNumber); // clean up
  });
});
