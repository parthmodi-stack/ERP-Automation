// erpforce-purchase-request.spec.js
// Requires: @playwright/test
// Run: npx playwright test erpforce-purchase-request.spec.js

const { test, expect } = require('@playwright/test');

const CONFIG = {
  baseUrl: 'https://dev.erpforce.co',
  // Search terms - the script picks the FIRST matching dropdown result dynamically.
  purchaseRepresentativeSearch: '',   // '' = pick first available option
  vendorSearch: '',                   // '' = pick first available option
  narration: `Automated PR created ${new Date().toISOString()}`,
  locationSearch: '',
  departmentSearch: '',
  itemSearch: 'a',                    // search term guaranteed to match items
  quantity: '10',
  rate: '100',
  taxTemplateSearch: '',              // '' = accept whatever auto-fills, else search
  // Must be the CURRENTLY LOGGED-IN test user, same reasoning documented on
  // testData.procurementRequest.approverName - Quick Approval only makes the "Accept" action
  // appear for whichever user it's actually sent to, so this has to match credentials.valid
  // (dipen.modi@trootech.com) exactly, not be derived from the header at runtime (that innerText
  // parse split on '\n' and, in practice, only ever captured the avatar-badge letter "D" -
  // confirmed live: Send Request still succeeded, "Pending Approval" still appeared, but it went
  // to a different, arbitrary "D"-initialed user instead of Dipen Modi, leaving Dipen's own
  // session with no Accept action - same root cause as the missing "select merge strategy" caret
  // step 14 kept hitting).
  approverName: 'Dipen Modi',
};

// Helper: click the first REAL option in whichever MUI popover/listbox is currently open.
// CONFIRMED LIVE BUG FIX: every dropdown-selection step below originally used
// `page.locator('ul, [role="listbox"]').first()`, which also matches the app's own left sidebar
// navigation `<ul>` - and since that sidebar renders earlier in the DOM than the dropdown's own
// portaled popover, `.first()` picked the SIDEBAR's "Dashboard" list item instead of a real
// option, which then failed anyway because the popover's own backdrop sat on top of it. Scoping
// to `page.getByRole('listbox')` (the ARIA landmark the open popover itself carries) avoids the
// sidebar entirely. Also excludes the popover's own search-input-as-first-option and
// placeholder/footer rows, same filtering BasePage.js's selectFirstAvailableOption uses.
async function pickFirstOption(page) {
  // CONFIRMED LIVE: some fields' disabled "no selection" placeholder option renders with NO text
  // at all (empty data-value, aria-disabled="true", aria-hidden), so the hasNotText filter below
  // (which only excludes options CONTAINING "Select"/etc.) doesn't catch it - exclude anything
  // aria-disabled explicitly too, not just by text.
  const options = page.getByRole('listbox').locator('[role="option"]:not([aria-disabled="true"])')
    .filter({ hasNot: page.locator('input') })
    .filter({ hasNotText: /Select|No data available|Create New/ });
  await options.first().waitFor({ state: 'visible', timeout: 10000 });
  await options.first().click();
}

// Helper: open a searchable combobox (by its placeholder text derived from `labelText`) and
// pick the first option, or an option matching `searchText` if provided.
async function selectFromCombobox(page, labelText, searchText = '') {
  const placeholderGuess = `Search ${labelText}`;
  await page.getByPlaceholder(placeholderGuess).first().click();

  if (searchText) {
    await page.getByPlaceholder(placeholderGuess).last().fill(searchText);
  }
  await page.waitForTimeout(500); // allow async option list to load
  await pickFirstOption(page);
}

