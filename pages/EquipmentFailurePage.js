const SettingsEntityPage = require('./base/SettingsEntityPage');

// Equipment Failure (dashboard/manufacturing/equipment-failure) - NOT a screen anyone navigates to
// directly to create a record; confirmed live a ticket here is auto-created as a side effect of
// blocking a Job Card's own Routing Details row (see pages/JobCardPage.js's own blockRow()) - one
// ticket per block, referencing that block's own Work Order/Work Centre/Operation/Equipment.
//
// CONFIRMED LIVE, easy to miss entirely: this ticket is the actual mechanism behind un-blocking a
// Job Card row, not something that resolves on its own or from the Job Card side at all. A
// Blocked row stays permanently ineligible for Record Completion (see JobCardPage.recordCompletion()'s
// own "no_eligible_operations" outcome) UNTIL this ticket's own "Maintanance Completed" action
// (real app typo, not a mistake introduced here) is confirmed - only THEN does the Job Card's own
// row revert from "Blocked" back to "Ready" (not "In progress" or "Completed" - a full reset back
// to the row's very first state, meaning Start/Complete/Record Completion all need to run again
// from scratch on that same row).
//
// Maintenance Status lifecycle: In Maintenance (created alongside the block) -> Completed (via
// "Maintanance Completed", a simple Yes/No confirm dialog with no extra fields to fill).
//
// Extends SettingsEntityPage purely for consistency with the rest of Manufacturing - this page
// has no dropdowns and no add/edit form at all (see header comment above), so none of the base
// class's dropdown/CRUD helpers actually get used here.
class EquipmentFailurePage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'equipment_failure',
      listPath: '/dashboard/manufacturing/equipment-failure',
    });

    this.maintenanceCompletedButton = page.getByRole('button', { name: 'Maintanance Completed', exact: true });
    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.deleteButton = page.getByRole('button', { name: 'Delete', exact: true });
  }

  async gotoList() {
    await this.page.goto('/dashboard/manufacturing/equipment-failure');
    await this.page.waitForLoadState('networkidle');
  }

  // No direct id/series-number link is returned from the Block action's own response (confirmed
  // live via network capture - its PATCH body only contains the routing detail's own updated
  // status, nothing pointing at this ticket) - the only reliable way to find "the" ticket a given
  // block created is by matching this suite's own dedicated, unique-per-Job-Card Work Centre name,
  // same as how every other page object in this module identifies "its own" record.
  async openViewByWorkCentre(workCentreName) {
    await this.gotoList();
    await this.page.waitForTimeout(1000);
    // Click the Work Centre's own text, not the bare <tr> - confirmed live that clicking the row
    // element itself can land on a non-navigating cell (e.g. the row's own "Toggle select row"
    // checkbox column) and silently never navigate, same reasoning every other page object in this
    // repo already clicks a specific text rather than a whole row.
    await this.page.getByText(workCentreName, { exact: true }).first().click();
    await this.page.waitForURL('**/view-/equipment-failure');
    await this.page.waitForLoadState('networkidle');
  }

  // In Maintenance -> Completed - the row-level un-block itself. Simple Yes/No confirm dialog,
  // unlike Job Card's own Block dialog, with no extra fields (Duration/End Date are computed
  // server-side, confirmed live via the response).
  async completeMaintenance() {
    const responsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'PATCH' && res.url().includes('/equipments/failures/update-status/')
    );
    await this.maintenanceCompletedButton.click();
    await this.page.waitForTimeout(600);
    const dialog = this.page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Yes', exact: true }).click();
    await responsePromise;
    await this.page.waitForTimeout(1000);
  }
}

module.exports = EquipmentFailurePage;
