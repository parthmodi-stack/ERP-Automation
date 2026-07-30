const { test } = require("@playwright/test");
const testData = require("../../config/testData");

test.use({ storageState: { cookies: [], origins: [] } });

test("diagnose Parth account employee linkage", async ({ page }) => {
  page.on("response", async (r) => {
    const url = r.url();
    if (
      url.includes("asset-request") ||
      url.includes("employee") ||
      url.includes("/auth/")
    ) {
      let bodySnippet = "";
      try {
        const json = await r.json();
        bodySnippet = JSON.stringify(json).slice(0, 500);
      } catch (e) {}
      console.log(r.request().method(), r.status(), url, bodySnippet);
    }
  });

  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill("nishit.vankawala@trootech.com");
  await page.getByPlaceholder(/password/i).fill("Admin@123");
  await page.getByRole("button", { name: /login|sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 20000 });
  console.log("Logged in. URL:", page.url());

  await page.goto("/dashboard/hrms/asset-request/add-asset-request");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  const is403 = await page.getByText("403", { exact: true }).isVisible().catch(() => false);
  const nameInputVisible = await page.getByPlaceholder("Enter Name").isVisible().catch(() => false);
  console.log("403 shown:", is403, "| Add-form Name input visible:", nameInputVisible);
});
