Path: /home/trootech/Documents/Project/Erpforce/ERP-Automation/CLAUDE.md
Path: /home/trootech/Documents/Project/Erpforce/ERP-Automation/DEFAULT_TEST_CASES.md
Path: /home/trootech/Documents/Project/Erpforce/ERP-Automation/.claude

tests-e2e/
├── playwright.config.ts
├── .env.example
├── src/
│ ├── data/test-data.ts
│ ├── fixtures/auth.fixture.ts
│ ├── pages/
│ │ ├── BasePage.ts
│ │ ├── LoginPage.ts
│ │ ├── AssetRequestPage.ts
│ │ ├── ApprovalDashboardPage.ts
│ │ ├── AssetAllocationPage.ts
│ │ ├── AssetTransferPage.ts
│ │ ├── MyAssetsPage.ts
│ │ └── DamageLossClaimPage.ts
│ └── utils/helpers.ts
└── tests/
├── 01-asset-request.spec.ts
├── 02-request-approval.spec.ts
├── 03-asset-allocation.spec.ts
├── 04-asset-transfer-acceptance.spec.ts
├── 05-asset-return.spec.ts
├── 06-repeat-request-flow.spec.ts
├── 07-damage-loss-request.spec.ts
├── 08-damage-loss-approval.spec.ts
└── 09-inter-user-transfer.spec.ts

src/data/test-data.ts

/\*_ Dynamic test-data generators so specs never collide on shared state. _/

export function uniqueSuffix(): string {
return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export function buildAssetRequestData(prefix = 'AutoAsset') {
const suffix = uniqueSuffix();
return {
assetName: `${prefix}-${suffix}`,
assetCategory: 'Customer Contracts', // must match a category that exists in the system
quantity: '1',
reason: `Automated E2E request created at ${new Date().toISOString()}`,
};
}

export function buildDamageLossData() {
const suffix = uniqueSuffix();
return {
condition: 'Damage' as const, // 'Damage' | 'Loss'
description: `Automated damage report ${suffix} - screen cracked during transit`,
};
}

export interface UserContext {
email: string;
password: string;
displayName: string;
}

export const REQUESTER: UserContext = {
email: process.env.REQUESTER_EMAIL ?? 'kashyap.jivani@trootech.com',
password: process.env.REQUESTER_PASSWORD ?? '',
displayName: 'kashyap jivani',
};

export const APPROVER: UserContext = {
email: process.env.APPROVER_EMAIL ?? '',
password: process.env.APPROVER_PASSWORD ?? '',
displayName: 'Dipen Modi',
};

export const SECOND_USER: UserContext = {
email: process.env.SECOND_USER_EMAIL ?? '',
password: process.env.SECOND_USER_PASSWORD ?? '',
displayName: 'Second Employee',
};

src/pages/AssetRequestPage.ts

import { Page, Locator, expect } from '@playwright/test';

/\*\*

- Common shell interactions: left sidebar navigation, header profile menu,
- generic grid helpers used by every Asset Management page object.
  \*/
  export class BasePage {
  constructor(protected readonly page: Page) {}

readonly profileMenuButton: Locator = this.page.getByText(/Admin$/).first();
readonly notificationBell = this.page.getByRole('button', { name: /notifications/i });
readonly searchMenuInput = this.page.getByPlaceholder('Search menu...');

/\*_ Expands the "Asset Management" sidebar group and clicks a child item. _/
async openAssetManagementMenu(childLabel: string) {
const parent = this.page.getByRole('button', { name: 'Asset Management' })
.or(this.page.getByText('Asset Management', { exact: true }));
await parent.first().click();
await this.page.getByText(childLabel, { exact: true }).click();
await this.page.waitForLoadState('networkidle');
}

async openApprovalDashboard() {
await this.page.getByText('Approval Dashboard', { exact: true }).click();
await this.page.waitForLoadState('networkidle');
}

/\*_ Returns the data grid row Locator whose row contains the given ID text (e.g. AR-2026-000090). _/
gridRowById(idText: string): Locator {
return this.page.locator('table, [role="grid"], .MuiDataGrid-row, tbody')
.locator('tr, [role="row"]')
.filter({ hasText: idText })
.first();
}

/\*_ Waits for and asserts a success toast/snackbar containing the given text. _/
async expectSuccessToast(textFragment: RegExp | string) {
const toast = this.page.getByRole('alert').filter({ hasText: textFragment })
.or(this.page.getByText(textFragment).first());
await expect(toast).toBeVisible({ timeout: 10_000 });
}

async expectStatusBadge(row: Locator, statusText: string | RegExp) {
await expect(row.getByText(statusText)).toBeVisible();
}
}

src/pages/ApprovalDashboardPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ApprovalDashboardPage extends BasePage {
constructor(page: Page) {
super(page);
}

async goto() {
await this.page.goto('/dashboard/hrms/approval-dashboard');
await expect(this.page.getByText('Approval Dashboard')).toBeVisible();
}

private rowByDescriptionOrId(identifier: string): Locator {
return this.gridRowById(identifier);
}

async approveByRequester(requestType: RegExp | string, requesterName: string) {
const row = this.page.locator('tr, [role="row"]')
.filter({ hasText: requestType })
.filter({ hasText: requesterName })
.first();
await expect(row).toBeVisible();
await row.getByRole('button', { name: 'Approve' }).click();
await this.confirmActionIfPrompted();
await this.expectSuccessToast(/approved|success/i);
}

async rejectByRequester(requestType: RegExp | string, requesterName: string, reason?: string) {
const row = this.page.locator('tr, [role="row"]')
.filter({ hasText: requestType })
.filter({ hasText: requesterName })
.first();
await row.getByRole('button', { name: 'Reject' }).click();
if (reason) {
await this.page.getByPlaceholder(/reason|comment/i).fill(reason);
}
await this.confirmActionIfPrompted();
await this.expectSuccessToast(/rejected|success/i);
}

private async confirmActionIfPrompted() {
const confirmButton = this.page.getByRole('button', { name: /confirm|yes|ok/i });
if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
await confirmButton.click();
}
}

async expectPendingEntry(requestType: RegExp | string, requesterName: string) {
const row = this.page.locator('tr, [role="row"]')
.filter({ hasText: requestType })
.filter({ hasText: requesterName });
await expect(row).toBeVisible();
await expect(row.getByText('Pending')).toBeVisible();
}
}

