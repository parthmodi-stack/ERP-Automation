const { expect } = require('@playwright/test');

// Job Card (dashboard/manufacturing/job-cards) - reached ONLY from a Completed Work Order's own
// Actions menu ("Create Job Cards", see WorkOrderPage.openCreateJobCardsForm()) - confirmed live
// that navigating directly to .../job-cards/add-job-cards produces a completely empty form with
// no pre-filled context at all. Entity/Location/Item/UOM/Bill of Material/Quantity/Routing all
// come pre-filled (mostly disabled) from that Work Order; only Production Start/End Date and
// Responsible Person (required) are left to fill - Reference Number/Manufacturing Time are
// disabled here even though Work Order's own equivalents are editable, a real per-module
// inconsistency, not a mistake introduced here. Production Start/End Date have required-field
// asterisks but are NOT actually enforced (confirmed live: saving with them empty still succeeds,
// showing "Invalid Date" afterward on View) - fillAndSave() below always fills them anyway since
// that's the only sane path, but this gap is worth knowing about if a future spec wants to prove
// it.
//
// Job Card has TWO separate status concepts, easy to conflate:
// - The Job Card's own OVERALL status: Pending (at creation) -> Released (immediately, with no
//   visible "Release" step anywhere - confirmed live a freshly created Job Card already shows
//   "Released" on its own View page) -> In progress (once any Routing Details row is started) ->
//   Completed (only via Actions -> Mark Complete, a separate, independent action - see
//   markComplete() below).
// - Each Routing Details row's OWN status: Ready -> In progress -> Completed or Blocked. Row
//   actions live in that row's own Actions cell (always the table's LAST td, since the
//   Instructions column's own "View Instruction" button shares the identical
//   `viewJobCards--button--add` class and would otherwise collide with position-based indexing) -
//   confirmed live it holds exactly 2 icon buttons, no title/aria-label to distinguish them:
//   index 0 is context-dependent (a play icon before starting, a green checkmark "Complete" after
//   starting), index 1 is always Block. Both open a confirm dialog - CONFIRMED LIVE UI COPY BUG:
//   the Start confirmation dialog's own title says "Mark Complete" (copy-pasted from the Complete
//   dialog) even though its body text correctly says "mark operation as In progress" - don't
//   assert on the dialog's title for either action, only its body text or the resulting row status.
//
// Block's own dialog (fields under the generic `equipment.*` prefix, NOT `job_card.*`) has a real,
// confirmed-live validation inconsistency: "Do you want to use alternative work equipment for the
// work order?" (Yes/No) reads like it should gate whether "Select Equipments" matters, but Select
// Equipments is enforced UNCONDITIONALLY regardless of that answer - Save fires no request at all
// (and shows no visible error banner, only a screenshot-confirmed "Please select equipment" one)
// until an equipment is actually checked. Also confirmed live: closing the equipment checklist
// popover with Escape (the fix used elsewhere in this repo for stale MUI backdrops) closes the
// ENTIRE Block dialog here instead of just the popover - clicking the dialog's own Narration
// textarea is what safely dismisses just the checklist.
//
// A Blocked row is excluded from Record Completion's own "Operations List" selection dialog
// (confirmed live: shows "No Data" with Next staying disabled if the Job Card's only row is
// Blocked) - this is the mechanism behind the product's "after block we can not Record Completion"
// behavior. Blocking is NOT a permanent dead end, though - it auto-creates a ticket in a wholly
// separate module, Equipment Failure (dashboard/manufacturing/equipment-failure -
// pages/EquipmentFailurePage.js), and confirming THAT ticket's own "Maintanance Completed" action
// is what reverts the Job Card row from "Blocked" back to "Ready" (a full reset, not "In progress"
// or "Completed" - Start/Complete/Record Completion all need to run again from scratch on that
// same row afterward). CONFIRMED LIVE GAP: the Job Card's own overall Mark Complete has NO
// dependency on any of this - it succeeds (200) and flips the whole Job Card to "Completed" even
// with a row still sitting Blocked and its own Equipment Failure ticket never resolved, since Mark
// Complete doesn't check Record Completion (or per-row status) having actually happened first.
class JobCardPage {
  constructor(page) {
    this.page = page;

    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.saveToDraftButton = page.getByRole('button', { name: 'Save To Draft', exact: true });
    this.discardButton = page.getByRole('button', { name: 'Discard', exact: true });

    this.productionStartDateInput = page.locator('input[name="job_card.production_start_date"]');
    this.productionEndDateInput = page.locator('input[name="job_card.production_end_date"]');
    this.narrationInput = page.locator('textarea[name="job_card.narration"]');

    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.actionsButton = page.getByRole('button', { name: 'Actions', exact: true });
    this.recordCompletionButton = page.getByRole('button', { name: 'Record Completion', exact: true });
    this.deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true });
  }

  async gotoList() {
    await this.page.goto('/dashboard/manufacturing/job-cards');
    await this.page.waitForLoadState('networkidle');
  }

  // Same `mui-component-select-job_card.<field>` pattern as every other Manufacturing form.
  async selectDropdown(fieldName, optionText) {
    await this.page.locator(`[id="mui-component-select-job_card.${fieldName}"]`).click();
    const menu = this.page.locator(`[id="menu-job_card.${fieldName}"]`);
    await menu.waitFor({ state: 'visible', timeout: 5000 });
    await expect(async () => {
      expect(await menu.locator('li').count()).toBeGreaterThan(1);
    }).toPass({ timeout: 8000, intervals: [300] });
    if (optionText) {
      await menu.locator('input').pressSequentially(optionText, { delay: 60 });
      const exact = menu.locator('li').filter({ hasText: new RegExp(`^${optionText}$`) });
      await expect(exact.first()).toBeVisible({ timeout: 8000 });
      await exact.first().click();
    } else {
      await menu.locator('li').nth(1).click();
    }
    await menu.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  // Required (real asterisk, actually enforced - confirmed live: Save fires no request at all
  // without it). Left to "first available" when no name is passed.
  async selectResponsiblePerson(name) {
    await this.selectDropdown('responsible_person_id', name);
  }

  // Call after WorkOrderPage.openCreateJobCardsForm() has already navigated here. Captures the
  // created record's own series_number directly from the create response (flat
  // `data.jobCards.series_number` - confirmed live), since the post-Save redirect lands on the
  // LIST, not this record's own view page.
  async fillAndSave({ productionStartDate, productionEndDate, responsiblePersonName, narration } = {}) {
    if (productionStartDate !== undefined) await this.productionStartDateInput.fill(productionStartDate);
    if (productionEndDate !== undefined) await this.productionEndDateInput.fill(productionEndDate);
    await this.selectResponsiblePerson(responsiblePersonName);
    if (narration !== undefined) await this.narrationInput.fill(narration);

    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && /\/job-cards\/?$/.test(new URL(res.url()).pathname)
    );
    await this.saveButton.click();
    const response = await responsePromise;
    const body = await response.json();
    await this.page.waitForURL('**/manufacturing/job-cards', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return body.data.jobCards.series_number;
  }

  async openView(seriesNumber) {
    await this.gotoList();
    await this.page.getByText(seriesNumber, { exact: true }).first().click();
    await this.page.waitForURL('**/view-job-cards');
    await this.page.waitForLoadState('networkidle');
  }

  async openActions() {
    await this.actionsButton.click();
    await this.page.waitForTimeout(400);
  }

  // The single Routing Details row this suite's own dedicated Routing (one operation, sequence 1)
  // produces - callers with a multi-row Routing would need to index this table themselves instead.
  routingRow() {
    const table = this.page.locator('table').filter({ has: this.page.locator('text=Operation Sequence') });
    return table.locator('tbody tr').first();
  }

  // Confirmed live exact casing (not "In Progress"/"Complete" as the column name/lifecycle
  // description might suggest): "Ready", "In progress", "Completed", "Blocked".
  async rowStatus() {
    return (await this.routingRow().locator('td', { hasText: /^(Ready|In progress|Completed|Blocked)$/ }).first().textContent()).trim();
  }

  // Actions cell is always the row's LAST td (confirmed live) - scoping to it avoids colliding
  // with the Instructions column's own "View Instruction" button, which shares the identical
  // `viewJobCards--button--add` class with these two row-action icons.
  rowActionsCell() {
    return this.routingRow().locator('td').last();
  }

  // Ready -> In progress. Same button position becomes Completed afterward (see completeRow()) -
  // confirmed live the confirm dialog's own TITLE says "Mark Complete" here too (a real copy-paste
  // bug), so this asserts on the dialog's body text instead, not its title.
  async startRow() {
    await this.rowActionsCell().locator('button').first().click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog.getByText(/mark operation as In progress/i)).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: 'Yes', exact: true }).click();
    await this.page.waitForTimeout(1000);
  }

  // In progress -> Completed. Same row-actions-cell button position as startRow() (context
  // dependent - confirmed live the icon changes from a play button to a green checkmark), so this
  // reuses the same "click first button" action.
  async completeRow() {
    await this.rowActionsCell().locator('button').first().click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog.getByText(/mark operation as Completed/i)).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: 'Yes', exact: true }).click();
    await this.page.waitForTimeout(1000);
  }

  // Ready or In progress -> Blocked. reason must be one of the fixed enum options ("Equipment
  // Failure"/"Material Availability"/"Setup and Adjustment"/"Process Defect" - confirmed live).
  // Select Equipments is REQUIRED regardless of useAlternativeEquipment's own Yes/No answer
  // (confirmed live real validation inconsistency - see class header comment) - always selects at
  // least one equipment rather than trusting the Yes/No answer to control that.
  //
  // Dismisses the equipment checklist's own popover by clicking the dialog's Narration textarea
  // (NOT Escape+backdrop, which closes the whole dialog here - see class header comment), then
  // answers the Yes/No radio by its own visible label text (the two radios share one MUI-generated
  // `name` attribute, not a stable one to target directly).
  async blockRow({ reason, useAlternativeEquipment = 'No', narration } = {}) {
    await this.rowActionsCell().locator('button').nth(1).click();
    await this.page.waitForTimeout(600);

    await this.page.locator('[id="mui-component-select-equipment.reason"]').click();
    const reasonMenu = this.page.locator('[id="menu-equipment.reason"]');
    await reasonMenu.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(400);
    if (reason) {
      const exact = reasonMenu.locator('li').filter({ hasText: new RegExp(`^${reason}$`) });
      await exact.first().click();
    } else {
      await reasonMenu.locator('li').nth(1).click();
    }
    await this.page.waitForTimeout(400);

    await this.page.locator('[id="mui-component-select-equipment.equipments"]').click();
    const equipMenu = this.page.locator('[id="menu-equipment.equipments"]');
    await equipMenu.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(400);
    await equipMenu.locator('li').first().click();
    await this.page.waitForTimeout(400);

    // Not dialog-scoped - confirmed live that page.getByRole('dialog') can resolve to 0 elements
    // for a moment right after this checklist popover interacts, even though the Block dialog
    // itself is still open underneath it.
    await this.page.locator('textarea[name="equipment.narration"]').click({ force: true });
    await this.page.waitForTimeout(400);

    await this.page.getByText(useAlternativeEquipment, { exact: true }).click();
    await this.page.waitForTimeout(300);

    if (narration !== undefined) {
      await this.page.locator('textarea[name="equipment.narration"]').fill(narration);
    }

    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'PATCH' && res.url().includes('/job-cards/routing-block-status/')
    );
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    await responsePromise;
    await this.page.waitForTimeout(1000);
  }

  // Two-step flow reached via the header's own "Record Completion" button: (1) an "Operations
  // List" selection dialog (checkbox required, Next disabled until checked) that excludes Blocked
  // rows entirely (confirmed live: shows "No Data" with Next staying disabled if none are
  // eligible - the mechanism behind "after block we can not Record Completion"), then (2) the full
  // "Add Record Completion" page, whose own fields are already pre-filled/mostly disabled from
  // this Job Card - nothing further to fill before its own Save.
  //
  // Returns 'no_eligible_operations' without attempting Next/Save if the Operations List has
  // nothing to check (matching WorkOrderPage.release()'s own "return an outcome, don't hard-assert"
  // shape), or 'completed' once the record-completion POST succeeds.
  async recordCompletion() {
    await this.recordCompletionButton.click();
    await this.page.waitForTimeout(800);
    const dialog = this.page.getByRole('dialog');
    // The dialog always renders a header "Toggle select all" checkbox even with zero eligible
    // rows (confirmed live: clicking it then does nothing, since there's no data row underneath
    // it to actually check) - "No Data" text is the real, reliable signal that Blocked rows left
    // nothing eligible, not the presence of any checkbox at all.
    if (await dialog.getByText('No Data', { exact: true }).count()) {
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      return 'no_eligible_operations';
    }

    await dialog.locator('tbody input[type="checkbox"]').first().check();
    await this.page.waitForTimeout(300);
    const nextButton = dialog.getByRole('button', { name: 'Next', exact: true });
    if (await nextButton.isDisabled()) {
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      return 'no_eligible_operations';
    }
    await nextButton.click();
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);

    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/record-completion')
    );
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    await responsePromise;
    await this.page.waitForURL('**/view-job-cards', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return 'completed';
  }

  // In progress -> Completed - the Job Card's own OVERALL status, independent of whether Record
  // Completion ever actually ran (see class header comment for the confirmed live gap this
  // exposes: this succeeds even with a Blocked, never-recorded row). Lives under the header's
  // Actions menu, not as its own standalone button.
  async markComplete() {
    await this.openActions();
    await this.page.getByRole('menuitem', { name: 'Mark Complete' }).click();
    await this.page.waitForTimeout(600);
    const dialog = this.page.getByRole('dialog');
    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'PATCH' && res.url().includes('/job-cards/status/')
    );
    await dialog.getByRole('button', { name: 'Yes', exact: true }).click();
    await responsePromise;
    await this.page.waitForTimeout(1000);
  }
}

module.exports = JobCardPage;
