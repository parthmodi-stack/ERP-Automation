# Leave Policy Master — Test Case Suite

Module path: HRMS → Company Master Policy → Leave Policy Master
Source verified against `erpforce-hrms-fe/src/views/leave-policy-master/` and `erpforce-be/modules/hrms/lib/leave-policy-master/` before writing any case below — every "Expected Result" reflects confirmed source behavior, not assumed UI conventions. Corrections to the original ask are called out explicitly rather than silently matched.

## Corrections to the requested module description (read before using these tables)

- **No "Publish" screen/button exists.** The real actions are **Save** (creates/updates with `is_draft: false`) and **Save To Draft** (`common.buttons.saveAsDraft_label`, exact button text **"Save To Draft"**, not "Save Draft"). Status is Draft vs Active/Inactive only — there is no separate "Published" state and no approval/Submit/Accept/Reject workflow anywhere in this module.
- **The form is a multi-tab wizard**, not a single scrolling form. "Save" only appears on the last tab; earlier tabs show "Next" instead. This affects Navigation and Page Load test cases below.
- **Company is required on the frontend only.** The backend JSON-schema validators for create/update don't require `company_id` at all — the use-case silently backfills it from the logged-in user's own company if omitted (`request.body.leave_policy_master.company_id = ... || request.userData.company_id`). This is a real, confirmed gap covered in Validation/Negative sections below, not a hypothetical.
- **Location and Department have NO Yup validation rules at all** (commented out in `utils/validation.ts`) — both are optional, contrary to their visual grouping under "Classification" possibly implying required.
- **Carry Forward / Encashment numeric sub-fields are NOT conditionally required** when their parent "Enable" checkbox is on, despite being visually `disabled` when it's off — no `.when('enabled', ...)` exists in the Yup schema. Only a floor of `min(0)` applies once a value is entered. This is a confirmed gap, covered explicitly rather than assumed away.
- **Effective From allows past, today, and future dates** — there is no "must be in the future" restriction (`createDateValidation({ allowPast: true, allowToday: true, allowFuture: true })`).
- **Company's own dropdown is a plain `DynamicSearchSelect`, not a `DynamicDependentField`** like Location/Department — whether it has a "Create New Company" footer link could not be confirmed from source (the shared component ships pre-minified with no visible default for that field). Cases referencing it are marked accordingly and should be manually verified first.

---

## 1. Functional Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LPM-F-01 | Leave Policy Master | Page Load | List page loads with correct URL and columns | Logged in, `canView` permission | — | Navigate to `/company-master-policy/leave-policy-master` | URL matches; table shows ID, Policy Name, Category, Effective From, Company, Location, Department, Status columns | P0 | Yes | Yes | Yes |
| TC-LPM-F-02 | Leave Policy Master | Page Load | Add page loads on an empty first tab | `canAdd` permission | — | Click Add from list | URL matches `add-leave-policy-master`; first tab active; "Next" button visible, no "Save" yet | P0 | Yes | Yes | Yes |
| TC-LPM-F-03 | Leave Policy Master | Listing | Table renders existing records | ≥1 record exists | — | Load list page | At least one row renders with non-empty Policy Name and Status | P0 | Yes | Yes | Yes |
| TC-LPM-F-04 | Leave Policy Master | Add | Create a policy with only mandatory fields | On Add page | Leave Type Title, Leave Category, Effective From, Company | Fill mandatory fields across tabs, click Next until last tab, click Save | Record created; `is_draft=false`; redirected to list; new row visible | P0 | Yes | Yes | Yes |
| TC-LPM-F-05 | Leave Policy Master | Add | Create a policy with Location and Department set | On Add page | Mandatory fields + Location A + Department A (both under same Company) | Fill form incl. Classification tab, Save | Record created with Location/Department persisted | P0 | Yes | No | Yes |
| TC-LPM-F-06 | Leave Policy Master | Add | Create a policy with Location/Department left blank | On Add page | Mandatory fields only | Save without touching Classification | Record created successfully (Location/Department are optional, no Yup rule exists) | P1 | Yes | No | Yes |
| TC-LPM-F-07 | Leave Policy Master | Edit | Open Edit and confirm form loads existing values | Existing record | Any saved record | Open Edit from list | All previously saved values pre-populate across all tabs | P0 | Yes | Yes | Yes |
| TC-LPM-F-08 | Leave Policy Master | Edit | Update a field and Save | Existing record | Updated Leave Type Title | Edit title, navigate to last tab, Save | Update persists; list reflects new title | P0 | Yes | Yes | Yes |
| TC-LPM-F-09 | Leave Policy Master | View | Open View and confirm read-only rendering | Existing record | — | Open View from list | Correct data displayed; no editable inputs anywhere | P0 | Yes | Yes | Yes |
| TC-LPM-F-10 | Leave Policy Master | Save Draft | Save a new policy as Draft | On Add page, `saveasdraft.canAdd` permission | Mandatory fields only | Fill mandatory fields, click "Save To Draft" | Record created with `is_draft=true`; list status chip shows "Draft" | P0 | Yes | Yes | Yes |
| TC-LPM-F-11 | Leave Policy Master | Save Draft | Re-save an existing Draft as Draft again | Existing Draft record | — | Open Edit on the Draft, change a field, click "Save To Draft" | "Save To Draft" button is visible only because `is_draft=true`; update persists, still Draft | P1 | Yes | No | Yes |
| TC-LPM-F-12 | Leave Policy Master | Save Draft | "Save To Draft" is hidden when editing a published (non-draft) record | Existing published record | — | Open Edit on a published record | "Save To Draft" button is NOT rendered (only shown when `tData.is_draft` is true) | P1 | Yes | No | Yes |
| TC-LPM-F-13 | Leave Policy Master | Final Save | Publish a Draft (Save from Edit converts is_draft to false) | Existing Draft record | — | Open Edit on Draft, navigate to last tab, click "Save" | Record updates with `is_draft=false`; status chip becomes Active/Inactive, not Draft | P0 | Yes | Yes | Yes |
| TC-LPM-F-14 | Leave Policy Master | Navigation | Tab stepper moves forward via "Next" | On Add page | — | Fill first tab's required fields, click Next | Advances to next tab without validation errors when required fields on current tab are filled | P0 | Yes | Yes | Yes |
| TC-LPM-F-15 | Leave Policy Master | Navigation | "Next" is blocked if current tab has invalid required fields | On Add page | Leave Type Title empty | Click Next without filling Leave Type Title | Inline validation error shown; tab does not advance | P0 | Yes | No | Yes |
| TC-LPM-F-16 | Leave Policy Master | Navigation | "Save" only appears on the final tab | On Add page | — | Observe footer buttons on tab 1 vs. final tab | Tab 1 shows Next (no Save); final tab shows Save instead of Next | P1 | Yes | No | No |
| TC-LPM-F-17 | Leave Policy Master | Cancel/Discard | Discard a new policy mid-fill | On Add page, some fields filled | — | Fill a few fields, click Discard | Redirected to list; no record created | P0 | Yes | Yes | Yes |
| TC-LPM-F-18 | Leave Policy Master | Cancel/Discard | Discard an in-progress Edit | On Edit page, field changed | Existing record | Change a field, click Discard | Redirected to list; original record unchanged | P0 | Yes | No | Yes |
| TC-LPM-F-19 | Leave Policy Master | Reset | No explicit "Reset" control exists on this form | On Add page | — | Search the Add page for a Reset/Clear-All action | No Reset button found in source (`add-leave-policy.hrms.tsx` header buttons are Save To Draft/Discard/Save only) — confirm live before writing an automated case; do not assume one exists | P3 | Manual first | No | No |