src/pages/AssetAllocationPage.ts

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class AssetAllocationPage extends BasePage {
constructor(page: Page) {
super(page);
}

readonly assignAssetsButton: Locator = this.page.getByRole('button', { name: /Assign Assets/i });
readonly createNewTransferButton: Locator = this.page.getByRole('button', { name: /Create New/i });
readonly approvalHistoryButton: Locator = this.page.getByRole('button', { name: /Approval History/i });

async goto() {
await this.page.goto('/dashboard/hrms/asset-allocation');
await expect(this.page.getByText('Asset Allocation', { exact: true })).toBeVisible();
}

async openAllocationByRequestId(requestId: string) {
await this.goto();
await this.gridRowById(requestId).click();
await expect(this.page.getByText(`ID : ${requestId}`)).toBeVisible();
}

async expectApprovedAndAvailableForAllocation(requestId: string) {
await this.goto();
const row = this.gridRowById(requestId);
await this.expectStatusBadge(row, /Approved/);
}

/\*_ Allocates an available asset (by serial number) against an approved request. _/
async allocateAsset(requestId: string, serialNumber: string, transferDetails: { transferTo: string; location: string }) {
await this.openAllocationByRequestId(requestId);
await this.assignAssetsButton.click();

    await this.page.getByPlaceholder(/serial number|search asset/i).fill(serialNumber);
    await this.page.getByText(serialNumber, { exact: false }).first().click();

    const saveAssignmentButton = this.page.getByRole('button', { name: /save|assign/i });
    await saveAssignmentButton.click();
    await this.expectSuccessToast(/success|assigned/i);

    // Create the transfer record so the asset can be received by the requester.
    await this.createNewTransferButton.click();
    await this.page.getByLabel(/transfer to|location/i).first().fill(transferDetails.location);
    const submitTransfer = this.page.getByRole('button', { name: /submit|create/i });
    await submitTransfer.click();
    await this.expectSuccessToast(/success|created/i);

}

async expectAssetLinkedToRequester(requestId: string, requesterName: string) {
await this.openAllocationByRequestId(requestId);
await expect(this.page.getByText('Transfer Requests')).toBeVisible();
const transferRow = this.page.locator('tr, [role="row"]').filter({ hasText: requesterName });
await expect(transferRow.first()).toBeVisible();
}

async expectAssetStatus(requestId: string, status: string | RegExp) {
await this.goto();
const row = this.gridRowById(requestId);
await this.expectStatusBadge(row, status);
}
}

