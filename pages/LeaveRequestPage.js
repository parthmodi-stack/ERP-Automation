const BasePage = require('./BasePage');

// Leave Request (erpforce-hrms-fe: src/views/leaves/leave-request/) - the APPROVER-facing review
// module, route `/dashboard/hrms/leaves/leave-request`. Reads from a different endpoint
// (`/v1/leave-requests/`) than Leave Management's own listing (`/v1/leave-management/`), but a
// leave created via Leave Management (LeaveManagementPage) shows up here under the SAME id - both
// are two views of one underlying leave-request record, confirmed by both `fetchLeaveManagement`
// and `fetchLeaveRequest` thunks reading the identical `data.leave_requests` response shape.
//
// Confirmed real behavior worth knowing before extending this file (source: leave-request/
// view-leave-request/view-leave-request.hrms.tsx, add-comment-modal/add-comment-modal.tsx):
//   - Approve/Reject share ONE modal component (AddCommentModal) - both call it with the same
//     "Comments" title; only the internal 'approve'/'reject' state differs which handler runs.
//   - The modal's comment field is genuinely REQUIRED for both actions (Yup: comment required,
//     PLUS the Save button is separately disabled while `!comment?.length`) - there is no
//     approve-without-comment path, confirmed identical for both actions.
//   - Approve/Reject buttons only render when `canUpdateStatus && tData?.can_proceed_request` -
//     the latter is a backend-computed flag (not just a permission), and both buttons are hidden
//     entirely once `status === 'cancelled'`.
//   - This module's OWN listing (leave-request.hrms.tsx) hardcodes `showAddButton={false}` and
//     `destructiveActionMenu={[]}` regardless of permissions - Add/Delete are unreachable from the
//     UI here by design (confirmed in source, not a permissions gap).
class LeaveRequestPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.approveButton = page.getByRole('button', { name: 'Approve Leave' });
    this.rejectButton = page.getByRole('button', { name: 'Reject Leave' });

    this.commentModal = page.getByRole('dialog');
    // "Comments" DynamicInput (`is_multiline`) has no real <label> association (same plain
    // sibling-<p> pattern fieldInputByLabel handles) AND renders as a <textarea>, not an <input> -
    // fieldInputByLabel() only looks for `input`, so it's not reused here. Scoped to the modal so
    // it can't collide with any other "Comments"-labelled element.
    this.commentInput = this.commentModal
      .getByText(/^Comments\s*\*?$/)
      .first()
      .locator('xpath=./following::textarea[1]');
    this.commentModalSaveButton = this.commentModal.getByRole('button', { name: 'Save', exact: true });
    this.commentModalCancelButton = this.commentModal.getByRole('button', { name: 'Cancel', exact: true });
    this.commentRequiredError = page.getByText('Please enter a comment');

    this.approvalHistoryButton = page.getByRole('button', { name: 'Approval History' });
  }

  // ---------- Navigation ----------
  // Same reasoning as LeaveManagementPage.waitForLeaveByIdFetch: relying on 'load'/progressbar-
  // hidden alone can resolve before the by-id GET actually completes, leaving tData empty at the
  // moment assertions run - wait on the real response instead. Matches exactly
  // `/v1/leave-requests/<digits>` (excludes `/status` and the list endpoint's own query string).
  async waitForRequestByIdFetch(action) {
    const responsePromise = this.page.waitForResponse(
      (r) => /\/v1\/leave-requests\/\d+$/.test(new URL(r.url()).pathname) && r.request().method() === 'GET',
      { timeout: 15000 },
    );
    await action();
    await responsePromise;
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  async gotoList() {
    await this.page.goto('/dashboard/hrms/leaves/leave-request');
    await this.page.waitForLoadState('load');
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  async gotoView(id) {
    if (!id) throw new Error(`gotoView() called with a falsy id (${id}) - a prior create step likely failed.`);
    await this.waitForRequestByIdFetch(async () => {
      await this.page.goto(`/dashboard/hrms/leaves/leave-request/${id}/view-leave-request`);
    });
  }

  async openViewFromList(seriesNumber) {
    await this.waitForRequestByIdFetch(async () => {
      await this.openRowActionMenu(seriesNumber);
      await this.page.getByRole('menuitem', { name: 'View', exact: true }).click();
      await this.page.waitForURL('**/view-leave-request');
    });
  }

  // ---------- Approve / Reject ----------
  // Waits on the actual PATCH /v1/leave-requests/{id}/status response (not just a toast) so the
  // caller can assert the real persisted status, per this repo's own "assert on the network
  // response, not just a matching toast/text" lesson (see memory: AssetTransferPage.acceptTransfer
  // false-positive).
  async approve(id, comment) {
    await this.gotoView(id);
    await this.approveButton.click();
    await this.commentInput.fill(comment);
    const statusResponsePromise = this.page.waitForResponse(
      (r) => r.url().includes(`/v1/leave-requests/${id}/status`) && r.request().method() === 'PATCH',
    );
    await this.commentModalSaveButton.click();
    const response = await statusResponsePromise;
    await this.page.waitForLoadState('networkidle');
    const body = await response.json().catch(() => null);
    return body?.data?.leave_request?.status ?? body?.data?.status;
  }

  async reject(id, comment) {
    await this.gotoView(id);
    await this.rejectButton.click();
    await this.commentInput.fill(comment);
    const statusResponsePromise = this.page.waitForResponse(
      (r) => r.url().includes(`/v1/leave-requests/${id}/status`) && r.request().method() === 'PATCH',
    );
    await this.commentModalSaveButton.click();
    const response = await statusResponsePromise;
    await this.page.waitForLoadState('networkidle');
    const body = await response.json().catch(() => null);
    return body?.data?.leave_request?.status ?? body?.data?.status;
  }

  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Draft|Pending|Approved|Rejected|Cancelled/);
  }
}

module.exports = LeaveRequestPage;