## 2. Dropdown Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LPM-DD-01 | Leave Policy Master | Company dropdown | Company is enabled by default | On Add page | — | Observe Company field on load | Company combobox is enabled and interactable immediately (not dependent on anything) | P0 | Yes | Yes | No |
| TC-LPM-DD-02 | Leave Policy Master | Location dropdown | Location is disabled until Company is selected | On Add page, Company empty | — | Attempt to open Location dropdown before selecting Company | Location combobox is disabled (`isDisabledDueToFilters` true while filter value empty) | P0 | Yes | Yes | Yes |
| TC-LPM-DD-03 | Leave Policy Master | Department dropdown | Department is disabled until Company is selected | On Add page, Company empty | — | Attempt to open Department dropdown before selecting Company | Department combobox is disabled, same mechanism as Location | P0 | Yes | Yes | Yes |
| TC-LPM-DD-04 | Leave Policy Master | Location dropdown | Location enables immediately after Company is selected | On Add page | Company A | Select Company A | Location combobox becomes enabled/clickable | P0 | Yes | Yes | Yes |
| TC-LPM-DD-05 | Leave Policy Master | Department dropdown | Department enables immediately after Company is selected | On Add page | Company A | Select Company A | Department combobox becomes enabled/clickable | P0 | Yes | Yes | Yes |
| TC-LPM-DD-06 | Leave Policy Master | Company dropdown | Search filters the option list | On Add page | Partial company name | Click Company combobox, type a partial name | Matching option(s) appear; non-matching options filtered out | P1 | Yes | No | No |
| TC-LPM-DD-07 | Leave Policy Master | Location dropdown | Search within an already-filtered Location list | Company selected | Partial location name | Type into Location's search input | Options filtered further within the company-scoped result set only | P1 | Yes | No | No |
| TC-LPM-DD-08 | Leave Policy Master | Location/Department dropdown | API call fires only after Company selection | On Add page | Company A | Select Company A, observe network | A location/department list request fires with a `company_id` filter matching Company A's id | P1 | Yes | No | No |
| TC-LPM-DD-09 | Leave Policy Master | Location dropdown | Empty result set for a Company with no Locations | Company with zero Locations | Company with no Locations | Select that Company, open Location dropdown | Dropdown shows an empty/no-data state, not an error | P1 | Yes | No | No |
| TC-LPM-DD-10 | Leave Policy Master | Department dropdown | Empty result set for a Company with no Departments | Company with zero Departments | Company with no Departments | Select that Company, open Department dropdown | Dropdown shows an empty/no-data state, not an error | P1 | Yes | No | No |
| TC-LPM-DD-11 | Leave Policy Master | Location/Department dropdown | Default value on Add is empty | On Add page | — | Open form, inspect Location/Department before any selection | Both fields render empty/unselected by default | P2 | Yes | No | No |
| TC-LPM-DD-12 | Leave Policy Master | Location dropdown | Selected value persists across tab navigation | Company + Location selected | Company A, Location A | Select values, navigate Next then Back | Location A remains selected after returning to the tab | P1 | Yes | No | Yes |
| TC-LPM-DD-13 | Leave Policy Master | Location dropdown | Clearing the Location selection | Location already selected | — | Click the field's clear-selection control | Location value clears; field returns to placeholder state | P2 | Yes | No | No |
| TC-LPM-DD-14 | Leave Policy Master | Location/Department dropdown | Loading indicator shows while options fetch | Company selected, throttled network | Company A | Select Company A, immediately open Location dropdown | A loading state renders in the popover until the fetch resolves | P2 | Yes | No | No |
| TC-LPM-DD-15 | Leave Policy Master | Location dropdown | "Create New Location" footer link creates and auto-selects a new Location | Company selected | New unique Location name | Open Location dropdown, click "Create New Location", fill quick-add modal, Save | New Location record created and becomes the selected value in the field | P1 | Yes | No | No |
| TC-LPM-DD-16 | Leave Policy Master | Company dropdown | Duplicate prevention — same Company cannot be selected twice in one field | On Add page | Company A | Select Company A, reopen dropdown, select Company A again | No duplicate/error state; field simply keeps the single selected value (single-select field, not multi-select) | P3 | Yes | No | No |
| TC-LPM-DD-17 | Leave Policy Master | Company dropdown | "Create New Company" footer — existence unconfirmed | On Add page | — | Open Company dropdown, check for a footer "Create New Company" link | Unlike Location/Department, this cannot be confirmed from source (plain `DynamicSearchSelect`, no `enable_footer` override visible) — verify manually first; do not assume it exists or doesn't | P3 | Manual first | No | No |