src/pages/AssetTransferPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/\*_ Covers the "Receive-Handover" grid used for both asset transfer acceptance and inter-user handovers. _/
export class AssetTransferPage extends BasePage {
constructor(page: Page) {
super(page);
}

readonly submitButton: Locator = this.page.getByRole('button', { name: 'Submit' });
readonly receivedStatusDropdown: Locator = this.page.locator('[aria-label="Received Status"], td:has-text("Received Status")')
.locator('xpath=following::div[contains(@role,"combobox")][1]');

async goto() {
await this.page.goto('/dashboard/hrms/asset-transfer');
await expect(this.page.getByText('Receive-Handover')).toBeVisible();
}

async openTransferById(transferId: string) {
await this.goto();
await this.gridRowById(transferId).click();
await expect(this.page.getByText(`ID : ${transferId}`)).toBeVisible();
}

async expectPendingTransfer(transferId: string) {
await this.goto();
const row = this.gridRowById(transferId);
await expect(row).toBeVisible();
await this.expectStatusBadge(row, /Requested/);
}

/\*_ Accepts/receives an asset transfer, marking Received Status = Yes with today's condition notes. _/
async acceptTransfer(transferId: string, condition = 'Good', comments = 'Received in good condition') {
await this.openTransferById(transferId);

    const receivedStatusCell = this.page.locator('tr', { hasText: 'Received Status' }).first();
    await this.page.getByRole('row').filter({ hasText: 'No' }).first()
      .getByRole('combobox').click();
    await this.page.getByRole('option', { name: 'Yes' }).click();

    const conditionInput = this.page.getByPlaceholder(/condition/i).first();
    if (await conditionInput.isVisible().catch(() => false)) {
      await conditionInput.fill(condition);
    }
    const commentsInput = this.page.getByPlaceholder(/comments/i).first();
    if (await commentsInput.isVisible().catch(() => false)) {
      await commentsInput.fill(comments);
    }

    await this.submitButton.click();
    await this.expectSuccessToast(/success|received|completed/i);

}

async expectTransferCompleted(transferId: string) {
await this.goto();
const row = this.gridRowById(transferId);
await this.expectStatusBadge(row, /Completed/);
}
}

src/pages/MyAssetsPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/\*_ "My Assets" (Asset List) grid: view owned assets, initiate Return and Report Damage/Loss. _/
export class MyAssetsPage extends BasePage {
constructor(page: Page) {
super(page);
}

readonly returnAssetButton: Locator = this.page.getByRole('button', { name: 'Return Asset' });
readonly reportDamageLossButton: Locator = this.page.getByRole('button', { name: /Report Damage\/Loss/i });

async goto() {
await this.page.goto('/dashboard/hrms/asset-list');
await expect(this.page.getByText('My Assets')).toBeVisible();
}

private rowByAssetId(assetId: string): Locator {
return this.gridRowById(assetId);
}

async expectAssetVisible(assetId: string) {
await this.goto();
await expect(this.rowByAssetId(assetId)).toBeVisible();
}

async expectAssetNotVisible(assetId: string) {
await this.goto();
await expect(this.rowByAssetId(assetId)).toHaveCount(0);
}

async selectAsset(assetId: string) {
const row = this.rowByAssetId(assetId);
await row.locator('input[type="checkbox"], [role="checkbox"]').first().click();
}

async returnAsset(assetId: string, returnReason = 'Automated E2E return') {
await this.goto();
await this.selectAsset(assetId);
await expect(this.returnAssetButton).toBeEnabled();
await this.returnAssetButton.click();

    const reasonField = this.page.getByPlaceholder(/reason|comment/i).first();
    if (await reasonField.isVisible().catch(() => false)) {
      await reasonField.fill(returnReason);
    }
    await this.page.getByRole('button', { name: /submit|confirm/i }).click();
    await this.expectSuccessToast(/success|returned|submitted/i);

}

async reportDamageLoss(assetId: string) {
await this.goto();
await this.selectAsset(assetId);
await expect(this.reportDamageLossButton).toBeEnabled();
await this.reportDamageLossButton.click();
}
}

