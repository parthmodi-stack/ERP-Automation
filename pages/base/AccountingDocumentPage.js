const { expect } = require('@playwright/test');
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

  // ---------- Approval flow (split-button caret + menu, same pattern as pages/BasePage.js's own
  // openSubmitMenu/clickSubmitMenuItem for Procurement) ----------
  // The main "Accept"/"Reject" button visible on the page is a no-op decoy that sits alongside
  // the caret in the same split-button group - confirmed live on Expense Reimbursement's Expense
  // Report detail page: clicking it directly left the record's status unchanged ("Submitted")
  // even after the confirm dialog's own "Submit" was clicked. The real action only fires via the
  // caret ("select merge strategy") opening a menu, then clicking Accept/Reject/Quick Approval as
  // a MENUITEM inside it - exactly like Procurement's split button. Retries the whole
  // open-menu-then-click sequence (not just the click) since the MUI Menu popover can still be
  // settling right after it opens.
  async openSubmitMenu() {
    const caret = this.page.getByRole('button', { name: 'select merge strategy' });
    const menu = this.page.getByRole('menu');
    for (let attempt = 1; attempt <= 4; attempt++) {
      await caret.click();
      try {
        await menu.waitFor({ state: 'visible', timeout: 3000 });
        return;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.keyboard.press('Escape').catch(() => {});
      }
    }
  }

  async clickSubmitMenuItem(name, { byText = false } = {}) {
    const locatorFor = () =>
      byText
        ? this.page.getByText(name, { exact: true })
        : this.page.getByRole('menuitem', { name, exact: true });
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.openSubmitMenu();
      try {
        await locatorFor().click({ timeout: 5000 });
        return;
      } catch (e) {
        if (attempt === 4) throw e;
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(300);
      }
    }
  }

  /** Sends a Quick Approval request to the given user via the split-button's own menu. */
  async quickApproval(userName) {
    await this.clickSubmitMenuItem('Quick Approval', { byText: true });

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await dialog.getByRole('combobox').first().click();
    await this.page.getByRole('option', { name: new RegExp(userName) }).click();
    await this.page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: /Send Request/i }).click();
  }

  async acceptApproval({ confirmButtonName = /Submit/i } = {}) {
    await this.clickSubmitMenuItem('Accept');
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await dialog.getByRole('button', { name: confirmButtonName }).click();
  }

  async rejectApproval({ confirmButtonName = /Submit/i } = {}) {
    await this.clickSubmitMenuItem('Reject');
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await dialog.getByRole('button', { name: confirmButtonName }).click();
  }

  async markAsVoid() {
    await this.markAsVoidButton.click();
  }

  async attachFile(filePath, fieldName = 'attachment_url') {
    await this.fieldLocator(fieldName).setInputFiles(filePath);
  }

  // saveAndCaptureId() is inherited from SettingsEntityPage - moved there so Settings-entity
  // modules with no approval workflow (e.g. CommissionPlanPage) can use it too.
}

module.exports = AccountingDocumentPage;