## 3. Dependency Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LPM-DEP-01 | Leave Policy Master | Company→Location dependency | Selecting a Company loads only its own Locations | On Add page | Company A (has Locations A1, A2) | Select Company A, open Location dropdown | Only Company A's Locations appear, no cross-company Locations | P0 | Yes | Yes | Yes |
| TC-LPM-DEP-02 | Leave Policy Master | Company→Department dependency | Selecting a Company loads only its own Departments | On Add page | Company A (has Departments A1, A2) | Select Company A, open Department dropdown | Only Company A's Departments appear | P0 | Yes | Yes | Yes |
| TC-LPM-DEP-03 | Leave Policy Master | Company change | Changing Company clears previously selected Location | Company A + Location A1 already selected | Company B | Change Company from A to B | Location field resets to empty (confirmed: `DynamicDependentField` resets value when a dirty dependency changes) | P0 | Yes | Yes | Yes |
| TC-LPM-DEP-04 | Leave Policy Master | Company change | Changing Company clears previously selected Department | Company A + Department A1 already selected | Company B | Change Company from A to B | Department field resets to empty, same mechanism as Location | P0 | Yes | Yes | Yes |
| TC-LPM-DEP-05 | Leave Policy Master | Company change | Dropdown data reloads after Company change | Company A selected, Location dropdown opened once | Company B | Change to Company B, reopen Location dropdown | A fresh API call fires filtered by Company B's id; Company A's Locations are no longer listed | P0 | Yes | No | Yes |
| TC-LPM-DEP-06 | Leave Policy Master | Removing Company | Clearing Company disables and clears Location/Department | Company A + Location + Department selected | — | Clear the Company selection | Location and Department both clear and become disabled again | P1 | Yes | No | Yes |
| TC-LPM-DEP-07 | Leave Policy Master | Re-selecting Company | Re-selecting the same Company after clearing does not retain the old Location | Company A selected → cleared → Company A selected again | Company A | Select A, clear, reselect A | Location/Department remain empty (cleared state is not restored just because the same Company is re-picked) | P1 | Yes | No | No |
| TC-LPM-DEP-08 | Leave Policy Master | Same Company selection | Re-picking the currently-selected Company (no actual change) does not clear Location/Department | Company A + Location A1 selected | Company A | Open Company dropdown, click Company A again (same value) | Location/Department are untouched since the dependency value didn't actually change | P2 | Yes | No | No |
| TC-LPM-DEP-09 | Leave Policy Master | Different Company selection | Switching between two different Companies twice clears correctly each time | Company A selected with Location | Company B, then Company A again | A → select Location → B → A | Location clears on each actual change, never silently carries over a stale cross-company value | P1 | Yes | No | Yes |