// A prior dropdown's own debounced search response can land late and silently reopen its
// popover (or leave its backdrop lingering) well after the code that used it has already moved
// on - confirmed live: this blocked the very next field's click (Vendor, right after Purchase
// Representative) even though nothing looked wrong on screen. Same root cause/fix as this
// codebase's own ProcurementRequestPage.closeAnyOpenPopover. Call before opening the NEXT
// dropdown, not just once up front, since the popover can reappear in between.
async function closeAnyOpenPopover(page) {
  const openListbox = page.getByRole('listbox');
  if (await openListbox.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('body').click({ position: { x: 2, y: 2 }, force: true }).catch(() => {});
    await openListbox.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

test('TC-PREQFULL-01 [+] ERPForce - create, submit and approve a purchase request', async ({ page }) => {
  // This account's environment is slower than the default 30s action / 60s test timeout allows
  // for (shared dataset, added network latency) - same fix as every other multi-step spec in this
  // suite (01/02/04/05/07/09 use 150000, 08 uses 200000, see 03-rfq.spec.js's own comment on this
  // exact issue). This test alone never had the override, which is why it kept dying at a
  // different, seemingly-random step on each run instead of a real functional bug.
  test.setTimeout(150000);

  // ---------- 1. Open Requests list and click Add ----------
  // Same stuck-loading-spinner recovery as createApprovedPurchaseRequest.js's step 1 - this
  // account's environment can get genuinely stuck on its own spinner well past a generous wait,
  // and only a reload recovers it.
  await page.goto(`${CONFIG.baseUrl}/dashboard/procurement/requests`, { timeout: 60000 });
  const addButton = page.getByRole('button', { name: /^\+?\s*Add$/ });
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
  await expect(page).toHaveURL(/add-requests/);

  // ---------- 1b. Select Entity ----------
  // Required field (marked with *) that this form leaves unselected by default - unlike
  // PurchaseOrderPage's Add form, which arrives pre-filled with "erp-force" (see
  // PurchaseOrderPage.fillBasicDetails). Leaving it unselected is why Department (further down,
  // in Classification) was staying permanently disabled: Department's options are Entity-scoped,
  // not just Location-scoped.
  await closeAnyOpenPopover(page);
  const entityCombobox = page.getByText('Entity *', { exact: true }).first()
    .locator('xpath=..')
    .getByRole('combobox')
    .first();
  await entityCombobox.click();
  await page.waitForTimeout(800);
  await pickFirstOption(page);
  console.log('DEBUG entity accessible text after select:', await entityCombobox.textContent());

  // ---------- 2. Select Purchase Representative ----------
  await page.locator('input[name="request.purchase_representative_id"]')
    .locator('xpath=ancestor::div[contains(@class,"") ][1]').click().catch(() => {});
  await page.getByPlaceholder('Search Purchase Representative').first().click();
  if (CONFIG.purchaseRepresentativeSearch) {
    await page.getByPlaceholder('Search Purchase Representative').last()
      .fill(CONFIG.purchaseRepresentativeSearch);
  }
  await page.waitForTimeout(500);
  await pickFirstOption(page);

  // ---------- 3. Select Vendor ----------
  // CONFIRMED LIVE: unlike Purchase Representative, this field's closed trigger carries no
  // "Search Vendor" placeholder attribute at all (getByPlaceholder found 0 matches, which is why
  // the click just hung until timeout) - resolve it structurally off its "Vendor" label instead,
  // the same label -> parent -> combobox approach this codebase's own page objects use
  // throughout (e.g. PurchaseOrderPage.getSelectedEntity).
  await closeAnyOpenPopover(page);
  const vendorCombobox = page.getByText('Vendor', { exact: true }).first()
    .locator('xpath=..')
    .getByRole('combobox')
    .first();
  await vendorCombobox.click();
  if (CONFIG.vendorSearch) {
    await page.getByPlaceholder('Search Vendor').last().fill(CONFIG.vendorSearch);
  }
  await page.waitForTimeout(800); // vendor list loads async
  await pickFirstOption(page);

  // ---------- 4. Select / confirm Currency ----------
  // Currency often auto-populates once Vendor is chosen; confirm/select explicitly.
  await closeAnyOpenPopover(page);
  const currencyBox = page.getByPlaceholder('Search Currency').first();
  if (await currencyBox.isVisible().catch(() => false)) {
    await currencyBox.click();
    await page.waitForTimeout(300);
    await pickFirstOption(page);
  }

  // ---------- 5. Add Narration ----------
  await page.getByPlaceholder('Enter Narration').fill(CONFIG.narration);

  // ---------- 6. Select Location and Department ----------
  // Same class of bug as Vendor above: this field's closed trigger doesn't reliably expose a
  // placeholder attribute either - resolve structurally off its own label instead. That label
  // also carries the SAME broken-i18n-key text already confirmed live on
  // PurchaseOrderPage.selectLocation (renders as "crm.salesOrder.fields.location_label *"
  // instead of "Location *" on this account) - match either.
  await closeAnyOpenPopover(page);
  const locationLabel = page.getByText('Location *', { exact: true })
    .or(page.getByText('crm.salesOrder.fields.location_label *', { exact: true }));
  const locationCombobox = locationLabel.locator('xpath=..').getByRole('combobox').first();
  await locationCombobox.click();
  if (CONFIG.locationSearch) await locationCombobox.locator('input').first().fill(CONFIG.locationSearch);
  await page.waitForTimeout(800);
  await pickFirstOption(page);

  // Same class of bug as Vendor/Location above: this field's closed trigger doesn't reliably
  // expose a placeholder attribute either - resolve structurally off its own label instead.
  await closeAnyOpenPopover(page);
  const deptCombobox = page.getByText('Department', { exact: true }).first()
    .locator('xpath=..')
    .getByRole('combobox')
    .first();
  await deptCombobox.click();
  if (CONFIG.departmentSearch) await deptCombobox.locator('input').first().fill(CONFIG.departmentSearch);
  await page.waitForTimeout(800);
  await pickFirstOption(page);

  // ---------- 7. Click Add under Items to open Edit Item modal ----------
  await page.getByRole('button', { name: /^\+?\s*Add$/ }).last().click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Edit Item' });
  await expect(modal).toBeVisible();

  // ---------- 8. Select Item, UoM (auto-fills), Quantity, Rate ----------
  // Same placeholder-trigger unreliability as Vendor/Location/Department above - resolve
  // structurally off each field's own label instead (same modal-scoped label -> parent ->
  // combobox approach as PurchaseOrderPage.selectModalDropdown elsewhere in this codebase).
  await closeAnyOpenPopover(page);
  const itemCombobox = modal.getByText(/^Item\s*\*?$/i).first()
    .locator('xpath=..')
    .getByRole('combobox')
    .first();
  await itemCombobox.click();
  await page.getByPlaceholder('Search Item').last().fill(CONFIG.itemSearch);
  await page.waitForTimeout(800);
  await pickFirstOption(page);

  // UoM auto-populates from the selected Item, but that auto-fill lands via its own async
  // re-render right after the item is picked - reading/clicking the UoM combobox immediately
  // races that re-render and can grab a node that gets detached mid-click. Give it a moment to
  // settle first.
  await page.waitForTimeout(1000);
  const uomInput = modal.locator('input[name="item_entries.uom_id"]');
  const uomValue = await uomInput.inputValue().catch(() => '');
  if (!uomValue) {
    await closeAnyOpenPopover(page);
    const uomCombobox = modal.getByText(/^UoM\s*\*?$/i).first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    await uomCombobox.click();
    await page.waitForTimeout(500);
    await pickFirstOption(page);
  }

  // .fill() alone sets the input's value but never fires the row's recalculation of
  // gross/net/total - same documented gap as PurchaseInvoicePage.fillItemEntry - so each field
  // must be committed with a blur (Tab) or the backend rejects the save with "Mismatch found in
  // details" because gross_amount/net_amount/total_amount are still 0.
  const quantityField = modal.locator('input[name="item_entries.quantity"]');
  await quantityField.fill(CONFIG.quantity);
  await quantityField.press('Tab');
  await page.waitForTimeout(300);

  const rateField = modal.locator('input[name="item_entries.rate"]');
  await rateField.fill(CONFIG.rate);
  await rateField.press('Tab');
  await page.waitForTimeout(300);

  // ---------- 9. Select Tax Template, then Save the item ----------
  // CONFIRMED LIVE: unlike UoM above, Tax Template does not reliably auto-populate from the
  // selected Item/Vendor - it's a required field on this modal (matches
  // ProcurementRequestPage.addItemWithFullDetails's own documented behavior, which always fills
  // it explicitly rather than assuming an auto-fill). Leaving it unselected here left the "Edit
  // Item" modal open with "Search Tax Template" still empty, silently blocking the main form's
  // Save (its waitForResponse never saw a request fire). Always select it explicitly: by
  // CONFIG.taxTemplateSearch if given, else the first available option.
  const taxCombobox = modal.getByText(/^Tax Template\s*\*?$/i).first()
    .locator('xpath=..')
    .getByRole('combobox')
    .first();
  await closeAnyOpenPopover(page);
  await taxCombobox.click();
  await page.waitForTimeout(500);
  if (CONFIG.taxTemplateSearch) {
    await taxCombobox.locator('input').first().fill(CONFIG.taxTemplateSearch);
    await page.waitForTimeout(500);
  }
  await pickFirstOption(page);

  // The Gross/Tax/Net recompute triggered by quantity/rate/tax template is not instant - saving
  // before it settles sends stale amounts the backend's cross-check rejects as the same
  // "Mismatch found in details" 400 (same class of race documented in
  // PurchaseInvoicePage.fillItemEntry). 1200ms reliably lets it settle.
  await page.waitForTimeout(1200);

  await modal.getByRole('button', { name: 'Save' }).click();
  await expect(modal).toBeHidden();

  // ---------- 10. Click Save on the main request form ----------
  // CONFIRMED LIVE (matches ProcurementRequestPage.saveAndCaptureId's own documented behavior):
  // Save redirects to the plain Requests LIST, not straight to a view-requests/<id> URL - capture
  // the list's own refetch response to read the freshly created record's real id, then navigate
  // to its view page ourselves.
  const listResponsePromise = page.waitForResponse((r) => r.url().includes('/purchase/v1/purchase-requests/?'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const listResponse = await listResponsePromise;
  const createdRequest = (await listResponse.json()).data.purchase_requests[0];
  await page.goto(`${CONFIG.baseUrl}/dashboard/procurement/requests/${createdRequest.id}/view-requests`);
  await expect(page).toHaveURL(/view-requests/);

  // ---------- 11. Verify the request was created with all selected data ----------
  await expect(page.getByText(/^PR-/)).toBeVisible();
  await expect(page.getByText(CONFIG.narration)).toBeVisible();
  // .first(): the view page renders the quantity value in several places (item table cell,
  // summary sidebar, etc.) - a bare getByText('10') matches over a dozen unrelated "10"-
  // containing amounts (confirmed live: 13 matches, including "AED 1010.00"), so this only
  // needs to confirm the value shows up somewhere, not pin down which one.
  await expect(page.getByText(CONFIG.quantity, { exact: false }).first()).toBeVisible();

  // ---------- 12. Click Submit dropdown -> Quick Approval ----------
  await page.locator('button[aria-haspopup="true"]', { hasText: '' })
    .filter({ has: page.locator('..') }); // no-op guard
  await page.getByRole('button', { name: 'Submit' }).locator('xpath=following-sibling::button[1]')
    .click();
  await page.getByText('Quick Approval', { exact: true }).click();

  // ---------- 13. Select the currently logged-in user, send request ----------
  const approvalModal = page.locator('[role="dialog"]').filter({ hasText: 'Quick Approval' });
  await closeAnyOpenPopover(page);
  await approvalModal.getByText('Select').click();

  // Matches BasePage.quickApproval()'s own proven selector: a case-sensitive RegExp gives a
  // substring match against each option's accessible name (which also carries an avatar-initials
  // prefix, so an exact match would never work at all) - deliberately NOT derived from the header
  // at runtime (see CONFIG.approverName's own comment for why that silently sent this to the
  // wrong user).
  await page.getByRole('listbox').getByRole('option', { name: new RegExp(CONFIG.approverName) })
    .first()
    .click();

  await page.keyboard.press('Escape'); // close the option list, keep modal open
  await approvalModal.getByRole('button', { name: 'Send Request' }).click();
  await expect(page.getByText('Pending Approval')).toBeVisible();

  // ---------- 14. Accept dropdown -> Accept -> confirm ----------
  // CONFIRMED LIVE / matches BasePage.openSubmitMenu(): there is no standalone "Accept" button to
  // find a sibling caret next to - the caret is its own button, accessible name "select merge
  // strategy" (shared across every approval-workflow module), and "Accept" only exists as a
  // menuitem inside the menu that caret opens. Also retries the whole open-then-click sequence,
  // not just the click, since MUI's Menu popover can keep remounting its MenuList right after
  // opening (same documented race as BasePage.clickSubmitMenuItem).
  const submitCaret = page.getByRole('button', { name: 'select merge strategy' });
  const submitMenu = page.getByRole('menu');
  for (let attempt = 1; attempt <= 4; attempt++) {
    await submitCaret.click();
    try {
      await submitMenu.waitFor({ state: 'visible', timeout: 3000 });
      break;
    } catch (e) {
      if (attempt === 4) throw e;
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  await page.getByRole('menuitem', { name: 'Accept', exact: true }).click();

  await page.getByRole('button', { name: 'Submit' }).click(); // confirmation dialog

  await expect(page.getByText('In Progress')).toBeVisible();
});
