# SKILLS.md

A cookbook of working patterns for writing and extending Playwright tests in this repo. Read [CLAUDE.md](CLAUDE.md) first for overall architecture; this file is the tactical reference for "how do I interact with this specific UI widget" when adding new specs or page objects. Every pattern below was copied from working code already in the repo, not invented, grep the cited file to see it in context.

## 1. Standard CRUD suite recipe

Every `tests/inventory/*.spec.js` file (attribute, location, bin) follows the same lifecycle, in this order, as separate numbered test cases (`TC-<AREA>-01`, `-02`, ...) inside one `test.describe`:

1. **Create, empty-form validation** — open Add form, click Save on an empty form, assert required-field errors appear and the URL stays on the add page. Then fill the form and save; assert redirect to the list URL and the new record's name visible in the list.
2. **View** — open the detail page via the list link, assert saved field values are visible as page text.
3. **Edit → toggle status Active → Inactive** — open edit form, assert current toggle state, click it, save, assert the "Inactive" badge in the row (`page.getByRole('row').filter({ hasText: name }).getByText('Inactive')`).
4. **Edit → reactivate Inactive → Active** — mirror of step 3.
5. **Duplicate** — Actions → Duplicate opens the Add form pre-filled with the original's data. Save without renaming first to assert a duplicate-name error, then rename and save to assert the copy appears in the list.
6. **Delete** — delete the record created in the duplicate step (not the original — later specs may depend on the original still existing, see §6). Confirm via the dialog's Delete button, assert the row is gone.

When adding a new master-data CRUD screen, scaffold its spec by copying this sequence rather than designing a new one.

## 2. Page Object conventions

- One class per screen in `pages/`, named `<Feature>Page.js`. Constructor holds locators only; methods are actions.
- Locator strategy, in order of preference actually used in this codebase: `getByPlaceholder(...)`, `getByRole('button'/'combobox'/'menuitem', { name })`, then `input[name="<form_object>.<field>"]` CSS when the placeholder/role isn't unique or doesn't exist (e.g. `input[name="add_item_category.category_name"]`). Avoid raw class-name selectors except for framework chrome you can't otherwise reach (`.MuiSwitch-root`, `.MuiPopover-paper`) — these are documented exceptions, not the default.
- Always provide a `goto()`/`gotoList()` pair: `gotoList()` navigates straight to the list URL, `goto()`/`openAdd()` goes further into the Add form. `openEdit(name)` composes `gotoList()` → click the record's link → Actions → Edit, and waits on the resulting `**/edit-<feature>` URL.
- A `fillForm({ ...fields })` method should guard every field with `if (field !== undefined) await this.xInput.fill(field)` so callers can pass partial data for negative-path tests without the page object needing separate methods per field.
- Compose a single high-level method (`createUOM()`, `createLocation()`) that chains `goto()` → `fillForm()` → feature-specific steps → `save()`, for specs that just want the happy path.

## 3. Dropdown/combobox patterns (pick the one matching the widget)

This app has at least four different dropdown implementations. Inspect the DOM (or an existing page object for the same screen) before assuming which one applies — using the wrong pattern is the most common source of new flaky tests.

**a. Native-feeling MUI combobox with a real listbox role** (`AttributePage.selectFieldType`, `DiscountedItemPage.selectDiscountType/selectDiscountCategory`):
```js
await page.getByRole('combobox', { name: 'Search <Field>' }).click();
await page.getByRole('option', { name: value, exact: true }).click();
// or, when the app renders the options in an explicit listbox:
const listbox = page.getByRole('listbox');
await listbox.waitFor({ state: 'visible' });
await listbox.getByRole('option', { name: value }).click();
```

**b. `mui-component-select-<field>` id-based menu with a filter input** (`DiscountedItemPage.selectAccount`, and the generalized `selectFromDropdown` helper in `tests/inventory/07-inventory-item.spec.ts`):
```js
await page.locator(`[id="mui-component-select-<form>.<field>"]`).click();
const menu = page.locator(`[id="menu-<form>.<field>"]`);
await menu.waitFor({ state: 'visible', timeout: 5000 });
await menu.locator('input').fill(searchText);
await page.waitForTimeout(500);           // menu re-filters asynchronously
await menu.locator(`li:has-text("${searchText}")`).first().click();
await menu.waitFor({ state: 'hidden', timeout: 5000 });
```
The `.ts` spec's version additionally polls `menu.locator('li').count()` with `expect(...).toPass()` before interacting, because some option lists (e.g. Location) populate asynchronously after the menu opens — do this when the field's options come from a network call.

**c. Text-trigger dropdown, no combobox role** (`BinPage.selectLocation/selectBinType`):
```js
await page.getByText('Search <Field>', { exact: true }).first().click();
await page.getByPlaceholder('Search <Field>').fill(value.substring(0, 25)); // truncate — see gotcha below
await page.waitForTimeout(500);
await page.getByRole('option', { name: value, exact: true }).first().click(); // or .last(), see below
```
Gotcha: if you type the *entire* target string into the filter box, `.first()` can land on the search-container row itself (whose accessible name mirrors the typed text) instead of the real option — truncate the search text (e.g. first 8-25 chars) so it's a prefix match, not an exact match, and check whether `.first()` or `.last()` picks the real option for that specific field (it varies; `selectBinType` uses `.last()`).

