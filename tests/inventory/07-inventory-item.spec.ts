import { test, expect, Page } from '@playwright/test';

// ─── Configuration ───────────────────────────────────────────────────────────
// const BASE_URL   = 'https://dev.erpforce.co';
const BASE_URL   = 'http://localhost:7172';

const ITEMS_URL  = `${BASE_URL}/dashboard/inventory/product-management/items`;

// Test data
const ITEM_NAME      = `Playwright Auto Item_${Date.now()}`;
const CATEGORY       = 'Electronics';
const COSTING_METHOD = 'FIFO';
const DEPARTMENT     = 'Test Operations';
const SALES_PRICE    = '750';
const LEAD_TIME      = '7';
const WEIGHT         = '3.5';
const HSN_CODE       = 'HSN998877';
const AVG_COST       = '350';

// ─── Helper: wait for page to be idle ────────────────────────────────────────
async function waitForIdle(page: Page, ms = 1500) {
  await page.waitForTimeout(ms);
}

// ─── Helper: select from the app's searchable dropdown component ────────────
// Every dropdown on this form (Category, Location, Department, Unit of
// Measurement, Costing Method) shares the same structure: clicking the
// combobox opens a menu (id="menu-add_inventory_item.<field>") containing a
// filter <input> and a list of <li> options. The first <li> is always the
// "Select ..." placeholder. Some lists (e.g. Location) populate asynchronously
// after the menu opens, so we wait for more than just the placeholder to exist.
// Pass no optionText to pick the first real (non-placeholder) option.
async function selectFromDropdown(page: Page, fieldName: string, optionText?: string) {
  await page.locator(`[id="mui-component-select-add_inventory_item.${fieldName}"]`).click();
  const menu = page.locator(`[id="menu-add_inventory_item.${fieldName}"]`);
  await menu.waitFor({ state: 'visible', timeout: 5000 });

  await expect(async () => {
    expect(await menu.locator('li').count()).toBeGreaterThan(1);
  }).toPass({ timeout: 8000, intervals: [300] });

  if (optionText) {
    await menu.locator('input').fill(optionText);
    await waitForIdle(page, 600);
    await menu.locator(`li:has-text("${optionText}")`).first().click();
  } else {
    await menu.locator('li').nth(1).click();
  }

  await menu.waitFor({ state: 'hidden', timeout: 5000 });
}

