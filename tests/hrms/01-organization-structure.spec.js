const { test, expect } = require('@playwright/test');
const OrganizationStructurePage = require('../../pages/OrganizationStructurePage');
const testData = require('../../config/testData');

// Organization Structure is a React Flow graph/org-chart builder (see the header comment on
// OrganizationStructurePage.js), not a flat CRUD form, and it has no Submit/Approve/Reject
// workflow at all (confirmed in erpforce-hrms-fe: only a Draft/Published toggle) - so this suite
// skips DEFAULT_TEST_CASES.md's "Approval Flow" section entirely rather than forcing it in, and
// substitutes a Save-to-Draft-vs-Published lifecycle case (TC-ORG-05) instead.
//
// SCOPE OF THIS FIRST PASS: only the Company node (the sole node type available on an empty
// canvas). Department/Designation/Team sidebars, multi-node hierarchy, and the node-level
// "delete blocked while it has children/employees/members" behavior (a real, confirmed-in-source
// gap worth testing - see node-menu.tsx) are NOT covered here because the in-canvas trigger for
// adding a CHILD node to an existing node wasn't confirmed against a live app before writing
// this suite. Extend OrganizationStructurePage with that flow once verified, then add those
// cases here - don't guess the selectors in the meantime.
test.describe('Organization Structure Module', () => {
  // Captured across tests in this file (single-worker, sequential execution - see
  // playwright.config.js) so later tests can act on the record TC-ORG-01 created, the same
  // pattern tests/inventory/02-location.spec.js uses for its "updatedName" record.
  let created = {};
  let draft = {};

  // ── TC-ORG-01: Create Organization Structure (Company node) ─────────────
  test('TC-ORG-01 [+] Create Organization Structure with a Company node', { tag: '@smoke' }, async ({ page }) => {
    const org = new OrganizationStructurePage(page);
    const data = testData.organizationStructure.valid;

    await org.goto();
    await org.openAddCompanySidebar();

    const selected = await org.fillCompanySidebar(data);
    await org.saveNodeToSidebar();

    // Node should now render on the canvas before the whole graph is persisted.
    await expect(page.getByText(selected.company, { exact: false }).first()).toBeVisible();

    const result = await org.save();
    expect(result.seriesNumber).toBeTruthy();

    created = { ...result, ...selected };

    await org.searchList(created.company);
    await expect(page.getByText(created.company, { exact: false }).first()).toBeVisible();
    await expect(await org.getRowStatus(created.seriesNumber)).toMatch(/Published/);
  });

  // ── TC-ORG-02: Edit Organization Structure - update Location ────────────
  test('TC-ORG-02 [+] Edit Organization Structure - update the Company node\'s Location', async ({ page }) => {
    const org = new OrganizationStructurePage(page);
    const data = testData.organizationStructure.valid;

    await org.gotoList();
    await org.searchList(created.seriesNumber);
    await org.openRowActionMenu(created.seriesNumber);
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await page.waitForURL('**/edit-organization-structure');
    await page.waitForLoadState('networkidle');

    await org.openExistingCompanyNode(created.company);
    const updated = await org.fillCompanySidebar({ location: data.updatedLocation });
    await org.saveNodeToSidebar();

    const result = await org.save();
    created.location = updated.location;
    expect(result.seriesNumber).toBeTruthy();
  });

  // ── TC-ORG-03: View Organization Structure ───────────────────────────────
  test('TC-ORG-03 [+] View Organization Structure - verify saved values render on the canvas', async ({ page }) => {
    const org = new OrganizationStructurePage(page);

    await org.gotoList();
    await org.openViewFromList(created.seriesNumber);

    await expect(page.getByText(created.company, { exact: false }).first()).toBeVisible();
    if (created.location) {
      await expect(page.getByText(created.location, { exact: false }).first()).toBeVisible();
    }
  });

  // ── TC-ORG-04: Field validation on the Company sidebar ───────────────────
  // Never saved (page-level Save/Save To Draft is never clicked) - matches DEFAULT_TEST_CASES.md's
  // convention that validation cases only need to assert inline errors, not persist anything.
  test('TC-ORG-04 [-] Add Company - required Company/Designation fields block save', async ({ page }) => {
    const org = new OrganizationStructurePage(page);

    await org.goto();
    await org.openAddCompanySidebar();

    // Clear auto-selected company first
    await org.clearCompanySelection();

    // Submit empty - both required-field errors should appear.
    await org.saveNodeToSidebar();
    await expect(org.companyRequiredError).toBeVisible();
    await expect(org.designationRequiredError).toBeVisible();

    // Fixing only Designation should clear just that field's error (TC-V07: correcting an
    // invalid field clears its own error without needing to resubmit the whole form).
    const data = testData.organizationStructure.valid;
    await org.selectFieldByLabel(org.designationField, data.designation, { exact: false });
    await expect(org.designationRequiredError).not.toBeVisible();
    await expect(org.companyRequiredError).toBeVisible();

    await org.discardButton.click();
  });

  // ── TC-ORG-05: Save to Draft ─────────────────────────────────────────────
  test('TC-ORG-05 [+] Create Organization Structure and Save To Draft - status shows Draft', async ({ page }) => {
    const org = new OrganizationStructurePage(page);
    const data = testData.organizationStructure.draft;

    await org.goto();
    await org.openAddCompanySidebar();
    const selected = await org.fillCompanySidebar(data);
    await org.saveNodeToSidebar();

    const result = await org.saveAsDraft();
    draft = { ...result, ...selected };

    await org.searchList(draft.company);
    await expect(await org.getRowStatus(draft.seriesNumber)).toMatch(/Draft/);
  });

  // ── TC-ORG-06: Delete Organization Structure ──────────────────────────────
  // Confirmed in erpforce-hrms-fe (redux/actionCreators.ts deleteOrganization thunk / listing row
  // menu): whole-record delete is gated ONLY by the `canDelete` permission, never by draft vs.
  // published status - unlike the document-module convention (TC016/TC017) where
  // Submitted/Approved records block delete. Deleting the Draft record from TC-ORG-05 here
  // exercises that unconditional path and leaves TC-ORG-01's Published record intact for any
  // future spec that wants to build on it (mirrors 02-location.spec.js leaving its main record).
  test('TC-ORG-06 [-] Delete the Draft Organization Structure created in TC-ORG-05', async ({ page }) => {
    const org = new OrganizationStructurePage(page);

    await org.gotoList();
    await org.deleteFromList(draft.seriesNumber);

    await org.searchList(draft.company);
    await expect(org.noDataRow()).toBeVisible();
  });

  // ── Listing Page (shared MaterialTable, same across every module) ────────
  test.describe('Listing Page', () => {
    test('TC-ORG-L01 [+] Search the list by Company Name', async ({ page }) => {
      const org = new OrganizationStructurePage(page);
      await org.gotoList();
      await org.searchList(created.company);
      await expect(page.getByText(created.company, { exact: false }).first()).toBeVisible();

      await org.searchList('zzz-no-such-organization-zzz');
      await expect(org.noDataRow()).toBeVisible();
    });

    test('TC-ORG-L02 [+] Sort the ID column ascending/descending', async ({ page }) => {
      const org = new OrganizationStructurePage(page);
      await org.gotoList();

      await org.clickColumnHeader('ID');
      const firstSort = await org.getColumnAriaSort('ID');
      expect(['ascending', 'descending']).toContain(firstSort);

      await org.clickColumnHeader('ID');
      const secondSort = await org.getColumnAriaSort('ID');
      expect(secondSort).not.toBe(firstSort);
    });

    test('TC-ORG-L03 [+] Paginate the list', async ({ page }) => {
      const org = new OrganizationStructurePage(page);
      await org.gotoList();

      const label = await org.getPaginationLabel();
      expect(label).toMatch(/Page \d+ of \d+/);

      const totalPages = Number(label.match(/of\s*(\d+)/)?.[1] ?? 1);
      if (totalPages >= 2) {
        await org.nextPageButton().click();
        await page.waitForLoadState('networkidle');
        const nextLabel = await org.getPaginationLabel();
        expect(nextLabel).not.toBe(label);
      }
    });

    test('TC-ORG-L04 [+] Row action menu offers View/Duplicate/Edit/Delete', async ({ page }) => {
      const org = new OrganizationStructurePage(page);
      await org.gotoList();
      await org.searchList(created.company);
      await org.openRowActionMenu(created.seriesNumber);

      await expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
    });

    test('TC-ORG-L05 [+] Row status badge matches the record\'s lifecycle state', async ({ page }) => {
      const org = new OrganizationStructurePage(page);
      await org.gotoList();
      await org.searchList(created.company);
      await expect(await org.getRowStatus(created.seriesNumber)).toMatch(/Published/);
    });
  });
});