**d. Generic helper for simple search-and-click dropdowns** (`helpers/dropdown.js`):
```js
const { selectDropdown } = require('../../helpers/dropdown');
await selectDropdown(page, triggerLocator, searchText, optionText);
```
Use this for a new simple dropdown rather than hand-rolling pattern (a) or (c) again; extend it if the new widget doesn't fit rather than writing a fifth bespoke variant.

**e. Popover-based multi-select-style picker** (`ItemCategoryPage.addAttribute`):
```js
await page.locator('<trigger button selector>').click();
const popover = page.locator('.MuiPopover-paper').last();
await popover.waitFor({ state: 'visible', timeout: 5000 });
await page.getByPlaceholder('Search <Field>').fill(searchText);
await page.waitForTimeout(500);
await popover.locator(`li.MuiMenuItem-root:has-text("${searchText}")`).first().click();
```

**Procurement-flow comboboxes** (`tests/procurement/01-procurement-request-flow.spec.js`) use pattern (a) but scoped to a `getByRole('dialog', { name })` when the combobox lives inside a modal, since unscoped `page.getByText(...)` can match an already-selected value shown elsewhere in the header form.

## 4. Status toggle pattern

Active/Inactive is a checkbox with a visually distinct clickable switch on top of it:
```js
this.statusToggle = page.locator('input[name="status"]');   // for assertions: toBeChecked()/not.toBeChecked()
this.statusSwitch = page.locator('.MuiSwitch-root');         // for interaction: .click()
```
Assert state on `statusToggle`, click on `statusSwitch` — clicking the underlying (visually hidden) input directly does not reliably work in this app.

## 5. Actions menu → Edit/Duplicate/Delete

From a record's detail (`view-*`) page:
```js
await page.getByRole('button', { name: 'Actions' }).click();
await page.getByRole('menuitem', { name: 'Edit' }).waitFor({ state: 'visible' }); // wait before click, menu animates in
await page.getByRole('menuitem', { name: 'Edit' }).click();
await page.waitForURL('**/edit-<feature>');
```
Delete requires an extra confirmation dialog: click the `Delete` menuitem, then wait for and click a *second* Delete button, usually scoped to avoid colliding with the menuitem (`page.getByRole('dialog').getByRole('button', { name: 'Delete' })` or `.getByRole('button', { name: 'Delete' }).last()` depending on the screen — check both patterns exist in `pages/*.js` and match the one already used for that feature).

## 6. Cross-spec data dependencies

Inventory specs run in file order (`01-attribute`, `02-location`, `03-bin`, ...) with `fullyParallel: false` / `workers: 1` specifically so later specs can reuse records created by earlier ones instead of recreating them (see `config/testData.js`'s `bin.valid.location`, which equals `location.valid.updatedName`). If you add a new spec that depends on another feature's data:
- Reference the upstream value from `testData.js` rather than hardcoding a duplicate string.
- Add a self-healing `test.beforeAll` like `03-bin.spec.js`'s: check whether the dependency already exists in the list (with a *retrying* visibility check, not an instant `.count()`, since another spec may be creating it concurrently in the same run), and create it if missing. Treat a duplicate-name error during that creation as success, not failure, since it means another spec's run already created it moments earlier.
- Leave a comment at the bottom of the upstream spec (see the end of `02-location.spec.js`) noting which downstream spec consumes which record, and that its final "delete the original" test case is intentionally omitted.

## 7. Validation-error gotchas

- Some forms only show a required-field error after the field has been "touched" (blurred). If clicking Save alone doesn't surface the error, click the field then `press('Tab')` before clicking Save (see `05-item-category.spec.js` TC-CAT-02, `06-discounted-item.spec.js` TC-DI-01).
- After a failed Save on a form with MUI dropdowns, the dropdown triggers can enter a stuck error state and stop responding on that same page instance — navigate back to a fresh Add form (`gotoList()` → click Add again) rather than continuing to fill the same page after a validation failure (see `03-bin.spec.js` TC-BIN-03's comment).
- A validation-failure toast can auto-dismiss quickly; assert on it immediately after the triggering click rather than doing other work first. If a persistent inline error (not the toast) is available, prefer asserting on that, and consider retrying the triggering click once if nothing appeared at all (race with event-handler wiring) — see the `07-inventory-item.spec.ts` Step 2 comment for the full reasoning.
- Prefer scoping `getByText`/`getByRole` locators to a `dialog`/section root when a plain page-wide query could also match an already-filled value elsewhere on the same page (headers, other rows). Several bugs of this shape are called out in `01-procurement-request-flow.spec.js`.

## 8. Adding a new feature spec — checklist

1. Add its fixtures to `config/testData.js` under a new top-level key, reusing the `ts` timestamp suffix for any name that must be unique per run but stable within a run (create → view → edit → duplicate).
2. Create `pages/<Feature>Page.js` following §2.
3. Create `tests/<domain>/<NN>-<feature>.spec.js`, numbered to reflect its place in the required run order if it depends on / is depended on by other specs.
4. Follow the CRUD recipe in §1; tag the primary happy-path test `{ tag: '@smoke' }`.
5. Add an npm script (`test:<feature>`) in `package.json` only if the feature is significant enough to warrant running in isolation regularly (existing precedent: `test:login`, `test:uom`).
