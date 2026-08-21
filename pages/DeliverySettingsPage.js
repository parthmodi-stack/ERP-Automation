const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Delivery Settings (erpforce-fe: modules/crm/src/views/settings/delivery-settings/) - confirmed
// real module, route `/dashboard/crm/settings/settings`. Implements the cases documented in
// CRM_SETTINGS_TEST_CASES.md's "4. Delivery Settings" section (TC-DLVS-01..04, TC-DLVS-V01..05).
//
// NOT a list/CRUD screen: a single global settings record (`delivery-settiing.tsx` - filename typo
// confirmed in source, not a transcription error here), no Add/Delete/Search/Sort/Pagination.
// `useForm` has no resolver at all - zero schema-level validation on this screen.
//
// CONFIRMED LIVE (corrects earlier source-only research): only `quote_percentage`'s label/
// placeholder actually render as the raw untranslated key today - `enable_rate_below_cost`
// correctly shows "Enable Rate Below Cost" and `require_quotation_for_sales_order` correctly shows
// "Require Quotation for Sales Order Creation" (a real en.ts key was added for the former since
// the source-only pass; the latter's exact wording differs from source labels-only reading). See
// TC-DLVS-V05 below for the one bug that IS still confirmed live.
//
// The three real-labeled checkboxes are plain MUI `Checkbox` + `FormControlLabel`, which DOES
// produce a real associated `<label>` (unlike the sibling-only DynamicToggleButton pattern used by
// Shipping Rule/Customer Segments) - `getByRole('checkbox', { name })` works directly here.
class DeliverySettingsPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.allowMultipleLocationsCheckbox = page.getByRole('checkbox', {
      name: 'Allow Delivery From Multiple Locations',
    });
    this.invoiceInAdvanceCheckbox = page.getByRole('checkbox', { name: 'Invoice In Advance' });
    this.requireQuotationCheckbox = page.getByRole('checkbox', {
      name: 'Require Quotation for Sales Order Creation',
    });
    this.enableRateBelowCostCheckbox = page.getByRole('checkbox', { name: 'Enable Rate Below Cost' });
    this.quotePercentageInput = page.getByPlaceholder('crm.settings.quote_percentage_label');

    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
  }

  async goto() {
    await this.page.goto('/dashboard/crm/settings/settings');
    await this.page.waitForLoadState('networkidle');
    await expect(this.allowMultipleLocationsCheckbox).toBeVisible({ timeout: 15000 });
  }

  async setCheckbox(locator, checked) {
    const isChecked = await locator.isChecked();
    if (isChecked !== checked) {
      await locator.click();
    }
  }

  // CONFIRMED LIVE: a plain click() + waitForLoadState('networkidle') can race ahead of the
  // handler's own async PATCH /v1/delivery-settings/:id dispatch (networkidle can report "0
  // in-flight requests" in the brief synchronous gap before the request actually fires) - arm the
  // response listener BEFORE/simultaneously with the click instead of after it.
  async save() {
    const [response] = await Promise.all([
      this.page
        .waitForResponse((r) => /\/delivery-settings\/\d+/.test(r.url()) && r.request().method() === 'PATCH')
        .catch(() => null),
      this.saveButton.click(),
    ]);
    await this.page.waitForLoadState('networkidle');
    return response;
  }
}

module.exports = DeliverySettingsPage;
