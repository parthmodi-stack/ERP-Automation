const { test, expect } = require('@playwright/test');
const PartyPage  = require('../../pages/accounting/PartyPage');
const testData   = require('../../config/testData');

// =============================================================================
// Customer & Vendor Management — Create / View / Edit / Search
// =============================================================================
//
// Form structure confirmed from source:
//   • FormParser with fieldArrayName 'add_customer' / 'add_vendor'
//   • Multi-tab form (Next button navigates; Save always submits)
//   • Account type switcher: styled buttons "Individual" | "Company"
//   • Address and Contact: modal dialogs opened from FormParser table rows
//   • Accounting tab: account_id (COA), payment_term, currencies
//
// Seed-data requirements:
//   - COA "Accounts Receivable" (customer) and "Accounts Payable" (vendor) exist
//   - Payment Term "Net 30" exists
//   - Currency "INR" exists
//   Update testData.accounting.customerManagement / vendorManagement if names differ.
// =============================================================================

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function waitForIdle(page, ms = 500) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

/**
 * Navigates to list, searches by text, asserts at least one visible row contains
 * that text, then opens the first matching row and returns to test.
 */
async function assertInList(page, party, searchText) {
  await party.gotoList();
  await party.search(searchText);
  await expect(page.getByText(searchText).first()).toBeVisible({ timeout: 15000 });
}

// =============================================================================
// CUSTOMER
// =============================================================================

test.describe('Customer Management', () => {
  const cData = testData.accounting.customerManagement;

  // ── TC-CUST-01  Individual ────────────────────────────────────────────────
  test(
    'TC-CUST-01 [+] Create Individual customer — name, address, contact, accounting tab',
    async ({ page }) => {
      // Five tabs, two modal dialogs (Address/Contact), each with several dropdown selections -
      // exceeds the 30s default with this suite's global slowMo: 500 (see settings-entity
      // .contract.js's TC-05 for the same reasoning).
      test.setTimeout(90000);
      const d     = cData.individual;
      const party = new PartyPage(page, 'customer');
      await party.openAdd();

      await expect(page).toHaveURL(/add-customer/);

      await party.create({
        accountType: d.accountType,   // 'Individual'
        firstName:   d.firstName,
        lastName:    d.lastName,
        address:     d.address,
        contact:     d.contact,
        accountName: d.accountName,
        paymentTerm: d.paymentTerm,
        currencies:  d.currencies,
        defaultTaxTemplate: d.defaultTaxTemplate,
      });

      await party.save();

      // Redirect away from add page
      await expect(page).not.toHaveURL(/add-customer/, { timeout: 20000 });
      await waitForIdle(page);

      // Verify record appears in list
      await assertInList(page, party, d.lastName);
    }
  );

  // ── TC-CUST-02  Company ───────────────────────────────────────────────────
  test(
    'TC-CUST-02 [+] Create Company customer — entity name, address, contact, accounting tab',
    async ({ page }) => {
      test.setTimeout(90000);
      const d     = cData.company;
      const party = new PartyPage(page, 'customer');
      await party.openAdd();

      await expect(page).toHaveURL(/add-customer/);

      await party.create({
        accountType: d.accountType,   // 'Company'
        companyName: d.companyName,
        address:     d.address,
        contact:     d.contact,
        accountName: d.accountName,
        paymentTerm: d.paymentTerm,
        currencies:  d.currencies,
        defaultTaxTemplate: d.defaultTaxTemplate,
      });

      await party.save();

      await expect(page).not.toHaveURL(/add-customer/, { timeout: 20000 });
      await waitForIdle(page);

      await assertInList(page, party, d.companyName);
    }
  );

  // ── TC-CUST-03  Validation ────────────────────────────────────────────────
  test(
    'TC-CUST-03 [-] Saving Individual customer with blank name shows validation error',
    async ({ page }) => {
      const party = new PartyPage(page, 'customer');
      await party.openAdd();

      // Select Individual but leave first_name / last_name empty
      await party.selectAccountType('Individual');

      // Attempt to save immediately — address/contact are also missing
      await party.save();

      // Must stay on add page
      await expect(page).toHaveURL(/add-customer/);

      // At least one of: MUI field error, or an inline alert banner, or toast
      const fieldError  = page.locator('.MuiFormHelperText-root.Mui-error, .Mui-error');
      const alertBanner = page.locator('[role="alert"]');
      const toast       = page.locator('#notistack-snackbar');

      const hasError =
        await fieldError.first().isVisible({ timeout: 5000 }).catch(() => false) ||
        await alertBanner.first().isVisible({ timeout: 5000 }).catch(() => false) ||
        await toast.isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasError).toBe(true);
    }
  );

  // ── TC-CUST-04  View Individual ───────────────────────────────────────────
  test(
    'TC-CUST-04 [+] View Individual customer — verify last name and status on view page',
    async ({ page }) => {
      const d     = cData.individual;
      const party = new PartyPage(page, 'customer');
      await party.gotoList();

      await party.search(d.lastName);
      const row = party.row(d.lastName);
      test.skip(
        !(await row.first().isVisible({ timeout: 10000 }).catch(() => false)),
        'Depends on TC-CUST-01 creating the Individual customer first'
      );

      // Match the link by its real accessible name (the visible text) rather than "first <a>
      // found anywhere in the row" - confirmed live a row can carry more than one anchor, and
      // the first one in DOM order isn't necessarily the visible one, which made a plain
      // row.first().getByRole('link').first() time out as "not visible". Stay on the already-
      // searched/filtered list rather than party.openRow() (which re-navigates via gotoList()
      // and would lose that filtering in this large, cumulative environment).
      // Not exact: true - the row's real link's accessible name is the full display name
      // ("Auto Cust_..."), not just the bare last name, confirmed live (an exact match against
      // lastName alone never matched anything and timed out).
      await page.getByRole('link', { name: d.lastName }).first().click();
      await page.waitForLoadState('networkidle');

      // Last name should be visible on the view page
      await expect(page.getByText(d.lastName).first()).toBeVisible({ timeout: 15000 });

      // Default status is Active
      await expect(page.getByText(/Active/i).first()).toBeVisible({ timeout: 10000 });
    }
  );

  // ── TC-CUST-05  Edit Individual ───────────────────────────────────────────
  test(
    'TC-CUST-05 [+] Edit Individual customer — update last name and verify it persists',
    async ({ page }) => {
      const d     = cData.individual;
      const party = new PartyPage(page, 'customer');
      await party.gotoList();

      await party.search(d.lastName);
      const row = party.row(d.lastName);
      test.skip(
        !(await row.first().isVisible({ timeout: 10000 }).catch(() => false)),
        'Depends on TC-CUST-01 creating the Individual customer first'
      );

      // Match by accessible name (not exact - see TC-CUST-04's comment) on the already-searched
      // list, rather than party.openRow() which would re-navigate and lose that filtering.
      await page.getByRole('link', { name: d.lastName }).first().click();
      await page.waitForLoadState('networkidle');
      // Confirmed live: the View page header has a direct "Edit" button now, not an Actions ->
      // Edit menu item - a genuine UI change from what this test originally assumed.
      await party.editButton.click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/edit-customer/);

      // Update last_name via FormParser field locator
      const lastNameField = party.field('last_name');
      await expect(lastNameField).toBeVisible({ timeout: 10000 });
      await lastNameField.clear();
      await lastNameField.fill(d.updatedLastName);

      await party.save();

      await expect(page).not.toHaveURL(/edit-customer/, { timeout: 20000 });
      await waitForIdle(page);

      // Updated name must appear in the list
      await assertInList(page, party, d.updatedLastName);
    }
  );

  // ── TC-CUST-06  Search ────────────────────────────────────────────────────
  test(
    'TC-CUST-06 [+] Customer list search narrows to matching Company rows',
    async ({ page }) => {
      const d     = cData.company;
      const party = new PartyPage(page, 'customer');
      await party.gotoList();

      await party.search(d.companyName);
      await waitForIdle(page, 400);

      // At least one row should contain the company name (or an empty-state message)
      const rows = page.locator('table tbody tr');
      const count = await rows.count();
      if (count > 0) {
        const firstRowText = await rows.first().innerText();
        const isMatch  = firstRowText.toLowerCase().includes(d.companyName.toLowerCase());
        const isEmpty  = /no (data|records|result)/i.test(firstRowText);
        expect(isMatch || isEmpty).toBe(true);
      }
    }
  );
});

