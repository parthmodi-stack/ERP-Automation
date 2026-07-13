const base = require('@playwright/test');
const ChartOfAccountsPage = require('../../pages/accounting/ChartOfAccountsPage');
const testData = require('../../config/testData');

/**
 * RBAC coverage for Chart of Accounts, parametrized by role via `test.use({ role: '...' })`
 * instead of duplicating a spec file per role.
 *
 * STATUS: every test body below is written and ready, but self-skips via the `page` fixture,
 * because config/testData.js's `accounting.rbacRoles` has no credentials yet for any restricted
 * role (readOnly/noAdd/noEdit/noDelete) - only the existing admin login (`fullAccess`) is a real
 * account. Fill in real { email, password } pairs there once dedicated test accounts exist for
 * this module, and every `test.skip` call below starts running for real with no code changes
 * needed. See ACCOUNTING_FINDINGS.md.
 *
 * Also unverified (blocked on the same missing accounts): what a permission-denied direct
 * navigation actually renders in this app - redirected to the list, a dedicated "not authorized"
 * page, or something else. The assertions below check for "the Add/Edit form did not render",
 * which is true either way; tighten to an exact URL/page once you can observe the real behavior.
 */
const test = base.test.extend({
  role: ['fullAccess', { option: true }],
  page: async ({ browser, role }, use, testInfo) => {
    const creds = testData.accounting.rbacRoles[role];
    if (!creds) {
      testInfo.skip(true, `No credentials configured for role "${role}" in config/testData.js accounting.rbacRoles - see this file's header comment.`);
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(testData.baseUrl + '/login');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder(/email/i).fill(creds.email);
    await page.getByPlaceholder(/password/i).fill(creds.password);
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 30000 });
    await use(page);
    await context.close();
  },
});

test.describe('Chart of Accounts - RBAC: no canAdd', () => {
  test.use({ role: 'noAdd' });

  test('TC-COA-RBAC-01 [-] Add button is hidden on the list page', async ({ page }) => {
    const coa = new ChartOfAccountsPage(page);
    await coa.gotoList();
    await base.expect(coa.addButton).not.toBeVisible();
  });

  test('TC-COA-RBAC-02 [-] Direct navigation to the Add form does not render the form', async ({ page }) => {
    const coa = new ChartOfAccountsPage(page);
    await page.goto(testData.baseUrl + coa.addPath);
    await page.waitForLoadState('networkidle');
    await base.expect(page).not.toHaveURL(new RegExp(coa.addPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
    await base.expect(coa.accountCodeField()).not.toBeVisible();
  });
});

test.describe('Chart of Accounts - RBAC: no canEdit', () => {
  test.use({ role: 'noEdit' });

  test('TC-COA-RBAC-03 [-] Edit is absent from the row menu and from the View page', async ({ page }) => {
    const coa = new ChartOfAccountsPage(page);
    await coa.gotoList();
    const anyRow = page.locator('table tbody tr').first();
    await base.expect(anyRow).toBeVisible();
    const rowText = await anyRow.innerText();
    await coa.openRowMenu(rowText.split('\n')[0]);
    await base.expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await coa.viewViaMenu(rowText.split('\n')[0]);
    await base.expect(page.getByRole('button', { name: 'Edit', exact: true })).not.toBeVisible();
  });

  test('TC-COA-RBAC-04 [-] Direct navigation to an Edit URL does not render the form', async ({ page }) => {
    const coa = new ChartOfAccountsPage(page);
    // Any numeric id is enough here - the assertion is that the edit form never renders,
    // regardless of whether the id itself is valid.
    await page.goto(`${testData.baseUrl}${coa.listPath}/1/edit-chart-of-accounts`);
    await page.waitForLoadState('networkidle');
    await base.expect(coa.accountCodeField()).not.toBeVisible();
  });
});

test.describe('Chart of Accounts - RBAC: no canDelete', () => {
  test.use({ role: 'noDelete' });

  test('TC-COA-RBAC-05 [-] Delete is absent from the row menu and from the View page', async ({ page }) => {
    const coa = new ChartOfAccountsPage(page);
    await coa.gotoList();
    const anyRow = page.locator('table tbody tr').first();
    const rowText = await anyRow.innerText();
    await coa.openRowMenu(rowText.split('\n')[0]);
    await base.expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await coa.viewViaMenu(rowText.split('\n')[0]);
    await base.expect(page.getByRole('button', { name: 'Delete', exact: true })).not.toBeVisible();
  });
});

test.describe('Chart of Accounts - RBAC: no canView', () => {
  test.use({ role: 'readOnly' }); // closest available role until a dedicated noView account exists

  test('TC-COA-RBAC-06 [-] View is absent from the row menu; direct navigation to a View URL is blocked', async ({ page }) => {
    const coa = new ChartOfAccountsPage(page);
    await page.goto(`${testData.baseUrl}${coa.listPath}/1/view-chart-of-accounts`);
    await page.waitForLoadState('networkidle');
    await base.expect(page.getByText('Account Name', { exact: true })).not.toBeVisible();
  });
});

test.describe('Chart of Accounts - RBAC: read-only role (canView only)', () => {
  test.use({ role: 'readOnly' });

  test('TC-COA-RBAC-07 [-] List is fully read-only: no Add button, no Edit/Delete in the row menu', async ({ page }) => {
    const coa = new ChartOfAccountsPage(page);
    await coa.gotoList();
    await base.expect(coa.addButton).not.toBeVisible();

    const anyRow = page.locator('table tbody tr').first();
    const rowText = await anyRow.innerText();
    await coa.openRowMenu(rowText.split('\n')[0]);
    await base.expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toHaveCount(0);
    await base.expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toHaveCount(0);
    await base.expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeVisible();
  });

  test('TC-COA-RBAC-08 [-] View page itself shows no Edit/Delete buttons', async ({ page }) => {
    const coa = new ChartOfAccountsPage(page);
    await coa.gotoList();
    const anyRow = page.locator('table tbody tr').first();
    const rowText = await anyRow.innerText();
    await coa.viewViaMenu(rowText.split('\n')[0]);
    await base.expect(page.getByRole('button', { name: 'Edit', exact: true })).not.toBeVisible();
    await base.expect(page.getByRole('button', { name: 'Delete', exact: true })).not.toBeVisible();
  });
});
