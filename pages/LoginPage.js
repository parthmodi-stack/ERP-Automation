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
}

module.exports = LoginPage;
