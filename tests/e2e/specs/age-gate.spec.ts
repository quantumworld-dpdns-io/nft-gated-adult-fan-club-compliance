import { test, expect } from "@playwright/test";

test.describe("Age Gate Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="connect-wallet-btn"]').click();
    await page.locator('[data-testid="mock-wallet-option"]').click();
  });

  test("navigate to content without verification shows age gate", async ({ page }) => {
    await page.goto("/content/adult");
    await expect(page.locator('[data-testid="age-gate"]')).toBeVisible();
    await expect(page.locator('[data-testid="age-gate-title"]')).toContainText("Age Verification Required");
  });

  test("verify age gate appears with correct messaging", async ({ page }) => {
    await page.goto("/content/adult");

    const ageGate = page.locator('[data-testid="age-gate"]');
    await expect(ageGate).toBeVisible();

    await expect(ageGate.locator('[data-testid="age-warning"]')).toBeVisible();
    await expect(ageGate.locator('[data-testid="verify-age-btn"]')).toBeVisible();
    await expect(ageGate.locator('[data-testid="age-requirement"]')).toContainText("18");
  });

  test("submit age verification successfully", async ({ page }) => {
    await page.goto("/content/adult");

    await page.locator('[data-testid="verify-age-btn"]').click();

    await expect(page.locator('[data-testid="age-verification-modal"]')).toBeVisible();
    await page.locator('[data-testid="dob-input"]').fill("2000-01-01");
    await page.locator('[data-testid="country-select"]').selectOption("US");
    await page.locator('[data-testid="submit-verification-btn"]').click();

    await expect(page.locator('[data-testid="verification-success"]')).toBeVisible();
  });

  test("access content after verification", async ({ page }) => {
    await page.goto("/content/adult");

    await page.locator('[data-testid="verify-age-btn"]').click();
    await page.locator('[data-testid="dob-input"]').fill("2000-01-01");
    await page.locator('[data-testid="country-select"]').selectOption("US");
    await page.locator('[data-testid="submit-verification-btn"]').click();
    await expect(page.locator('[data-testid="verification-success"]')).toBeVisible();

    await page.goto("/content/adult");
    await expect(page.locator('[data-testid="age-gate"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="content-container"]')).toBeVisible();
  });

  test("test expired verification flow", async ({ page }) => {
    await page.goto("/content/adult");
    await page.locator('[data-testid="verify-age-btn"]').click();
    await page.locator('[data-testid="dob-input"]').fill("2000-01-01");
    await page.locator('[data-testid="country-select"]').selectOption("US");
    await page.locator('[data-testid="submit-verification-btn"]').click();

    await page.evaluate(() => {
      localStorage.setItem("age_verified_at", "0");
    });

    await page.goto("/content/adult");
    await expect(page.locator('[data-testid="age-gate"]')).toBeVisible();
    await expect(page.locator('[data-testid="verification-expired"]')).toBeVisible();
  });

  test("underage user is rejected with clear message", async ({ page }) => {
    await page.goto("/content/adult");

    await page.locator('[data-testid="verify-age-btn"]').click();
    await page.locator('[data-testid="dob-input"]').fill("2015-01-01");
    await page.locator('[data-testid="country-select"]').selectOption("US");
    await page.locator('[data-testid="submit-verification-btn"]').click();

    await expect(page.locator('[data-testid="verification-failed"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText("underage");
  });

  test("age gate remembers verification across sessions", async ({ page }) => {
    await page.goto("/content/adult");
    await page.locator('[data-testid="verify-age-btn"]').click();
    await page.locator('[data-testid="dob-input"]').fill("2000-01-01");
    await page.locator('[data-testid="country-select"]').selectOption("US");
    await page.locator('[data-testid="submit-verification-btn"]').click();

    await page.reload();
    await page.goto("/content/adult");
    await expect(page.locator('[data-testid="content-container"]')).toBeVisible();
  });
});
