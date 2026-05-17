import { test, expect } from "@playwright/test";

test.describe("Membership Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-testid="connect-wallet-btn"]').click();
    await page.locator('[data-testid="mock-wallet-option"]').click();
  });

  test("view membership tiers", async ({ page }) => {
    await page.goto("/membership");
    await expect(page.locator('[data-testid="membership-tiers"]')).toBeVisible();

    const tiers = page.locator('[data-testid="tier-card"]');
    const tierCount = await tiers.count();
    expect(tierCount).toBeGreaterThanOrEqual(1);

    const firstTier = tiers.first();
    await expect(firstTier.locator('[data-testid="tier-name"]')).toBeVisible();
    await expect(firstTier.locator('[data-testid="tier-price"]')).toBeVisible();
    await expect(firstTier.locator('[data-testid="tier-benefits"]')).toBeVisible();
  });

  test("select tier and mint membership", async ({ page }) => {
    await page.goto("/membership");

    const firstTier = page.locator('[data-testid="tier-card"]').first();
    await firstTier.locator('[data-testid="select-tier-btn"]').click();

    await expect(page.locator('[data-testid="mint-modal"]')).toBeVisible();
    await page.locator('[data-testid="confirm-mint-btn"]').click();

    await expect(page.locator('[data-testid="mint-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="membership-nft-id"]')).toBeVisible();
  });

  test("verify membership shows in profile", async ({ page }) => {
    await page.locator('[data-testid="select-tier-btn"]').first().click();
    await page.locator('[data-testid="confirm-mint-btn"]').click();
    await expect(page.locator('[data-testid="mint-success"]')).toBeVisible();

    await page.goto("/profile");
    await expect(page.locator('[data-testid="my-memberships"]')).toBeVisible();

    const membershipCard = page.locator('[data-testid="membership-card"]');
    await expect(membershipCard).toBeVisible();
    await expect(membershipCard.locator('[data-testid="membership-tier-name"]')).toBeVisible();
    await expect(membershipCard.locator('[data-testid="membership-expiry"]')).toBeVisible();
  });

  test("test tier upgrade flow", async ({ page }) => {
    await page.goto("/membership");

    await page.locator('[data-testid="tier-card"]').first().locator('[data-testid="select-tier-btn"]').click();
    await page.locator('[data-testid="confirm-mint-btn"]').click();

    await page.goto("/membership");

    const upgradeBtn = page.locator('[data-testid="upgrade-btn"]').first();
    await expect(upgradeBtn).toBeVisible();
    await upgradeBtn.click();

    await expect(page.locator('[data-testid="upgrade-modal"]')).toBeVisible();
    await page.locator('[data-testid="confirm-upgrade-btn"]').click();

    await expect(page.locator('[data-testid="upgrade-success"]')).toBeVisible();
  });

  test("membership benefits are displayed correctly", async ({ page }) => {
    await page.goto("/membership");

    const firstTier = page.locator('[data-testid="tier-card"]').first();
    const benefits = firstTier.locator('[data-testid="tier-benefits"] li');
    const benefitCount = await benefits.count();
    expect(benefitCount).toBeGreaterThan(0);

    const firstBenefit = await benefits.first().textContent();
    expect(firstBenefit?.trim().length).toBeGreaterThan(0);
  });

  test("membership pricing shows correct currency", async ({ page }) => {
    await page.goto("/membership");

    const price = await page.locator('[data-testid="tier-price"]').first().textContent();
    expect(price).toMatch(/ETH|MATIC|USD|\d+/);
  });
});
