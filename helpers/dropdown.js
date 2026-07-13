/**
 * Select an option from a custom search dropdown.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} triggerLocator - The element that opens the dropdown
 * @param {string} searchText - Text to type into the search box
 * @param {string} optionText - Exact option text to click
 */
async function selectDropdown(page, triggerLocator, searchText, optionText) {
  const insideDialog = (await triggerLocator.locator('xpath=ancestor::*[@role="dialog"]').count()) > 0;

  // Retries the whole open -> search -> click sequence: the options list is fetched from an API
  // after typing, and occasionally the click on the final option lands before that response has
  // re-rendered the list, silently missing the real target - confirmed flaky against the running
  // app (intermittent "Please select Account" even though the option was clicked). Verifying the
  // trigger's text actually changed catches this instead of trusting the click blindly.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await triggerLocator.click();
    // Closed dropdowns in this app never unmount their search input (same "stale DOM" quirk as
    // their backdrop), so `.last()` evaluated immediately after the click can resolve to an
    // earlier, unrelated dropdown's search box that happens to still be the last one in the DOM
    // at that instant. Waiting briefly lets the just-opened dropdown's own search box mount first.
    await page.waitForTimeout(400);
    const searchBox = page.locator('input[placeholder*="Search"]').last();
    await searchBox.fill(searchText);
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
    await matches.last().click();
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
  throw new Error(`selectDropdown: "${optionText}" never registered on the trigger after 3 attempts`);
}

module.exports = { selectDropdown };
