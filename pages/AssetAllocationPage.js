const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Read in full from erpforce-hrms-fe source (asset-allocation-list.tsx, view-asset-allocation/
// view-asset-allocation.hrms.tsx, view-asset-allocation/asset-action-modal.tsx,
// redux/actionCreators.ts, utils/permissions.ts) before writing any locator here - not yet
// live-verified end-to-end the way AssetRequestPage.js is. Known facts baked into this page:
// - The list is READ-ONLY (`showAddButton={false}`) - records only arrive via the Asset Request
//   -> Approve flow, filtered `status.in=Approved,Assigned,PartialAssigned`. `gotoView(id)` uses
//   the SAME id as AssetRequestPage (this list is `fetchRequestedAssets` under the hood).
// - "Assign Assets"/"Add Assets" and "Create New"/"Transfer Assets" are the SAME action wired to
//   the SAME modal each - the label just depends on whether the request already has
//   assigned_assets/transfer_requests. Both buttons are ALWAYS rendered; permission
//   (`canAssignAssets`/`canCreateTransfer`) only drives their `disabled` attribute, not
//   visibility - assert on enabled/disabled state per role, not presence.
// - The assign/transfer modal is a two-panel move-between-lists UI, NOT a plain checkbox-and-
//   submit form: tick a row on the LEFT table, click the panel's own move-right button (SAME
//   label text as the modal's final commit button - CONFIRMED LIVE: "Assign Assets"/"Transfer
//   Assets", PLURAL, not the singular "Assign Asset"/"Transfer Asset" the source read suggested),
//   which moves it into the RIGHT "cart" table, THEN click the modal-footer commit button (now
//   enabled since the cart is non-empty). Two buttons share the same accessible name.
// - Title/breadcrumb strings here (`hrms.employee_assets.*`) carry the SAME raw-i18n-key risk
//   already confirmed live on AssetRequestPage - avoid asserting on them; field-level content
//   (asset name, quantity, serial numbers) render fine.
class AssetAllocationPage extends BasePage {
  // ---------- Navigation ----------
  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create/approve step likely failed.`);
    await this.page.goto(`/dashboard/hrms/asset-allocation/${id}/view-asset-allocation`);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  // ---------- Assign an available asset against an Approved request ----------
  // Returns the receive_handover_request id the backend auto-creates on a successful assign
  // (type "Receive", status "Requested") - AssetTransferPage.gotoView() needs THIS id, not the
  // original asset_request id.
  async assignAsset(id) {
    await this.gotoView(id);

    const assignButton = this.page.getByRole('button', { name: /Assign Assets|Add Assets/i });
    await expect(assignButton).toBeEnabled({ timeout: 10000 });
    await assignButton.click();

    const modal = this.page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Left table ("Available Assets") - tick the first available row's checkbox.
    // CONFIRMED LIVE (MyAssetsPage.js): `[role="row"]` alone also matches a table's HEADER row -
    // scope the role-based alternative under `tbody` to avoid ever resolving to it.
    const firstAvailableRow = modal.locator('table tbody tr, table tbody [role="row"]').first();
    await firstAvailableRow.locator('input[type="checkbox"], [role="checkbox"]').first().click();

    // Move-right button (panel footer) shares the SAME accessible name as the modal's commit
    // button ("Assign Assets") - `.first()` is the move-right action, enabled once a row is ticked.
    const assignAssetButtons = modal.getByRole('button', { name: 'Assign Assets', exact: true });
    await assignAssetButtons.first().click();

    // Commit button is now the one still open/enabled after the move (the modal doesn't close
    // on move-right, only on final commit) - `.last()` resolves to the modal-footer action.
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes('/asset-allocation/requests/') && r.url().includes('/assign') && r.request().method() === 'POST',
    );
    await assignAssetButtons.last().click();
    const response = await responsePromise;
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    const body = await response.json().catch(() => null);
    return body?.data?.receive_handover_request?.id ?? body?.receive_handover_request?.id ?? null;
  }

  // ---------- Transfer an in-use asset (currently held by someone else) against an Approved
  // request - the inter-user transfer flow. Read in full from erpforce-be's
  // asset-allocation.service.js `createTransfer`/receive-handover.service.js
  // `processHandoverRequest`/`completeReceiveHandover` before writing this: transferring creates
  // a "Handover" type receive_handover_request for the CURRENT holder (from_employee_id) - it
  // does NOT create a "Receive" request for the new owner yet. The current holder must Approve
  // (-> InTransit) then complete/Submit (AssetTransferPage.approveHandover/acceptTransfer) before
  // the backend auto-creates that companion "Receive" request for the new owner. ----------
  // CONFIRMED LIVE: filtering the "Assets In Use" table by a specific holder's display name
  // (`hasText: assignedToText`) timed out finding any match - this cumulative shared test
  // environment doesn't guarantee any particular named employee currently holds an asset (they
  // may have already been transferred away by an earlier run). Reverted to a plain first-row
  // pick, same as assignAsset() above - any in-use asset works equally well for exercising the
  // transfer mechanism, the specific holder's identity doesn't matter to this flow.
  async transferAsset(id) {
    await this.gotoView(id);

    const transferButton = this.page.getByRole('button', { name: /Transfer Assets|Create New/i });
    await expect(transferButton).toBeEnabled({ timeout: 10000 });
    await transferButton.click();

    const modal = this.page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Left table ("Assets In Use") - tick the first row's checkbox. Capture the row's own text
    // (includes the "Assigned To" column) BEFORE clicking - callers need to know who the actual
    // current holder is, since it's no longer guaranteed to be any specific known test user.
    const targetRow = modal.locator('table tbody tr, table tbody [role="row"]').first();
    const rowText = (await targetRow.innerText().catch(() => '')) || '';
    await targetRow.locator('input[type="checkbox"], [role="checkbox"]').first().click();

    // Same move-right/commit-button-share-a-name pattern as assignAsset() above - CONFIRMED LIVE
    // (screenshot) this one is singular "Transfer Asset", UNLIKE Assign's plural "Assign Assets" -
    // each button's exact text needed its own live confirmation, one wasn't a safe analogy for
    // the other.
    const transferAssetButtons = modal.getByRole('button', { name: 'Transfer Asset', exact: true });
    await transferAssetButtons.first().click();

    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes('/asset-allocation/transfer') && r.request().method() === 'POST',
    );
    await transferAssetButtons.last().click();
    const response = await responsePromise;
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    const body = await response.json().catch(() => null);
    const receiveHandoverRequests = body?.data?.receive_handover_requests ?? body?.receive_handover_requests ?? [];
    // This is the "Handover" type record - the CURRENT holder acts on this one first.
    return { handoverId: receiveHandoverRequests[0]?.id ?? null, holderRowText: rowText };
  }

  async expectStatus(id, statusRegex) {
    await this.gotoView(id);
    await expect(this.page.getByText(statusRegex).first()).toBeVisible({ timeout: 10000 });
  }
}

module.exports = AssetAllocationPage;