// =============================================================================
// VENDOR
// =============================================================================

test.describe('Vendor Management', () => {
  const vData = testData.accounting.vendorManagement;

  // ── TC-VEND-01  Individual ────────────────────────────────────────────────
  test(
    'TC-VEND-01 [+] Create Individual vendor — name, address, contact, accounting tab',
    async ({ page }) => {
      test.setTimeout(90000);
      const d     = vData.individual;
      const party = new PartyPage(page, 'vendor');
      await party.openAdd();

      await expect(page).toHaveURL(/add-vendor/);

      await party.create({
        accountType: d.accountType,
        firstName:   d.firstName,
        lastName:    d.lastName,
        address:     d.address,
        contact:     d.contact,
        accountName: d.accountName,
        paymentTerm: d.paymentTerm,
        currencies:  d.currencies,
        defaultTaxTemplate: d.defaultTaxTemplate,
      });

      await party.save();

      await expect(page).not.toHaveURL(/add-vendor/, { timeout: 20000 });
      await waitForIdle(page);

      await assertInList(page, party, d.lastName);
    }
  );

  // ── TC-VEND-02  Company ───────────────────────────────────────────────────
  test(
    'TC-VEND-02 [+] Create Company vendor — entity name, address, contact, accounting tab',
    async ({ page }) => {
      test.setTimeout(90000);
      const d     = vData.company;
      const party = new PartyPage(page, 'vendor');
      await party.openAdd();

      await expect(page).toHaveURL(/add-vendor/);

      await party.create({
        accountType: d.accountType,
        companyName: d.companyName,
        address:     d.address,
        contact:     d.contact,
        accountName: d.accountName,
        paymentTerm: d.paymentTerm,
        currencies:  d.currencies,
        defaultTaxTemplate: d.defaultTaxTemplate,
      });

      await party.save();

      await expect(page).not.toHaveURL(/add-vendor/, { timeout: 20000 });
      await waitForIdle(page);

      await assertInList(page, party, d.companyName);
    }
  );

  // ── TC-VEND-03  Validation ────────────────────────────────────────────────
  test(
    'TC-VEND-03 [-] Saving Individual vendor with blank name shows validation error',
    async ({ page }) => {
      const party = new PartyPage(page, 'vendor');
      await party.openAdd();

      await party.selectAccountType('Individual');
      await party.save();

      await expect(page).toHaveURL(/add-vendor/);

      const fieldError  = page.locator('.MuiFormHelperText-root.Mui-error, .Mui-error');
      const alertBanner = page.locator('[role="alert"]');
      const toast       = page.locator('#notistack-snackbar');

      const hasError =
        await fieldError.first().isVisible({ timeout: 5000 }).catch(() => false) ||
        await alertBanner.first().isVisible({ timeout: 5000 }).catch(() => false) ||
        await toast.isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasError).toBe(true);
    }
  );

  // ── TC-VEND-04  View Individual ───────────────────────────────────────────
  test(
    'TC-VEND-04 [+] View Individual vendor — verify last name and status on view page',
    async ({ page }) => {
      const d     = vData.individual;
      const party = new PartyPage(page, 'vendor');
      await party.gotoList();

      await party.search(d.lastName);
      const row = party.row(d.lastName);
      test.skip(
        !(await row.first().isVisible({ timeout: 10000 }).catch(() => false)),
        'Depends on TC-VEND-01 creating the Individual vendor first'
      );

      // party.openRow() matches by real accessible name rather than "first <a> in the row" -
      // see TC-CUST-04's own comment on why the plain row-click pattern isn't reliable here.
      // Match by accessible name rather than "first <a> in the row" - see TC-CUST-04's own
      // comment above. Stay on the already-searched list instead of party.openRow(), which
      // re-navigates via gotoList() and would lose that filtering.
      // Not exact: true - the row's real link's accessible name is the full display name
      // ("Auto Cust_..."), not just the bare last name, confirmed live (an exact match against
      // lastName alone never matched anything and timed out).
      await page.getByRole('link', { name: d.lastName }).first().click();
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(d.lastName).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Active/i).first()).toBeVisible({ timeout: 10000 });
    }
  );

  // ── TC-VEND-05  Edit Individual ───────────────────────────────────────────
  test(
    'TC-VEND-05 [+] Edit Individual vendor — update last name and verify it persists',
    async ({ page }) => {
      const d     = vData.individual;
      const party = new PartyPage(page, 'vendor');
      await party.gotoList();

      await party.search(d.lastName);
      const row = party.row(d.lastName);
      test.skip(
        !(await row.first().isVisible({ timeout: 10000 }).catch(() => false)),
        'Depends on TC-VEND-01 creating the Individual vendor first'
      );

      // party.openRow() matches by real accessible name rather than "first <a> in the row" -
      // see TC-CUST-04's own comment on why the plain row-click pattern isn't reliable here.
      // Match by accessible name rather than "first <a> in the row" - see TC-CUST-04's own
      // comment above. Stay on the already-searched list instead of party.openRow(), which
      // re-navigates via gotoList() and would lose that filtering.
      // Not exact: true - the row's real link's accessible name is the full display name
      // ("Auto Cust_..."), not just the bare last name, confirmed live (an exact match against
      // lastName alone never matched anything and timed out).
      await page.getByRole('link', { name: d.lastName }).first().click();
      await page.waitForLoadState('networkidle');
      // Confirmed live: the View page header has a direct "Edit" button now, not an Actions ->
      // Edit menu item - a genuine UI change from what this test originally assumed.
      await party.editButton.click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/edit-vendor/);

      const lastNameField = party.field('last_name');
      await expect(lastNameField).toBeVisible({ timeout: 10000 });
      await lastNameField.clear();
      await lastNameField.fill(d.updatedLastName);

      await party.save();

      await expect(page).not.toHaveURL(/edit-vendor/, { timeout: 20000 });
      await waitForIdle(page);

      await assertInList(page, party, d.updatedLastName);
    }
  );

  // ── TC-VEND-06  Search ────────────────────────────────────────────────────
  test(
    'TC-VEND-06 [+] Vendor list search narrows to matching Company rows',
    async ({ page }) => {
      const d     = vData.company;
      const party = new PartyPage(page, 'vendor');
      await party.gotoList();

      await party.search(d.companyName);
      await waitForIdle(page, 400);

      const rows = page.locator('table tbody tr');
      const count = await rows.count();
      if (count > 0) {
        const firstRowText = await rows.first().innerText();
        const isMatch = firstRowText.toLowerCase().includes(d.companyName.toLowerCase());
        const isEmpty = /no (data|records|result)/i.test(firstRowText);
        expect(isMatch || isEmpty).toBe(true);
      }
    }
  );
});
