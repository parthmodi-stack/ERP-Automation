/**
 * Select an option from a custom search dropdown.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} triggerLocator - The element that opens the dropdown
 * @param {string} searchText - Text to type into the search box
 * @param {string} optionText - Exact option text to click
 * @param {{allowCreateNew?: boolean, createNewFields?: object, createIfMissing?: () => Promise<void>, optional?: boolean}} [opts] -
 *   last-resort fallbacks, tried IN ORDER, only when the search finds no exact match AND there's
 *   no other real option to fall back to either (the list is genuinely empty - "No data
 *   available"):
 *     1. `allowCreateNew` - use the dropdown's own "Create New ..." footer option (confirmed
 *        against the running app to exist on several FormParser selects - Payment Term, Vendor,
 *        Currency, ...): click it, fill the inline modal's Name field with `searchText`, then
 *        fill any `createNewFields` the caller provides (bare field names, no prefix - matched
 *        against whatever prefix the modal's own Name field uses, text fields via `.fill()`,
 *        selects via a nested selectDropdown()), save, then retry the same search from the top.
 *        Some of these inline modals require MORE than just a name (confirmed live: Payment
 *        Term's also requires due_date_based_on/credit_days) - `createNewFields` covers those;
 *        leave it unset for modals that only need a name.
 *     2. `createIfMissing` - for fields with NO such footer option (e.g. a line-item Account
 *        select) - an async callback that creates the missing record some other way (typically
 *        via a master Settings Page Object on a throwaway browser tab so it doesn't disturb
 *        whatever form this dropdown lives on) and resolves once done; selectDropdown then
 *        retries the same search, which should now find a real match.
 *   `optional` - when true and BOTH of the above are unavailable/unset, skip selection entirely
 *     (close the dropdown, log a console warning, and return) instead of throwing. Use for
 *     fields whose value isn't actually required to save the form.
 *   Several of this suite's assumed seed values (vendors, currencies, payment terms, ...) don't
 *   actually exist in every environment, so without at least one of these an empty list either
 *   hangs trying to click a disabled placeholder or throws.
 */
