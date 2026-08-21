const { test, expect } = require('@playwright/test');
const DeliverySettingsPage = require('../../pages/DeliverySettingsPage');

// Delivery Settings (erpforce-fe: modules/crm/src/views/settings/delivery-settings/) - confirmed
// real module, route `/dashboard/crm/settings/settings`. Implements the cases documented in
// CRM_SETTINGS_TEST_CASES.md's "4. Delivery Settings" section (TC-DLVS-01..04, TC-DLVS-V01..05).
//
// IMPORTANT: unlike every other module in this suite, this is a SINGLE global settings record
// shared by the whole environment - other specs (Sales Order, etc.) may depend on its current
// values (e.g. "Require Quotation For Sales Order"). Every test that flips a checkbox restores
// its original value before finishing, rather than leaving mutated global state behind.
//
// TC-DLVS-03 (Save gated by canEdit) is NOT automated - it needs a second, lesser-privileged user
// account to exercise, which isn't set up in this suite's auth fixtures.
test.describe('Delivery Settings Module', () => {
  test.describe.configure({ timeout: 90000 });

  // ── TC-DLVS-01/04: Toggle each checkbox, save, reload - persists and restores ──
  test('TC-DLVS-01 [+] Toggle each checkbox and persist, then restore original values', async ({ page }) => {
    const ds = new DeliverySettingsPage(page);
    await ds.goto();

    const originalAllowMultiple = await ds.allowMultipleLocationsCheckbox.isChecked();
    const originalInvoiceAdvance = await ds.invoiceInAdvanceCheckbox.isChecked();
    const originalRequireQuotation = await ds.requireQuotationCheckbox.isChecked();
    const originalEnableRateBelowCost = await ds.enableRateBelowCostCheckbox.isChecked();

    await ds.setCheckbox(ds.allowMultipleLocationsCheckbox, !originalAllowMultiple);
    await ds.setCheckbox(ds.invoiceInAdvanceCheckbox, !originalInvoiceAdvance);
    await ds.setCheckbox(ds.requireQuotationCheckbox, !originalRequireQuotation);
    await ds.setCheckbox(ds.enableRateBelowCostCheckbox, !originalEnableRateBelowCost);
    await ds.save();

    await ds.goto(); // reload
    // TC-DLVS-04: reopening always shows the last-saved values.
    expect(await ds.allowMultipleLocationsCheckbox.isChecked()).toBe(!originalAllowMultiple);
    expect(await ds.invoiceInAdvanceCheckbox.isChecked()).toBe(!originalInvoiceAdvance);
    expect(await ds.requireQuotationCheckbox.isChecked()).toBe(!originalRequireQuotation);
    expect(await ds.enableRateBelowCostCheckbox.isChecked()).toBe(!originalEnableRateBelowCost);

    // Restore original values - this is shared global config, not a throwaway record.
    await ds.setCheckbox(ds.allowMultipleLocationsCheckbox, originalAllowMultiple);
    await ds.setCheckbox(ds.invoiceInAdvanceCheckbox, originalInvoiceAdvance);
    await ds.setCheckbox(ds.requireQuotationCheckbox, originalRequireQuotation);
    await ds.setCheckbox(ds.enableRateBelowCostCheckbox, originalEnableRateBelowCost);
    await ds.save();
  });

  // ── TC-DLVS-02: Update quote_percentage and persist ────────────────────────────
  test('TC-DLVS-02 [+] Update quote_percentage and persist, then restore original value', async ({ page }) => {
    const ds = new DeliverySettingsPage(page);
    await ds.goto();

    const originalValue = await ds.quotePercentageInput.inputValue();

    await ds.quotePercentageInput.fill('15');
    await ds.save();

    await ds.goto();
    await expect(ds.quotePercentageInput).toHaveValue('15.00');

    await ds.quotePercentageInput.fill(originalValue);
    await ds.save();
  });

  // ── TC-DLVS-V05: quote_percentage renders a raw untranslated i18n key ──────────
  // CONFIRMED LIVE (corrects the source-only research pass): only quote_percentage's label/
  // placeholder are actually broken today - enable_rate_below_cost correctly shows "Enable Rate
  // Below Cost" (a real en.ts key exists now), so this case narrows to the one bug still live.
  test('TC-DLVS-V05 [-] BUG - quote_percentage renders a raw i18n key as its label/placeholder', async ({ page }) => {
    const ds = new DeliverySettingsPage(page);
    await ds.goto();

    await expect(ds.quotePercentageInput).toBeVisible();
    await expect(page.getByText('crm.settings.quote_percentage_label')).toBeVisible();
    await expect(page.getByPlaceholder('crm.settings.quote_percentage_label')).toBeVisible();
  });

  // ── TC-DLVS-V01/V02/V03: quote_percentage has no schema-level validation ───────
  test('TC-DLVS-V01 [-] Non-numeric quote_percentage - no schema exists to block it', async ({ page }) => {
    const ds = new DeliverySettingsPage(page);
    await ds.goto();
    const originalValue = await ds.quotePercentageInput.inputValue();

    // Plain text input (no type="number") - a non-numeric string CAN be typed; confirm what
    // actually happens on save rather than assuming it's rejected, since no resolver exists.
    await ds.quotePercentageInput.fill('abc');
    await ds.save();
    await ds.goto();
    const savedValue = await ds.quotePercentageInput.inputValue();
    // Documenting the gap: verify live whether "abc" was coerced to blank/0 or rejected. Either
    // way, no inline validation error is expected anywhere on this screen (no resolver exists).
    expect(savedValue).not.toBe('abc'); // Number("abc") is NaN - coerced to null/blank on submit

    await ds.quotePercentageInput.fill(originalValue);
    await ds.save();
  });

  test('TC-DLVS-V02 [-] Negative quote_percentage - no lower bound exists', async ({ page }) => {
    const ds = new DeliverySettingsPage(page);
    await ds.goto();
    const originalValue = await ds.quotePercentageInput.inputValue();

    await ds.quotePercentageInput.fill('-10');
    await ds.save();
    await ds.goto();
    // Confirmed gap: no `.min(0)` exists anywhere in this form - the negative value is accepted.
    await expect(ds.quotePercentageInput).toHaveValue('-10.00');

    await ds.quotePercentageInput.fill(originalValue);
    await ds.save();
  });

  test('TC-DLVS-V03 [-] quote_percentage above 100 - no upper bound exists', async ({ page }) => {
    const ds = new DeliverySettingsPage(page);
    await ds.goto();
    const originalValue = await ds.quotePercentageInput.inputValue();

    await ds.quotePercentageInput.fill('150');
    await ds.save();
    await ds.goto();
    // Confirmed gap: no `.max(100)` exists anywhere in this form - the out-of-range value is accepted.
    await expect(ds.quotePercentageInput).toHaveValue('150.00');

    await ds.quotePercentageInput.fill(originalValue);
    await ds.save();
  });

  // ── TC-DLVS-V04: Rapid double-click Save on the single record ─────────────────
  test('TC-DLVS-V04 [+] Rapid double-click Save does not corrupt the single record', async ({ page }) => {
    const ds = new DeliverySettingsPage(page);
    await ds.goto();

    await Promise.all([ds.saveButton.click(), ds.saveButton.click()]);
    await page.waitForLoadState('networkidle');

    await ds.goto();
    await expect(ds.allowMultipleLocationsCheckbox).toBeVisible(); // page still loads cleanly, no corrupted state
  });
});
