const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Leave Management (erpforce-hrms-fe: src/views/leaves/leave-management/) - the EMPLOYEE-facing
// "apply for my own leave" module, route `/dashboard/hrms/leaves/leave-management`. Distinct from
// the approver-facing Leave Request module (`LeaveRequestPage.js`) even though both share nearly
// identical field names - source-read confirmed these are two separate sub-modules with different
// validation/permission keys (LeaveManagement vs LeaveRequests), not two views of one thing.
//
// Confirmed real behavior worth knowing before extending this file (source: leave-management/
// form/form.tsx, utils/validation.ts, utils/constants.ts):
//   - Yup schema requires ONLY leave_category_id/duration/start_date/end_date/employee_id -
//     Leave Reason and Attachments have NO validation rule at all (optional, no max length).
//   - Duration is a static 2-option DynamicSelect ('Full Day'/'Half Day'), not master data.
//   - Leave Type (DynamicSearchSelect, apiType='leave_category') is filtered to only the
//     categories on the LOGGED-IN employee's own contract - not a stable/pinnable literal across
//     accounts, so this page always picks whichever option renders first.
//   - Start Date has `min_date=today` (past dates are unselectable via the picker); End Date is
//     disabled until Start Date is chosen and has `min_date=start_date`.
//   - No. Of Days is a disabled, auto-calculated field: (end_date - start_date in days) + 1 - it
//     does NOT account for Half Day (confirmed in form.tsx's useEffect: no 0.5-day branch at all).
//   - The Employee dropdown only renders for the hardcoded `user.id == 10` - for every other
//     account (including this suite's employee login) employee_id auto-fills from the logged-in
//     user and the field never appears, so this page never fills it.
//   - Row-menu Edit is enabled only for Draft/Rejected statuses; Cancel only for Pending/Approved;
//     Delete only for Draft - all three are UI-menu-only gates (confirmed no route guard/status
//     check exists on the Edit page itself - see EDIT_LEAVE_MANAGEMENT_EMPLOYEE's ProtectedRoute
//     being commented out in leave-management/routes/index.tsx).
//   - Cancel is a plain ConfirmModal ("Cancel Leave Management: {id} ?", confirm button text
//     "Cancel", dismiss button text "Close") - there is NO comment/reason field on this modal,
//     unlike Leave Request's Approve/Reject flow.
//   - View page's Duration ValueField has a confirmed display bug: it recomputes
//     `end_date.diff(start_date,'day')+1` instead of showing the literal "Full Day"/"Half Day"
//     text (view-leave-management.hrms.tsx's getValue(), `name === 'duration'` branch) - assert
//     this explicitly rather than assuming the text renders correctly.
class LeaveManagementPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    this.listAddButton = page.getByRole('button', { name: 'Add' }).first();

    // Add/Edit form fields - ID/No. Of Days have no real <label> association (plain sibling <p>
    // + <input>, same pattern as Leave Policy Master - see BasePage.fieldInputByLabel's own
    // comment), Leave Reason is a plain multiline DynamicInput.
    this.idInput = this.fieldInputByLabel('ID');
    this.leaveTypeField = 'Leave Type';
    this.durationField = 'Duration';
    // Both Start Date and End Date share the exact same "DD-MM-YYYY" placeholder - .nth(0) is
    // Start Date, .nth(1) is End Date, per their DOM order in form.tsx (Start Date renders first).
    this.dateInputs = page.getByPlaceholder('DD-MM-YYYY');
    this.noOfDaysInput = this.fieldInputByLabel('No. Of Days');
    this.leaveReasonInput = page.getByPlaceholder('Enter Reason');

    this.requiredError = (label) => page.getByText(new RegExp(`${label} is required`, 'i'));

    this.discardButton = page.getByRole('button', { name: 'Discard' });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    // View page
    this.viewActionsButton = page.getByRole('button', { name: 'Actions' });
    this.approvalHistoryButton = page.getByRole('button', { name: 'Approval History' });

    // Cancel confirmation - plain ConfirmModal, no comment field (see class-level comment).
    this.cancelConfirmButton = page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true });
    this.cancelDismissButton = page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true });
  }

  async gotoList() {
    // Re-navigating to the SAME listing URL immediately after an in-app action just finished its
    // own async refetch (e.g. right after a Delete/Cancel confirm) can occasionally abort with
    // net::ERR_ABORTED - CONFIRMED LIVE, reproducible - most likely the SPA's own router
    // intercepting/cancelling the redundant reload mid-flight. One retry clears it reliably.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.page.goto('/dashboard/hrms/leaves/leave-management');
        break;
      } catch (e) {
        if (!String(e).includes('ERR_ABORTED') || attempt === 3) throw e;
        await this.page.waitForTimeout(1000);
      }
    }
    await this.page.waitForLoadState('load');
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  async gotoAdd() {
    await this.gotoList();
    await this.listAddButton.click();
    await this.page.waitForURL('**/add-leave-management');
    await this.page.waitForLoadState('load');
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  // leaveType/duration are left undefined by default (picks whatever's available) - pass an
  // explicit value only when a test genuinely needs a specific one.
  async fillForm({ leaveType, duration = 'Full Day', startDate, endDate, leaveReason } = {}) {
    if (leaveType) {
      await this.selectFieldByLabel(this.leaveTypeField, leaveType, { exact: false });
    } else {
      const combobox = this.page
        .getByText(/^Leave Type\s*\*?$/)
        .first()
        .locator('xpath=..')
        .getByRole('combobox')
        .first();
      await this.selectFirstAvailableOption(combobox);
    }
    if (duration) {
      await this.selectFieldByLabel(this.durationField, duration, { exact: false });
    }
    if (startDate) {
      await this.dateInputs.nth(0).fill(startDate);
    }
    if (endDate) {
      await this.dateInputs.nth(1).fill(endDate);
    }
    if (leaveReason !== undefined) {
      await this.leaveReasonInput.fill(leaveReason);
    }
  }

  async getNoOfDaysValue() {
    return this.noOfDaysInput.inputValue();
  }

  // ---------- Save actions ----------
  // List refetch shape per leave-management/redux/actionCreators.ts fetchLeaveManagement:
  // `{ data: { leave_requests: [...] } }` from GET /v1/leave-management/.
  async saveAndCaptureId(buttonLocator) {
    const listResponsePromise = this.page.waitForResponse(
      (r) => r.url().includes('/v1/leave-management/') && r.request().method() === 'GET',
    );
    await buttonLocator.click();
    const listResponse = await listResponsePromise;
    await this.page.waitForLoadState('networkidle');
    const body = await listResponse.json().catch(() => null);
    const record = body?.data?.leave_requests?.[0];

    const id = record?.id !== undefined ? String(record.id) : undefined;
    let seriesNumber = record?.series_number;
    if (!seriesNumber) {
      seriesNumber = await this.page.locator('table tbody tr').first().innerText();
    }
    return { id, seriesNumber };
  }

  async save() {
    return this.saveAndCaptureId(this.saveButton);
  }

  async saveAsDraft() {
    return this.saveAndCaptureId(this.saveToDraftButton);
  }

  // Edit page only renders "Save To Draft" when `tData?.is_draft` is true (edit-leave-management
  // .hrms.tsx) - a DIFFERENT flag from the list/view's `status` text field, so a record whose
  // Status column reads "Draft" is not guaranteed to show this button on Edit. Callers that need
  // to edit-and-persist-as-draft should check this first rather than assuming the button exists.
  async isSaveToDraftVisible() {
    return this.saveToDraftButton.isVisible().catch(() => false);
  }

  // ---------- Row status / navigation ----------
  async getRowStatus(seriesNumber) {
    return this.getRowStatusMatching(seriesNumber, /Draft|Pending|Approved|Rejected|Cancelled/);
  }

  // Both Edit and View are SPA route changes (client-side pushState, no real navigation), so
  // `page.waitForLoadState('load')` is a no-op here - the browser's real 'load' event already
  // fired once at initial app boot and never fires again on an in-app route change. The only
  // reliable signal that the record's own data has actually arrived is the by-id GET response
  // itself (CONFIRMED LIVE: without this wait, the page can render with an entirely empty tData
  // - every ValueField shows "-" - because the loader clears before the fetch resolves).
  // Matches exactly `/v1/leave-management/<digits>` with no further path segment (excludes the
  // `/status` PATCH and the list endpoint's own `/v1/leave-management/?...` GET).
  async waitForLeaveByIdFetch(action) {
    const responsePromise = this.page.waitForResponse(
      (r) => /\/v1\/leave-management\/\d+$/.test(new URL(r.url()).pathname) && r.request().method() === 'GET',
      { timeout: 15000 },
    );
    await action();
    await responsePromise;
    await this.page.locator('role=progressbar').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  async openEditFromList(seriesNumber) {
    await this.waitForLeaveByIdFetch(async () => {
      await this.openRowActionMenu(seriesNumber);
      await this.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
      await this.page.waitForURL('**/edit-leave-management');
    });
  }

  async openViewFromList(seriesNumber) {
    await this.waitForLeaveByIdFetch(async () => {
      await this.openRowActionMenu(seriesNumber);
      await this.page.getByRole('menuitem', { name: 'View', exact: true }).click();
      await this.page.waitForURL('**/view-leave-management');
    });
  }

  // Direct URL navigation - used by security test cases that check whether Edit is reachable for
  // a non-Draft/Rejected status despite the row menu disabling it (confirmed gap - Edit route has
  // no status guard, see class-level comment).
  async gotoEditById(id) {
    await this.waitForLeaveByIdFetch(async () => {
      await this.page.goto(`/dashboard/hrms/leaves/leave-management/${id}/edit-leave-management`);
    });
  }

  async gotoViewById(id) {
    await this.waitForLeaveByIdFetch(async () => {
      await this.page.goto(`/dashboard/hrms/leaves/leave-management/${id}/view-leave-management`);
    });
  }

  // ---------- Cancel / Delete from list ----------
  // Waits on the actual PATCH /v1/leave-management/{id}/status response (not just
  // 'networkidle', which can resolve before a slow request on this dev environment settles - the
  // ConfirmModal itself only closes on a fulfilled response, so checking the modal alone would
  // just be waiting on the same thing indirectly) and on the dialog actually closing, so the
  // caller can trust the listing has re-rendered with the new status before reading it.
  async cancelConfirmAndWait() {
    const statusResponsePromise = this.page.waitForResponse(
      (r) => /\/v1\/leave-management\/\d+\/status$/.test(new URL(r.url()).pathname) && r.request().method() === 'PATCH',
      { timeout: 15000 },
    );
    await this.cancelConfirmButton.click();
    await statusResponsePromise;
    await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async cancelFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'Cancel', exact: true }).click();
    await this.cancelConfirmAndWait();
  }

  async cancelFromView() {
    await this.openViewActionsMenu();
    await this.page.getByRole('menuitem', { name: 'Cancel', exact: true }).click();
    await this.cancelConfirmAndWait();
  }

  // ---------- View page: Actions menu ----------
  async openViewActionsMenu() {
    await this.viewActionsButton.click();
  }

  async openEditFromView() {
    await this.waitForLeaveByIdFetch(async () => {
      await this.openViewActionsMenu();
      await this.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
      await this.page.waitForURL('**/edit-leave-management');
    });
  }

  async isViewActionDisabled(actionName) {
    await this.openViewActionsMenu();
    const item = this.page.getByRole('menuitem', { name: actionName, exact: true });
    const ariaDisabled = await item.getAttribute('aria-disabled');
    await this.page.keyboard.press('Escape');
    return ariaDisabled === 'true';
  }
}

module.exports = LeaveManagementPage;