src/pages/DamageLossClaimPage.ts

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DamageLossClaimPage extends BasePage {
constructor(page: Page) {
super(page);
}

readonly conditionDropdown: Locator = this.page.getByLabel(/condition/i)
.or(this.page.getByPlaceholder(/condition/i));
readonly descriptionTextarea: Locator = this.page.getByPlaceholder(/description|details/i);
readonly fileUploadInput: Locator = this.page.locator('input[type="file"]');
readonly submitButton: Locator = this.page.getByRole('button', { name: 'Submit' });

async goto() {
await this.page.goto('/dashboard/hrms/damage-loss-claim');
await expect(this.page.getByText('Damage/Loss Claim')).toBeVisible();
}

/\*_ Fills and submits the Damage/Loss claim form (assumes navigation already happened via MyAssetsPage). _/
async fillAndSubmitClaim(data: { condition: 'Damage' | 'Loss'; description: string; attachmentPath?: string }) {
await this.conditionDropdown.click();
await this.page.getByRole('option', { name: data.condition }).click();
await this.descriptionTextarea.fill(data.description);

    if (data.attachmentPath) {
      await this.fileUploadInput.setInputFiles(data.attachmentPath);
    }

    await this.submitButton.click();
    await this.expectSuccessToast(/success|submitted|created/i);

}

async openClaimById(claimId: string) {
await this.goto();
await this.gridRowById(claimId).click();
await expect(this.page.getByText(`ID: ${claimId}`)).toBeVisible();
}

async expectStatus(claimId: string, status: string | RegExp) {
await this.goto();
const row = this.gridRowById(claimId);
await expect(row).toBeVisible();
await this.expectStatusBadge(row, status);
}

async getLatestClaimIdForEmployee(employeeName: string): Promise<string> {
await this.goto();
const row = this.page.locator('tr, [role="row"]').filter({ hasText: employeeName }).first();
const idText = await row.locator('text=/DLC-\\d{4}-\\d{6}/').first().textContent();
if (!idText) throw new Error('Could not resolve latest Damage/Loss Claim ID');
return idText.trim();
}
}

src/utils/helpers.ts

import { Page } from '@playwright/test';

/\*_ Clicks the header profile control and selects Logout. Adjust selector once verified against the real menu. _/
export async function logout(page: Page) {
await page.getByText(/Admin$/).first().click();
const logoutOption = page.getByRole('menuitem', { name: /logout|log out/i })
.or(page.getByText(/logout|log out/i));
await logoutOption.click();
await page.waitForURL(/login/, { timeout: 15_000 });
}

/\*_ Polls a grid until a row containing `idText` reaches the expected status, avoiding hardcoded sleeps. _/
export async function waitForGridStatus(page: Page, idText: string, status: string, timeoutMs = 20_000) {
await page.waitForFunction(
({ idText, status }) => {
const rows = Array.from(document.querySelectorAll('tr, [role="row"]'));
return rows.some(r => r.textContent?.includes(idText) && r.textContent?.includes(status));
},
{ idText, status },
{ timeout: timeoutMs },
);
}

src/fixtures/auth.fixture.ts

import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { logout } from '../utils/helpers';
import { REQUESTER, APPROVER, SECOND_USER, UserContext } from '../data/test-data';
import { Browser, Page } from '@playwright/test';

type AuthFixtures = {
requesterPage: Page;
approverPage: Page;
secondUserPage: Page;
};

async function loginAs(browser: Browser, user: UserContext): Promise<Page> {
if (!user.email || !user.password) {
throw new Error(
`Missing credentials for ${user.displayName}. Set the corresponding env vars before running this suite.`,
);
}
const context = await browser.newContext();
const page = await context.newPage();
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.login(user.email, user.password);
return page;
}

/\*\*

- Provides pre-authenticated, isolated browser contexts for each role so tests
- can run independently without leaking session state between users.
  \*/
  export const test = base.extend<AuthFixtures>({
  requesterPage: async ({ browser }, use) => {
  const page = await loginAs(browser, REQUESTER);
  await use(page);
  await logout(page).catch(() => undefined);
  await page.close();
  },

approverPage: async ({ browser }, use) => {
const page = await loginAs(browser, APPROVER);
await use(page);
await logout(page).catch(() => undefined);
await page.close();
},

secondUserPage: async ({ browser }, use) => {
const page = await loginAs(browser, SECOND_USER);
await use(page);
await logout(page).catch(() => undefined);
await page.close();
},
});

export { expect };
