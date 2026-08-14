class LoginPage {
  constructor(page) {
    this.page = page;

    this.emailInput    = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton  = page.locator('button[type="submit"]');
    this.errorMessage  = page.locator('[class*="error"], [class*="alert"], [class*="toast"]').first();
  }

  async goto() {
    // CONFIRMED LIVE: same stuck-on-its-own-bare-loading-spinner class of bug as
    // LocationPage.gotoList()/BinPage.gotoList()/ItemCategoryPage.gotoList()/UOMPage.goto() - a
    // single networkidle wait can hang well past a generous timeout on a cold first load, and only
    // a reload recovers it. This is the very first navigation of a run, so a stall here kills
    // every step after it - retry with a reload instead of trusting one wait.
    await this.page.goto('/', { timeout: 60000 });
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      try {
        await this.emailInput.waitFor({ state: 'visible', timeout: 30000 });
        return;
      } catch (e) {
        if (attempt === 3) throw e;
        await this.page.reload({ timeout: 60000 }).catch(() => {});
      }
    }
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
