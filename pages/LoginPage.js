class LoginPage {
  constructor(page) {
    this.page = page;

    this.emailInput    = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton  = page.locator('button[type="submit"]');
    this.errorMessage  = page.locator('[class*="error"], [class*="alert"], [class*="toast"]').first();
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async fillEmail(email) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password) {
    await this.passwordInput.fill(password);
  }

  async clickSubmit() {
    await this.submitButton.click();
  }

  async login(email, password) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSubmit();
  }

  async loginAndWaitForDashboard(email, password) {
    await this.login(email, password);
    await this.page.waitForURL('**/dashboard**', { timeout: 15000 });
  }

  async isOnLoginPage() {
    return this.page.url().includes('/login') || this.page.url() === `${this.page.url().split('/').slice(0, 3).join('/')}/`;
  }

  // Header avatar (erpforce-common-hub-fe's HeaderEnhanced) -> "Logout" menuitem -> a confirm
  // dialog reusing the SAME "Logout" text for its title and confirm button, so each step is
  // scoped (menuitem, then dialog button) to avoid a strict-mode multi-match.
  // CONFIRMED LIVE: the deployed build does NOT render a ".user-profile-box" class at all (0
  // matches, even though `_tid` IS present in localStorage) - the source-read class name doesn't
  // match what's actually shipped. Click the "Admin" role label instead (confirmed live for both
  // Dipen Modi and kashyap jivani's headers, and this repo's own config/testData.js already notes
  // every test account here renders that same "Admin" role text).
  async logout() {
    await this.page.getByText('Admin', { exact: true }).first().click();
    await this.page.getByRole('menuitem', { name: 'Logout' }).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Logout' }).click();
    await this.page.waitForURL(/\/login/, { timeout: 15000 });
  }
}

module.exports = LoginPage;
