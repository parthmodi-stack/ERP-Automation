const { expect } = require('@playwright/test');

// Build Order (dashboard/manufacturing/orders/build-order) - created FROM a Work Order's own
// Actions menu ("Build", only available once that Work Order has reached "Material Issued"
// status via WorkOrderPage.issueMaterial()), not reached by direct navigation of its own the way
// Bill of Material/Work Order are. Confirming its own "Mark Completed" is what finally flips the
// PARENT Work Order to "Completed" too (confirmed live) - the Work Order's own "Close" button is
// a red herring, NOT part of this lifecycle (confirmed live: it actually reverts status back to
// "Released", toast "Work Order has been released", the same confirm dialog/endpoint as Release
// itself - a real app bug, not a step to use here).
//
// Status lifecycle: (Add form, mostly pre-filled from the parent Work Order) -> In progress
// --(Mark Completed)--> Completed. Mark Completed's own first click always surfaces a
// "Validation Error" dialog ("Please select the lot/serial number and done quantity for Finished
// Item to Mark it as Complete.") - this is NOT a hard block (confirmed live): clicking its own
// "Ok" auto-generates the tracking record server-side and opens a "Track Detail" dialog, already
// pre-populated with a lot covering the full quantity - saving THAT dialog is what actually
// completes the status transition. No page anywhere (View/Edit/Actions, on either the Build
// Order or the Work Order) exposes this lot entry directly - it only ever appears via this
// Ok-then-Track-Detail sequence.
class BuildOrderPage {
  constructor(page) {
    this.page = page;

    this.quantityInput = page.locator('input[placeholder="Enter Quantity"]');
    this.finishedGoodCostInput = page.locator('input[placeholder="Enter Finished Good Cost"]');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.markCompletedButton = page.getByRole('button', { name: 'Mark Completed' });
    this.validationErrorDialog = page.getByRole('dialog', { name: 'Validation Error' });
    this.trackDetailDialog = page.getByRole('dialog', { name: 'Track Detail' });
  }

  // Call after WorkOrderPage.openBuildForm() has already navigated here - Work Order/Entity/
  // Location/Items/UOM/Bill of Materials are pre-filled and read-only; only Quantity and
  // Finished Good Cost need to be entered. Captures the created record's own series_number
  // directly from the create response (flat `data.build_order.series_number` - confirmed live),
  // since the post-Save redirect lands on the LIST, not this record's own view page, and the list
  // has no Work Order column to reliably identify "our" row by.
  async fillAndSave({ quantity, finishedGoodCost }) {
    await this.quantityInput.fill(String(quantity));
    if (finishedGoodCost !== undefined) {
      await this.finishedGoodCostInput.fill(String(finishedGoodCost));
    }

    const createResponsePromise = this.page.waitForResponse(
      (res) => res.request().method() === 'POST' && /\/build-orders\/?$/.test(new URL(res.url()).pathname)
    );
    await this.saveButton.click();
    const createResponse = await createResponsePromise;
    const body = await createResponse.json();
    await this.page.waitForURL('**/orders/build-order', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    return body.data.build_order.series_number;
  }

  async openView(seriesNumber) {
    await this.page.goto('/dashboard/manufacturing/orders/build-order');
    await this.page.waitForLoadState('networkidle');
    await this.page.getByText(seriesNumber, { exact: true }).first().click();
    await this.page.waitForURL('**/view-build-order');
    await this.page.waitForLoadState('networkidle');
  }

  // In progress -> Completed. See class header comment for why this needs TWO confirmations
  // (the "Validation Error" dialog's own Ok, then the auto-opened Track Detail dialog's own Save)
  // rather than completing on the very first click.
  async markCompleted() {
    await this.markCompletedButton.click();
    await this.validationErrorDialog.waitFor({ state: 'visible' });
    await this.validationErrorDialog.getByRole('button', { name: 'Ok', exact: true }).click();
    await this.trackDetailDialog.waitFor({ state: 'visible' });
    await this.trackDetailDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(this.page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 15000 });
  }

  // "Unbuild" only appears in the Actions menu once this Build Order is Completed (confirmed
  // live - call markCompleted() first). Opens Unbuild Order's own "Add Unbuild Order" form,
  // reachable ONLY from here (not by direct navigation - see pages/UnbuildOrderPage.js's own
  // header comment for why direct creation is blocked entirely by a backend bug).
  async openUnbuildForm() {
    await this.actionsButton.click();
    await this.page.getByRole('menuitem', { name: 'Unbuild' }).click();
    await this.page.waitForURL('**/add-unbuild-order');
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = BuildOrderPage;
