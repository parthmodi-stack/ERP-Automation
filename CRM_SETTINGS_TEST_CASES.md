# CRM → Settings — Test Case Suite

Scope: `Shipping Rule`, `Promotions`, `Customer Segments`, `Delivery Settings` (the first four
entries under the CRM module's Settings gear menu). `Terms & Conditions`, `Forms`, and
`Template Editor` are intentionally out of scope for this file.

Module path: CRM → Settings (`modules/crm/src/constants/sidebar.crm.ts`, `PathnameCrm.SETTINGS/*`)

Source verified against `erpforce-fe/modules/crm/src/views/settings/{shipping-rules,promotions,
customer-segments,delivery-settings}/` (add/edit/view components, inline Yup schemas,
`promotions/utils/validation.ts`) before writing any case below.

**Approval workflow: present in the data layer, dead in the UI for all three CRUD modules.**
Shipping Rule, Promotions, and Customer Segments all carry real Draft → Submitted →
Quick Approval → Accept/Reject plumbing (redux actions `addApprover`/`updateXStatus`, a shared
`QuickApprovalModal` component, `status` values of `Draft`/`Submitted`/`Approved`/`Rejected`) — but
the View page's own UI never lets a user actually reach that flow, confirmed separately per
module:
- **Shipping Rule** (`view-shippment-rules.tsx:403-406`): the entire Submit `<Button>` is commented
  out of the JSX. It does not render at all.
- **Customer Segments** (`view-customer-segment.tsx:366-372`): the Submit button renders, but its
  `onClick` is `(e) => console.log('Submit Clicked')` — a literal no-op. `setOpenQuickApprovalModal`
  is never called anywhere else in the file, so the Quick Approval modal it renders is unreachable.
- **Promotions** (`view-promotion.tsx`): same as Customer Segments — `setOpenQuickApprovalModal`
  is never invoked anywhere in the file (confirmed by grep across the whole component), so its
  Quick Approval modal is likewise dead code from the UI's perspective.

Practical effect: a record saved via "Save To Draft" can never be moved to Submitted/Approved
through the UI in any of these three modules. `DEFAULT_TEST_CASES.md`'s Approval Flow section
(TC04/TC05/TC016/TC017) does not apply as a *working* path — instead, each module below gets one
"Save To Draft" positive case and one confirmed-bug case documenting the broken Submit trigger.
Delivery Settings has no draft/approval concept of any kind (single flat record, no `status` field
at all).

## Corrections / confirmed source facts (read before using these tables)

- **Shipping Rule** has a real Yup schema: `name`, `company_id`, `shipping_cost`, `handling_cost`,
  `shipping_account_id`, `handling_account_id` are all `.required()`. Neither cost field has a
  `.min(0)` — negative/zero values are not blocked by schema.
- **Confirmed copy-paste bug**: `edit-shippment-rules.tsx:43` sets
  `company_id.typeError('Name is required')` — the wrong message for that field. This is a real,
  reproducible defect, not a guess.
- **`location_id` cascades off `company_id`** at the UI level (option list re-fetches/filters when
  Company changes) — this is UI-driven, not schema-enforced.
- **Promotions** is the most complex screen here: one main form (three `type` variants: Fixed
  Amount / Percentage / Buy X Get Y) plus two nested modals (Add Coupon, Add Reward). The reward
  modal itself swaps its entire field set based on the parent promotion's `type`.
  `promotions/utils/validation.ts` has real conditional (`.when()`) rules: `limit_usage_count` is
  only required (and `min(1)`) when `limit_usage` is checked; `end_date` must be
  `>= start_date`. Changing `type` after rewards already exist triggers a confirm dialog that
  clears the rewards table if accepted. **Confirmed live**: `type` defaults to "Fixed Amount" on a
  fresh Add page (same pre-fill pattern as Entity) — its own required-error case is unreachable.
  **Confirmed bug**: saving a coupon on an existing (Edit-mode) promotion persists it server-side,
  but the "Create Coupon"/"Edit Coupon" trigger label never updates to reflect that, since the
  modal's `onSave` callback passes `null` in Edit mode instead of the saved coupon data — only the
  separate "View Coupon" link (driven by the refetched record) confirms it actually saved. The
  reward modal's "Products"/`item_id` field (Buy X Get Y) is a checkbox-list multiselect widget, a
  different UI pattern from the option-role listbox used by every other dropdown in this suite.
- **Customer Segments** only schema-validates `name`, `company_id`, and `start_date`. `end_date`,
  `purchase_amount`, `purchase_count`, and `segment_duration` have **no Yup rule** — they are
  gated purely at the UI level by the `autoassign` checkbox. A `status`/`is_active` field exists in
  `customer-segments/types.ts` but `DynamicToggleButton` is imported and never rendered in
  `form.tsx` — there is currently no Active/Inactive toggle exposed in this module's UI, so no test
  case below assumes one exists.
- **Confirmed i18n bug on Delivery Settings, independent of the approval-flow findings above**:
  `quote_percentage` calls a `t()` key (`crm.settings.quote_percentage_label`) that does not exist
  anywhere in `en.ts`, and the i18n config's `missingKeyNoValueFallbackToKey` is `true`, so it
  renders the **literal raw key string** as both its label and its placeholder instead of
  human-readable text. This is the same class of defect as the `common.terms_and_conditions`
  raw-key finding from the original scoping conversation, confirmed here in a second, unrelated
  module. (A source-only reading first flagged `enable_rate_below_cost` as broken the same way too
  — live verification during automation showed it now correctly renders "Enable Rate Below Cost",
  so a matching `en.ts` key must have been added since; only `quote_percentage` is still broken.)
- **Delivery Settings is not a list/CRUD screen at all.** It is a single global settings record
  (`delivery-settiing.tsx` — filename typo confirmed in source, not a transcription error here)
  with four checkboxes (`allow_delivery_from_multiple_locations`, `invoice_in_advance`,
  `require_quotation_for_sales_order`, `enable_rate_below_cost`) and one numeric field
  (`quote_percentage`). `useForm` is initialized **with no resolver at all** — there is zero
  schema-level validation on this screen. Every "negative" case for this module is a gap-finding
  probe (does the app currently guard against bad input), not a confirmation of an existing error
  message. There is no Add/Delete/Search/Sort/Pagination for this module since there is only ever
  one record.

---

## 1. Shipping Rule

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SHIP-01 | Shipping Rule | Create | Create a rule with all required fields | On Add page | Fill name, company, location, shipping/handling cost, shipping/handling account; Save | Valid values for all required fields | Record saved; appears in list; `is_active` defaults to true | P0 | High | Functional | Yes |
| TC-SHIP-02 | Shipping Rule | Create | Location dropdown loads options scoped to selected Company | On Add page, Company empty | Select a Company, open Location dropdown | — | Location enabled; options filtered to the selected Company | P0 | High | Dependency | Yes |
| TC-SHIP-03 | Shipping Rule | Create | Changing Company clears a previously selected Location | Company A + Location A1 selected | Change Company to B | — | Location resets to empty | P0 | High | Dependency | Yes |
| TC-SHIP-04 | Shipping Rule | Edit | Edit an existing rule and persist changes | Existing rule | Open Edit, change fields, Save | — | Updated values persist and reload correctly | P0 | High | Functional | Yes |
| TC-SHIP-05 | Shipping Rule | View | View page displays all saved fields correctly | Existing rule with narration + attachment | Open View | — | Name, company, location, both costs, both accounts, narration, attachment all render correctly | P0 | High | Functional | Yes |
| TC-SHIP-06 | Shipping Rule | Edit | Auto-filled Edit fields match the View page | Existing rule | Open Edit, compare to View | — | Every field pre-populates identically to View | P1 | Medium | Functional | Yes |
| TC-SHIP-07 | Shipping Rule | Edit | `id` field stays read-only | On Add/Edit page | Inspect `id` field | — | Disabled input, not editable | P1 | Low | UI | Yes |
| TC-SHIP-08 | Shipping Rule | Edit | Editing a single field updates only that field | Existing rule | Change `shipping_cost` only, Save | — | Only `shipping_cost` updates; all other fields unchanged | P0 | High | Functional | Yes |
| TC-SHIP-09 | Shipping Rule | Status | Toggling `is_active` to Inactive persists | Existing Active rule | Toggle Active off, Save | — | List reflects Inactive status | P1 | Medium | Functional | Yes |
| TC-SHIP-10 | Shipping Rule | Delete | Delete a rule successfully | Existing rule | Confirm Delete | — | Record removed from list; reopening it fails | P0 | High | Functional | Yes |
| TC-SHIP-11 | Shipping Rule | Delete | Related master data intact after delete | Rule referencing Company/Account X | Delete the rule | — | Company/Account X remains usable when creating a new rule | P1 | Medium | Functional | Yes |
| TC-SHIP-12 | Shipping Rule | Listing | Search/filter the list | Multiple rules exist | Search by name | — | Matching rows returned; a non-matching search shows the shared "No Data" state | P1 | Medium | Functional | Yes |
| TC-SHIP-13 | Shipping Rule | Listing | Column sort toggles correctly | Multiple rules exist | Click a sortable column header twice | — | `aria-sort` cycles none → ascending → descending | P1 | Low | Functional | Yes |
| TC-SHIP-14 | Shipping Rule | Listing | Pagination controls work | 20+ rules exist | Use Prev/Next and "Go To" | — | Navigation stays in sync with "Page X of Y" | P2 | Low | Functional | Yes |
| TC-SHIP-15 | Shipping Rule | Save To Draft | Save a rule as Draft | On Add page | Fill required fields, click Save To Draft | — | Record saved with `status: 'Draft'`; list shows Draft | P0 | High | Functional | Yes |
| TC-SHIP-V01 | Shipping Rule | Validation | Each required field left empty blocks Save | On Add page | Leave `name` empty, Save; repeat individually for `company_id`, `shipping_cost`, `handling_cost`, `shipping_account_id`, `handling_account_id` | — | Inline required error per field; record not created | P0 | High | Validation | Yes |
| TC-SHIP-V02 | Shipping Rule | Validation | Non-numeric input in cost fields rejected | On Add page | Type letters into `shipping_cost`/`handling_cost` | `"abc"` | Format error shown; Save blocked | P1 | Medium | Validation | Yes |
| TC-SHIP-V03 | Shipping Rule | Validation | Zero/negative cost values — no schema bound exists | On Add page | Enter `0` and `-50` into `shipping_cost`/`handling_cost`, Save | `0`, `-50` | No Yup `.min(0)` found — verify live whether these are accepted (likely gap) | P2 | Medium | Negative | Manual first |
| TC-SHIP-V04 | Shipping Rule | Validation | Correcting an invalid field clears its error | Required-field error showing | Fill in the empty field | — | Inline error clears without resubmitting the whole form | P1 | Low | Validation | Yes |
| TC-SHIP-V05 | Shipping Rule | Validation | Bug repro — wrong error message on `company_id` | On Edit page, `company_id` left invalid | Trigger the field's type error | — | Confirmed bug (`edit-shippment-rules.tsx:43`): shows "Name is required" instead of a company-specific message | P1 | Medium | Negative | Yes |
| TC-SHIP-V06 | Shipping Rule | Validation | Location dropdown for a Company with zero Locations | Company with no Locations | Select that Company, open Location dropdown | — | Empty/no-data dropdown state, not an error or crash | P2 | Low | Boundary | Yes |
| TC-SHIP-V07 | Shipping Rule | Approval | Bug repro — Submit button does not exist on View | Existing Draft rule | Open View | — | Confirmed bug (`view-shippment-rules.tsx:403-406`): the Submit button is commented out of the JSX entirely; a Draft rule can never be moved to Submitted via UI | P1 | High | Negative | Yes |

## 2. Promotions

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-PROMO-01 | Promotions | Create | Create a Fixed Amount promotion | On Add page | Select type=Fixed Amount, fill required fields, Save | — | Record saved with type Fixed Amount | P0 | High | Functional | Yes |
| TC-PROMO-02 | Promotions | Create | Create a Percentage promotion | On Add page | Select type=Percentage, fill required fields, Save | — | Record saved with type Percentage | P0 | High | Functional | Yes |
| TC-PROMO-03 | Promotions | Create | Create a Buy X Get Y promotion | On Add page | Select type=Buy X Get Y, fill required fields, Save | — | Record saved with type Buy X Get Y | P0 | High | Functional | Yes |
| TC-PROMO-04 | Promotions | Edit | Edit an existing promotion and persist changes | Existing promotion | Open Edit, change fields, Save | — | Updated values persist and reload correctly | P0 | High | Functional | Yes |
| TC-PROMO-05 | Promotions | View | View page displays all saved fields correctly | Existing promotion | Open View | — | Name, type, dates, company, account, narration, attachment all render correctly | P0 | High | Functional | Yes |
| TC-PROMO-06 | Promotions | Edit | `type` becomes disabled once rewards exist | Promotion with 1+ reward added | Open Edit | — | `type` dropdown is disabled | P1 | Medium | Functional | Yes |
| TC-PROMO-07 | Promotions | Edit | Changing `type` after rewards exist prompts confirm and clears rewards | Promotion with rewards, Edit open | Change `type`, confirm the dialog | — | Confirm dialog appears; accepting clears the existing rewards table | P1 | High | Functional | Yes |
| TC-PROMO-08 | Promotions | Create | `limit_usage` checkbox gates `limit_usage_count` | On Add page | Toggle `limit_usage` on/off | — | `limit_usage_count` input enables only when checked | P1 | Medium | Functional | Yes |
| TC-PROMO-09 | Promotions | Coupon | Add a coupon via Add-Coupon-Modal on an existing (Edit-mode) promotion | Promotion created, modal open | Fill `couponFormat`, `characterLimit`, `numberOfCoupons`, Save | Valid values | Coupon persists server-side, confirmed via the "View Coupon" link on reopening Edit — but a confirmed bug means the "Create Coupon"/"Edit Coupon" trigger label itself never updates in Edit mode (`onSave(mode === 'add' ? vals : null)` resets local `couponData` to `null`) | P0 | High | Functional | Yes |
| TC-PROMO-10 | Promotions | Coupon | `limitUsage` checkbox gates `usageLimit` | Coupon modal open | Toggle `limitUsage` on/off | — | `usageLimit` input enables only when checked | P1 | Medium | Functional | Yes |
| TC-PROMO-11 | Promotions | Reward | Add Fixed Amount reward, condition=Item | Fixed Amount promotion, reward modal open | Select condition_type=Item, check `min_quantity_cb`, fill `minimum_quantity`, `discount_value`, Save | — | Reward saved; `minimum_quantity` required and enforced | P0 | High | Functional | Yes |
| TC-PROMO-12 | Promotions | Reward | Add Fixed Amount reward, condition=Order | Fixed Amount promotion, reward modal open | Select condition_type=Order, fill `order_total`, `discount_value`, Save | — | Reward saved; `order_total` shown/required instead of `minimum_quantity` | P0 | High | Functional | Yes |
| TC-PROMO-13 | Promotions | Reward | Add Percentage reward within valid range | Percentage promotion, reward modal open | Fill `discount_percentage` (e.g. 25), Save | `25` | Reward saved with 25% discount | P0 | High | Functional | Yes |
| TC-PROMO-14 | Promotions | Reward | Add Buy X Get Y reward | Buy X Get Y promotion, reward modal open | Fill `condition_name`, `minimum_quantity`, Product, Rewarding Product, `reward_quantity`, Save | — | Reward saved with all fields persisted | P0 | High | Functional | Yes |
| TC-PROMO-15 | Promotions | Reward | `condition_type` toggle swaps required fields | Reward modal open (Fixed or Percentage) | Switch condition_type Item ↔ Order | — | Field set swaps correctly (`minimum_quantity` vs `order_total`) each time | P1 | Medium | Functional | Yes |
| TC-PROMO-16 | Promotions | Delete | Delete a promotion | Existing promotion | Confirm Delete | — | Record removed from list | P0 | High | Functional | Yes |
| TC-PROMO-17 | Promotions | Create | `end_date` constrained to be on/after `start_date` | On Add page | Pick a `start_date`, then open `end_date` picker | — | Dates before `start_date` are not selectable / are rejected | P1 | Medium | Validation | Yes |
| TC-PROMO-18 | Promotions | Listing | Search/sort/paginate/row-action-menu behave correctly | Multiple promotions exist | Search, sort a column, paginate, open row menu | — | All four behave per the shared listing conventions | P1 | Medium | Functional | Yes |
| TC-PROMO-19 | Promotions | Save To Draft | Save a promotion as Draft | On Add page | Fill required fields, click Save To Draft | — | Record saved with `status: 'Draft'`; list shows Draft | P0 | High | Functional | Yes |
| TC-PROMO-V01 | Promotions | Validation | Required main-form fields left empty block Save | On Add page | Leave `name` empty, Save; repeat for `type`, `start_date`, `company_id`, `account_id` | — | Inline required error per field; record not created | P0 | High | Validation | Yes |
| TC-PROMO-V02 | Promotions | Validation | `end_date` before `start_date` rejected | On Add page | Set `end_date` earlier than `start_date`, Save | — | Blocked by Yup `.min(Yup.ref('start_date'))` | P1 | Medium | Negative | Yes |
| TC-PROMO-V03 | Promotions | Validation | `limit_usage_count` required/min(1) only when `limit_usage` checked | On Add page | Check `limit_usage`, leave count empty or `0`, Save | `0`, empty | Blocked when checked; no error when unchecked (field cleared) | P1 | Medium | Negative | Yes |
| TC-PROMO-V04 | Promotions | Validation | Coupon modal numeric fields rejected when invalid | Coupon modal open | Enter non-numeric or `0`/negative into `characterLimit`/`numberOfCoupons`, Save | `"abc"`, `0` | Blocked with inline error | P1 | Medium | Validation | Yes |
| TC-PROMO-V05 | Promotions | Validation | Reward Fixed/Percentage numeric bounds enforced | Reward modal open | Enter negative `discount_value`; enter `discount_percentage` of `150`, Save | `-10`, `150` | Both rejected — `discount_value` must be ≥0, `discount_percentage` must be 0–100 | P1 | High | Negative | Yes |
| TC-PROMO-V06 | Promotions | Validation | Reward Buy X Get Y required fields enforced | Reward modal open (Buy X Get Y) | Leave Product empty or `reward_quantity` at `0`, Save | `0` | Blocked — Product requires min 1 selection, `reward_quantity` requires min 1 | P1 | Medium | Negative | Yes |
| TC-PROMO-V07 | Promotions | Validation | Correcting an invalid field clears its error | `discount_percentage` showing error at 150 | Change value to 50 | `50` | Inline error clears without resubmitting the whole form | P1 | Low | Validation | Yes |
| TC-PROMO-V08 | Promotions | Approval | Bug repro — Quick Approval modal is never triggered | Existing Draft promotion | Open View, inspect Submit/approval controls | — | Confirmed bug (`view-promotion.tsx`): `setOpenQuickApprovalModal(true)` is never called anywhere in the file — the rendered `QuickApprovalModal` is unreachable via any UI action | P1 | High | Negative | Yes |

## 3. Customer Segments

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-CSEG-01 | Customer Segments | Create | Create a segment with required fields | On Add page | Fill `name`, `company_id`, `start_date`, Save | — | Record saved and appears in list | P0 | High | Functional | Yes |
| TC-CSEG-02 | Customer Segments | Edit | Edit an existing segment and persist changes | Existing segment | Open Edit, change fields, Save | — | Updated values persist and reload correctly | P0 | High | Functional | Yes |
| TC-CSEG-03 | Customer Segments | View | View page displays all saved fields correctly | Existing segment with narration + attachment | Open View | — | All fields render correctly | P0 | High | Functional | Yes |
| TC-CSEG-04 | Customer Segments | Create | `autoassign` checkbox gates dependent fields | On Add page | Toggle `autoassign` on/off | — | `purchase_amount`, `purchase_count`, `segment_duration` enable only when checked | P1 | Medium | Functional | Yes |
| TC-CSEG-05 | Customer Segments | Create | `autoassign` unchecked excludes dependent fields from payload | On Add page, `autoassign` unchecked | Save | — | `purchase_amount`/`purchase_count`/`segment_duration` are not sent/saved | P1 | Medium | Functional | Yes |
| TC-CSEG-06 | Customer Segments | Create | `autoassign` checked derives segment start/end from `segment_duration` | On Add page, `autoassign` checked | Pick a `segment_duration` range, Save | — | Saved `segment_start_date`/`segment_end_date` match the picked range | P1 | Medium | Functional | Yes |
| TC-CSEG-07 | Customer Segments | Edit | Editing a single field updates only that field | Existing segment | Change `name` only, Save | — | Only `name` updates; other fields unchanged | P0 | High | Functional | Yes |
| TC-CSEG-08 | Customer Segments | Edit | Auto-filled Edit fields match the View page | Existing segment | Open Edit, compare to View | — | Every field pre-populates identically to View | P1 | Medium | Functional | Yes |
| TC-CSEG-09 | Customer Segments | Edit | `id` field stays read-only | On Add/Edit page | Inspect `id` field | — | Disabled input, not editable | P1 | Low | UI | Yes |
| TC-CSEG-10 | Customer Segments | Delete | Delete a segment successfully | Existing segment | Confirm Delete | — | Record removed from list; reopening it fails | P0 | High | Functional | Yes |
| TC-CSEG-11 | Customer Segments | Delete | Related master data intact after delete | Segment referencing Company X | Delete the segment | — | Company X remains usable when creating a new segment | P1 | Medium | Functional | Yes |
| TC-CSEG-12 | Customer Segments | Listing | Search/sort/row-action-menu behave correctly | Multiple segments exist | Search, sort a column, open row menu | — | All three behave per the shared listing conventions | P1 | Medium | Functional | Yes |
| TC-CSEG-13 | Customer Segments | Listing | Pagination controls work | 20+ segments exist | Use Prev/Next and "Go To" | — | Navigation stays in sync with "Page X of Y" | P2 | Low | Functional | Yes |
| TC-CSEG-14 | Customer Segments | Save To Draft | Save a segment as Draft | On Add page | Fill required fields, click Save To Draft | — | Record saved with `status: 'Draft'`; list shows Draft | P0 | High | Functional | Yes |
| TC-CSEG-V01 | Customer Segments | Validation | Required fields left empty block Save | On Add page | Leave `name` empty, Save; repeat for `company_id`, `start_date` | — | Inline required error per field; record not created | P0 | High | Validation | Yes |
| TC-CSEG-V02 | Customer Segments | Validation | `end_date` before `start_date` — no schema rule exists | On Add page | Set `end_date` earlier than `start_date`, Save | — | No Yup rule found — verify live whether this is silently accepted (likely gap) | P2 | Medium | Negative | Manual first |
| TC-CSEG-V03 | Customer Segments | Validation | Non-numeric `purchase_amount`/`purchase_count` while `autoassign` checked | On Add page, `autoassign` checked | Enter letters into `purchase_amount`/`purchase_count`, Save | `"abc"` | No Yup rule found — verify live behavior (likely gap) | P2 | Medium | Negative | Manual first |
| TC-CSEG-V04 | Customer Segments | Validation | Correcting an empty required field clears its error | Required-field error showing | Fill in the empty field | — | Inline error clears without resubmitting the whole form | P1 | Low | Validation | Yes |
| TC-CSEG-V05 | Customer Segments | Approval | Bug repro — Submit button is a no-op | Existing Draft segment | Open View, click Submit | — | Confirmed bug (`view-customer-segment.tsx:366-372`): `onClick={(e) => console.log('Submit Clicked')}` — no request fires, no status change, no modal opens | P1 | High | Negative | Yes |

## 4. Delivery Settings

Single global settings record — no Add/Delete/Search/Sort/Pagination applies. `useForm` has no
resolver at all, so every negative case here is a gap-finding probe, not a confirmation of an
existing guardrail.

| TC ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority | Severity | Test Type | Automation Candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-DLVS-01 | Delivery Settings | Save | Toggle each checkbox and persist | On settings page | Toggle `allow_delivery_from_multiple_locations`, `invoice_in_advance`, `require_quotation_for_sales_order`, `enable_rate_below_cost` individually, Save each, reload | — | Each toggle's saved state persists correctly after reload | P0 | High | Functional | Yes |
| TC-DLVS-02 | Delivery Settings | Save | Update `quote_percentage` and persist | On settings page | Enter a valid number (e.g. 15), Save, reload | `15` | Value persists after reload | P0 | High | Functional | Yes |
| TC-DLVS-03 | Delivery Settings | Permission | Save gated by `canEdit` | User without `canEdit` | Load settings page | — | Save control disabled/hidden | P0 | High | RBAC | Yes |
| TC-DLVS-04 | Delivery Settings | Reload | Reopening the page always shows last-saved values | Settings just saved | Reload the page | — | Displayed values match the last Save, no stale cache | P1 | Medium | Functional | Yes |
| TC-DLVS-V01 | Delivery Settings | Validation | Non-numeric `quote_percentage` — no schema exists | On settings page | Enter letters into `quote_percentage`, Save | `"abc"` | No resolver found — verify live whether this is blocked or silently coerced to `null` (likely gap) | P2 | Medium | Negative | Manual first |
| TC-DLVS-V02 | Delivery Settings | Validation | Negative `quote_percentage` — no lower bound exists | On settings page | Enter `-10` into `quote_percentage`, Save | `-10` | No `.min(0)` found — verify live whether this is accepted (likely gap) | P2 | Medium | Negative | Manual first |
| TC-DLVS-V03 | Delivery Settings | Validation | `quote_percentage` above 100 — no upper bound exists | On settings page | Enter `150` into `quote_percentage`, Save | `150` | No `.max(100)` found — verify live whether this is accepted (likely gap) | P2 | Medium | Negative | Manual first |
| TC-DLVS-V04 | Delivery Settings | Save | Rapid double-click Save on the single record | On settings page, valid data | Double-click Save quickly | — | No duplicate/conflicting PATCH requests; final state consistent | P2 | Medium | Negative | Yes |
| TC-DLVS-V05 | Delivery Settings | Validation | Bug repro — quote_percentage renders a raw i18n key | On settings page | Inspect the numeric field's label and placeholder | — | Confirmed live: no `en.ts` key exists for `crm.settings.quote_percentage_label` — both label and placeholder render the literal key string instead of readable text | P1 | Medium | Negative | Yes |

---

## Totals

| Module | Positive | Negative | Total |
|---|---|---|---|
| Shipping Rule | 15 | 7 | 22 |
| Promotions | 19 | 8 | 27 |
| Customer Segments | 14 | 5 | 19 |
| Delivery Settings | 4 | 5 | 9 |
| **Grand Total** | **52** | **25** | **77** |

## Next steps

Cases marked **Manual first** rely on confirming live app behavior against a screen with no
schema-level validation (Delivery Settings' three negative cases, Customer Segments' two, Shipping
Rule's one) — verify these against `dev.erpforce.co` before automating, since the expected result
is "confirm what actually happens," not a known pass/fail. Once confirmed, convert this checklist
into Playwright specs following `SKILLS.md`'s conventions (`pages/<Module>Page.js` extending
`BasePage.js` for its listing/dropdown/delete helpers). Shipping Rule, Promotions, and Customer
Segments each get a "Save To Draft" positive case and a confirmed-bug case documenting the broken
Submit trigger, but none of `BasePage.js`'s Quick Approval/Accept/Reject helpers are exercisable
end-to-end here, since that whole path is unreachable from the UI in all three modules (see the
confirmed findings above). Delivery Settings alone has no draft/status concept of any kind.
