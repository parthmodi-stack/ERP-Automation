// erpforce-rfq-full-workflow.spec.js
const { test, expect } = require('@playwright/test');
const { createAndApproveRequest } = require('./helpers/createApprovedPurchaseRequest');

const CONFIG = {
  baseURL: 'https://dev.erpforce.co',
  rfqListPath: '/dashboard/procurement/orders/request-for-quote',
  referenceNo: `REF-AUTO-${Date.now()}`,
  itemRate: '100',
  tenderVendorCount: 2, // additional vendors invited via Call For Tender (besides the main/request vendor)
};

// ---------- Generic helper: waits for `locator` to become visible after a navigation, retrying
// with a hard page reload if it doesn't. CONFIRMED LIVE: this SPA can get genuinely STUCK on its
// own bare loading spinner (or a completely blank pre-render page) - not just slow - where a
// single wait, however generous, never resolves, but a hard reload reliably recovers it. Used
// after every navigation in this file that's hit this live. ----------
async function waitVisibleWithReload(page, locator, { attempts = 4, perAttemptTimeout = 30000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    try {
      await locator.waitFor({ state: 'visible', timeout: perAttemptTimeout });
      return;
    } catch (e) {
      if (attempt === attempts) throw e;
      // page.reload() (not page.goto(page.url())): reload() always re-fetches the CURRENT
      // document directly with no risk of racing a stale/half-committed page.url() - confirmed
      // live that goto(page.url()) can land on a truly blank page (not even the spinner) if
      // page.url() gets read mid-navigation-failure and returns something like "about:blank".
      await page.reload({ timeout: 60000 }).catch(() => {});
    }
  }
}

// ---------- Generic helper: opens a custom async combobox, optionally types a
// search term, waits for options to load, and picks the first ENABLED option ----------
async function pickFirstAvailableOption(page, comboboxLocator, searchText = '') {
  await comboboxLocator.click();
  if (searchText) await page.keyboard.type(searchText);
  const listbox = page.locator('[role="listbox"], .options-list, .dropdown-menu').last();
  await listbox.waitFor({ state: 'visible', timeout: 10000 });
  await expect(listbox.getByText(/loading/i)).toHaveCount(0, { timeout: 10000 }).catch(() => {});
  // CONFIRMED LIVE (Terms & Condition field): some of these listboxes render their OWN search
  // textbox wrapped in a `role="option"` element with no text content, as the very first option -
  // neither aria-disabled nor a "Select..."/"loading" text match excludes it, so `.first()` was
  // clicking that dead search-box option instead of the real one, leaving the dropdown open with
  // its own popover then blocking every click elsewhere on the page. Exclude anything wrapping an
  // `<input>`, matching the sibling erpforce-purchase-request.spec.js's own pickFirstOption.
  const options = listbox.locator('[role="option"]:not([aria-disabled="true"]):not(.disabled)')
    .filter({ hasNot: page.locator('input') });
  await options.first().waitFor({ state: 'visible', timeout: 10000 });
  const text = (await options.first().innerText()).trim();
  await options.first().click();
  return text;
}

// ---------- Generic helper: opens the "Create"/"Submit"/"Accept" split-button's own menu and
// clicks a menuitem inside it. There is no standalone button to find a sibling caret next to -
// the caret is its own button, accessible name "select merge strategy" (shared across every
// approval-workflow module - confirmed live and documented in ProcurementRequestPage.js/
// BasePage.openSubmitMenu), and the menuitem only exists once that caret's menu is open. Retries
// the whole open-then-click sequence, not just the click, since MUI's Menu popover can keep
// remounting its MenuList right after opening. ----------
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