// ─── Main Test ───────────────────────────────────────────────────────────────
test.describe('ERPForce – Add Inventory Item (full flow)', () => {

  test('Create inventory item with all required fields', { tag: '@smoke' }, async ({ page }) => {
    test.setTimeout(120000); // ~14 tab transitions with slowMo exceed the 30s default

    // ── STEP 1: Navigate to Items list and click Add ──────────────────────────
    await page.goto(ITEMS_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add' }).click();
    await page.waitForURL('**/add-inventory-item');
    await page.waitForLoadState('networkidle');
    await waitForIdle(page);

    console.log('✅ Step 1 – Add button clicked');

    // ── STEP 2: Click Save → verify error validation ──────────────────────────
    // The "Please fill all the required fields." banner is a toast that can
    // auto-dismiss, so check immediately after the click instead of waiting
    // first, otherwise the dwell time eats into the toast's visible window.
    await page.getByRole('button', { name: 'Save' }).click();

    // Under heavy load (e.g. deep into a long regression run) the click can land
    // before the form's event handlers are fully wired up and get silently
    // swallowed — no toast, no inline errors, nothing. Use a persistent inline
    // error (not the toast) as a quick signal, and retry the click once if
    // nothing showed up at all.
    const nameError = page.getByText('Name is required');
    try {
      await expect(nameError).toBeVisible({ timeout: 4000 });
    } catch {
      console.log('⚠️  No validation feedback after first Save click — retrying click');
      await page.getByRole('button', { name: 'Save' }).click();
    }

    // Verify required-field errors
    await expect(page.getByText('Please fill all the required fields.')).toBeVisible({ timeout: 5000 });
    await expect(nameError).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Category is required')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Select Stock Unit')).toBeVisible({ timeout: 5000 });

    console.log('✅ Step 2 – Error validation confirmed');

    // ── STEP 3: Fill Name and select Category ─────────────────────────────────
    await page.getByPlaceholder('Enter Name').fill(ITEM_NAME);
    await selectFromDropdown(page, 'category', CATEGORY);

    console.log('✅ Step 3 – Name and Category filled');

    // ── STEP 4: Select Unit of Measurement and Costing Method ────────────────
    // Unit of Measurement is dynamic master data like Location (grows/churns
    // over time from other automation runs), and its filter input doesn't
    // reliably narrow the list down to a specific name (typing a search term
    // can still return the full unfiltered list) — pick first available
    // instead of a hardcoded name, same as Location below. Base Unit is
    // auto-filled and DISABLED regardless of which one is picked → skip it.
    await selectFromDropdown(page, 'unit_of_measurement');
    await selectFromDropdown(page, 'costing_method', COSTING_METHOD);

    console.log('✅ Step 4 – UOM and Costing Method selected');

    // ── STEP 5: Select Location and Department ────────────────────────────────
    await selectFromDropdown(page, 'location'); // pick first available location
    await selectFromDropdown(page, 'department', DEPARTMENT);

    console.log('✅ Step 5 – Location and Department selected');

    // ── STEP 5.5: Fix duplicate SKU if the auto-generated SKU is already taken ─
    const skuInput = page.getByPlaceholder('Enter Number');
    if ((await skuInput.getAttribute('aria-invalid')) === 'true') {
      const currentSku = await skuInput.inputValue();
      await skuInput.fill(currentSku + '1');
      await waitForIdle(page, 500);
      console.log(`✅ Step 5.5 – Duplicate SKU fixed: ${currentSku} → ${currentSku}1`);
    }

    // ── STEP 6: Click Next → Rental Price ────────────────────────────────────
    await page.getByRole('button', { name: 'Next' }).click();
    await waitForIdle(page, 2000);
    await expect(page.locator('[role="tab"][aria-selected="true"]'))
      .toHaveText(/Rental Price/i);

    console.log('✅ Step 6 – Navigated to Rental Price tab');

    // ── STEP 7: Click Next → Sales ────────────────────────────────────────────
    await page.getByRole('button', { name: 'Next' }).click();
    await waitForIdle(page, 2000);
    await expect(page.locator('[role="tab"][aria-selected="true"]'))
      .toHaveText(/Sales/i);

    console.log('✅ Step 7 – Navigated to Sales tab');

    // ── STEP 8: Add Sales Price → Next ────────────────────────────────────────
    await page.getByPlaceholder('Enter Sales Price').fill(SALES_PRICE);
    // NOTE: "inventory_items.form.sales_replacement_cost_label" field is a
    //       disabled/unresolved-locale field → skip it

    await page.getByRole('button', { name: 'Next' }).click();
    await waitForIdle(page, 2000);
    await expect(page.locator('[role="tab"][aria-selected="true"]'))
      .toHaveText(/Purchase/i);

    console.log('✅ Step 8 – Sales Price entered, navigated to Purchase tab');

    // ── STEP 9: Next → Accounting ─────────────────────────────────────────────
    await page.getByRole('button', { name: 'Next' }).click();
    await waitForIdle(page, 2000);
    await expect(page.locator('[role="tab"][aria-selected="true"]'))
      .toHaveText(/Accounting/i);

    console.log('✅ Step 9 – Navigated to Accounting tab (pre-filled values used)');

    // ── STEP 10: Next → Inventory ─────────────────────────────────────────────
    await page.getByRole('button', { name: 'Next' }).click();
    await waitForIdle(page, 2000);
    await expect(page.locator('[role="tab"][aria-selected="true"]'))
      .toHaveText(/Inventory/i);

    console.log('✅ Step 10 – Navigated to Inventory tab');

    // ── STEP 11: Fill Inventory fields (skip disabled fields) ─────────────────
    await page.getByPlaceholder('Enter Default Lead Time in Days').fill(LEAD_TIME);
    await page.getByPlaceholder('Enter Weight').fill(WEIGHT);
    await page.getByPlaceholder('Enter HSN Code').fill(HSN_CODE);
    await page.getByPlaceholder('Enter Average Cost').fill(AVG_COST);

    console.log('✅ Step 11 – Inventory fields filled');

    // ── STEP 12: Check Use Bins, Apply For Prices, Apply For Quantity ─────────
    // These fields have no <label> wrapper: a heading <p> followed by a
    // <div><span class="MuiCheckbox-root"><input type="checkbox">...</span></div>.
    // Scope to the Grid item that contains the field's text and toggle the
    // visible checkbox span (the underlying input is visually hidden by MUI).
    async function ensureCheckboxChecked(labelText: string) {
      const heading = page.locator('p', { hasText: labelText, exact: true }).first();
      const field = heading.locator('xpath=following-sibling::div[1]');
      const input = field.locator('input[type="checkbox"]');
      if (!(await input.isChecked())) {
        await field.locator('span.MuiCheckbox-root').click();
      }
      await expect(input).toBeChecked();
    }

    await ensureCheckboxChecked('Use Bins');
    await ensureCheckboxChecked('Apply For Prices');
    await ensureCheckboxChecked('Apply For Quantity');

    console.log('✅ Step 12 – Use Bins, Apply For Prices, Apply For Quantity checked');

    // ── STEP 13: Click Next 4 times → Variant ─────────────────────────────────
    const intermediatesTabs = [
      'Price Rules/Sales',
      'Update Quantity',
      'Moves History',
      'Reordering Rules',
    ];

    for (const tabName of intermediatesTabs) {
      await page.getByRole('button', { name: 'Next' }).click();
      await waitForIdle(page, 2000);
      await expect(page.locator('[role="tab"][aria-selected="true"]'))
        .toHaveText(new RegExp(tabName, 'i'));
      console.log(`  → Passed through: ${tabName}`);
    }

    // One more click → Variant (last tab, Next disappears)
    await page.getByRole('button', { name: 'Next' }).click();
    await waitForIdle(page, 2000);
    await expect(page.locator('[role="tab"][aria-selected="true"]'))
      .toHaveText(/Variant/i);
    // Confirm Next button is gone
    await expect(page.getByRole('button', { name: 'Next' })).not.toBeVisible();

    console.log('✅ Step 13 – Navigated to Variant tab');

    // ── STEP 14: Click Save ────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL('**/items', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Verify the new item is in the list
    const row = page.locator('tr', { hasText: ITEM_NAME });
    await expect(row).toBeVisible();
    await expect(row.getByText('Active')).toBeVisible();
    await expect(row.getByText(`AED ${Number(SALES_PRICE).toFixed(4)}`)).toBeVisible();

    console.log(`✅ Step 14 – Item "${ITEM_NAME}" saved successfully!`);
    console.log('🎉 All 14 steps completed!');
  });
});