## 4. Validation Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LPM-VAL-01 | Leave Policy Master | Required validation | Leave Type Title required | On Add page | Blank title | Leave Title empty, click Next/Save | Inline error rendered, blocked from proceeding | P0 | Yes | Yes | Yes |
| TC-LPM-VAL-02 | Leave Policy Master | Required validation | Leave Category required | On Add page | No category selected | Leave Category empty, click Next/Save | Inline error rendered, blocked | P0 | Yes | Yes | Yes |
| TC-LPM-VAL-03 | Leave Policy Master | Required validation | Effective From required | On Add page | Date empty | Leave Effective From empty, click Next/Save | Inline error rendered, blocked | P0 | Yes | No | Yes |
| TC-LPM-VAL-04 | Leave Policy Master | Required validation | Company required on frontend | On Add page | Company empty | Leave Company empty, click Next/Save | Frontend Yup blocks with a required error (`company_id` is `.required()` in `validation.ts`) | P0 | Yes | Yes | Yes |
| TC-LPM-VAL-05 | Leave Policy Master | Missing Company (backend gap) | Submitting with Company bypassed at the API layer | Direct API call bypassing the UI | `company_id` omitted from payload | POST directly to `/v1/leave-policy-master/` without `company_id` | Backend silently defaults `company_id` to the authenticated user's own company instead of rejecting the request — confirmed real gap, not a hypothetical | P1 | Yes | No | Yes |
| TC-LPM-VAL-06 | Leave Policy Master | Missing Location | Save succeeds with Location left blank | On Add page | Location blank, all else valid | Save without touching Location | Save succeeds — Location has no Yup rule at all | P1 | Yes | No | Yes |
| TC-LPM-VAL-07 | Leave Policy Master | Missing Department | Save succeeds with Department left blank | On Add page | Department blank, all else valid | Save without touching Department | Save succeeds — Department has no Yup rule at all | P1 | Yes | No | Yes |
| TC-LPM-VAL-08 | Leave Policy Master | Invalid combination | Selecting a Location that doesn't belong to the selected Company (forced via API) | Direct API call | `location_id` belonging to a different company than `company_id` in payload | POST with mismatched company/location ids | Document actual server behavior (accept and silently mismatch vs. reject) — must be verified live since no cross-company check was found in the backend validators reviewed; do not assume it's rejected | P1 | Manual first | No | Yes |
| TC-LPM-VAL-09 | Leave Policy Master | Invalid IDs | Non-existent `company_id` sent via API | Direct API call | `company_id: 999999999` | POST with a company id that doesn't exist | Expect a 4xx/validation error or FK constraint failure — confirm exact status/message live | P2 | Yes | No | No |
| TC-LPM-VAL-10 | Leave Policy Master | Duplicate records | Two policies with an identical Leave Type Title | Existing record with Title "Sick Leave" | Title "Sick Leave" again | Create a second policy with the same title | No uniqueness rule found on `leave_type_title` in either Yup or backend schema — expect it to save successfully; do not assert a duplicate-blocked error without live confirmation | P2 | Yes | No | No |
| TC-LPM-VAL-11 | Leave Policy Master | Maximum length | Leave Type Title at/just past its max length (if any) | On Add page | 255+ character title | Enter a very long title, attempt Save | No explicit max-length rule found in `utils/validation.ts` for `leave_type_title` — confirm live whether the input itself truncates or the backend rejects | P2 | Yes | No | No |
| TC-LPM-VAL-12 | Leave Policy Master | Whitespace | Leave Type Title containing only spaces | On Add page | `"   "` | Enter only spaces, attempt Save | No `.trim()` rule found in the Yup schema — likely accepted; confirm live rather than assume rejection | P2 | Yes | No | No |
| TC-LPM-VAL-13 | Leave Policy Master | Special characters | Leave Type Title with HTML/script-like content | On Add page | `<script>alert(1)</script>` | Enter the value, Save | Value is accepted and rendered as plain text (no client-side sanitization rule found) — verify it is NOT executed/injected on View/List render | P1 | Yes | No | No |
| TC-LPM-VAL-14 | Leave Policy Master | Numeric fields | Annual Entitlement rejects negative values | On Add page | `-5` | Enter -5 into Annual Entitlement | Blocked by `min(0)` Yup rule | P1 | Yes | No | Yes |
| TC-LPM-VAL-15 | Leave Policy Master | Numeric fields | Max Carry Forward Days rejects negative values | On Add page, Carry Forward enabled | `-1` | Enter -1 | Blocked by `min(0)` Yup rule | P1 | Yes | No | Yes |
| TC-LPM-VAL-16 | Leave Policy Master | Numeric fields | Fractional value in a backend-integer field | Carry Forward enabled | `2.5` | Enter 2.5 into Max Carry Forward Days, Save | Frontend Yup (`number()`) accepts it, but backend schema types this field as `integer` — expect a backend rejection or silent truncation; confirm which live, this is a real frontend/backend type mismatch | P1 | Yes | No | No |
| TC-LPM-VAL-17 | Leave Policy Master | Mixed values | Numeric field containing letters | On Add page | `"abc"` | Type "abc" into Annual Entitlement | Field should reject non-numeric input or show a type error | P2 | Yes | No | No |
| TC-LPM-VAL-18 | Leave Policy Master | Cross-field gap | Enable Carry Forward but leave Max Carry Forward Days blank | On Add page | Carry Forward enabled, days field blank | Enable checkbox, leave days blank, Save | Confirmed gap: no `.when('enabled', ...)` required rule exists — Save succeeds despite the field being visually enabled/expected | P1 | Yes | No | Yes |
| TC-LPM-VAL-19 | Leave Policy Master | Cross-field gap | Enable Encashment but leave Minimum Balance Required and Maximum Days Per Year blank | On Add page | Encashment enabled, both fields blank | Enable checkbox, leave fields blank, Save | Same confirmed gap as TC-LPM-VAL-18 — Save succeeds | P1 | Yes | No | Yes |
| TC-LPM-VAL-20 | Leave Policy Master | Eligibility Rules validation | Rule with no conditions blocks save | On Add page, Eligibility Rules tab | One rule added, zero conditions | Add a rule, don't add any condition, proceed | Blocked by `conditions.min(1)` Yup rule | P1 | Yes | No | Yes |
| TC-LPM-VAL-21 | Leave Policy Master | Eligibility Rules validation | Condition value required unless operator is a null-check | On Add page, Eligibility Rules tab | Operator = "equals", value blank | Set a non-null-check operator, leave value blank | Blocked — value is required for non-null-check operators (`.when('operator', ...)`) | P1 | Yes | No | Yes |
| TC-LPM-VAL-22 | Leave Policy Master | Eligibility Rules validation | Condition value not required for a null-check operator | On Add page, Eligibility Rules tab | Operator = "is null" (or equivalent), value blank | Set a null-check operator, leave value blank | Allowed — value requirement is waived for that operator type | P2 | Yes | No | No |

## 5. Negative Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LPM-NEG-01 | Leave Policy Master | API failure | List API returns a generic error | Mocked route interception | `page.route()` abort/500 on `GET /v1/leave-policy-master` | Load the list page | An error state renders instead of an infinite loader or a crash | P1 | Yes | No | No |
| TC-LPM-NEG-02 | Leave Policy Master | Timeout | List API hangs indefinitely | Mocked route with an unresolved promise | — | Load list page | A timeout/error state appears rather than hanging forever with no feedback | P2 | Yes | No | No |
| TC-LPM-NEG-03 | Leave Policy Master | 500 response | Save request returns HTTP 500 | Mocked route | 500 on `POST /v1/leave-policy-master/` | Fill valid form, Save | Error toast shown; user remains on the form, no false "success" navigation | P1 | Yes | No | No |
| TC-LPM-NEG-04 | Leave Policy Master | 404 response | Opening Edit/View for a deleted record's ID | Direct navigation | Non-existent `:id` in the URL | Navigate to `.../:id/edit-leave-policy-master` for a deleted id | A 404/not-found state renders, not a blank crash | P1 | Yes | No | No |
| TC-LPM-NEG-05 | Leave Policy Master | Network disconnect | Network drops mid-save | Simulated offline via `context.setOffline(true)` | — | Fill form, go offline, click Save | A network-error toast/state appears; no silent data loss without feedback | P2 | Yes | No | No |
| TC-LPM-NEG-06 | Leave Policy Master | Empty response | List API returns an empty array | Mocked route | `{ data: { leave_policy_master: [] } }` | Load list page | The shared "No Data" empty state renders, not zero `<tr>` with no explanation | P1 | Yes | No | No |
| TC-LPM-NEG-07 | Leave Policy Master | Null response | Get-by-id API returns `data.leave_policy_master: null` | Mocked route | Null payload | Open Edit/View | Handled gracefully (error/empty state), not a JS exception | P2 | Yes | No | No |
| TC-LPM-NEG-08 | Leave Policy Master | Large response | List API returns a very large page of records | Mocked route with 1000+ rows | — | Load list page | Table renders without freezing; pagination still functions | P2 | Yes | No | No |
| TC-LPM-NEG-09 | Leave Policy Master | Slow response | List API resolves after several seconds | Mocked route with delay | 5s delay | Load list page | A loading indicator is visible for the full duration, then data renders correctly | P2 | Yes | No | No |
| TC-LPM-NEG-10 | Leave Policy Master | Unauthorized response | API returns 401 mid-session | Mocked route | 401 on any leave-policy-master call | Trigger the call | `BasePage`'s existing 401/403 fast-fail behavior should surface this as an auth failure, not a generic UI bug | P1 | Yes | No | No |
| TC-LPM-NEG-11 | Leave Policy Master | Forbidden response | API returns 403 for a permission-scoped action | Mocked route | 403 on `POST /v1/leave-policy-master/` | Attempt Save as a user without `canAdd` | Same 401/403 fast-fail path as TC-LPM-NEG-10 applies | P2 | Yes | No | No |

