const { test, expect } = require('@playwright/test');
const LeaveManagementPage = require('../../pages/LeaveManagementPage');
const LeaveRequestPage = require('../../pages/LeaveRequestPage');
const LoginPage = require('../../pages/LoginPage');
const testData = require('../../config/testData');

const { employee, approver } = testData.leaveManagement.users;
const { valid, request: requestData } = testData.leaveManagement;

function formatDdMmYyyy(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${date.getFullYear()}`;
}

function daysFromToday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

// See 15-leave-management.spec.js's identical helper for why: the backend rejects a real Save
// with "Leave request already exists for date range" against ANY prior leave for the same
// category with an overlapping range, even across separate spec files sharing this dev dataset -
// a wide random spread avoids that collision.
function randomOffset(min = 100, max = 3000) {
  return min + Math.floor(Math.random() * (max - min));
}

// Leave Request approval workflow - genuinely logs in as TWO distinct real accounts (same
// reasoning as tests/hrms/12-inter-user-asset-transfer.spec.js): Kashyap Jivani creates his own
// leave via Leave Management, then Dipen Modi (the fixed approver login already used throughout
// this repo) reviews/actions it via the separate Leave Request module. A leave created via
// Leave Management shows up in Leave Request under the SAME id - see LeaveRequestPage.js's
// top-of-file comment for the source-level evidence.
test.describe.serial('Leave Request - Approve / Reject Workflow', () => {
  test.describe.configure({ timeout: 180000 });

  let page;
  let loginPage;
  let leaveManagementPage;
  let leaveRequestPage;

  let approveFlowId;
  let approveFlowSeriesNumber;
  let rejectFlowId;
  let cancelledFlowId;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    page = await context.newPage();
    loginPage = new LoginPage(page);
    leaveManagementPage = new LeaveManagementPage(page);
    leaveRequestPage = new LeaveRequestPage(page);
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  async function createLeaveAsEmployee(reasonSuffix, offsetDays = randomOffset()) {
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(employee.email, employee.password);

    const startDate = daysFromToday(offsetDays);
    const endDate = daysFromToday(offsetDays + 1);

    await leaveManagementPage.gotoAdd();
    await leaveManagementPage.fillForm({
      leaveType: valid.leaveType,
      duration: 'Full Day',
      startDate: formatDdMmYyyy(startDate),
      endDate: formatDdMmYyyy(endDate),
      leaveReason: `${valid.leaveReason} - ${reasonSuffix}`,
    });
    const { id, seriesNumber } = await leaveManagementPage.save();
    expect(id, 'creating the leave should return a captured id').toBeTruthy();

    await loginPage.logout();
    return { id, seriesNumber };
  }

  test('TC-LR-01 [+] Kashyap creates a leave, Dipen approves it with a comment', async () => {
    const created = await createLeaveAsEmployee('approve flow');
    approveFlowId = created.id;
    approveFlowSeriesNumber = created.seriesNumber;

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);

    const status = await leaveRequestPage.approve(approveFlowId, requestData.comment.approve);
    expect(status).toMatch(/Approved/i);

    await loginPage.logout();
  });

  test('TC-LR-02 [+] Employee sees Approved status and updated Approval History after logging back in', async () => {
    expect(approveFlowId, 'TC-LR-01 must run first').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(employee.email, employee.password);
    await leaveManagementPage.gotoList();

    const status = await leaveManagementPage.getRowStatus(approveFlowSeriesNumber);
    expect(status).toMatch(/Approved/i);

    await leaveManagementPage.openViewFromList(approveFlowSeriesNumber);
    await leaveManagementPage.approvalHistoryButton.click();
    await expect(page.getByText(/Reviewed & Approved|approved the leave/i).first()).toBeVisible();
    await page.keyboard.press('Escape'); // close the popover - its backdrop otherwise blocks logout's own header click

    await loginPage.logout();
  });

  test('TC-LR-03 [-] Cannot approve/reject an already-Approved leave request', async () => {
    expect(approveFlowId, 'TC-LR-01 must run first').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);

    await leaveRequestPage.gotoView(approveFlowId);
    await expect(leaveRequestPage.approveButton).not.toBeVisible();
    await expect(leaveRequestPage.rejectButton).not.toBeVisible();

    await loginPage.logout();
  });

  test('TC-LR-04 [-] Empty comment blocks Save on the Approve/Reject modal', async () => {
    const created = await createLeaveAsEmployee('validation flow');

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);

    await leaveRequestPage.gotoView(created.id);
    await leaveRequestPage.approveButton.click();
    await expect(leaveRequestPage.commentModalSaveButton).toBeDisabled();

    // NOTE: add-comment-modal.tsx destructures `formState: { errors }` but never actually renders
    // `errors.comment` anywhere - CONFIRMED LIVE the "Please enter a comment" Yup message never
    // appears in the UI, on blur or otherwise. The disabled Save button is the only real gate a
    // user sees; that's what this case actually verifies.
    await leaveRequestPage.commentInput.fill('a');
    await expect(leaveRequestPage.commentModalSaveButton).toBeEnabled();
    await leaveRequestPage.commentInput.fill('');
    await leaveRequestPage.commentInput.blur();
    await expect(leaveRequestPage.commentModalSaveButton).toBeDisabled();

    await leaveRequestPage.commentModalCancelButton.click();

    // Reject this one too, so it doesn't linger as a stray Pending record for later runs.
    const status = await leaveRequestPage.reject(created.id, requestData.comment.reject);
    expect(status).toMatch(/Rejected/i);

    await loginPage.logout();
  });

  test('TC-LR-05 [+] Kashyap creates a leave, Dipen rejects it with a comment', async () => {
    const created = await createLeaveAsEmployee('reject flow');
    rejectFlowId = created.id;

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);

    const status = await leaveRequestPage.reject(rejectFlowId, requestData.comment.reject);
    expect(status).toMatch(/Rejected/i);

    await loginPage.logout();
  });

  test('TC-LR-06 [+] Employee sees Rejected status and can re-edit the leave', async () => {
    expect(rejectFlowId, 'TC-LR-05 must run first').toBeTruthy();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(employee.email, employee.password);

    await leaveManagementPage.gotoViewById(rejectFlowId);
    const statusChip = page.locator('[class*="StatusChip--rejected"]').first();
    await expect(statusChip).toBeVisible();

    // Rejected qualifies for Edit per leave-management.hrms.tsx's row-menu gating rule.
    const editDisabled = await leaveManagementPage.isViewActionDisabled('Edit');
    expect(editDisabled).toBe(false);

    await loginPage.logout();
  });

  test('TC-LR-07 [-] Cannot approve/reject a Cancelled leave request', async () => {
    const created = await createLeaveAsEmployee('cancel-before-approval flow');
    cancelledFlowId = created.id;

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(employee.email, employee.password);
    await leaveManagementPage.gotoList();
    await leaveManagementPage.cancelFromList(created.seriesNumber);
    await loginPage.logout();

    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(approver.email, approver.password);
    await leaveRequestPage.gotoView(cancelledFlowId);
    await expect(leaveRequestPage.approveButton).not.toBeVisible();
    await expect(leaveRequestPage.rejectButton).not.toBeVisible();

    await loginPage.logout();
  });
});
