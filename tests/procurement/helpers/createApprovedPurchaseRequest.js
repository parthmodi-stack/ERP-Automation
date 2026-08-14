const { expect } = require('@playwright/test');

// Shared setup helper extracted from erpforce-purchase-request.spec.js (that test is the
// verified-passing source of truth for this flow - keep both in sync if the app changes).
// Creates, saves, submits for Quick Approval, and Accepts a brand-new Purchase Request, landing
// on its view page with status "In Progress". Used by tests (e.g. erpforce-rfq-full-workflow.spec.js)
// that need a real, already-approved Request to open their own flow from, since they can't rely
// on a prior test in the same file/session to have left one behind when run standalone.

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

/**
 * @param {import('@playwright/test').Page} page
 * @param {{baseUrl?: string, narration?: string, itemSearch?: string, quantity?: string, rate?: string, approverName?: string}} [overrides]
 * @returns {Promise<{id: string, narration: string}>}
 */
async function createAndApproveRequest(page, overrides = {}) {
  const config = {
    baseUrl: 'https://dev.erpforce.co',
    narration: `Automated PR created ${new Date().toISOString()}`,
    itemSearch: 'a',
    quantity: '10',
    rate: '100',
    approverName: 'Dipen Modi',
    ...overrides,
  };

  // ---------- 1. Open Requests list and click Add ----------
  // Wait for the page to actually finish rendering before interacting (same class of fix as the
  // Submit-caret step below) - this environment's real latency has repeatedly left this exact
  // "Add" button not yet rendered well past the default 25s action timeout on a bare goto.
  // CONFIRMED LIVE: this SPA can also get genuinely STUCK on its own bare loading spinner, not
  // just slow - a single wait, however generous, never resolves, but a hard reload recovers it.
  // Retry with a reload instead of just waiting longer.
  await page.goto(`${config.baseUrl}/dashboard/procurement/requests`, { timeout: 60000 });
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

  // ---------- 2. Select Purchase Representative ----------
  await page.locator('input[name="request.purchase_representative_id"]')
    .locator('xpath=ancestor::div[contains(@class,"") ][1]').click().catch(() => {});
  await page.getByPlaceholder('Search Purchase Representative').first().click();
  await page.waitForTimeout(500);
  await pickFirstOption(page);

  // ---------- 3. Select Vendor ----------
  await closeAnyOpenPopover(page);
  const vendorCombobox = page.getByText('Vendor', { exact: true }).first()
    .locator('xpath=..')
    .getByRole('combobox')
    .first();
  await vendorCombobox.click();
  await page.waitForTimeout(800);
  await pickFirstOption(page);

  // ---------- 4. Select / confirm Currency ----------
  await closeAnyOpenPopover(page);
  const currencyBox = page.getByPlaceholder('Search Currency').first();
  if (await currencyBox.isVisible().catch(() => false)) {
    await currencyBox.click();
    await page.waitForTimeout(300);
    await pickFirstOption(page);
  }

  // ---------- 5. Add Narration ----------
  await page.getByPlaceholder('Enter Narration').fill(config.narration);

  // ---------- 6. Select Location and Department ----------
  await closeAnyOpenPopover(page);
  const locationLabel = page.getByText('Location *', { exact: true })
    .or(page.getByText('crm.salesOrder.fields.location_label *', { exact: true }));
  const locationCombobox = locationLabel.locator('xpath=..').getByRole('combobox').first();
  await locationCombobox.click();
  await page.waitForTimeout(800);
  await pickFirstOption(page);

  await closeAnyOpenPopover(page);
  const deptCombobox = page.getByText('Department', { exact: true }).first()
    .locator('xpath=..')
    .getByRole('combobox')
    .first();
  await deptCombobox.click();
  await page.waitForTimeout(800);
  await pickFirstOption(page);

  // ---------- 7. Click Add under Items to open Edit Item modal ----------
  await page.getByRole('button', { name: /^\+?\s*Add$/ }).last().click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Edit Item' });
  await expect(modal).toBeVisible();

  // ---------- 8. Select Item, UoM (auto-fills), Quantity, Rate ----------
  await closeAnyOpenPopover(page);
  const itemCombobox = modal.getByText(/^Item\s*\*?$/i).first()
    .locator('xpath=..')
    .getByRole('combobox')
    .first();
  await itemCombobox.click();
  await page.getByPlaceholder('Search Item').last().fill(config.itemSearch);
  await page.waitForTimeout(800);
  await pickFirstOption(page);

  // UoM auto-populates from the selected Item, but that auto-fill lands via its own async
  // re-render right after the item is picked - give it a moment to settle before checking it.
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
  // gross/net/total - each field must be committed with a blur (Tab) or the backend rejects the
  // save with "Mismatch found in details" because gross_amount/net_amount/total_amount stay 0.
  const quantityField = modal.locator('input[name="item_entries.quantity"]');
  await quantityField.fill(config.quantity);
  await quantityField.press('Tab');
  await page.waitForTimeout(300);

  const rateField = modal.locator('input[name="item_entries.rate"]');
  await rateField.fill(config.rate);
  await rateField.press('Tab');
  await page.waitForTimeout(300);

  // Tax Template is a required field that does NOT reliably auto-populate from the selected
  // Item/Vendor (matches ProcurementRequestPage.addItemWithFullDetails's own documented
  // behavior, which always fills it explicitly rather than assuming an auto-fill). CONFIRMED
  // LIVE: leaving it unselected left this modal open with "Search Tax Template" still empty,
  // silently blocking the main form's Save below (its waitForResponse never saw a request
  // fire) - select the first available option explicitly.
  await closeAnyOpenPopover(page);
  const taxCombobox = modal.getByText(/^Tax Template\s*\*?$/i).first()
    .locator('xpath=..')
    .getByRole('combobox')
    .first();
  await taxCombobox.click();
  await page.waitForTimeout(500);
  await pickFirstOption(page);

  // The Gross/Tax/Net recompute triggered by quantity/rate/tax template is not instant - saving
  // before it settles sends stale amounts the backend's cross-check rejects with the same 400.
  await page.waitForTimeout(1200);

  await modal.getByRole('button', { name: 'Save' }).click();
  await expect(modal).toBeHidden();

  // ---------- 9. Click Save on the main request form ----------
  // Save redirects to the plain Requests LIST, not straight to a view-requests/<id> URL - capture
  // the list's own refetch response to read the freshly created record's real id, then navigate
  // to its view page ourselves.
  const listResponsePromise = page.waitForResponse((r) => r.url().includes('/purchase/v1/purchase-requests/?'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const listResponse = await listResponsePromise;
  const createdRequest = (await listResponse.json()).data.purchase_requests[0];
  await page.goto(`${config.baseUrl}/dashboard/procurement/requests/${createdRequest.id}/view-requests`, { timeout: 60000 });
  await expect(page).toHaveURL(/view-requests/);
  // CONFIRMED LIVE: a bare URL check doesn't mean the page has actually finished rendering under
  // this environment's real latency - this view page (tabs, items table, summary sidebar) can
  // still be stuck on the app's own loading spinner well past the default 25s action timeout, so
  // the very next interaction (the Submit caret below) was racing a still-blank page. This SPA can
  // also get genuinely STUCK (not just slow) on that spinner - a single wait, however generous,
  // never resolves, but a hard reload recovers it - so retry with a reload instead of waiting
  // longer (same fix as gotoRfqListAndSearch/the Step 1 Add-button wait above).
  const submitButton = page.getByRole('button', { name: 'Submit' });
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    try {
      await submitButton.waitFor({ state: 'visible', timeout: 30000 });
      break;
    } catch (e) {
      if (attempt === 3) throw e;
      await page.reload({ timeout: 60000 }).catch(() => {});
    }
  }

  // ---------- 10. Click Submit dropdown -> Quick Approval ----------
  await submitButton.locator('xpath=following-sibling::button[1]')
    .click();
  await page.getByText('Quick Approval', { exact: true }).click();

  // ---------- 11. Select the approver, send request ----------
  const approvalModal = page.locator('[role="dialog"]').filter({ hasText: 'Quick Approval' });
  await closeAnyOpenPopover(page);
  await approvalModal.getByText('Select').click();
  await page.getByRole('listbox').getByRole('option', { name: new RegExp(config.approverName) })
    .first()
    .click();
  await page.keyboard.press('Escape'); // close the option list, keep modal open
  await approvalModal.getByRole('button', { name: 'Send Request' }).click();
  await expect(page.getByText('Pending Approval')).toBeVisible();

  // ---------- 12. Accept dropdown -> Accept -> confirm ----------
  // There is no standalone "Accept" button to find a sibling caret next to - the caret is its own
  // button, accessible name "select merge strategy" (shared across every approval-workflow
  // module), and "Accept" only exists as a menuitem inside the menu that caret opens. Retries the
  // whole open-then-click sequence, not just the click, since MUI's Menu popover can keep
  // remounting its MenuList right after opening.
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

  return { id: String(createdRequest.id), narration: config.narration };
}

module.exports = { createAndApproveRequest };
