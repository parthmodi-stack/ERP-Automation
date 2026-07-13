const SettingsEntityPage = require('./SettingsEntityPage');

/**
 * Base Page Object for the "document with approval workflow" archetype used across the
 * Accounting module (Journal Entry, Sales/Purchase Invoice, Cash Expense, Credit/Debit Note,
 * Payment/Collection, Expense Reimbursement, Budget, Asset/Asset Transfer, Commission*).
 *
 * Each of these has: list (ActionBar + MaterialTable with a rowActionMenu offering
 * View/Edit/Duplicate/Submit for Approval/Mark as Void, and a destructiveActionMenu with
 * Delete), an Add/Edit form, a View page driving status transitions via the shared
 * `ApprovalWrapper` component, and a `<entity>--StatusChip--<STATUS>` CSS class per row
 * (see erpforce-fe modules/accounting/src/views/journal-entry/journal-entry.tsx).
 *
 * Extends SettingsEntityPage since list search/sort/pagination/delete and the generic
 * name-based form filling are identical; this class only adds workflow-specific behavior.
 */
class AccountingDocumentPage extends SettingsEntityPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {{ entityKey: string, listPath: string, addPath: string, statusCssSlug: string }} config
   *   statusCssSlug - CSS class prefix for the status chip, e.g. 'journalEntry' for
   *   `.journalEntry--StatusChip--Approved`
   */
  constructor(page, config) {
    super(page, config);
    this.statusCssSlug = config.statusCssSlug;

    this.viewMenuItem = page.getByRole('menuitem', { name: 'View' });
    this.submitForApprovalMenuItem = page.getByRole('menuitem', { name: 'Submit For Approval' });
    this.markAsVoidMenuItem = page.getByRole('menuitem', { name: 'Mark As Void' });

    // View-page ApprovalWrapper buttons (common.submit / common.accept / common.reject)
    this.submitButton = page.getByRole('button', { name: 'Submit', exact: true });
    this.acceptButton = page.getByRole('button', { name: 'Accept', exact: true });
    this.rejectButton = page.getByRole('button', { name: 'Reject', exact: true });
    this.markAsVoidButton = page.getByRole('button', { name: 'Mark As Void' });
    this.printButton = page.getByRole('button', { name: 'Print' });
    this.actionsMenuButton = page.getByRole('button', { name: 'Actions' });
  }

  async openView(rowText) {
    await this.openRow(rowText);
  }

  async openRowAction(rowText, actionLabel) {
    await this.gotoList();
    await this.row(rowText).getByRole('button', { name: /actions|more/i }).click();
    await this.page.getByRole('menuitem', { name: actionLabel }).click();
    await this.page.waitForLoadState('networkidle');
  }

  statusChipOnRow(rowText) {
    return this.statusChip(rowText, this.statusCssSlug);
  }

  statusChipOnView() {
    return this.page.locator(`[class*="${this.statusCssSlug}--StatusChip"]`);
  }

  async submitForApproval() {
    await this.submitButton.click();
  }

  async acceptApproval() {
    await this.acceptButton.click();
  }

  async rejectApproval() {
    await this.rejectButton.click();
  }

  async markAsVoid() {
    await this.markAsVoidButton.click();
  }

  async attachFile(filePath, fieldName = 'attachment_url') {
    await this.fieldLocator(fieldName).setInputFiles(filePath);
  }
}

module.exports = AccountingDocumentPage;