// ---------- Shared helper for steps 12-14 (Create -> Response -> set Rate -> Save) ----------
async function submitResponseForCurrentRfq(page) {
  await openSplitButtonMenuAndPick(page, /response/i);
  // "Response" navigates to a new Add Response page - wait for it to actually render (same class
  // of fix as every other navigation in this file) before interacting with it.
  const itemsHeading = page.getByRole('heading', { name: /items/i });
  await waitVisibleWithReload(page, itemsHeading);

  await itemsHeading.scrollIntoViewIfNeeded();
  await page.locator('table tr').nth(1).locator('button').first().click(); // edit/pencil icon on first item row
  await page.locator('[role="dialog"] input[placeholder="Enter Rate"], [role="dialog"] input[name*="rate"]')
    .fill(CONFIG.itemRate);
  await page.locator('[role="dialog"]').getByRole('button', { name: /^save$/i }).click();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);

  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page).toHaveURL(/response/); // redirected to Responses list
}

// ---------- Generic helper: opens the RFQ list and searches for `term`, so row-count/row-lookup
// assertions only ever see OUR OWN rows instead of whatever happens to be on the list's default
// page/sort of this large, shared dataset (confirmed live: 14 pages, sorted so a freshly created
// today-dated row is nowhere near page 1 without searching - matches BasePage.ensureSearchInputOpen/
// searchList's own documented reasoning). ----------
async function gotoRfqListAndSearch(page, term) {
  await page.goto(`${CONFIG.baseURL}${CONFIG.rfqListPath}`, { timeout: 60000 });
  // Matches RfqPage.gotoList()'s own wait: networkidle can fire before the page has actually
  // rendered anything under this environment's latency, so the very next interaction (the search
  // toggle button below) can be racing a still-blank/still-spinner page. Wait for the "Add"
  // button - always present once the list has truly finished rendering - before touching anything.
  await waitVisibleWithReload(page, page.getByRole('button', { name: 'Add' }).first());

  const searchInput = page.getByPlaceholder('Search', { exact: true });
  if (!(await searchInput.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Add' }).first()
      .locator('xpath=preceding-sibling::button[2]')
      .click();
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
  }
  // The search input renders inside a MUI Popover still mid-mount the instant it becomes
  // "visible" - an immediate .fill() can silently dispatch no request at all. Focus it and let
  // the popover settle first (same fix as BasePage.ensureSearchInputOpen).
  await searchInput.click();
  await page.waitForTimeout(300);
  const encodedTerm = encodeURIComponent(term);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(`search=${encodedTerm}`), { timeout: 10000 }).catch(() => null),
    searchInput.fill(term),
  ]);
  await page.waitForTimeout(500);
}

// ---------- Generic helper: if the page just showed "Please fill all the required fields",
// switch to the Address & Contact tab and fill whichever of Vendor Address/Contact Person/
// Shipping Address is still empty. Resolve each off its own label's parent -> combobox (same
// proven pattern as every other fixed dropdown in this file), not the fragile `following::*[1]`
// axis walk this validation-recovery step originally used. Returns whether it actually had
// anything to recover (so callers know whether to expect a follow-up "saved successfully"). ----------
async function fillAddressContactIfBlocked(page) {
  const validationBanner = page.getByText(/please fill all the required fields/i);
  if (!(await validationBanner.isVisible().catch(() => false))) return false;

  await page.getByRole('tab', { name: /address & contact/i }).click();

  for (const label of ['Vendor Address', 'Contact Person']) {
    const field = page.getByText(label, { exact: false }).first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    if (await field.isVisible().catch(() => false)) {
      await pickFirstAvailableOption(page, field).catch(() => {});
    }
  }

  // CONFIRMED LIVE: "Shipping Address" doesn't fit the label->parent->combobox pattern above -
  // its own label text ("Shipping Address *") AND its empty-state closed-trigger text ("Search
  // Shipping Address") both contain the same substring, and it lives nested one level deeper
  // inside its own "Entity Shipping Address" accordion (unlike Vendor Address/Contact Person,
  // which sit in a flatter, unlabeled section) - the generic resolution silently grabbed the
  // wrong node and left the field untouched. Target its own empty-state text directly instead.
  const shipAddrTrigger = page.getByText('Search Shipping Address', { exact: true });
  if (await shipAddrTrigger.isVisible().catch(() => false)) {
    await pickFirstAvailableOption(page, shipAddrTrigger).catch(() => {});
  }
  return true;
}

