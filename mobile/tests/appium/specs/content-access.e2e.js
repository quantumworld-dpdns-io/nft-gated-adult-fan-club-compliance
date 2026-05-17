const { expect } = require('chai');
const {
  waitForElement,
  tapElement,
  getText,
  scrollToElement,
  isElementDisplayed,
  screenshot,
} = require('../helpers/element');
const { connectMockWallet, disconnectWallet } = require('../helpers/wallet');

describe('Content Access E2E', function () {
  this.timeout(180000);

  afterEach(async function () {
    await screenshot(driver, `content-access-${this.currentTest.title.replace(/\s+/g, '-')}`);
  });

  describe('Verified User Flow', function () {
    before(async function () {
      await driver.launchApp();
      await connectMockWallet(driver);
      await waitForElement(driver, '~home-screen', 10000);
    });

    after(async function () {
      await driver.closeApp();
    });

    it('should navigate to Content screen', async function () {
      await tapElement(driver, '~content-tab');
      const contentScreen = await waitForElement(driver, '~content-screen');
      expect(await contentScreen.isDisplayed()).to.be.true;
    });

    it('should display content items in grid', async function () {
      const contentItems = await driver.$$('~content-item');
      expect(contentItems.length).to.be.greaterThan(0);
    });

    it('should tap on unlocked content item', async function () {
      const unlockedItem = await waitForElement(driver, '~content-item-unlocked');
      await tapElement(driver, '~content-item-unlocked');

      const contentViewer = await waitForElement(driver, '~content-viewer', 10000);
      expect(await contentViewer.isDisplayed()).to.be.true;
    });

    it('should load content successfully', async function () {
      const contentBody = await waitForElement(driver, '~content-body');
      expect(await contentBody.isDisplayed()).to.be.true;

      const contentTitle = await getText(driver, '~content-title');
      expect(contentTitle.length).to.be.greaterThan(0);
    });

    it('should have interaction controls', async function () {
      const likeButton = await waitForElement(driver, '~like-button');
      expect(await likeButton.isDisplayed()).to.be.true;
    });
  });

  describe('Unverified User Flow', function () {
    before(async function () {
      await driver.launchApp();
      await connectMockWallet(driver);
      await waitForElement(driver, '~home-screen', 10000);
    });

    after(async function () {
      await driver.closeApp();
    });

    it('should navigate to Content screen as unverified user', async function () {
      await tapElement(driver, '~content-tab');
      await waitForElement(driver, '~content-screen', 5000);
    });

    it('should show locked indicator on restricted content', async function () {
      const lockedItems = await driver.$$('~content-item-locked');
      expect(lockedItems.length).to.be.greaterThan(0);
    });

    it('should show age gate when tapping locked content', async function () {
      const lockedItem = await waitForElement(driver, '~content-item-locked');
      await tapElement(driver, '~content-item-locked');

      const ageGate = await waitForElement(driver, '~age-gate-modal');
      expect(await ageGate.isDisplayed()).to.be.true;

      const gateTitle = await getText(driver, '~age-gate-title');
      expect(gateTitle).to.include('Age Verification Required');
    });

    it('should navigate to verify screen from age gate', async function () {
      const verifyButton = await waitForElement(driver, '~age-gate-verify-button');
      await tapElement(driver, '~age-gate-verify-button');

      const verifyScreen = await waitForElement(driver, '~verify-screen', 5000);
      expect(await verifyScreen.isDisplayed()).to.be.true;
    });
  });

  describe('Content Unlock After Verification', function () {
    before(async function () {
      await driver.launchApp();
      await connectMockWallet(driver);
      await waitForElement(driver, '~home-screen', 10000);
    });

    after(async function () {
      await driver.closeApp();
    });

    it('should verify age first', async function () {
      await tapElement(driver, '~verify-tab');
      await waitForElement(driver, '~verify-screen', 5000);

      await tapElement(driver, '~zk-proof-option');
      await tapElement(driver, '~verify-age-button');

      await waitForElement(driver, '~verified-badge', 30000);
    });

    it('should navigate to content and tap locked item', async function () {
      await tapElement(driver, '~content-tab');

      const lockedItem = await waitForElement(driver, '~content-item-locked');
      await tapElement(driver, '~content-item-locked');

      const contentViewer = await waitForElement(driver, '~content-viewer', 10000);
      expect(await contentViewer.isDisplayed()).to.be.true;
    });

    it('should display content after verification-based unlock', async function () {
      const contentBody = await waitForElement(driver, '~content-body');
      expect(await contentBody.isDisplayed()).to.be.true;
    });
  });
});
