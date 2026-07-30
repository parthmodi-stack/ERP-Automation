const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Read in full from erpforce-hrms-fe source (my-assets/my-assets-list.tsx, my-assets/components/
// header-buttons.tsx) and CONFIRMED LIVE (tests/tmp/inspect-asset-return.spec.js) before writing
// this. Known facts:
// - Route `/dashboard/hrms/asset-list`. Two title-menu tabs: "My Asset" (received-asset, the
//   DEFAULT active tab, `enableRowSelection=true`) and "Grouped Asset" (my-assets, no row
//   selection) - Return Asset only makes sense on the "My Asset" tab, which is why it's the
//   default.
// - header-buttons.tsx's own "Return Asset" button is DEAD CODE (commented out in JSX) - the
//   REAL button lives in my-assets-list.tsx's `actionButtons` prop, rendered only on the
//   received-asset tab, disabled until at least one row checkbox is selected.
// - Clicking it opens a `ConfirmModal` (title "Return Asset", description "Are you sure you want
//   to return N selected asset(s)?", Cancel + Confirm buttons) - CONFIRMED LIVE: the Confirm
//   button's own text renders as the RAW i18n key "common.return" (missing translation, not a
//   locator bug) - don't match by name text, use structural position instead (Cancel first,
//   Confirm last, per the dialog's own DOM/text order).
// - Confirming calls `POST /hrms/v1/my-assets/return` with `{ employee_asset_ids: [...] }` -
//   CONFIRMED LIVE the response includes a NEW "Receive" type `handover_request`, always owned by
//   a fixed "super admin" employee (id 192, login email admin@gmail.com in this environment) -
//   NOT the employee who returned the asset. Capture `handover_request.id` from this response
//   (AssetTransferPage.gotoReturnView/acceptReturn needs it), rather than searching the Asset
//   Return list afterward.
class MyAssetsPage extends BasePage {
  async goto() {
    await this.page.goto('/dashboard/hrms/asset-list');
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  rowByAssetName(assetName) {
    return this.page.locator('tr', { hasText: assetName });
  }

  // Ticks the given asset's row checkbox (or the first row if no name given - most callers only
  // care about "return whichever asset I currently hold"), clicks "Return Asset", confirms the
  // modal, and returns the id of the "Receive" handover request the backend auto-creates for the
  // fixed receiving employee.
  async returnAsset(assetName) {
    await this.goto();

    const row = assetName ? this.rowByAssetName(assetName).first() : this.page.locator('table tbody tr, table tbody [role="row"]').first();
    await row.locator('input[type="checkbox"], [role="checkbox"]').first().click();

    const returnButton = this.page.getByRole('button', { name: 'Return Asset', exact: true });
    await expect(returnButton).toBeEnabled({ timeout: 10000 });
    await returnButton.click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    // `.last()` is the Confirm button (Cancel renders first) - see class-level comment on why
    // this isn't matched by its own text.
    const confirmButton = dialog.getByRole('button').last();

    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes('/my-assets/return') && r.request().method() === 'POST',
    );
    await confirmButton.click();
    const response = await responsePromise;
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    const body = await response.json().catch(() => null);
    return body?.data?.handover_request?.id ?? body?.handover_request?.id ?? null;
  }

  // ---------- Report Damage/Loss (from an asset's own View My Assets page) ----------
  // Read in full from view-my-assets.hrms.tsx before writing this - CRITICAL constraint: that
  // page destructures `const { type, assetId } = location.state` with NO fallback, and the
  // Add Damage Loss Claim form's Serial Number multiselect options come ENTIRELY from
  // `location.state.assets` (passed in via `handleReportDamage`'s `navigate(..., { state:
  // {...currentAsset, selectedAsset} })`) - NOT a live API fetch. A direct `page.goto()` to
  // either page would either crash (missing state) or render a Serial Number field with ZERO
  // selectable options. Both navigations MUST happen via real in-app clicks (row click, then the
  // "Report Damage/Loss" button) so React Router's client-side state actually carries over.
  // CONFIRMED LIVE: the "Asset Name" column here is the REAL physical asset's own name (e.g.
  // "Iphone8") - NOT whatever free-text name a test typed into the Asset Request form when
  // requesting it (those are two unrelated fields; the request just describes what was wanted,
  // the actual unit fulfilling it keeps its own real name). There's no way to know that real
  // name in advance, so this always operates on the first row - any held asset is equally valid
  // for exercising the Damage/Loss mechanism, matching returnAsset()'s own default.
  // CONFIRMED LIVE: an asset that already has a damage/loss claim raised against it renders its
  // "View My Assets" checkbox `disabled` (`can_raise_damage_claim` becomes false server-side once
  // claimed) - since this whole suite repeatedly calls this method against the SAME cumulative
  // held-assets list, the first row eventually becomes permanently ineligible. Walk list rows
  // (each one is a single specific asset, per the `employee_asset_id` filter on this list's own
  // "received-asset" tab) until one has an enabled checkbox on its own View page, rather than
  // assuming row 0 always works.
  async reportDamageLoss({ maxAssetsToTry = 50 } = {}) {
    await this.goto();
    // CONFIRMED LIVE: navigating here immediately after a mutation on the previous page (e.g.
    // AssetTransferPage.acceptTransfer's own POST /complete) can leave this list stuck showing its
    // loading-skeleton rows indefinitely - `networkidle` alone doesn't catch this, since the
    // skeleton is a client-side loading STATE, not pending network activity. Wait for it to
    // actually clear before doing anything else; if it never does, one full re-navigation is
    // enough to recover (this is a render-race, not a real backend delay).
    const waitForSkeletonClear = async () => {
      try {
        await expect(this.page.locator('.MuiSkeleton-root').first()).not.toBeVisible({ timeout: 10000 });
        return true;
      } catch (e) {
        return false;
      }
    };
    if (!(await waitForSkeletonClear())) {
      await this.goto();
      await waitForSkeletonClear();
    }

    // The list defaults to 10 items per page - a plain `nth(index)` locator only ever sees
    // whatever's in the DOM for the CURRENT page, so without this, searching past row 9 silently
    // finds nothing (count() === 0) rather than actually checking more assets. 50 is this shared
    // pagination component's own largest page-size option (pagination.tsx's pageSizeOptions).
    await this.changePageSize(50).catch(() => {});
    await waitForSkeletonClear();

    // CONFIRMED LIVE: this suite's own cumulative runs keep ADDING newly-assigned (unclaimed)
    // assets to Kashyap's held-asset list without ever returning older ones - by now his list can
    // hold more than one page's worth of rows even at the max page size (50). An earlier attempt
    // to sort by "Assigned On" descending (so the freshest holds get checked first) was reverted -
    // this table's sort control CYCLES (unsorted -> ascending -> descending -> unsorted) and
    // persists across calls within the same session, so clicking a FIXED number of times per call
    // doesn't reliably land on the same state twice - a second call within the same test walked
    // straight into ascending (oldest-first) order instead, exactly the opposite of what was
    // wanted. Walking every page in whatever order the list already uses is slower but doesn't
    // depend on sort state at all.
    let pageIndex = 0;
    let totalChecked = 0;
    while (totalChecked < maxAssetsToTry) {
      // CONFIRMED LIVE: `[role="row"]` alone also matches the table's HEADER row (MRT gives both
      // thead and tbody rows this role) - a bare `table tbody tr, [role="row"]` selector can
      // therefore resolve to the header's own "select all"/sort-control row instead of a real
      // data row. Scope the role-based alternative under `tbody` too.
      const rowsOnPage = await this.page.locator('table tbody tr, table tbody [role="row"]').count();
      if (rowsOnPage === 0) break;

      for (let index = 0; index < rowsOnPage && totalChecked < maxAssetsToTry; index++, totalChecked++) {
        const row = this.page.locator('table tbody tr, table tbody [role="row"]').nth(index);

        await row.getByRole('link').first().click().catch(() => row.click());
        await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

        const detailCheckbox = this.page
          .locator('table tbody tr, table tbody [role="row"]')
          .first()
          .locator('input[type="checkbox"], [role="checkbox"]')
          .first();
        // CONFIRMED LIVE: this view can briefly render the checkbox as enabled from stale/cached
        // state, then flip it to disabled a moment later once the real `can_raise_damage_claim`
        // value resolves (a subsequent claim-check refetch) - checking `isDisabled()` once and
        // immediately clicking can race that flip and throw "element is not enabled" mid-click.
        // Re-check after a short settle wait, right before clicking, to avoid acting on stale state.
        let isDisabled = await detailCheckbox.isDisabled().catch(() => true);
        if (!isDisabled) {
          await this.page.waitForTimeout(500);
          isDisabled = await detailCheckbox.isDisabled().catch(() => true);
        }
        if (!isDisabled) {
          try {
            await detailCheckbox.click({ timeout: 5000 });
            const reportButton = this.page.getByRole('button', { name: /Report Damage\/Loss/i });
            await expect(reportButton).toBeEnabled({ timeout: 10000 });
            await reportButton.click();
            await this.page.waitForURL(/add-damage-loss-claim/, { timeout: 15000 });
            await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
            return;
          } catch (e) {
            // Flipped to disabled mid-click (or some other transient issue) - treat this asset as
            // ineligible and move on to the next row instead of failing the whole search.
          }
        }

        // Go BACK to the same list page instead of a full goto() reset - preserves the page-size/
        // pagination position (goto() would silently reset back to page 1 every time, making it
        // impossible to ever reach page 2+).
        await this.page.goBack();
        await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await waitForSkeletonClear();
      }

      // Current page's rows are all ineligible - advance to the next page rather than re-checking
      // the same ones. Stop if there isn't one.
      const nextButton = this.nextPageButton();
      const isNextDisabled = await nextButton.isDisabled().catch(() => true);
      if (isNextDisabled) break;
      await nextButton.click();
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await waitForSkeletonClear();
      pageIndex++;
    }

    throw new Error(`reportDamageLoss(): checked ${totalChecked} held assets across ${pageIndex + 1} page(s) and none had an enabled "raise damage claim" checkbox - every asset already has a claim against it.`);
  }
}

module.exports = MyAssetsPage;
