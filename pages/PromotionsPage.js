const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Promotions (erpforce-fe: modules/crm/src/views/settings/promotions/) - confirmed real module,
// route `/dashboard/crm/settings/promotions`. The most complex screen in this suite: one main
// form (3 `type` variants) plus two nested modals (Add Coupon, Add Reward - itself 3 field-set
// variants keyed off the parent promotion's `type`). Implements the cases documented in
// CRM_SETTINGS_TEST_CASES.md's "2. Promotions" section.
//
// CONFIRMED SOURCE FACTS (form.tsx/validation.ts/add-coupon-modal.tsx/add-reward-modal.tsx):
// - `company_id` (apiType='company') renders its real live label as "Entity", same override
//   confirmed twice already on Shipping Rule/Customer Segments - NOT "Company" (en.ts's key name).
// - Coupon/Reward, in 'add' mode (a promotion not yet saved), are stored in LOCAL form state only
//   (`couponData`/`rewardRows`) and bundled into the main Save payload - neither dispatches its own
//   API call until the parent record already exists ('edit' mode).
// - The Coupon trigger is a `<span onClick>`, NOT a button - "Create Coupon" before one exists,
//   "Edit Coupon" once `couponData` is set. The Reward table's add trigger IS a real button
//   labelled "Add" (`common.add`, class `add-row-btn`) - there is no distinct "Add Reward" label.
// - Reward modal's Fixed Amount/Percentage variants gate `minimum_quantity` behind an EMBEDDED
//   checkbox (`min_quantity_cb`, titled "Minimum Quantity") passed as the input's own `label` prop
//   - not a plain field label, a nested checkbox+input combo.
// - `type` becomes disabled on Edit once `data.reward_data.length` > 0 (rewards already exist).
// - Same dead-approval-workflow pattern as Shipping Rule/Customer Segments: `view-promotion.tsx`
//   never calls `setOpenQuickApprovalModal(true)` anywhere - Quick Approval is unreachable via UI.
class PromotionsPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.listAddButton = page.getByRole('button', { name: 'Add' }).first();

    this.idInput = this.fieldInputByLabel('ID');
    this.nameInput = this.fieldInputByLabel('Name');
    this.typeField = 'Type';
    this.startDateInput = this.fieldInputByLabel('Start Date');
    this.endDateInput = this.fieldInputByLabel('End Date');
    this.companyField = 'Entity'; // apiType='company' - confirmed live override, see class comment
    this.accountField = 'Account';
    this.narrationInput = this.fieldTextareaByLabel('Narration');
    this.limitUsageCountInput = this.fieldInputByLabel('Limit');

    this.limitUsageCheckbox = page
      .getByText('Limit Usage', { exact: true })
      .locator('xpath=..')
      .getByRole('checkbox')
      .first();

    this.couponTrigger = page.getByText(/^(Create|Edit) Coupon$/);
    this.addRewardButton = page.getByRole('button', { name: 'Add', exact: true }).last();

    this.discardButton = page.getByRole('button', { name: 'Discard' });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    this.viewActionsButton = page.getByRole('button', { name: 'Actions' });
    this.viewSubmitButton = page.getByRole('button', { name: 'Submit', exact: true });

    this.nameRequiredError = page.getByText(/^Name is required$/i);
    this.typeRequiredError = page.getByText(/^Type is required$/i);
    this.startDateRequiredError = page.getByText(/^Start date is required$/i);
    this.companyRequiredError = page.getByText(/^Company is required$/i);
    this.accountRequiredError = page.getByText(/^Account is required$/i);
    this.endDateBeforeStartError = page.getByText(/^End date cannot be before start date$/i);
    this.limitRequiredError = page.getByText(/^Limit is required$/i);
  }

  async gotoList() {
    await this.page.goto('/dashboard/crm/settings/promotions');
    await this.page.waitForLoadState('networkidle');
  }

  async goto() {
    await this.gotoList();
    await this.listAddButton.click();
    await this.page.waitForURL('**/add-promotions');
    await this.page.waitForLoadState('networkidle');
  }

  fieldTextareaByLabel(labelText, { scope = this.page.getByRole('main') } = {}) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`);
    return scope.getByText(labelRegex).first().locator('xpath=..').locator('textarea').first();
  }

  async setLimitUsage(checked = true) {
    const isChecked = await this.limitUsageCheckbox.isChecked();
    if (isChecked !== checked) {
      await this.limitUsageCheckbox.click();
    }
  }

  async selectType(typeLabel) {
    await this.selectFieldByLabel(this.typeField, typeLabel, { exact: false });
  }

  async selectAccount(scope) {
    await this.selectFirstOptionByLabel(this.accountField, scope ? { scope } : {});
  }

  // ---------- Fill helpers ----------
  async fillGeneralDetails({
    name,
    type,
    startDate,
    endDate,
    limitUsage,
    limitUsageCount,
    narration,
    pickFirstAccount = true,
  } = {}) {
    if (name !== undefined) {
      await this.nameInput.fill(name);
    }
    if (type) {
      await this.selectType(type);
    }
    if (startDate !== undefined) {
      await this.startDateInput.fill(startDate);
    }
    if (endDate !== undefined) {
      await this.endDateInput.fill(endDate);
    }
    if (pickFirstAccount) {
      await this.selectAccount();
    }
    if (limitUsage !== undefined) {
      await this.setLimitUsage(limitUsage);
    }
    if (limitUsageCount !== undefined) {
      await this.limitUsageCountInput.fill(String(limitUsageCount));
    }
    if (narration !== undefined) {
      await this.narrationInput.fill(narration);
    }
  }

  // ---------- Coupon modal ----------
  couponModal() {
    return this.page.getByRole('dialog').filter({ hasText: 'Add New Coupons' });
  }

  async openCouponModal() {
    await this.couponTrigger.click();
    await this.couponModal().waitFor({ state: 'visible' });
  }

  async fillCoupon({ couponFormat = 'Alphanumeric', characterLimit, numberOfCoupons, limitUsage, usageLimit } = {}) {
    const modal = this.couponModal();
    await this.selectFieldByLabel('Code Format', couponFormat, { scope: modal, exact: false });
    if (characterLimit !== undefined) {
      await modal.getByPlaceholder('Enter Character Limit').fill(String(characterLimit));
    }
    if (numberOfCoupons !== undefined) {
      await modal.getByPlaceholder('Enter Number Of Coupons').fill(String(numberOfCoupons));
    }
    if (limitUsage !== undefined) {
      const box = modal.getByText('Limit Usage', { exact: true }).locator('xpath=..').getByRole('checkbox').first();
      const isChecked = await box.isChecked();
      if (isChecked !== limitUsage) await box.click();
    }
    if (usageLimit !== undefined) {
      await modal.getByPlaceholder('Limit').fill(String(usageLimit));
    }
  }

  async saveCoupon() {
    const modal = this.couponModal();
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
  }

  async cancelCoupon() {
    const modal = this.couponModal();
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
  }

  // ---------- Reward modal ----------
  rewardModal() {
    return this.page.getByRole('dialog').filter({ hasText: 'Add New Condition' });
  }

  async openRewardModal() {
    await this.addRewardButton.click();
    await this.rewardModal().waitFor({ state: 'visible' });
  }

  async selectRewardConditionType(modal, type) {
    // type: 'Item' | 'Order Total'
    await modal.getByRole('radio', { name: type, exact: true }).check();
  }

  async fillFixedAmountReward({
    conditionType = 'Item',
    minimumQuantity,
    orderTotal,
    discountValue,
    description,
  } = {}) {
    const modal = this.rewardModal();
    await this.selectRewardConditionType(modal, conditionType);
    if (conditionType === 'Item' && minimumQuantity !== undefined) {
      const cb = modal.getByText('Minimum Quantity', { exact: true }).locator('xpath=..').getByRole('checkbox').first();
      await cb.check();
      await modal.getByPlaceholder('Enter minimum quantity').fill(String(minimumQuantity));
    }
    if (conditionType === 'Order Total' && orderTotal !== undefined) {
      await modal.getByPlaceholder('0.00').first().fill(String(orderTotal));
    }
    if (discountValue !== undefined) {
      await modal.getByPlaceholder('0.00').last().fill(String(discountValue));
    }
    if (description !== undefined) {
      await modal.getByPlaceholder('Enter Description').fill(description);
    }
  }

  async fillPercentageReward({ conditionType = 'Item', minimumQuantity, orderTotal, discountPercentage, maxAmount, description } = {}) {
    const modal = this.rewardModal();
    await this.selectRewardConditionType(modal, conditionType);
    if (conditionType === 'Item' && minimumQuantity !== undefined) {
      const cb = modal.getByText('Minimum Quantity', { exact: true }).locator('xpath=..').getByRole('checkbox').first();
      await cb.check();
      await modal.getByPlaceholder('Enter minimum quantity').fill(String(minimumQuantity));
    }
    if (conditionType === 'Order Total' && orderTotal !== undefined) {
      await modal.getByPlaceholder('0.00').first().fill(String(orderTotal));
    }
    if (discountPercentage !== undefined) {
      const placeholders = modal.getByPlaceholder('0.00');
      await placeholders.nth(conditionType === 'Order Total' ? 1 : 0).fill(String(discountPercentage));
    }
    if (maxAmount !== undefined) {
      const placeholders = modal.getByPlaceholder('0.00');
      await placeholders.last().fill(String(maxAmount));
    }
    if (description !== undefined) {
      await modal.getByPlaceholder('Enter Description').fill(description);
    }
  }

  // "Products" (item_id) is a checkbox-list multiselect widget (a search box + rows of plain
  // checkboxes, confirmed live) - NOT the standard option-role listbox used by every other
  // DynamicSearchSelect field in this suite. Click the first checkbox row directly instead of
  // going through BasePage's option-role helpers.
  async selectFirstCheckboxListOption(labelText, scope) {
    const escapedLabel = labelText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const labelRegex = new RegExp(`^${escapedLabel}\\s*\\*?$`, 'i');
    const combobox = scope
      .getByText(labelRegex)
      .first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    await combobox.click();
    const firstCheckbox = this.page.getByRole('checkbox').filter({ hasNot: this.page.locator('input') }).first();
    await firstCheckbox.waitFor({ state: 'visible', timeout: 7000 });
    await firstCheckbox.click();
    await this.page.keyboard.press('Escape');
  }

  async fillBuyXGetYReward({ conditionName, minimumQuantity, rewardQuantity, description } = {}) {
    const modal = this.rewardModal();
    if (conditionName !== undefined) {
      await modal.getByPlaceholder('Enter Condition name').fill(conditionName);
    }
    if (minimumQuantity !== undefined) {
      await modal.getByPlaceholder('Enter minimum quantity').fill(String(minimumQuantity));
    }
    await this.selectFirstCheckboxListOption('Products', modal);
    await this.selectFirstOptionByLabel('Rewarding Product', { scope: modal });
    if (rewardQuantity !== undefined) {
      await modal.getByPlaceholder('Enter reward quantity').fill(String(rewardQuantity));
    }
    if (description !== undefined) {
      await modal.getByPlaceholder('Enter Description').fill(description);
    }
  }

  async saveReward() {
    const modal = this.rewardModal();
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
  }

  async cancelReward() {
    const modal = this.rewardModal();
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
  }

  // ---------- Save actions ----------
  async saveAndCaptureId(buttonLocator) {
    await buttonLocator.click();
    await this.page.waitForURL((url) => !/\/(add|edit)-promotions/.test(url.pathname), {
      timeout: 20000,
    });
    await this.page.waitForLoadState('networkidle');
    await this.page
      .locator('.MuiSkeleton-root')
      .first()
      .waitFor({ state: 'detached', timeout: 10000 })
      .catch(() => {});

    const rowText = await this.page.locator('table tbody tr').first().innerText();
    const match = rowText.match(/[A-Z]+-\d{4}-\d+/);
    const seriesNumber = match ? match[0] : rowText.split('\n')[0];
    return { id: seriesNumber, seriesNumber };
  }

  async save() {
    return this.saveAndCaptureId(this.saveButton);
  }

  async saveAsDraft() {
    return this.saveAndCaptureId(this.saveToDraftButton);
  }

  // ---------- Row status / navigation ----------
  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Draft|Submitted|Approved|Rejected/);
  }

  async openEditFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await this.page.waitForURL('**/edit-promotions');
    await this.page.waitForLoadState('networkidle');
    await expect(this.nameInput).not.toHaveValue('', { timeout: 10000 });
  }

  async openViewFromList(seriesNumber) {
    await this.rowBySeriesNumber(seriesNumber).getByText(/Draft|Submitted|Approved|Rejected/).first().click();
    await this.page.waitForURL('**/view-promotions');
    await this.page.waitForLoadState('networkidle');
  }

  async clickSubmitAndCaptureConsole() {
    let consoleMessage = null;
    const handler = (msg) => {
      if (msg.text().toLowerCase().includes('submit')) consoleMessage = msg.text();
    };
    this.page.on('console', handler);
    await this.viewSubmitButton.click();
    await this.page.waitForTimeout(1000);
    this.page.off('console', handler);
    return consoleMessage;
  }
}

module.exports = PromotionsPage;