// ---------- Steps 11-15 as a reusable routine for a single draft vendor row, identified by its
// own series_number (see the Step 9 comment on why - not by CONFIG.referenceNo). ----------
async function processDraftVendorRow(page, seriesNumber) {
  await gotoRfqListAndSearch(page, seriesNumber);
  // CONFIRMED LIVE: an invisible MUI menu backdrop (MuiPopover-root MuiMenu-root) can be left
  // over on this page, intercepting the row click below for the full 25s of retries with no
  // progress - dismiss any stray open menu/popover before interacting, same defensive pattern as
  // the sibling erpforce-purchase-request.spec.js's own closeAnyOpenPopover.
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('body').click({ position: { x: 2, y: 2 }, force: true }).catch(() => {});
  const row = page.locator('table tr').filter({ hasText: seriesNumber }).first();
  await row.click();
  // Clicking the row navigates to the RFQ's own view page - wait for it to actually render
  // (same class of fix as gotoRfqListAndSearch) before looking for "Actions".
  const actionsButton = page.getByRole('button', { name: /actions/i });
  await waitVisibleWithReload(page, actionsButton);

  // Step 11: Actions -> Edit -> Save (+ conditional validation fix)
  await actionsButton.click();
  await page.getByRole('menuitem', { name: /edit/i }).click();
  // "Edit" navigates to a new edit page - wait for it to actually render (same class of fix as
  // every other navigation in this file) before clicking Save.
  const saveButton = page.getByRole('button', { name: /^save$/i });
  await waitVisibleWithReload(page, saveButton);
  await saveButton.click();

  if (await fillAddressContactIfBlocked(page)) {
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText(/saved successfully/i)).toBeVisible();
  }

  // Step 12: verify now Open, then Create -> Response
  await expect(page.getByText(/^open$/i)).toBeVisible();

  // Steps 13-14: item rate + save
  await submitResponseForCurrentRfq(page);

  // Step 15: back to listing, verify Response Received (checked by caller after loop)
}

