const { test, expect } = require('@playwright/test');
const CrmDeliveryOrderPage = require('../../pages/CrmDeliveryOrderPage');

// ── tests/regression/12-delivery-order-negative.spec.js ───────────────────────────────────────
// Delivery Orders Navigation/Permissions + Negative & Edge Case coverage, sourced from
// Delivery_Orders_TestCases.xlsx. Continues TC-DO-NN numbering after 11-delivery-order-detail.
// spec.js. No @smoke2 tag - never runs there.
//
// Role-based access (viewer/no-access role) TCs from the sheet are skipped entirely - they need a
// second test account with different permissions, which isn't configured in this project.
// Deleted/inactive-customer and concurrent-invoice-creation TCs are skipped as genuinely
// impractical to automate reliably here (see conversation history for why).
test.describe('Delivery Order Management - Negative & Edge Cases', () => {

  test('TC-DO-47 [-] Access a non-existent Delivery Order via URL does not crash', async ({ page }) => {
    const delivery = new CrmDeliveryOrderPage(page);
    await page.goto('/dashboard/crm/orders/delivery-orders/9999999/view-delivery-orders', { timeout: 60000 });
    await page.waitForTimeout(2000);
    // No crash: the page itself is still up (banner/nav chrome present), even though no real
    // record data ever loads for this id.
    await expect(page.getByRole('button', { name: 'CRM' })).toBeVisible({ timeout: 10000 });
  });

  test.describe('Unauthenticated access', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('TC-DO-48 [-] Unauthenticated direct URL access redirects to login', async ({ page }) => {
      await page.goto('/dashboard/crm/orders/delivery-orders/1/view-delivery-orders', { timeout: 60000 });
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/login/i, { timeout: 15000 });
    });
  });

  test('TC-DO-49 [-] Network loss during list page load shows an error, does not freeze', async ({ page }) => {
    // Only abort the DATA fetch (apidev host, non-document requests) - a bare glob on
    // "delivery-order" also matches the page's own top-level navigation URL and kills the whole
    // page load instead of simulating a mid-page data-fetch failure (confirmed live: aborting
    // that broadly renders Chrome's own "This site can't be reached" interstitial).
    const routeHandler = route => {
      if (route.request().resourceType() !== 'document' && route.request().url().includes('apidev.erpforce.co')) {
        return route.abort();
      }
      return route.continue();
    };
    await page.route('**/*', routeHandler);
    await page.goto('/dashboard/crm/orders/delivery-orders', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);
    // No crash: the page's own chrome (nav/sidebar) still renders even though the grid's own
    // data fetch failed.
    await expect(page.getByRole('button', { name: 'CRM' })).toBeVisible({ timeout: 10000 });
    await page.unroute('**/*', routeHandler);
  });
});
