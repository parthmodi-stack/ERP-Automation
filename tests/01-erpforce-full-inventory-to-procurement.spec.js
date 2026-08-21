// erpforce-full-inventory-to-procurement.spec.js
// Integrates 10 of this suite's individually-passing @smoke test cases into ONE continuous flow,
// threading REAL created data through every step (same Location -> same Bin/Inventory Item, same
// UOM -> same Inventory Item, same Item Category -> same Inventory Item, same Inventory Item ->
// same Stock Transfer -> same Item for the full Procure-to-Pay cycle) instead of each step
// picking/creating its own independent fixture the way the standalone files do. Steps:
//   1. Login
//   2. Create Location
//   3. Create Bin (references the Location from step 2)
//   4. Create UOM
//   5. Create Item Category
//   6. Create Discounted Item
//   7. Create Inventory Item, using the SAME Location/UOM/Item Category from steps 2/4/5
//   8. Create Stock Transfer for that SAME Item
//   9. Complete that Stock Transfer to Done status (Lot/Serial traceability -> Validate)
//  10. Full Procure-to-Pay cycle (PR -> PO -> Approval -> GRN -> Trace -> Validate -> Invoice)
//      for that SAME Item
//
// One long serial test (not test.describe.serial across files - a single test function) sharing
// one page/context throughout, since the whole point is real data continuity: an earlier step's
// output (a name, an id) is a later step's input. Each step's own logic is lifted verbatim from
// its already-verified-passing standalone file (02-location/03-bin/04-uom/05-item-category/
// 06-discounted-item/07-inventory-item/erpforce-stock-transfer/erpforce-procure-to-pay) - keep
// this file in sync with those if the app changes, same convention documented in
// createApprovedPurchaseRequest.js.

const { test, expect } = require('@playwright/test');
const LoginPage = require('../pages/LoginPage');
const LocationPage = require('../pages/LocationPage');
const BinPage = require('../pages/BinPage');
const UOMPage = require('../pages/UOMPage');
const ItemCategoryPage = require('../pages/ItemCategoryPage');
const DiscountedItemPage = require('../pages/DiscountedItemPage');
const StockTransferPage = require('../pages/StockTransferPage');
const testData = require('../config/testData');
const factory = require('../config/testDataFactory');
const { selectDropdown } = require('../helpers/dropdown');
const { createAndApproveRequest } = require('./procurement/helpers/createApprovedPurchaseRequest');
const crmChain = require('../config/crmChain');

const NAMES = {
  location: factory.uniqueName('Auto_Full_Location'),
  bin: factory.uniqueName('Auto_Full_Bin'),
  uom: factory.uniqueName('Auto_Full_UOM'),
  itemCategory: factory.uniqueName('Auto_Full_Category'),
  discountedItem: factory.uniqueName('Auto_Full_Discount'),
  item: factory.uniqueName('Auto_Full_Item'),
};

const ITEM_FORM = {
  category: NAMES.itemCategory,
  costingMethod: 'FIFO',
  salesPrice: '750',
  leadTime: '7',
  weight: '3.5',
  hsnCode: 'HSN998877',
  avgCost: '350',
};

const STOCK_TRANSFER_DATA = testData.stockTransfer.valid;
const LOT_NUMBER = `LOT-FULL-${Date.now()}`;

const P2P_CONFIG = {
  baseUrl: testData.baseUrl,
  approverName: 'Dipen Modi',
  lotSerialNumber: `LOT-P2P-FULL-${Date.now()}`,
  vendorInvoiceNo: `VEND-INV-FULL-${Date.now()}`,
};

// ---------- Shared helpers (same as erpforce-purchase-request.spec.js / erpforce-procure-to-pay.spec.js -
// keep in sync if the app changes) ----------
async function pickFirstOption(page) {
  const options = page.getByRole('listbox').locator('[role="option"]:not([aria-disabled="true"])')
    .filter({ hasNot: page.locator('input') })
    .filter({ hasNotText: /Select|No data available|Create New/ });
  await options.first().waitFor({ state: 'visible', timeout: 10000 });
  await options.first().click();
}

