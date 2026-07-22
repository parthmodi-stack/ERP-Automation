---
name: qa-playwright-test-creator
description: Guidelines, standard patterns, and step-by-step workflow for writing Playwright E2E test specs and Page Objects in ERP-Automation.
---

# Skill: QA Playwright Test Creator (`qa-playwright-test-creator`)

## Overview
This skill provides instructions for creating, extending, and refactoring Playwright E2E automation tests and Page Object Models (POM) within the `ERP-Automation` repository.

## Step-by-Step Implementation Workflow

### Step 1: Module Classification & Architecture Choice
Determine the category of the target module:
1. **Document-Lifecycle Module** (Draft -> Submit -> Approve/Reject -> Delete):
   - Examples: Procurement Request, Purchase Agreement, Purchase Order, RFQ, Delivery Order, Vendor Return.
   - Page Object MUST extend `pages/BasePage.js`.
2. **Master Data Module** (CRUD / Simple Setup):
   - Examples: Location, Bin, UOM, Attribute, Discounted Item.
   - Page Object inherits basic Playwright `Page` methods or standalone pattern.

### Step 2: Page Object Model Creation (`pages/<Feature>Page.js`)
- Place in `pages/<Feature>Page.js`.
- Extend `BasePage` for document modules:
  ```javascript
  const BasePage = require('./BasePage');

  class FeaturePage extends BasePage {
    constructor(page) {
      super(page);
      // Define page-specific locators
    }

    async fillHeader(data) {
      // Use selectFieldByLabel or openDropdownAndPick for DynamicSelect comboboxes
    }

    async addItemRow(itemData) {
      // Add line item, wait for debounced calculations
      await this.waitForItemAmountsToSettle();
    }
  }

  module.exports = FeaturePage;
  ```

### Step 3: Test Data Management (`config/testData.js` & `config/testDataFactory.js`)
- **Master / Foreign Key Data**: Pin live-verified records in `config/testData.js`. Add comments explaining why specific items, locations, or approvers were selected.
- **Free-Text & Numeric Data**: Use `config/testDataFactory.js` for unique names (`Date.now()` suffix), reference numbers, narrations, and amounts.

### Step 4: Playwright Spec File Scaffolding (`tests/<module>/<NN>-<feature>.spec.js`)
- Naming convention: `tests/<module>/<NN>-<feature>.spec.js`.
- Pattern for Document Lifecycles:
  ```javascript
  const { test, expect } = require('@playwright/test');
  const FeaturePage = require('../../pages/FeaturePage');
  const testData = require('../../config/testData');

  test.describe.serial('Module Feature Suite', () => {
    test.describe.configure({ timeout: 150000 });

    let page;
    let featurePage;
    let seriesNumber;

    test.beforeAll(async ({ browser }) => {
      page = await browser.newPage();
      featurePage = new FeaturePage(page);
    });

    test.afterAll(async () => {
      await page.close();
    });

    test('TC-MODULE-01 [+] Create record as Draft', async () => {
      // 1. Navigate to Add page
      // 2. Fill form using POM
      // 3. Save as Draft
      // 4. Capture series number from response listener
    });

    test('TC-MODULE-02 [+] Edit Draft record', async () => {
      // Re-use seriesNumber from TC-MODULE-01
    });
  });
  ```

## Key Guidelines & Pitfalls to Avoid
1. **Auth Fast-Fail**: `BasePage.js` handles 401/403 responses automatically. Do not try to re-authenticate inside test cases if session drops; delete `auth.json` and re-run setup.
2. **Debounced Computations**: Always call `waitForItemAmountsToSettle()` after setting item quantities/rates before clicking Save.
3. **Dropdown Race Conditions**: Use `selectFieldByLabel` or `openDropdownAndPick` from `BasePage.js` which handles retries and Escape key resets.
4. **Table Selectors**: Match rows by series number text (`rowBySeriesNumber`), not by `getByRole('link')`.