## 6. Boundary Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LPM-BND-01 | Leave Policy Master | Minimum values | Annual Entitlement at exactly 0 | On Add page | `0` | Enter 0, Save | Accepted — `min(0)` is inclusive | P2 | Yes | No | No |
| TC-LPM-BND-02 | Leave Policy Master | Minimum values | Max Carry Forward Days at exactly 0 | Carry Forward enabled | `0` | Enter 0, Save | Accepted | P2 | Yes | No | No |
| TC-LPM-BND-03 | Leave Policy Master | Maximum values | Annual Entitlement at a very large number | On Add page | `999999` | Enter 999999, Save | No max bound found in Yup — confirm live whether the backend's integer column has a practical ceiling | P3 | Yes | No | No |
| TC-LPM-BND-04 | Leave Policy Master | First Company | Selecting the first Company in the dropdown's option order | On Add page | First-listed Company | Open dropdown, pick first option | Selection succeeds; Location/Department load for it | P2 | Yes | No | No |
| TC-LPM-BND-05 | Leave Policy Master | Last Company | Selecting the last Company in the dropdown's option order (may require scrolling/pagination in the popover) | On Add page | Last-listed Company | Scroll to and pick the last option | Selection succeeds even at the end of a paginated dropdown list | P2 | Yes | No | No |
| TC-LPM-BND-06 | Leave Policy Master | Single Location | Company with exactly one Location | Company with 1 Location | — | Select that Company, open Location dropdown | Exactly one option renders, selectable | P2 | Yes | No | No |
| TC-LPM-BND-07 | Leave Policy Master | Multiple Locations | Company with many Locations | Company with 10+ Locations | — | Select that Company, open Location dropdown, scroll | All belong to that Company only; scrolling/pagination works within the popover | P2 | Yes | No | No |
| TC-LPM-BND-08 | Leave Policy Master | No Locations | Company with zero Locations | Company with 0 Locations | — | Select that Company, open Location dropdown | Empty-state rendered (same as TC-LPM-DD-09) | P2 | Yes | No | No |
| TC-LPM-BND-09 | Leave Policy Master | Single Department | Company with exactly one Department | Company with 1 Department | — | Select that Company, open Department dropdown | Exactly one option renders, selectable | P2 | Yes | No | No |
| TC-LPM-BND-10 | Leave Policy Master | Multiple Departments | Company with many Departments | Company with 10+ Departments | — | Select that Company, open Department dropdown, scroll | All belong to that Company only | P2 | Yes | No | No |
| TC-LPM-BND-11 | Leave Policy Master | No Departments | Company with zero Departments | Company with 0 Departments | — | Select that Company, open Department dropdown | Empty-state rendered (same as TC-LPM-DD-10) | P2 | Yes | No | No |

## 7. Edit Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LPM-EDIT-01 | Leave Policy Master | Preload | Existing Company preloads correctly on Edit | Record saved with Company A | — | Open Edit | Company field shows Company A pre-selected | P0 | Yes | Yes | Yes |
| TC-LPM-EDIT-02 | Leave Policy Master | Preload | Existing Location preloads correctly on Edit | Record saved with Location A1 | — | Open Edit | Location field shows Location A1 pre-selected, options scoped to Company A | P0 | Yes | Yes | Yes |
| TC-LPM-EDIT-03 | Leave Policy Master | Preload | Existing Department preloads correctly on Edit | Record saved with Department A1 | — | Open Edit | Department field shows Department A1 pre-selected | P0 | Yes | Yes | Yes |
| TC-LPM-EDIT-04 | Leave Policy Master | Dependency on Edit | Changing Company on Edit clears the pre-loaded Location/Department | Record saved with Company A + Location A1 + Department A1 | Company B | Open Edit, change Company to B | Location and Department fields both clear, same as the Add-page dependency behavior | P0 | Yes | Yes | Yes |
| TC-LPM-EDIT-05 | Leave Policy Master | Save after update | Save persists an updated Location correctly | Editing existing record | Location A2 (same Company) | Change Location to A2, Save | Updated record shows Location A2 on reopening | P0 | Yes | No | Yes |
| TC-LPM-EDIT-06 | Leave Policy Master | Cancel update | Discarding an Edit leaves the original record untouched | Editing existing record | Field changed, not saved | Change a field, click Discard | Reopening Edit shows the original, unchanged value | P0 | Yes | No | Yes |

