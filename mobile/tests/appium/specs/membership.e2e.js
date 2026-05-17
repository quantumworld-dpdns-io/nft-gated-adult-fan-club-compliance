const { expect } = require('chai');
const {
  waitForElement,
  tapElement,
  getText,
  scrollToElement,
  isElementDisplayed,
  screenshot,
} = require('../helpers/element');
const { connectMockWallet } = require('../helpers/wallet');

describe('Membership E2E', function () {
  this.timeout(180000);

  before(async function () {
    await driver.launchApp();
    await connectMockWallet(driver);
    await waitForElement(driver, '~home-screen', 10000);
  });

  after(async function () {
    await screenshot(driver, 'membership-final');
    await driver.closeApp();
  });

  it('should navigate to membership section', async function () {
    await tapElement(driver, '~membership-tab');
    const membershipScreen = await waitForElement(driver, '~membership-screen');
    expect(await membershipScreen.isDisplayed()).to.be.true;

    await screenshot(driver, 'membership-screen');
  });

  it('should display tier options', async function () {
    const tierCards = await driver.$$('~tier-card');
    expect(tierCards.length).to.be.at.least(2);

    const firstTierName = await getText(driver, '~tier-name');
    expect(firstTierName.length).to.be.greaterThan(0);

    await screenshot(driver, 'tier-options');
  });

  it('should display current membership badge', async function () {
    const membershipBadge = await waitForElement(driver, '~membership-tier-badge');
    expect(await membershipBadge.isDisplayed()).to.be.true;

    const badgeText = await getText(driver, '~membership-tier-badge');
    expect(badgeText).to.be.oneOf(['Basic', 'Premium', 'Exclusive']);

    await screenshot(driver, 'current-tier');
  });

  it('should select Premium tier', async function () {
    const premiumCard = await waitForElement(driver, '~tier-card-premium');
    await tapElement(driver, '~tier-card-premium');

    const selectButton = await waitForElement(driver, '~select-tier-button');
    expect(await selectButton.isDisplayed()).to.be.true;

    const tierDetailName = await getText(driver, '~tier-detail-name');
    expect(tierDetailName).to.include('Premium');

    await screenshot(driver, 'premium-selected');
  });

  it('should complete purchase flow', async function () {
    await tapElement(driver, '~select-tier-button');

    const purchaseModal = await waitForElement(driver, '~purchase-modal');
    expect(await purchaseModal.isDisplayed()).to.be.true;

    await screenshot(driver, 'purchase-modal');

    const confirmPurchase = await waitForElement(driver, '~confirm-purchase');
    await tapElement(driver, '~confirm-purchase');

    const mockWalletConfirm = await waitForElement(driver, '~mock-wallet-confirm');
    if (await mockWalletConfirm.isDisplayed()) {
      await tapElement(driver, '~mock-wallet-confirm');
    }

    const successMessage = await waitForElement(driver, '~purchase-success', 15000);
    expect(await successMessage.isDisplayed()).to.be.true;
  });

  it('should update membership badge to Premium', async function () {
    await waitForElement(driver, '~membership-screen', 5000);

    const badge = await waitForElement(driver, '~membership-tier-badge', 10000);
    const badgeText = await getText(driver, '~membership-tier-badge');

    if (badgeText !== 'Premium') {
      const dismissButton = await waitForElement(driver, '~dismiss-success');
      await tapElement(driver, '~dismiss-success');

      await tapElement(driver, '~membership-tab');
      await waitForElement(driver, '~membership-screen', 5000);
    }

    await screenshot(driver, 'premium-badge');
  });

  it('should test subscription management', async function () {
    await scrollToElement(driver, '~subscription-management');

    const manageButton = await waitForElement(driver, '~manage-subscription');
    expect(await manageButton.isDisplayed()).to.be.true;

    await tapElement(driver, '~manage-subscription');

    const managementScreen = await waitForElement(driver, '~subscription-management-screen');
    expect(await managementScreen.isDisplayed()).to.be.true;

    await screenshot(driver, 'subscription-management');

    const cancelOption = await waitForElement(driver, '~cancel-subscription-option');
    expect(await cancelOption.isDisplayed()).to.be.true;

    const changePlanOption = await waitForElement(driver, '~change-plan-option');
    expect(await changePlanOption.isDisplayed()).to.be.true;
  });

  it('should display subscription status with expiry', async function () {
    const expiryInfo = await waitForElement(driver, '~subscription-expiry');
    expect(await expiryInfo.isDisplayed()).to.be.true;

    const expiryText = await getText(driver, '~subscription-expiry');
    expect(expiryText).to.include('Expires');

    await screenshot(driver, 'subscription-expiry');
  });
});