async function selectDropdown(page, triggerLocator, searchText, optionText, opts = {}) {
  const { allowCreateNew = false, createNewFields, createIfMissing, optional = false } = opts;
  const insideDialog = (await triggerLocator.locator('xpath=ancestor::*[@role="dialog"]').count()) > 0;
  let createdOnce = false;
  // One extra attempt when a create fallback is available, so consuming an attempt to create the
  // missing record still leaves the normal 3 attempts to find and select it afterward.
  const maxAttempts = (allowCreateNew || createIfMissing) ? 4 : 3;

  // Retries the whole open -> search -> click sequence: the options list is fetched from an API
  // after typing, and occasionally the click on the final option lands before that response has
  // re-rendered the list, silently missing the real target - confirmed flaky against the running
  // app (intermittent "Please select Account" even though the option was clicked). Verifying the
  // trigger's text actually changed catches this instead of trusting the click blindly.
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await triggerLocator.click();
    // Closed dropdowns in this app never unmount their search input (same "stale DOM" quirk as
    // their backdrop), so `.last()` evaluated immediately after the click can resolve to an
    // earlier, unrelated dropdown's search box that happens to still be the last one in the DOM
    // at that instant. Waiting briefly lets the just-opened dropdown's own search box mount first.
    await page.waitForTimeout(400);
    const searchBox = page.locator('input[placeholder*="Search"]').last();
    searchText && await searchBox.fill(searchText);
    await page.waitForTimeout(800 + attempt * 400); // back off a bit more each retry

    // Scoped to role=option (the app's real ARIA role for menu items) rather than a bare text
    // locator: when the closed trigger already displays the target text (e.g. a single-choice
    // field pre-selected to its only option), `text="..."` ambiguously matches the trigger itself
    // - which sits behind the menu's backdrop - and the click times out waiting to become stable.
    //
    // ALWAYS pick .last(), not .first(): this custom dropdown wraps its own search <input> in a
    // role="option" element that sits first in the list, and once you've typed a query, that
    // wrapper's computed accessible name mirrors the typed text - so searching "Assets" or "Cash"
    // always produces a phantom exact match (the search box itself) ahead of the real, selectable
    // list item. Confirmed against the running app for both flat lists (Chart of Accounts' Parent
    // Type) and hierarchical ones (Journal Entry line-item Account, where a category header can
    // ALSO share the leaf account's exact text) - the real, clickable option is reliably last.
    const matches = page.getByRole('option', { name: optionText, exact: true });
    // The phantom search-wrapper match documented above means `matches` never actually resolves
    // to zero elements - even a nonsense search always produces that one phantom match. So a
    // genuine hit is count >= 2 (phantom + the real option); count === 1 means only the phantom
    // matched and the real option doesn't exist. Confirmed live: a real match (e.g. searching
    // "Dubai" in a State field that has it) yields count 2, a fake one yields count 1.
    if (await matches.count() >= 2) {
      await matches.last().click();
    } else {
      // config/testData.js's dropdown values (accounts, payment terms, tax categories, banks,
      // vendors, currencies, ...) are best-effort guesses for records this suite doesn't seed
      // itself - see ACCOUNTING_FINDINGS.md - and may not exist under this exact name in every
      // environment. Clear the just-typed search so the full option list re-renders, then fall
      // back to the first real, selectable option rather than clicking a target that will never
      // appear (which would otherwise hang for the full action timeout before failing the whole
      // test).
      await searchBox.fill('');
      await page.waitForTimeout(600);
      // Scoped to the CURRENT dropdown's own listbox (`.last()`, same reasoning as the search box
      // above) rather than a bare page-wide `getByRole('option')` - this app's closed dropdowns
      // never unmount, so a page-wide query can otherwise resolve into an earlier, unrelated
      // dropdown's still-present option list.
      const currentListbox = page.locator('[role="listbox"]').last();
      // Index 0 is the search-input-wrapped-as-an-option quirk documented above, index 1 is the
      // disabled "Select ..." placeholder - the first real, selectable option is index 2. When
      // the list is genuinely empty that index 2 IS the disabled "No data available" row instead
      // (confirmed against the running app: this environment currently has ZERO Payment Term
      // records at all, even with the search cleared) - detect that rather than trying to click
      // it, which would just hang (retrying an "element is not enabled" actionability check)
      // until the action timeout. Polled a few times rather than checked once: the full list can
      // still be mid-fetch right after clearing the search box.
      const fallbackOption = currentListbox.locator('[role="option"]').nth(2);
      let fallbackIsUsable = false;
      for (let check = 0; check < 3; check++) {
        fallbackIsUsable = (await fallbackOption.count()) > 0
          && (await fallbackOption.getAttribute('aria-disabled').catch(() => null)) !== 'true';
        if (fallbackIsUsable) break;
        await page.waitForTimeout(500);
      }

      if (!fallbackIsUsable) {
        const createOption = currentListbox.getByRole('option', { name: /^Create New/i }).last();
        const inlineCreateAvailable = allowCreateNew && !createdOnce
          && (await createOption.isVisible({ timeout: 1000 }).catch(() => false));

        if (inlineCreateAvailable) {
          createdOnce = true;
          await createOption.click();
          // The inline "Create New ..." modal opens on top of the current page - no navigation,
          // so whatever this dropdown's own form already has filled in is untouched. It does NOT
          // auto-select the newly created record on the trigger afterward, so this falls through
          // to `continue` and re-searches from the top.
          const dialog = page.getByRole('dialog');
          await dialog.waitFor({ state: 'visible', timeout: 10000 });
          const nameField = dialog.locator('input[name$="_data.name"], input[name$=".name"]').first();
          searchText && await nameField.fill(searchText);
          if (createNewFields) {
            // Derive the modal's own field-array prefix from the Name field's own `name`
            // attribute (e.g. "payment_term.name" -> "payment_term") rather than requiring the
            // caller to know it - confirmed against the running app that this prefix differs per
            // entity.
            const namePrefix = (await nameField.getAttribute('name')).replace(/\.name$/, '');
            for (const [field, value] of Object.entries(createNewFields)) {
              const fieldSelectTrigger = dialog.locator(`[id="mui-component-select-${namePrefix}.${field}"]`);
              if (await fieldSelectTrigger.count() > 0) {
                await selectDropdown(page, fieldSelectTrigger, value, value);
              } else {
                await dialog.locator(`[name="${namePrefix}.${field}"]`).fill(String(value));
              }
            }
          }
          await dialog.getByRole('button', { name: /^Save$/i }).click();
          await dialog.waitFor({ state: 'hidden', timeout: 10000 });
          await page.waitForTimeout(500);
          // Confirmed against the running app: the underlying select menu (opened before the
          // "Create New ..." option was clicked) is still considered open underneath the now-
          // closed dialog - its trigger reports aria-expanded="true" and its own backdrop keeps
          // intercepting pointer events, hanging the next attempt's click on the same trigger.
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(200);
          if (!insideDialog) {
            await page.mouse.click(2, 2);
            await page.waitForTimeout(200);
          }
          continue;
        }

        if (createIfMissing && !createdOnce) {
          createdOnce = true;
          // Close this dropdown before creating the missing record elsewhere (a throwaway tab,
          // by convention) - leaving it open risks the stale-backdrop issue documented below.
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(200);
          if (!insideDialog) {
            await page.mouse.click(2, 2);
            await page.waitForTimeout(200);
          }
          await createIfMissing();
          continue; // retry from the top - the record should now be a real, searchable match
        }

        // Close the dropdown before giving up either way (throwing or skipping) so it doesn't
        // leave a stray open menu/backdrop behind for whatever the caller does next.
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(200);
        if (!insideDialog) {
          await page.mouse.click(2, 2);
          await page.waitForTimeout(200);
        }

        if (optional) {
          console.warn(`selectDropdown: "${optionText}" has no options at all (list is empty) - skipping since this field is optional`);
          return;
        }

        throw new Error(
          `selectDropdown: "${optionText}" has no options at all (list is empty) and no create fallback was available`
        );
      }
      await fallbackOption.click();
    }
    await page.waitForTimeout(300);

    // Confirmed against the running app: this MUI Select can leave an "invisible" full-viewport
    // backdrop mounted with pointer-events: auto after closing, which blocks every subsequent
    // click anywhere on the page. It never reaches Playwright's "hidden" state on its own. A
    // neutral click in the page's empty top-left corner reliably dismisses it without touching
    // any real form control - EXCEPT when the dropdown lives inside an open dialog (e.g. the
    // Journal Entry line-item modal): there, clicking outside the dialog's own paper hits ITS
    // backdrop instead and resets the dialog's just-made selection. Dialog-internal selects don't
    // need this cleanup at all (Save clicks through them fine).
    if (!insideDialog) {
      await page.mouse.click(2, 2);
      await page.waitForTimeout(200);
    }

    // Placeholders in this app all read "Search <Field Label>" while unselected; anything else
    // means the click actually registered.
    const currentText = (await triggerLocator.textContent().catch(() => '')) || '';
    if (currentText.trim() && !currentText.trim().startsWith('Search ')) {
      return;
    }
    if (insideDialog) {
      // A dialog-internal select that didn't register can't be recovered by pressing Escape (it
      // would close the dialog too) - just close the still-open menu and retry from the trigger.
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(200);
    }
  }
  throw new Error(`selectDropdown: "${optionText}" never registered on the trigger after ${maxAttempts} attempts`);
}

module.exports = { selectDropdown };