## 8. View Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LPM-VIEW-01 | Leave Policy Master | Correct data | Company displayed matches the saved record | Existing record | — | Open View | Company name shown matches what was saved | P0 | Yes | Yes | Yes |
| TC-LPM-VIEW-02 | Leave Policy Master | Correct data | Location displayed matches the saved record | Existing record with Location | — | Open View | Location name shown matches what was saved | P0 | Yes | Yes | Yes |
| TC-LPM-VIEW-03 | Leave Policy Master | Correct data | Department displayed matches the saved record | Existing record with Department | — | Open View | Department name shown matches what was saved | P0 | Yes | Yes | Yes |
| TC-LPM-VIEW-04 | Leave Policy Master | Read-only | No field on the View screen is editable | Existing record | — | Open View, attempt to click/type into any field | All fields are read-only; no input accepts focus/typing | P0 | Yes | Yes | Yes |
| TC-LPM-VIEW-05 | Leave Policy Master | No editable controls | No Save/Save To Draft/Next buttons render on View | Existing record | — | Open View, inspect footer buttons | Only an "Actions" menu (Edit/Delete) is present, no form-submission controls | P1 | Yes | No | Yes |

## 9. API Validation

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LPM-API-01 | Leave Policy Master | Request payload | Correct `company_id` is sent on create | On Add page | Company A | Select Company A, fill mandatory fields, Save, inspect the POST body | `leave_policy_master.company_id` in the request matches Company A's id | P1 | Yes | No | Yes |
| TC-LPM-API-02 | Leave Policy Master | Request payload | Correct `location_id` is sent on create | Company + Location selected | Location A1 | Save, inspect the POST body | `location_id` matches the selected Location's id | P1 | Yes | No | Yes |
| TC-LPM-API-03 | Leave Policy Master | Request payload | Correct `department_id` is sent on create | Company + Department selected | Department A1 | Save, inspect the POST body | `department_id` matches the selected Department's id | P1 | Yes | No | Yes |
| TC-LPM-API-04 | Leave Policy Master | No unnecessary calls | Location API doesn't fire before Company is selected | On Add page | — | Load Add page, watch network for 2s without touching Company | No location-list request fires (field is disabled, no fetch trigger) | P2 | Yes | No | No |
| TC-LPM-API-05 | Leave Policy Master | Response mapping | Create response's ID is read from the correct nested path | After Save | — | Intercept `POST /v1/leave-policy-master/` response | ID is at `response.data.leave_policy_master.id` — confirmed nesting depth, do not assume `response.data.id` | P1 | Yes | No | No |
| TC-LPM-API-06 | Leave Policy Master | Response mapping | List response's records and pagination are read from the correct paths | On list page | — | Intercept `GET /v1/leave-policy-master/` | Rows at `response.data.leave_policy_master` (array); pagination is a SIBLING of `data`, at `response.pagination`, not nested under it | P1 | Yes | No | No |
| TC-LPM-API-07 | Leave Policy Master | Caching | Reopening the same Company's Location list doesn't necessarily refetch | Company A selected once already this session | — | Select Company A, open Location dropdown, close, reopen | Document actual behavior (refetch vs. cached) — no caching layer was confirmed from source, verify live before asserting either way | P3 | Manual first | No | No |

## 10. UI Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LPM-UI-01 | Leave Policy Master | Labels | Company/Location/Department render their correct labels | On Add page | — | Inspect field labels | "Company", "Location", "Department" (exact translations from `hrms.leave_policy_master.fields.*`) | P1 | Yes | No | No |
| TC-LPM-UI-02 | Leave Policy Master | Placeholder | Location/Department show a placeholder before selection | On Add page, Company selected | — | Inspect empty Location/Department fields | Placeholder text renders (verify exact string live - translation key presence was not individually confirmed for these two fields) | P2 | Yes | No | No |
| TC-LPM-UI-03 | Leave Policy Master | Loading spinner | A loading indicator appears while dropdown options fetch | Company just selected | — | Select Company, immediately open Location dropdown | Spinner/loading state visible until data resolves | P2 | Yes | No | No |
| TC-LPM-UI-04 | Leave Policy Master | Disabled state | Disabled Location/Department render with a visually disabled style | Company not yet selected | — | Inspect Location/Department before Company selection | Fields show a disabled visual treatment, not just a non-functional enabled-looking control | P1 | Yes | No | Yes |
| TC-LPM-UI-05 | Leave Policy Master | Error messages | Required-field errors render inline, not only as a toast | On Add page | Blank mandatory fields | Attempt Next/Save | Inline helper-text errors appear under each invalid field | P1 | Yes | No | Yes |
| TC-LPM-UI-06 | Leave Policy Master | Success toast | A success toast appears after Save | On Add page, valid data | — | Complete and Save | Toast confirms creation (message key `hrms.leave_policy_master`-scoped or shared `msg.create`-equivalent - confirm exact text live) | P1 | Yes | Yes | Yes |
| TC-LPM-UI-07 | Leave Policy Master | Alignment | Classification section fields align consistently with the rest of the form | On Add page | — | Visual inspection / screenshot diff | Location/Department sit in the same grid pattern as other paired fields (no layout regression) | P3 | Yes | No | No |
| TC-LPM-UI-08 | Leave Policy Master | Responsive behavior | Form remains usable at a narrower viewport | On Add page | Viewport resized | Resize to a smaller width, interact with Company/Location/Department | Fields remain usable and don't overlap/clip | P3 | Yes | No | No |