async function closeAnyOpenPopover(page) {
  const openListbox = page.getByRole('listbox');
  if (await openListbox.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('body').click({ position: { x: 2, y: 2 }, force: true }).catch(() => {});
    await openListbox.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

async function waitVisibleWithReload(page, locator, { attempts = 4, perAttemptTimeout = 30000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    try {
      await locator.waitFor({ state: 'visible', timeout: perAttemptTimeout });
      return;
    } catch (e) {
      if (attempt === attempts) throw e;
      await page.reload({ timeout: 60000 }).catch(() => {});
    }
  }
}

async function openSplitButtonMenuAndPick(page, menuItemNamePattern) {
  const caret = page.getByRole('button', { name: 'select merge strategy' });
  const menu = page.getByRole('menu');
  for (let attempt = 1; attempt <= 4; attempt++) {
    await caret.click();
    try {
      await menu.waitFor({ state: 'visible', timeout: 3000 });
      break;
    } catch (e) {
      if (attempt === 4) throw e;
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  await page.getByRole('menuitem', { name: menuItemNamePattern }).click();
}

function comboboxByLabel(page, labelPattern, { exact = false } = {}) {
  return page.getByText(labelPattern, { exact }).first().locator('xpath=..').getByRole('combobox').first();
}

async function selectFirstIfEmpty(page, combobox, { alreadySelectedPattern = /^Search /i } = {}) {
  const currentText = ((await combobox.textContent().catch(() => '')) || '').replace(/[​﻿]/g, '').trim();
  if (currentText && !alreadySelectedPattern.test(currentText)) return; // pre-filled - nothing to do
  await closeAnyOpenPopover(page);
  await combobox.click();
  await page.waitForTimeout(600);
  await pickFirstOption(page);
}

// Same "mui-component-select-add_inventory_item.<field>" dropdown pattern as
// tests/inventory/07-inventory-item.spec.ts.
async function waitForIdle(page, ms = 1500) {
  await page.waitForTimeout(ms);
}

// CONFIRMED LIVE: brand-new master data (a Location/UOM/Item Category created moments earlier,
// with no prior usage history) can leave OTHER dropdowns on this form empty that wouldn't be
// empty when built against long-existing master data (e.g. 07-inventory-item.spec.ts's own
// "Electronics" category) - Default Tax was one instance of this; there is no guarantee it's the
// only one. Rather than special-case every individual field one at a time as each surfaces, scan
// every "mui-component-select-add_inventory_item.<field>" dropdown actually present on whichever
// tab is currently active, and select the first real option for any still showing its "Search
// .../Select ..." placeholder. Safe to call on every tab, repeatedly - already-filled fields are
// left untouched.
async function fillAnyEmptyDropdownsOnCurrentTab(page) {
  const selects = page.locator('[id^="mui-component-select-add_inventory_item."]');
  const count = await selects.count();
  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);
    const id = await select.getAttribute('id').catch(() => null);
    if (!id) continue;
    const fieldName = id.replace('mui-component-select-add_inventory_item.', '');

    // Only touch fields actually marked required ("<Label> *" text as a sibling under the same
    // parent, same structural relationship this file already uses for Default Tax) - an empty
    // OPTIONAL field (e.g. "Parent Item", used for item variants) is not a Save blocker and must
    // be left alone. CONFIRMED LIVE: blindly filling it here previously picked an unrelated real
    // item as this new item's "parent" and left its own menu popover stuck open, blocking every
    // subsequent dropdown's click.
    const parent = select.locator('xpath=..');
    const isRequired = await parent.getByText(/\*\s*$/).count().catch(() => 0);
    if (!isRequired) continue;

    const text = ((await select.textContent().catch(() => '')) || '').replace(/[​﻿]/g, '').trim();
    if (text && !/^Search |^Select /i.test(text)) continue; // already has a real value

    await select.click();
    const menu = page.locator(`[id="menu-add_inventory_item.${fieldName}"]`);
    const opened = await menu.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (!opened) {
      await page.keyboard.press('Escape').catch(() => {});
      continue;
    }
    await expect(async () => {
      expect(await menu.locator('li').count()).toBeGreaterThan(1);
    }).toPass({ timeout: 8000, intervals: [300] }).catch(() => {});

    const options = menu.locator('li').filter({ hasNotText: /^Select |^No data available$/i });
    if (await options.count() > 0) {
      await options.first().click();
      console.log(`  ⚠️  Auto-filled otherwise-empty required dropdown: ${fieldName}`);
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    // Always make sure the menu is actually gone before moving to the next select in this loop,
    // regardless of which branch above ran - a menu left open from one iteration was exactly what
    // blocked the click on the NEXT one.
    await menu.waitFor({ state: 'hidden', timeout: 5000 }).catch(async () => {
      await page.keyboard.press('Escape').catch(() => {});
      await menu.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    });
    await page.waitForTimeout(300);
  }
}

// Returns the selected option's own text (callers that need to hand the exact chosen value off
// to a later step - e.g. Department, which is otherwise just "pick first available" with nothing
// recorded - read it from here instead of guessing).
async function selectFromInventoryItemDropdown(page, fieldName, optionText) {
  await page.locator(`[id="mui-component-select-add_inventory_item.${fieldName}"]`).click();
  const menu = page.locator(`[id="menu-add_inventory_item.${fieldName}"]`);
  await menu.waitFor({ state: 'visible', timeout: 5000 });

  await expect(async () => {
    expect(await menu.locator('li').count()).toBeGreaterThan(1);
  }).toPass({ timeout: 8000, intervals: [300] });

  let selectedOption;
  if (optionText) {
    await menu.locator('input').fill(optionText);
    await waitForIdle(page, 600);
    selectedOption = menu.locator(`li:has-text("${optionText}")`).first();
  } else {
    selectedOption = menu.locator('li').nth(1);
  }
  const selectedText = ((await selectedOption.textContent().catch(() => '')) || '').trim();
  await selectedOption.click();

  // CONFIRMED LIVE (recurring smoke2 failure, TC-FULLFLOW-01, on both "unit_of_measurement" and
  // "category" fields): the MUI Select menu can stay open/visible for the full 5s wait even after
  // its own option was clicked - same class of stray-popover issue this file's own auto-fill loop
  // above already recovers from (see its own menu.waitFor + Escape retry) - apply the identical
  // Escape-and-recheck recovery here instead of a bare wait with no fallback.
  await menu.waitFor({ state: 'hidden', timeout: 5000 }).catch(async () => {
    await page.keyboard.press('Escape').catch(() => {});
    await menu.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  });
  return selectedText;
}

test.describe('ERPForce: Full Inventory -> Procurement smoke flow', () => {
  // Override storageState so this test starts from a genuinely fresh (unauthenticated) session -
  // same override as tests/auth/login.spec.js's own TC-AUTH-01 - otherwise the project's default
  // auth.json storageState (playwright.config.js) would already be logged in, making Step 1's
  // login a no-op instead of an actual login flow.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('TC-FULLFLOW-01 [+] Login -> Location -> Bin -> UOM -> Category -> Discounted Item -> Inventory Item -> Stock Transfer -> Done -> Procure-to-Pay', { tag: '@smoke2' }, async ({ page }) => {
    // Ten confirmed-live sub-flows chained end to end on a genuinely slow shared dev environment -
    // same class of headroom bump as erpforce-rfq-full-workflow.spec.js's own test.setTimeout,
    // just larger given there's roughly 4x the work of any single existing erpforce-*.spec.js file.
    test.setTimeout(1800000);

    // ---------- Step 1: Login ----------
    // Override storageState so this test starts from a genuinely fresh (unauthenticated) session,
    // same as tests/auth/login.spec.js's own TC-AUTH-01, rather than relying on global-setup's
    // shared auth.json.
    const login = new LoginPage(page);
    await login.goto();
    await login.loginAndWaitForDashboard(testData.credentials.valid.email, testData.credentials.valid.password);
    await expect(page).toHaveURL(/dashboard/);
    console.log('✅ Step 1 – Logged in');

    // ---------- Step 2: Create Location ----------
    const location = new LocationPage(page);
    await location.goto();
    await location.fillForm({
      name: NAMES.location,
      shortName: 'AFL',
      address1: '123 Automation Street',
      address2: 'Suite 456',
      address3: 'Block B',
      zipCode: '400001',
      city: 'Dubai',
      summary: 'Created via full-flow integration test',
    });
    await location.ensureInventoryAvailable();
    await location.save();
    await page.waitForURL('**/configuration/location', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(NAMES.location).first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Step 2 – Location created:', NAMES.location);

    // ---------- Step 3: Create Bin (references the Location from Step 2) ----------
    const bin = new BinPage(page);
    await bin.gotoList();
    await bin.addButton.click();
    await page.waitForURL('**/add-bins');
    await page.waitForLoadState('networkidle');
    await bin.fillName(NAMES.bin);
    await bin.selectLocation(NAMES.location);
    await bin.selectBinType('Internal Location');
    await bin.save();
    await page.waitForURL('**/configuration/bins', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(NAMES.bin).first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Step 3 – Bin created:', NAMES.bin, 'at location', NAMES.location);

    // ---------- Step 4: Create UOM ----------
    const uom = new UOMPage(page);
    await uom.goto();
    await uom.fillForm({ unitName: NAMES.uom, symbol: 'AFU', description: 'Full-flow integration UOM' });
    await uom.addEntry({ uomName: 'AFU_BASE', symbol: 'AB', isBaseUnit: true });
    await uom.save();
    await page.waitForURL('**/uom', { timeout: 10000 });
    await expect(page.locator(`text=${NAMES.uom}`)).toBeVisible({ timeout: 10000 });
    console.log('✅ Step 4 – UOM created:', NAMES.uom);

    // ---------- Step 5: Create Item Category ----------
    const category = new ItemCategoryPage(page);
    await category.openAdd();
    await category.fillForm({
      name: NAMES.itemCategory,
      description: 'Full-flow integration category',
      skuPrefix: 'AFC',
      startingSku: '1',
    });
    await category.addAttribute('Iphone Variant');
    await category.save();
    await page.waitForURL(/item-category/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: NAMES.itemCategory, exact: true }).first())
      .toBeVisible({ timeout: 10000 });
    console.log('✅ Step 5 – Item Category created:', NAMES.itemCategory);

    // ---------- Step 6: Create Discounted Item ----------
    const discItem = new DiscountedItemPage(page);
    await discItem.openAdd();
    await discItem.skuInput.fill(factory.referenceNumber('AFD'));
    await discItem.nameInput.fill(NAMES.discountedItem);
    await discItem.selectDiscountType('Sales');
    await discItem.selectAccount('Sales Revenue');
    await discItem.selectDiscountCategory('Rate');
    await discItem.discountRateInput.fill('10');
    await discItem.descriptionInput.fill('Full-flow integration discounted item');
    await discItem.save();
    await page.waitForURL(/discounted-item/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    console.log('✅ Step 6 – Discounted Item created:', NAMES.discountedItem);

    // ---------- Step 7: Create Inventory Item, using the SAME Location/UOM/Item Category ----------
    // Adapted from tests/inventory/07-inventory-item.spec.ts, substituting the Category/UOM/
    // Location searches with the exact records created in Steps 2/4/5 above instead of that
    // file's own hardcoded "Electronics"/first-available picks.
    await page.goto(`${testData.baseUrl}/dashboard/inventory/product-management/items`, { timeout: 60000 });
    const addButton = page.getByRole('button', { name: 'Add' });
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      try {
        await addButton.waitFor({ state: 'visible', timeout: 30000 });
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        await page.reload({ timeout: 60000 }).catch(() => {});
      }
    }
    await addButton.click();
    await page.waitForURL('**/add-inventory-item');
    await page.waitForLoadState('networkidle');
    await waitForIdle(page);

    await page.getByPlaceholder('Enter Name').fill(NAMES.item);
    await selectFromInventoryItemDropdown(page, 'category', ITEM_FORM.category);
    await selectFromInventoryItemDropdown(page, 'unit_of_measurement', NAMES.uom);
    await selectFromInventoryItemDropdown(page, 'costing_method', ITEM_FORM.costingMethod);
    await selectFromInventoryItemDropdown(page, 'location', NAMES.location);
    // Department has no pinned name to search for (pick first available) - capture whichever one
    // actually got selected so it can be handed off to 01-lead.spec.js below, same as every other
    // NAMES.* value in this file.
    NAMES.department = await selectFromInventoryItemDropdown(page, 'department');

    // Always append 3 random digits to the auto-generated SKU, without waiting to see
    // whether it's actually flagged as a duplicate first.
    const skuInput = page.getByPlaceholder('Enter Number');
    const currentSku = await skuInput.inputValue();
    const randomSuffix = `${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}`;
    await skuInput.fill(`${currentSku}${randomSuffix}`);
    await waitForIdle(page, 500);

    await fillAnyEmptyDropdownsOnCurrentTab(page); // Primary tab safety net

    await page.getByRole('button', { name: 'Next' }).click(); // -> Rental Price
    await waitForIdle(page, 2000);
    await fillAnyEmptyDropdownsOnCurrentTab(page);
    await page.getByRole('button', { name: 'Next' }).click(); // -> Sales
    await waitForIdle(page, 2000);
    await page.getByPlaceholder('Enter Sales Price').fill(ITEM_FORM.salesPrice);
    await fillAnyEmptyDropdownsOnCurrentTab(page);
    await page.getByRole('button', { name: 'Next' }).click(); // -> Purchase
    await waitForIdle(page, 2000);
    await fillAnyEmptyDropdownsOnCurrentTab(page);
    await page.getByRole('button', { name: 'Next' }).click(); // -> Accounting
    await waitForIdle(page, 2000);
    // Income Account/Asset Account use the "mui-component-select-add_inventory_item.<field>" id
    // pattern the generic scan below covers - but CONFIRMED LIVE: Default Tax does NOT (it's a
    // different searchable-combobox component with no such id), so the generic scan silently
    // skips it entirely. Handle it explicitly first, same structural label->parent->combobox
    // lookup this file has always used for it, THEN run the generic scan for the rest.
    const defaultTaxCombobox = page.getByText('Default Tax *', { exact: true }).first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    const defaultTaxText = ((await defaultTaxCombobox.textContent().catch(() => '')) || '')
      .replace(/[​﻿]/g, '').trim();
    if (!defaultTaxText || /^Search /i.test(defaultTaxText)) {
      await defaultTaxCombobox.click();
      const taxListbox = page.getByRole('listbox');
      await taxListbox.waitFor({ state: 'visible', timeout: 5000 });
      const taxOptions = taxListbox.locator('[role="option"]:not([aria-disabled="true"])')
        .filter({ hasNot: page.locator('input') })
        .filter({ hasNotText: /Select|No data available|Create New/ });
      await taxOptions.first().waitFor({ state: 'visible', timeout: 8000 });
      await taxOptions.first().click();
      await taxListbox.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
    await fillAnyEmptyDropdownsOnCurrentTab(page);

    await page.getByRole('button', { name: 'Next' }).click(); // -> Inventory
    await waitForIdle(page, 2000);
    await page.getByPlaceholder('Enter Default Lead Time in Days').fill(ITEM_FORM.leadTime);
    await page.getByPlaceholder('Enter Weight').fill(ITEM_FORM.weight);
    await page.getByPlaceholder('Enter HSN Code').fill(ITEM_FORM.hsnCode);
    await page.getByPlaceholder('Enter Average Cost').fill(ITEM_FORM.avgCost);
    await fillAnyEmptyDropdownsOnCurrentTab(page);

    async function ensureCheckboxChecked(labelText) {
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

    const intermediateTabs = ['Price Rules/Sales', 'Update Quantity', 'Moves History', 'Reordering Rules'];
    for (const tabName of intermediateTabs) {
      await page.getByRole('button', { name: 'Next' }).click();
      await waitForIdle(page, 2000);
      await fillAnyEmptyDropdownsOnCurrentTab(page);
    }
    await page.getByRole('button', { name: 'Next' }).click(); // -> Variant (last tab)
    await waitForIdle(page, 2000);
    await fillAnyEmptyDropdownsOnCurrentTab(page);

    // CONFIRMED LIVE: whatever error Save surfaces (required field, duplicate SKU) takes a beat
    // to render after the click - checking immediately with a short timeout can catch neither
    // banner and wrongly conclude Save succeeded, even though the error shows up moments later
    // (past this function's own check, but still well within the final waitForURL below, which
    // then times out with no explanation). Settle first, then check patiently, and keep retrying
    // Save as long as EITHER known error is still present - up to 6 rounds total covers both a
    // missed required field and however many SKU collisions in a row this org's counter needs.
    const requiredFieldsError = page.getByText('Please fill all the required fields.');
    const skuExistsError = page.getByText('SKU already exists');
    const skuInputField = page.getByPlaceholder('Enter Number');

    // Up to 10 rounds, not 6 - CONFIRMED LIVE: other required-field errors (scanned/fixed below)
    // can take several rounds to all surface and clear one at a time, and the SKU collision often
    // only becomes the LAST remaining blocker once every other field is already satisfied - too
    // few rounds here means running out of attempts just as SKU finally surfaces on its own.
    for (let attempt = 1; attempt <= 10; attempt++) {
      await page.getByRole('button', { name: 'Save' }).click();
      await page.waitForTimeout(1500); // let the save/validation response actually land and render

      const requiredMissing = await requiredFieldsError.isVisible({ timeout: 5000 }).catch(() => false);
      const skuTaken = await skuExistsError.isVisible({ timeout: 2000 }).catch(() => false);

      if (skuTaken) {
        const currentSku = await skuInputField.inputValue();
        // Append three random digits and retry.
        const randomSuffix = `${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}`;
        const nextSku = `${currentSku}${randomSuffix}`;
        await skuInputField.fill(nextSku);
        await waitForIdle(page, 500);
        console.log(`  ⚠️  SKU "${currentSku}" already exists - retrying Save with "${nextSku}"`);
        continue;
      }

      if (requiredMissing) {
        // CONFIRMED LIVE: Save can leave the page on whichever tab happened to be active when
        // clicked (e.g. the last tab, Variant) rather than jumping to the tab with the actual
        // empty field - scanning only the CURRENT tab then finds nothing to fix and loops
        // forever. Click through every tab on this form and scan each one, not just whichever
        // one we're already on.
        console.log('  ⚠️  Save blocked by a required field - scanning every tab, not just the current one');
        const allTabs = page.getByRole('tab');
        const tabCount = await allTabs.count();
        for (let i = 0; i < tabCount; i++) {
          await allTabs.nth(i).click();
          await waitForIdle(page, 800);
          await fillAnyEmptyDropdownsOnCurrentTab(page);
        }
        continue;
      }

      break; // neither error present - Save either succeeded or is navigating away
    }

    await page.waitForURL('**/items', { timeout: 20000 });
    await page.waitForLoadState('networkidle');

    const itemRow = page.locator('tr', { hasText: NAMES.item });
    await expect(itemRow).toBeVisible({ timeout: 10000 });
    console.log('✅ Step 7 – Inventory Item created:', NAMES.item, 'using Location', NAMES.location, ', UOM', NAMES.uom, ', Category', NAMES.itemCategory);

    // ---------- Step 8: Create Stock Transfer for the SAME item ----------
    // Adapted from tests/inventory/erpforce-stock-transfer.spec.js, substituting the item/
    // destination-location "first available" picks with the exact records from Steps 2/7 above.
    const stockTransfer = new StockTransferPage(page);
    await page.goto(`${testData.baseUrl}/dashboard`, { timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

    await stockTransfer.openAdd();
    await stockTransfer.selectEmployee();
    await stockTransfer.selectOperationType(STOCK_TRANSFER_DATA.operationType);
    await stockTransfer.selectDestinationLocation(NAMES.location);

    await stockTransfer.goToOperationalDetailTab();
    await stockTransfer.addOperationItem({
      item: NAMES.item,
      requestQuantity: STOCK_TRANSFER_DATA.requestQuantity,
      rate: STOCK_TRANSFER_DATA.rate,
      transferQuantity: STOCK_TRANSFER_DATA.transferQuantity,
    });

    await stockTransfer.save();
    await page.waitForURL('**/operations/stock-transfer', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await stockTransfer.waitForListLoaded();

    const createdStockTransferId = await stockTransfer.getIdForRow(NAMES.location);
    expect(createdStockTransferId).toBeTruthy();
    console.log('✅ Step 8 – Stock Transfer created (id', createdStockTransferId, ') for item', NAMES.item);

    // ---------- Step 9: Complete that Stock Transfer to Done status ----------
    // Adapted verbatim from erpforce-stock-transfer.spec.js's TC-ST-10 (already confirmed-live
    // through this exact Lot/Serial creation -> Quantity -> Validate sequence).
    await stockTransfer.gotoView(createdStockTransferId);
    await stockTransfer.markAsToDoButton.click();
    await stockTransfer.confirmDialogAction('Submit');
    await expect(page.locator('.viewStockTransfer--StatusChip--ready')).toBeVisible({ timeout: 10000 });

    await stockTransfer.selectTab('Operational Detail');

    const trackDetailIndex = await page.getByRole('columnheader', { name: 'Track Detail' }).evaluate(
      (th) => Array.from(th.parentElement.children).indexOf(th)
    );
    const stItemRow = page.locator('table tbody tr').first();
    await stItemRow.locator('td').nth(trackDetailIndex).locator('button, svg, a').first().click();
    const trackDetailModal = page.getByRole('dialog').filter({ hasText: 'Track Detail' });
    await expect(trackDetailModal).toBeVisible();

    await trackDetailModal.getByRole('button', { name: 'Add', exact: true }).click();
    const lotSerialModal = page.getByRole('dialog').filter({ hasText: 'Lot/Serial number' });
    await expect(lotSerialModal).toBeVisible();

    const lotSerialCombobox = lotSerialModal.getByText('Lot/Serial number *', { exact: true }).first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    await lotSerialCombobox.click();
    await page.getByPlaceholder('Search Lot/Serial number').fill(LOT_NUMBER);
    await page.waitForTimeout(500);
    await page.getByText('Create New Lot/Serial number', { exact: true }).click();
    await page.waitForTimeout(500);

    const addLotNumberModal = page.getByRole('dialog').filter({ hasText: 'Add Lot Number' });
    await expect(addLotNumberModal).toBeVisible();
    await addLotNumberModal.getByText('Select Lot Number').click();
    await page.getByRole('option', { name: 'Lot Number', exact: true }).click();
    await addLotNumberModal.getByPlaceholder('Enter Lot Number').fill(LOT_NUMBER);
    await addLotNumberModal.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);

    await page.getByText(LOT_NUMBER, { exact: true }).last().click();
    await page.waitForTimeout(300);
    await lotSerialModal.locator('input[name="add_stock_transfer.quantity"]').fill(STOCK_TRANSFER_DATA.transferQuantity);
    await lotSerialModal.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);

    await trackDetailModal.getByRole('button', { name: 'Save' }).click();
    await expect(trackDetailModal).toBeHidden({ timeout: 8000 });

    await stockTransfer.validateButton.click();
    await expect(
      page.getByText('Are you sure you want to mark Stock Transfer as Done ?')
    ).toBeVisible({ timeout: 5000 });
    await stockTransfer.confirmDialogAction('Submit');
    await expect(page.locator('.viewStockTransfer--StatusChip--done')).toBeVisible({ timeout: 10000 });
    console.log('✅ Step 9 – Stock Transfer', createdStockTransferId, 'completed to Done status');

    // ---------- Step 10: Full Procure-to-Pay cycle for the SAME item ----------
    // Adapted verbatim from erpforce-procure-to-pay.spec.js's TC-P2P-01 (already confirmed-live),
    // substituting the upstream Request's own item search with the exact item from Step 7.
    // Explicit (not relying on createAndApproveRequest's own default) so this exact value can be
    // handed off via crm-chain.json for tests/inventory's own Moves History cross-check against
    // this run's real "In" quantity.
    const PURCHASE_QUANTITY = '10';
    const request = await createAndApproveRequest(page, { baseUrl: P2P_CONFIG.baseUrl, itemSearch: NAMES.item, quantity: PURCHASE_QUANTITY });
    console.log('✅ Step 10.0 – Purchase Request created and approved for item', NAMES.item, '(request id', request.id, ')');

    await openSplitButtonMenuAndPick(page, /^order$/i);
    await waitVisibleWithReload(page, page.getByRole('textbox', { name: 'Purchase Order ID' }));
    // The Purchase Order ID textbox rendering doesn't mean the rest of the form (Payment Terms/
    // Department's own async option fetches) has settled yet - wait for the page to actually
    // finish loading before touching any dropdown, or a click can land while its option list is
    // still empty/mid-fetch.
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    async function fillPaymentTermsIfEmpty() {
      const combobox = comboboxByLabel(page, /^Payment\s+Terms/i);
      const currentText = ((await combobox.textContent().catch(() => '')) || '').replace(/[​﻿]/g, '').trim();
      if (currentText && !/^Search /i.test(currentText)) return; // already has a real value
      const newTermName = `Auto_Payment_Term_${Date.now()}`;
      await selectDropdown(page, combobox, newTermName, newTermName, {
        allowCreateNew: true,
        createNewFields: { due_date_based_on: "Day's after Invoice date", credit_days: '30' },
      });
    }

    await fillPaymentTermsIfEmpty();
    await comboboxByLabel(page, 'Department', { exact: true }).scrollIntoViewIfNeeded().catch(() => {});
    await selectFirstIfEmpty(page, comboboxByLabel(page, 'Department', { exact: true }));

    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.getByRole('button', { name: 'Next' }).click();
      await page.waitForTimeout(500);
      const paymentTermsError = page.getByText(/Payment term is requier(e)?d/i);
      const departmentError = page.getByText(/Department is requier(e)?d/i);
      if (await paymentTermsError.isVisible().catch(() => false)) {
        await fillPaymentTermsIfEmpty();
      } else if (await departmentError.isVisible().catch(() => false)) {
        await closeAnyOpenPopover(page);
        await comboboxByLabel(page, 'Department', { exact: true }).click();
        await page.waitForTimeout(600);
        await pickFirstOption(page);
      } else {
        break;
      }
    }
    const shipAddrTrigger = page.getByText('Search Shipping Address', { exact: true });
    if (await shipAddrTrigger.isVisible().catch(() => false)) {
      await shipAddrTrigger.click();
      await page.waitForTimeout(800);
      await pickFirstOption(page);
    } else {
      await selectFirstIfEmpty(page, comboboxByLabel(page, /Shipping\s+Address/i));
    }

    const poListResponsePromise = page.waitForResponse((r) => r.url().includes('/purchase/v1/purchase-orders/?'), { timeout: 30000 });
    await page.getByRole('button', { name: /^Submit$/, exact: false }).first().click();
    const poListResponse = await poListResponsePromise;
    const createdPo = (await poListResponse.json()).data.purchase_orders[0];
    await page.goto(`${P2P_CONFIG.baseUrl}/dashboard/procurement/purchase-order/${createdPo.id}/view-purchase-order`, { timeout: 60000 });
    await waitVisibleWithReload(page, page.getByText(/^ID:/).first());
    console.log('✅ Step 10.1 – Purchase Order created (id', createdPo.id, ') for item', NAMES.item);

    await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible();

    const submitButton = page.getByRole('button', { name: 'Submit', exact: true });
    await submitButton.locator('xpath=following-sibling::button[1]').click();
    await page.getByText('Quick Approval', { exact: true }).click();

    const approvalModal = page.locator('[role="dialog"]').filter({ hasText: 'Quick Approval' });
    await closeAnyOpenPopover(page);
    await approvalModal.getByText('Select').click();
    await page.getByRole('listbox').getByRole('option', { name: new RegExp(P2P_CONFIG.approverName) }).first().click();
    await page.keyboard.press('Escape');
    await approvalModal.getByRole('button', { name: 'Send Request' }).click();
    await expect(page.getByText('Pending Approval')).toBeVisible();

    await openSplitButtonMenuAndPick(page, /^Accept$/);
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('Approved', { exact: true })).toBeVisible();
    console.log('✅ Step 10.2 – Purchase Order approved');

    await page.getByRole('button', { name: 'Receive', exact: true }).click();
    await waitVisibleWithReload(page, page.getByText('ID', { exact: true }).first());

    const grnResponsePromise = page.waitForResponse(
      (r) => /\/purchase-orders\/\d+\/grn(\/\d+)?(\?|$)/.test(r.url()) && ['POST', 'PUT'].includes(r.request().method()),
      { timeout: 20000 },
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const grnResponse = await grnResponsePromise;
    const grnBody = await grnResponse.json().catch(() => null);
    const grnData = grnBody && grnBody.data ? grnBody.data : grnBody;
    const grnRecord = (grnData && (grnData.grn || grnData.goods_receipt_note)) || grnData;
    const grnId = String(grnRecord.id);
    await page.goto(`${P2P_CONFIG.baseUrl}/dashboard/procurement/purchase-order/${createdPo.id}/grn/${grnId}/view-grn`, { timeout: 60000 });
    await waitVisibleWithReload(page, page.getByText(/^ID:/).first());
    console.log('✅ Step 10.3 – GRN created (id', grnId, ')');

    const grnItemRow = page.locator('table tbody tr').first();
    await grnItemRow.locator('button').last().click();
    const traceDialog = page.getByRole('dialog').filter({ hasText: 'Trace Details' });
    await traceDialog.waitFor({ state: 'visible', timeout: 10000 });

    await traceDialog.getByRole('button', { name: 'Add', exact: true }).click();
    const traceAddModal = page.getByRole('dialog').filter({ has: page.getByPlaceholder('Select Lot/Serial number') });
    await traceAddModal.waitFor({ state: 'visible', timeout: 10000 });

    const qtyText = await traceDialog.getByText('Quantity', { exact: true }).first()
      .locator('xpath=following::*[1]').textContent().catch(() => '');
    const itemQuantity = (qtyText || '').trim() || '10';

    await traceAddModal.getByPlaceholder('Select Lot/Serial number').fill(P2P_CONFIG.lotSerialNumber);
    await page.waitForTimeout(500);
    const traceQtyField = traceAddModal.getByPlaceholder('Enter Quantity');
    await traceQtyField.waitFor({ state: 'visible', timeout: 5000 });
    await traceQtyField.fill(itemQuantity);
    await traceAddModal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(traceAddModal).not.toBeVisible({ timeout: 10000 });

    await traceDialog.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(traceDialog).not.toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Validate', exact: true }).click();
    await expect(page.getByText('Validated', { exact: true }).first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Step 10.4 – GRN validated');

    await page.getByRole('button', { name: 'Bill', exact: true }).click();
    await page.waitForURL('**/add-purchase-invoice', { timeout: 30000 });

    const vendorInvoiceInput = page.locator(
      '[name*="supplier_invoice_number"], [name*="vendor_invoice_no"], [placeholder*="Invoice No"]',
    ).first();
    await waitVisibleWithReload(page, vendorInvoiceInput);
    await vendorInvoiceInput.fill(P2P_CONFIG.vendorInvoiceNo);
    await page.getByRole('button', { name: /^Save$/i }).last().click();

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.locator('tbody tr').first().getByRole('link').first().click();
    await expect(page.getByText(P2P_CONFIG.vendorInvoiceNo).first()).toBeVisible({ timeout: 20000 });
    console.log('✅ Step 10.5 – Purchase Invoice created:', P2P_CONFIG.vendorInvoiceNo);

    console.log('🎉 Full flow completed: Location', NAMES.location, '-> Bin', NAMES.bin, '-> UOM', NAMES.uom,
      '-> Category', NAMES.itemCategory, '-> Discounted Item', NAMES.discountedItem, '-> Item', NAMES.item,
      '-> Stock Transfer', createdStockTransferId, '(Done) -> PO', createdPo.id, '-> GRN', grnId, '-> Invoice', P2P_CONFIG.vendorInvoiceNo);

    // Hand off this run's real Location/Department/Item to 01-lead.spec.js (TC-LEAD-01) and
    // 02-opportunity.spec.js (TC-OPP-01) via the same config/crmChain.js file they already use for
    // their own Lead -> Opportunity hand-off, so a chained @smoke2 run (this test first) has them
    // reference this exact master data instead of each picking/creating its own.
    // CONFIRMED LIVE: Step 7's Department pick-first-available can land on the menu's own disabled
    // "No data available" row (this account's Inventory Item Department list came back empty in
    // one run) - that's not a real, searchable department name, so don't hand it off as one; leave
    // fullFlowDepartment unset (crmChain.save/JSON.stringify drop undefined keys) so TC-LEAD-01
    // falls back to testData.lead.valid's own already-confirmed-valid 'parth'.
    const realDepartment = NAMES.department && !/no data available|^select /i.test(NAMES.department)
      ? NAMES.department
      : undefined;
    crmChain.save({
      fullFlowLocation: NAMES.location,
      fullFlowDepartment: realDepartment,
      fullFlowItem: NAMES.item,
      // Real quantity actually received via this run's own GRN, for tests/inventory's own Moves
      // History cross-check against the item's real "In" movement quantity.
      fullFlowPurchaseQuantity: PURCHASE_QUANTITY,
      // Real quantity moved via this run's own Stock Transfer, plus its lot number prefix, so the
      // Moves History cross-check can verify the Stock Transfer's "In" row specifically instead of
      // conflating it with the PO/GRN's own separate "In" row (both can share the same quantity).
      fullFlowTransferQuantity: STOCK_TRANSFER_DATA.transferQuantity,
      fullFlowTransferLotPrefix: 'LOT-FULL-',
      // Same disambiguation for the PO/GRN's own "In" row (its lot number carries this prefix -
      // see P2P_CONFIG.lotSerialNumber above).
      fullFlowPurchaseLotPrefix: 'LOT-P2P-FULL-',
    });
  });
});
