const { expect } = require('@playwright/test');

// Shared across ProcurementRequestPage and PurchaseAgreementPage (and any future document-style
// module page object). Only methods that are byte-identical between the two, or a strict
// superset improvement of both, live here - anything with a real behavioral difference (dropdown
// search/retry quirks, save/approval wording, field names) stays in its own page object. Merging
// those would risk reintroducing bugs that took multiple rounds of live debugging to fix.
class BasePage {
  constructor(page) {
    this.page = page;
  }

  // Gross/Tax/Net/Total amounts in an item modal are computed by a debounced effect after
  // Quantity/Rate change; saving before it fires submits null amounts, which the backend
  // rejects as a "details mismatch".
  async waitForItemAmountsToSettle(modal) {
    const grossAmount = modal.locator('text=Gross Amount').locator('xpath=following::input[1]');
    await expect(grossAmount).not.toHaveValue('', { timeout: 5000 });
  }

  async discard() {
    await this.page.getByRole('button', { name: 'Discard' }).click();
  }

  // seriesNumber is the exact text rendered in the list's ID column (e.g. "PR-2026-000149") - see
  // the comment on each subclass's saveAndCaptureId for why this can't be derived from the raw id.
  rowBySeriesNumber(seriesNumber) {
    return this.page.locator('tr', { has: this.page.getByRole('link', { name: seriesNumber, exact: true }) });
  }

  async openRowActionMenu(seriesNumber) {
    if (!seriesNumber) throw new Error(`openRowActionMenu() called with a falsy seriesNumber (${seriesNumber}) - a prior create/save step likely failed.`);
    const row = this.rowBySeriesNumber(seriesNumber);
    await row.locator('button').first().click(); // "..." menu button
  }

  // Narration is a real <textarea>; its value isn't part of innerText(), unlike comboboxes.
  async getEditNarrationValue() {
    return this.page.getByPlaceholder('Enter Narration').inputValue();
  }

  // .first() guards against labels that collide with an Items-grid column of the same name
  // (e.g. "Location"), where a hidden sort-indicator badge can also match the xpath axis. Some
  // values (e.g. Vendor) render as multiple text nodes in a flex container (name next to an
  // avatar-related element) with extra whitespace at the join - collapse runs of whitespace so
  // comparisons against a plainly-typed value like "Alex Smith" don't fail.
  async getFieldValueOnView(label) {
    const text = (await this.page.getByText(label, { exact: true }).first().locator('xpath=following::*[1]').first().textContent()) ?? '';
    return text.trim().replace(/\s+/g, ' ');
  }

  // Combobox-based fields (Entity, Purchase Representative, Vendor, Currency, Location,
  // Department) show their selected value as the combobox's own visible/accessible text. MUI's
  // clear-selection icon button leaves a stray zero-width space in innerText(). .first() guards
  // against a label that also appears elsewhere on the page (e.g. a read-only Summary sidebar).
  async getEditComboboxValue(label) {
    const text = await this.page.getByText(label, { exact: true }).first().locator('xpath=following-sibling::*[1]').innerText();
    return text.replace(/[\u200B\uFEFF]/g, '').trim();
  }

  // ---------- Delete ----------
  async deleteFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();
    await this.confirmDelete();
  }

  async deleteFromView() {
    await this.page.getByRole('button', { name: 'Actions' }).click();
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();
    await this.confirmDelete();
  }

  async isDeleteAvailableFromList(seriesNumber) {
    await this.openRowActionMenu(seriesNumber);
    const available = await this.page.getByRole('menuitem', { name: 'Delete' }).count();
    await this.page.keyboard.press('Escape');
    return available > 0;
  }

  // ---------- Approval flow ----------
  // The "Submit"/"Accept" button is a split-button: the main button either fires a default
  // action immediately (Submit) or is a no-op (Accept) - the menu with Quick Approval/Accept/
  // Reject only opens via its adjacent caret button (a shared generic accessible name across
  // every such split-button in the app), not the main button itself.
  async openSubmitMenu() {
    await this.page.getByRole('button', { name: 'select merge strategy' }).click();
  }
}

module.exports = BasePage;