## 11. Accessibility Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LPM-A11Y-01 | Leave Policy Master | Keyboard navigation | Company/Location/Department are operable via keyboard only | On Add page | — | Tab to each field, open with Enter/Space, arrow through options, select with Enter | Each dropdown is fully operable without a mouse | P2 | Yes | No | No |
| TC-LPM-A11Y-02 | Leave Policy Master | Tab order | Tab order follows the visual Company → Location → Department sequence | On Add page | — | Press Tab repeatedly from Company | Focus moves in the same left-to-right/top-to-bottom order as the visible layout | P2 | Yes | No | No |
| TC-LPM-A11Y-03 | Leave Policy Master | Screen reader labels | Each dropdown has an accessible name matching its visible label | On Add page | — | Inspect accessibility tree / ARIA snapshot | Accessible name for each combobox matches "Company"/"Location"/"Department" | P2 | Yes | No | No |
| TC-LPM-A11Y-04 | Leave Policy Master | ARIA attributes | Disabled Location/Department expose `aria-disabled`/`disabled` correctly | Company not selected | — | Inspect ARIA state of Location/Department | Disabled state is exposed to assistive tech, not just visually implied | P2 | Yes | No | No |
| TC-LPM-A11Y-05 | Leave Policy Master | Focus management | Focus returns to a sensible element after closing a dropdown | Dropdown opened and closed via Escape | — | Open Location dropdown, press Escape | Focus returns to the Location trigger, not lost to `<body>` | P3 | Yes | No | No |

## 12. Regression Test Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LPM-REG-01 | Leave Policy Master | Leave Category | Leave Category selection still saves and displays correctly | On Add page | Existing Leave Category | Select category, Save, View | Category name matches on View/List | P1 | Yes | No | Yes |
| TC-LPM-REG-02 | Leave Policy Master | Leave Title | Leave Type Title still saves and displays correctly | On Add page | Unique title | Enter title, Save, View | Title matches on View/List (List column "Policy Name") | P1 | Yes | No | Yes |
| TC-LPM-REG-03 | Leave Policy Master | Annual Entitlement | Annual Entitlement still saves and displays correctly | On Add page | `12` | Enter 12, Save, View | Value 12 shown on View | P2 | Yes | No | Yes |
| TC-LPM-REG-04 | Leave Policy Master | Accrual Type | Accrual Type still saves and displays correctly | On Add page | Any valid Accrual Type option | Select, Save, View | Value matches on View | P2 | Yes | No | Yes |
| TC-LPM-REG-05 | Leave Policy Master | Effective Date | Effective From accepts a past date (not just future) | On Add page | Yesterday's date | Enter a past date, Save | Accepted — no "future only" restriction exists | P1 | Yes | No | Yes |
| TC-LPM-REG-06 | Leave Policy Master | Effective Date | Effective From accepts today's date | On Add page | Today | Enter today, Save | Accepted | P2 | Yes | No | Yes |
| TC-LPM-REG-07 | Leave Policy Master | Status | Status chip correctly reflects Active vs Inactive vs Draft | Three records in each state | — | Load list | Each row's chip matches its actual `is_draft`/`is_active` combination | P1 | Yes | No | Yes |
| TC-LPM-REG-08 | Leave Policy Master | Eligibility Rules | A saved Eligibility Rule with conditions round-trips through Edit | Record with 1 rule, 1 condition | — | Save, reopen Edit | Rule and its condition(s) pre-populate identically | P1 | Yes | No | Yes |
| TC-LPM-REG-09 | Leave Policy Master | Carry Forward | Carry Forward toggle and its sub-fields round-trip through Edit | Record with Carry Forward enabled + days set | — | Save, reopen Edit | Checkbox and days value both pre-populate correctly | P1 | Yes | No | Yes |
| TC-LPM-REG-10 | Leave Policy Master | Encashment | Encashment toggle and its sub-fields round-trip through Edit | Record with Encashment enabled + formula set | — | Save, reopen Edit | Checkbox and formula/value fields pre-populate correctly | P1 | Yes | No | Yes |
| TC-LPM-REG-11 | Leave Policy Master | Save Draft | Save To Draft continues to work after unrelated form changes elsewhere in the app | Existing regression baseline | — | Run the full Draft flow (TC-LPM-F-10) | Still passes | P1 | Yes | No | Yes |
| TC-LPM-REG-12 | Leave Policy Master | Save | Final Save continues to work | Existing regression baseline | — | Run TC-LPM-F-04 | Still passes | P0 | Yes | Yes | Yes |
| TC-LPM-REG-13 | Leave Policy Master | View | View continues to render correctly | Existing regression baseline | — | Run TC-LPM-F-09 | Still passes | P0 | Yes | No | Yes |
| TC-LPM-REG-14 | Leave Policy Master | Edit | Edit continues to preload and save correctly | Existing regression baseline | — | Run TC-LPM-EDIT-01 through 05 | Still passes | P0 | Yes | No | Yes |
| TC-LPM-REG-15 | Leave Policy Master | Listing | Listing page continues to search/sort/paginate correctly | Existing regression baseline | — | Run standard Listing Page suite (search/sort/paginate/row-menu) | Still passes | P0 | Yes | Yes | Yes |

## 13. Edge Cases