test('TC-RFQFULL-01 [+] ERPForce: RFQ full workflow (steps 1-17) from existing Purchase Request', async ({ page }) => {
  // This test does an upstream Request create+approve AND the full 17-step RFQ flow in one run
  // against a slow shared dev environment - same class of fix as erpforce-purchase-request.spec.js's
  // own timeout bump, just larger given there's more than double the work here. gotoRfqListAndSearch
  // alone is called 8+ times, each now allowed up to 90s in a genuinely slow patch (confirmed live),
  // so 300000 no longer gives enough headroom even when every step succeeds.
  test.setTimeout(600000);

  // ---- Step 0: Create and approve an upstream Purchase Request of our own, so this test has a
  // real "existing Request" to open even when run standalone, not just when chained right after
  // erpforce-purchase-request.spec.js in the same browser session.
  await createAndApproveRequest(page);

  // ---- Step 1: Open the existing Request (created above) and Create -> RFQ ----
  await openSplitButtonMenuAndPick(page, /^rfq$/i);
  // "RFQ" navigates to a new Add RFQ form - wait for it to actually render (same class of fix as
  // every other navigation in this file) before interacting with it.
  const referenceNoInput = page.locator('input[name="rfq.reference_number"]');
  await waitVisibleWithReload(page, referenceNoInput);

  // ---- Step 2: Verify carried-over fields from the Request ----
  // .first(): this page also has a "Vendor Name" items-table column, "Location"/"Currency" columns
  // etc. that separately match these same loose regexes - only confirming the label shows up
  // somewhere, not pinning down which one (same class of fix as the quantity assertion below).
  await expect(page.getByText(/vendor/i).first()).toBeVisible();
  await expect(page.getByText(/currency/i).first()).toBeVisible();
  await expect(page.getByText(/location/i).first()).toBeVisible();
  await expect(page.getByText(/purchase representative/i).first()).toBeVisible();

  // ---- Step 3: Reference No. + Terms & Condition ----
  await referenceNoInput.fill(CONFIG.referenceNo);
  // CONFIRMED LIVE: `text=Terms & Condition».locator('xpath=following::*[1]')` doesn't reliably
  // land on the actual combobox trigger - `following::*` walks document order, not siblings, so
  // it can resolve to a wrapper element instead. That still opened the dropdown (its click
  // bubbled), but the swallowed `.catch(() => {})` was hiding a real failure picking the option
  // afterward - it stayed open, and its popover then blocked every click on "Call For Tender"
  // underneath it (that's why THAT step kept timing out, not because of its own locator). Resolve
  // off the label's own parent -> combobox instead, matching every other dropdown in the sibling
  // erpforce-purchase-request.spec.js, and explicitly wait for the popover to actually close.
  const termsCombo = page.getByText('Terms & Condition', { exact: true })
    .locator('xpath=..')
    .getByRole('combobox')
    .first();
  // pickFirstAvailableOption (not a hand-rolled filter): the listbox's first "option" is actually
  // its own search textbox wrapped in an option role with no text - a bare hasNotText(/select/i)
  // filter doesn't exclude it (empty text doesn't contain "select" either), so `.first()` clicked
  // that instead of "new TnC" (confirmed live: no error, because the click itself succeeded, it
  // just hit the wrong element and left the real option - and the whole popover - untouched).
  await pickFirstAvailableOption(page, termsCombo);

  // ---- Steps 4-6: Call For Tender - add 2 additional vendors ----
  // CONFIRMED LIVE: this accordion's own header is an actual `button` (its accessible name comes
  // from the "Call For Tender" paragraph inside it), not a `heading` - the same accordion pattern
  // as the Items section right above it. `getByRole('heading', ...)` never resolves at all, which
  // is why this timed out.
  for (let i = 0; i < CONFIG.tenderVendorCount; i++) {
    await page.getByRole('button', { name: /call for tender/i })
      .locator('xpath=..').getByRole('button', { name: /add/i }).click();
    // CONFIRMED LIVE: same class of bug as every closed-trigger field in the sibling
    // erpforce-purchase-request.spec.js - "Search Vendor" is this MUI Select's own static
    // display text (via displayEmpty/renderValue), not a real `placeholder` attribute, so
    // getByPlaceholder found 0 matches and the click just hung until timeout. Resolve
    // structurally off the "Vendor" label instead.
    const vendorDialog = page.locator('[role="dialog"]');
    const vendorCombo = vendorDialog.getByText('Vendor', { exact: false }).first()
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    await pickFirstAvailableOption(page, vendorCombo); // skips already-used/disabled vendor automatically
    // CONFIRMED LIVE: the checkbox isn't aria-labelled to "Copy Product" (getByRole('checkbox',
    // {name}) found 0 matches and the check() just hung) - it's a standard MUI
    // FormControlLabel-style pairing instead, where the label text itself is clickable and
    // toggles the checkbox next to it.
    await vendorDialog.getByText('Copy Product', { exact: true }).click();
    await page.locator('[role="dialog"]').getByRole('button', { name: /save/i }).click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  }

  // ---- Step 7: Next ----
  await page.getByRole('button', { name: /next/i }).click();

  // ---- Step 8-9: Save (with conditional Address & Contact recovery) ----
  // CONFIRMED LIVE: this Save can be blocked by "Please fill all the required fields" (Shipping
  // Address specifically, under the Address & Contact tab - Vendor Address/Contact Person already
  // carry over from the source Request) - reuse the same recovery routine processDraftVendorRow
  // already needs for the identical validation gap on each draft vendor's own Edit->Save, rather
  // than guessing which field is actually required from a single, possibly-scrolled screenshot.
  let listResponsePromise = page.waitForResponse((r) => r.url().includes('/purchase/v1/rfq/?'), { timeout: 5000 }).catch(() => null);
  await page.getByRole('button', { name: /^save$/i }).click();

  if (await fillAddressContactIfBlocked(page)) {
    // CONFIRMED LIVE: the list's own top search bar does not index the "Reference No." field at
    // all - searching for our own known, unique reference number cleanly returned "No Data"
    // despite the records genuinely existing (this Save creates ALL tenderVendorCount+1 rows at
    // once - the main vendor's own row plus each tender vendor's draft - so counting/finding them
    // afterward by reference number never worked). Matches RfqPage.saveAndCaptureId's own proven
    // fix: capture the list's own refetch response instead and read each new row's real,
    // searchable series_number directly - that field the search bar DOES index (confirmed live
    // elsewhere in this suite, e.g. 03-rfq.spec.js's own rfq.searchList(seriesNumber) calls).
    listResponsePromise = page.waitForResponse((r) => r.url().includes('/purchase/v1/rfq/?'));
    await page.getByRole('button', { name: /^save$/i }).click();
  }
  const listResponse = await listResponsePromise;
  const createdRfqs = (await listResponse.json()).data.rfqs.slice(0, CONFIG.tenderVendorCount + 1);
  const seriesNumbers = createdRfqs.map((r) => r.series_number);

  // ---- Step 10: Verify 3 rows: 1 Open (main vendor) + 2 Draft (tender vendors) ----
  const draftSeriesNumbers = [];
  let openSeriesNumber;
  for (const seriesNumber of seriesNumbers) {
    await gotoRfqListAndSearch(page, seriesNumber);
    const row = page.locator('table tr').filter({ hasText: seriesNumber });
    await expect(row).toHaveCount(1);
    if (await row.filter({ hasText: /open/i }).count()) openSeriesNumber = seriesNumber;
    if (await row.filter({ hasText: /draft/i }).count()) draftSeriesNumbers.push(seriesNumber);
  }
  expect(openSeriesNumber).toBeTruthy();
  expect(draftSeriesNumbers).toHaveLength(CONFIG.tenderVendorCount);

  // ---- Steps 11-15: process 1st draft vendor ----
  await processDraftVendorRow(page, draftSeriesNumbers[0]);
  await gotoRfqListAndSearch(page, draftSeriesNumbers[0]);
  await expect(
    page.locator('table tr').filter({ hasText: draftSeriesNumbers[0] }).filter({ hasText: /response received/i })
  ).toHaveCount(1);

  // ---- Step 16: repeat same process for 2nd draft vendor ----
  await processDraftVendorRow(page, draftSeriesNumbers[1]);
  await gotoRfqListAndSearch(page, draftSeriesNumbers[1]);
  await expect(
    page.locator('table tr').filter({ hasText: draftSeriesNumbers[1] }).filter({ hasText: /response received/i })
  ).toHaveCount(1);

  // ---- Step 17: open the main (Open-status) vendor RFQ and complete a Response the same way ----
  await gotoRfqListAndSearch(page, openSeriesNumber);
  // Same defensive dismiss as processDraftVendorRow - see its own comment for why.
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('body').click({ position: { x: 2, y: 2 }, force: true }).catch(() => {});
  const mainVendorRow = page.locator('table tr').filter({ hasText: openSeriesNumber }).first();
  await mainVendorRow.click();
  // Clicking the row navigates to the RFQ's own view page - wait for it to actually render (same
  // class of fix as processDraftVendorRow) before submitResponseForCurrentRfq looks for the caret.
  await waitVisibleWithReload(page, page.getByRole('button', { name: 'select merge strategy' }));
  await submitResponseForCurrentRfq(page); // no Address & Contact fix needed - already populated from Request

  // Final check for this run: all 3 rows now show Response Received (formal step 18 verification,
  // included here since it directly confirms step 17 succeeded)
  for (const seriesNumber of seriesNumbers) {
    await gotoRfqListAndSearch(page, seriesNumber);
    await expect(page.locator('table tr').filter({ hasText: seriesNumber })).toContainText(/response received/i);
  }
});
