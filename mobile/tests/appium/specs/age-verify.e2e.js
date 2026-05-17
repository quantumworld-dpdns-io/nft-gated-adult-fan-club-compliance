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

describe('Age Verification E2E', function () {
  this.timeout(180000);

  before(async function () {
    await driver.launchApp();
    await connectMockWallet(driver);
    await waitForElement(driver, '~home-screen', 10000);
  });

  after(async function () {
    await screenshot(driver, 'age-verify-final');
    await driver.closeApp();
  });

  it('should navigate to Verify screen', async function () {
    await tapElement(driver, '~verify-tab');
    const verifyScreen = await waitForElement(driver, '~verify-screen');
    expect(await verifyScreen.isDisplayed()).to.be.true;

    const title = await getText(driver, '~verify-title');
    expect(title).to.include('Age Verification');

    await screenshot(driver, 'verify-screen');
  });

  it('should display verification options', async function () {
    const zkOption = await waitForElement(driver, '~zk-proof-option');
    expect(await zkOption.isDisplayed()).to.be.true;

    const docOption = await waitForElement(driver, '~document-upload-option');
    expect(await docOption.isDisplayed()).to.be.true;

    await screenshot(driver, 'verify-options');
  });

  it('should select ZK Proof option', async function () {
    await tapElement(driver, '~zk-proof-option');
    const verifyButton = await waitForElement(driver, '~verify-age-button');
    expect(await verifyButton.isDisplayed()).to.be.true;

    await screenshot(driver, 'zk-proof-selected');
  });

  it('should submit age verification via ZK proof', async function () {
    await tapElement(driver, '~verify-age-button');

    const loadingIndicator = await waitForElement(driver, '~verification-loading');
    expect(await loadingIndicator.isDisplayed()).to.be.true;

    await screenshot(driver, 'verification-in-progress');
  });

  it('should show verification confirmation', async function () {
    const verifiedBadge = await waitForElement(driver, '~verified-badge', 30000);
    expect(await verifiedBadge.isDisplayed()).to.be.true;

    const verifiedText = await getText(driver, '~verified-title');
    expect(verifiedText).to.include('Age Verified');

    await screenshot(driver, 'verification-confirmed');
  });

  it('should display verification badge on profile', async function () {
    await tapElement(driver, '~profile-tab');
    const ageVerifiedRow = await waitForElement(driver, '~age-verified-row');
    expect(await ageVerifiedRow.isDisplayed()).to.be.true;

    await screenshot(driver, 'profile-verified');
  });

  it('should test unverified user flow - attempt access shows gate', async function () {
    await tapElement(driver, '~home-tab');

    await tapElement(driver, '~content-tab');
    await waitForElement(driver, '~content-screen', 5000);

    const lockedItem = await waitForElement(driver, '~content-item-locked');
    await tapElement(driver, '~content-item-locked');

    const ageGate = await waitForElement(driver, '~age-gate-modal');
    expect(await ageGate.isDisplayed()).to.be.true;

    await screenshot(driver, 'age-gate-prompt');
  });
});
