/**
 * Select an option from a custom search dropdown.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} triggerLocator - The element that opens the dropdown
 * @param {string} searchText - Text to type into the search box
 * @param {string} optionText - Exact option text to click
 */
async function selectDropdown(page, triggerLocator, searchText, optionText) {
  await triggerLocator.click();
  const searchBox = page.locator('input[placeholder*="Search"]').last();
  await searchBox.fill(searchText);
  await page.waitForTimeout(800);
  await page.locator(`text="${optionText}"`).first().click();
}

module.exports = { selectDropdown };
