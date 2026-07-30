const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Read in full from erpforce-hrms-fe source (receive-handover/view-receive-handover/
// view-receive-handover.hrms.tsx, utils/default-data.ts's receiveHandoverEditableColumns,
// utils/permissions.ts's getAssetTransferPermissions, and erpforce-common-hub-fe's
// material-editable-table.tsx) before writing any locator here - not yet live-verified
// end-to-end. Known facts baked into this page:
// - For a freshly-assigned asset, the backend creates a "Receive" type receive_handover_request
//   (status "Requested"). Its view page auto-opens the ONLY asset row in inline edit mode on
//   load (`enableFirstRowEdit` -> `table.setEditingRow(firstRow)` in material-editable-table.tsx)
//   whenever that row's own `received_status` isn't already "Yes" - no manual click-to-edit step
//   needed, the row is already editable the instant the page loads.
// - `received_status` is a plain MRT `editVariant: 'select'` column with exactly two options,
//   `Yes`/`No` (utils/default-data.ts) - rendered as a native MUI Select/combobox in the editing
//   row.
// - Editing the row only updates LOCAL state (`hideSaveButton={true}`, no per-row API call) - the
//   actual `completeReceiveHandover` API call only fires when the page-level "Submit" header
//   button is clicked, which sends ALL rows' current (possibly still-default) values in one call -
//   so `received_status` must be set to "Yes" BEFORE clicking Submit, or the request is silently
//   marked "No"/not received.
// - "Submit" only renders at all when `showSubmitButton` is true (`canComplete` permission AND
//   status is "Requested" for a Receive-type record, OR "InTransit" for a Handover-type record
//   AFTER it's been Approved) - if a user's role lacks `ReceiveHandover.requests.actions.complete`,
//   this button won't render, and that's a genuine role-permission finding worth asserting on,
//   not a broken locator.
// - Inter-user TRANSFER (not a fresh allocation) creates a "Handover" type record for the
//   CURRENT holder, status "Requested" - read in full from erpforce-be's
//   receive-handover.service.js before wiring this up: the current holder must first Approve
//   (shared src/components/approve-reject/apporve-reject.tsx, POST .../process-handover, no
//   confirm dialog - `onClick` calls the status handler directly) which flips status ->
//   "InTransit" and the linked asset -> "in_transit". ONLY THEN does the page's "Submit" button
//   render, to complete the handover (POST .../complete) - which is the SAME
//   row-edit-then-Submit interaction as acceptTransfer() below, just with the column relabeled
//   "Handover Status" instead of "Received Status" (same underlying combobox/select, no locator
//   change needed). Completing an "all Yes" Handover response includes a NEW `receive_request`
//   object for the recipient (`response.data.receive_request.id`) - acceptTransfer() returns the
//   full parsed body so callers can extract this for the next stage.
class AssetTransferPage extends BasePage {
  // `routeSegment` defaults to the Asset Transfer module ('asset-transfer'); the Asset Return
  // module ('asset-return') renders the EXACT SAME `ViewReceiveHandover` component (just with a
  // `type='return'` prop from its own route wrapper) - CONFIRMED LIVE (screenshot): identical
  // breadcrumb/table/Submit-button shape, same combobox-then-Enter-then-Submit interaction below
  // works unchanged. gotoReturnView() is a thin convenience over this.
  async gotoView(id, routeSegment = 'asset-transfer') {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior assign/transfer/return step likely failed to return a receive_handover_request id.`);
    await this.page.goto(`/dashboard/hrms/${routeSegment}/${id}/view-${routeSegment}`);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  async gotoReturnView(id) {
    await this.gotoView(id, 'asset-return');
  }

  async expectSubmitAvailable() {
    await expect(this.page.getByRole('button', { name: 'Submit', exact: true })).toBeVisible({ timeout: 10000 });
  }

  // Approves a pending ("Requested") Handover request - the CURRENT holder's own first step
  // before they can complete/hand it over. Not applicable to "Receive" type records (those go
  // straight to acceptTransfer()).
  async approveHandover(id) {
    await this.gotoView(id);

    const approveButton = this.page.getByRole('button', { name: 'Approve', exact: true });
    await expect(approveButton).toBeEnabled({ timeout: 10000 });

    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes('process-handover') && r.request().method() === 'POST',
    );
    await approveButton.click();
    await responsePromise;
    await expect(this.page.getByText(/InTransit|In Transit/i).first()).toBeVisible({ timeout: 10000 });
  }

  // Marks the (already auto-editing) asset row's Received/Handover Status as "Yes" and submits,
  // completing the Receive-Handover request. Returns the parsed response body - for a Handover
  // completion this may include a `receive_request` object (the companion Receive record
  // auto-created for the new owner); for a plain Receive completion it won't.
  async acceptTransfer(id, routeSegment = 'asset-transfer') {
    await this.gotoView(id, routeSegment);

    // CONFIRMED LIVE (tests/tmp/inspect-handover-row.spec.js): scoping through a `table tbody
    // tr .first()` row locator resolves to the WRONG element - the click/select silently
    // "succeeds" (no error) but never actually changes the row's real value. Selecting the
    // page's own FIRST combobox directly (unscoped) is what actually works - verified live, the
    // selected value visibly updates from "No" to "Yes" this way.
    const statusCombobox = this.page.getByRole('combobox').first();
    await statusCombobox.click();
    await this.page.getByRole('option', { name: 'Yes', exact: true }).click();
    await expect(statusCombobox).toHaveText('Yes', { timeout: 5000 });

    // CONFIRMED LIVE: unlike Damage/Loss Claim's row (which needs BasePage.saveEditableTableRow's
    // click-outside commit), this specific table regresses back to "InTransit"/stale data when
    // using that same click-outside approach - re-tested directly, confirmed by re-running
    // 12-inter-user-asset-transfer.spec.js's TC-AST-11. The two forms clearly commit differently
    // under the hood despite sharing the same visual MaterialEditableTable component. The row's
    // own `onKeyUp` Enter handler (`saveEditingRow(table)`, 0ms internal delay) is what's proven
    // reliable HERE specifically - keep this one as Enter, don't "genericize" it further without
    // re-verifying live again.
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(300);
    await this.saveEditableTableRow();

    const submitButton = this.page.getByRole('button', { name: 'Submit', exact: true });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });

    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes('/receive-handover/requests/') && r.url().includes('/complete') && r.request().method() === 'POST',
    );
    await submitButton.click();
    const response = await responsePromise;
    const body = await response.json().catch(() => null);
    // Trust the network response's own status over a DOM text scan - "Completed" can appear
    // elsewhere on the page (e.g. a status-filter dropdown option) even when the request itself
    // is still in an earlier status, which is exactly what silently masked this bug the first
    // time (the old `getByText(/Completed/i)` assertion kept passing while the real request
    // stayed "InTransit").
    expect(body?.data?.request?.status ?? body?.request?.status).toBe('Completed');

    return body;
  }

  // Thin wrapper so callers reading a return-flow spec don't have to know about the shared
  // `routeSegment` plumbing - same interaction, just the Asset Return module's own route.
  async acceptReturn(id) {
    return this.acceptTransfer(id, 'asset-return');
  }

  // Convenience for the inter-user transfer flow: extracts the new "Receive" record id the
  // backend auto-creates for the recipient once the current holder's Handover completes.
  // CONFIRMED LIVE: `receive_request` itself has an extra nesting level - `{ data: {...},
  // schema: {...} }` - NOT the plain record the other endpoints (assign/transfer) return.
  async getCompanionReceiveRequestId(completeResponseBody) {
    const receiveRequest = completeResponseBody?.data?.receive_request ?? completeResponseBody?.receive_request;
    return receiveRequest?.data?.id ?? receiveRequest?.id ?? null;
  }
}

module.exports = AssetTransferPage;
