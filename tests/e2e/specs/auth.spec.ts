import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("navigate to site and see landing page", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('[data-testid="connect-wallet-btn"]')).toBeVisible();
  });

  test("connect wallet (mock) and verify user state", async ({ page }) => {
    await page.locator('[data-testid="connect-wallet-btn"]').click();

    const walletModal = page.locator('[data-testid="wallet-modal"]');
    await expect(walletModal).toBeVisible();

    await page.locator('[data-testid="mock-wallet-option"]').click();

    await expect(page.locator('[data-testid="user-address"]')).toBeVisible();

    const walletAddress = await page.locator('[data-testid="user-address"]').textContent();
    expect(walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  test("verify authenticated user state shows correctly", async ({ page }) => {
    await page.locator('[data-testid="connect-wallet-btn"]').click();
    await page.locator('[data-testid="mock-wallet-option"]').click();

    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-balance"]')).toBeVisible();
  });

  test("disconnect wallet", async ({ page }) => {
    await page.locator('[data-testid="connect-wallet-btn"]').click();
    await page.locator('[data-testid="mock-wallet-option"]').click();

    await page.locator('[data-testid="user-menu"]').click();
    await page.locator('[data-testid="disconnect-btn"]').click();

    await expect(page.locator('[data-testid="connect-wallet-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-address"]')).not.toBeVisible();
  });

  test("test persisted sessions across page reload", async ({ page }) => {
    await page.locator('[data-testid="connect-wallet-btn"]').click();
    await page.locator('[data-testid="mock-wallet-option"]').click();

    const address = await page.locator('[data-testid="user-address"]').textContent();

    await page.reload();

    await expect(page.locator('[data-testid="user-address"]')).toBeVisible();
    const persistedAddress = await page.locator('[data-testid="user-address"]').textContent();
    expect(persistedAddress).toBe(address);
  });

  test("try accessing protected route without auth redirects to login", async ({ page }) => {
    await page.goto("/membership");
    await expect(page.locator('[data-testid="connect-wallet-btn"]')).toBeVisible();
    await expect(page).toHaveURL(/.*\/$/);
  });

  test("switch between multiple wallet accounts", async ({ page }) => {
    await page.locator('[data-testid="connect-wallet-btn"]').click();
    await page.locator('[data-testid="mock-wallet-option"]').click();

    const firstAddress = await page.locator('[data-testid="user-address"]').textContent();

    await page.locator('[data-testid="user-menu"]').click();
    await page.locator('[data-testid="switch-wallet-btn"]').click();
    await page.locator('[data-testid="mock-wallet-option-2"]').click();

    const secondAddress = await page.locator('[data-testid="user-address"]').textContent();
    expect(secondAddress).not.toBe(firstAddress);
  });
});