| TC ID | Module | Feature | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority | Automation | Smoke | Regression |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-LPM-EDGE-01 | Leave Policy Master | Rapid switching | Rapidly changing Company multiple times in quick succession | On Add page | Company A, B, C in quick succession | Select A, immediately B, immediately C | Final state reflects only Company C and its Location/Department options; no race condition leaves stale Company A/B data selected | P1 | Yes | No | No |
| TC-LPM-EDGE-02 | Leave Policy Master | Double-click | Double-clicking a Company option in the dropdown | On Add page | Company A | Double-click the option | Behaves identically to a single click - selects once, doesn't toggle or error | P3 | Yes | No | No |
| TC-LPM-EDGE-03 | Leave Policy Master | Browser refresh | Refreshing mid-Add loses unsaved data (expected) but doesn't crash | On Add page, fields filled | — | Fill form, refresh | Page reloads to a blank Add form; no leftover partial/corrupted state | P2 | Yes | No | No |
| TC-LPM-EDGE-04 | Leave Policy Master | Browser refresh | Refreshing the Edit page reloads the same record correctly | On Edit page for record X | — | Refresh | Same record's data reloads correctly, not a different record or a blank form | P2 | Yes | No | No |
| TC-LPM-EDGE-05 | Leave Policy Master | Back navigation | Browser Back from View returns to the List with prior search/filter state intact | List searched, then View opened | Search term applied | Search, open View, click Back | List still shows the filtered results, not a full reset | P2 | Yes | No | No |
| TC-LPM-EDGE-06 | Leave Policy Master | Concurrent users | Two sessions editing the same record simultaneously | Two authenticated sessions | Same record | Both open Edit, both change different fields, both Save | Document actual behavior (last-write-wins vs. conflict error) - no optimistic-locking mechanism was found in the reviewed use-cases; verify live | P2 | Manual first | No | No |
| TC-LPM-EDGE-07 | Leave Policy Master | Session timeout | Session expires while the Add form is open | Long-idle session | — | Idle past session expiry, attempt Save | `BasePage`'s 401/403 fast-fail should surface an auth failure rather than a confusing generic error | P2 | Yes | No | No |
| TC-LPM-EDGE-08 | Leave Policy Master | Refresh after Save Draft | Refreshing immediately after Save To Draft still shows the Draft in the list | Just saved as Draft | — | Save To Draft, refresh the list page | Draft record still appears with the Draft status chip | P2 | Yes | No | No |
| TC-LPM-EDGE-09 | Leave Policy Master | Edit after Save | Editing a record immediately after its initial Save works without a stale-cache issue | Just saved a new record | — | Save, immediately open Edit on the new record | Edit form loads the just-saved values correctly, not a cached pre-save state | P1 | Yes | No | Yes |
| TC-LPM-EDGE-10 | Leave Policy Master | Delete dependent master data | The selected Location is deleted from the backend after this policy referenced it | Record saved with Location A1; Location A1 later deleted elsewhere | — | Reopen View/Edit on the policy | Document actual behavior (blank Location field vs. an error) - not confirmed from source, verify live | P2 | Manual first | No | No |
| TC-LPM-EDGE-11 | Leave Policy Master | Inactive Company | A Company marked Inactive still appears (or doesn't) in the dropdown | Company A set Inactive elsewhere | — | Open Company dropdown | Confirm live whether inactive Companies are filtered out of this dropdown's API query or still listed | P2 | Manual first | No | No |
| TC-LPM-EDGE-12 | Leave Policy Master | Inactive Location/Department | An inactive Location/Department under an active Company | Location A1 set Inactive | Company A selected | Open Location dropdown | Confirm live whether inactive Locations are excluded or shown (possibly greyed out) | P2 | Manual first | No | No |

## 14. Test Data Matrix

Reusable, named test-data fixtures this suite's `config/testData.js` should define under a new `leavePolicyMaster` key (following this repo's existing shape: free text via `testDataFactory`, FK references pinned to real live-verified master data — see `memory.md`'s "Why the config looks the way it does" and the `procurementRequest`/`bin` entries in `testData.js` for the established pattern).

| Fixture | Description | Notes |
|---|---|---|
| Company A | A real Company with ≥1 Location and ≥1 Department | Reuse `"erp-force"`, already pinned elsewhere in this repo, if it has both |
| Company B | A second real, distinct Company for switch/clear tests | Needed for TC-LPM-DEP-03/04/09, TC-LPM-EDIT-04 |
| Company with no Locations | Real Company confirmed to have zero Location records | Needed for TC-LPM-DD-09, TC-LPM-BND-08 — must be identified live, don't fabricate |
| Company with no Departments | Real Company confirmed to have zero Department records | Needed for TC-LPM-DD-10, TC-LPM-BND-11 |
| Company with multiple Locations | Real Company with 10+ Locations | Needed for TC-LPM-BND-07 |
| Company with multiple Departments | Real Company with 10+ Departments | Needed for TC-LPM-BND-10 |
| Location A | A Location under Company A | Used across Add/Edit/View cases |
| Location B | A second Location under Company A (for TC-LPM-EDIT-05) | Must belong to the SAME company as Location A |
| Department A | A Department under Company A | Used across Add/Edit/View cases |
| Department B | A second Department under Company A | Optional, for extra edit-integrity coverage |
| Valid combination | Company A + Location A + Department A (all same company) | The default "happy path" fixture |
| Invalid combination | Company A + a Location/Department belonging to Company B | Only reachable via direct API call, not through the UI dropdowns (which are pre-filtered) — see TC-LPM-VAL-08 |

**Before implementing in Playwright:** none of the "Company/Location/Department with N records" fixtures above can be safely hardcoded — they must be identified against the actual live/dev environment first (same discipline `testData.js` already applies to `procurementRequest.valid.location`/`vendor`), otherwise these fixtures will silently rot as the shared dataset changes.

---

## Coverage summary

| Section | Test Case Count |
|---|---|
| 1. Functional | 19 |
| 2. Dropdown | 17 |
| 3. Dependency | 9 |
| 4. Validation | 22 |
| 5. Negative | 11 |
| 6. Boundary | 11 |
| 7. Edit | 6 |
| 8. View | 5 |
| 9. API Validation | 7 |
| 10. UI | 8 |
| 11. Accessibility | 5 |
| 12. Regression | 15 |
| 13. Edge Cases | 12 |
| **Total** | **147** |

## Notes on Priority/Automation columns

- **Priority** (P0–P3) reflects business risk if broken, not implementation difficulty — every Company→Location/Department dependency case is P0/P1 because it's this task's explicit "Feature Under Test."
- **Automation = "Manual first"** marks cases where the expected result genuinely couldn't be confirmed from source (cross-company FK enforcement, inactive-record filtering, concurrent-edit conflict handling, Company's own "create new" footer, dropdown caching). Automating an assertion for these without a live check first risks encoding a guess as a "confirmed" test, the same mistake already corrected earlier in this suite (Organization Structure, Document Master) — verify against the running app, then automate.
- All other cases are marked **Automation = Yes** because their expected behavior is confirmed directly from `erpforce-hrms-fe`/`erpforce-be` source, not inferred.
