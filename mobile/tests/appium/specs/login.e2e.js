const { expect } = require('chai');
const {
  waitForElement,
  tapElement,
  getText,
  isElementDisplayed,
  screenshot,
} = require('../helpers/element');
const {
  connectMockWallet,
  disconnectWallet,
  isWalletConnected,
} = require('../helpers/wallet');

describe('Wallet Login E2E', function () {
  this.timeout(120000);

  before(async function () {
    await driver.launchApp();
  });

  after(async function () {
    await disconnectWallet(driver);
    await screenshot(driver, 'login-final-state');
    await driver.closeApp();
  });

  it('should display the connect wallet screen on first launch', async function () {
    const connectButton = await waitForElement(driver, '~connect-wallet-button');
    expect(await connectButton.isDisplayed()).to.be.true;

    const title = await getText(driver, '~login-title');
    expect(title).to.include('NFT Fanclub');

    await screenshot(driver, 'login-initial-screen');
  });

  it('should show wallet connection modal when connect is tapped', async function () {
    await tapElement(driver, '~connect-wallet-button');

    const modal = await waitForElement(driver, '~wallet-connection-modal');
    expect(await modal.isDisplayed()).to.be.true;

    await screenshot(driver, 'wallet-connection-modal');
  });

  it('should connect mock wallet successfully', async function () {
    const walletAddress = await connectMockWallet(driver);
    expect(walletAddress).to.be.a('string');
    expect(walletAddress).to.match(/^0x[a-fA-F0-9]{40}$/);

    await screenshot(driver, 'wallet-connected');
  });

  it('should redirect to home screen after connection', async function () {
    const homeScreen = await waitForElement(driver, '~home-screen', 15000);
    expect(await homeScreen.isDisplayed()).to.be.true;

    await screenshot(driver, 'home-screen-after-login');
  });

  it('should display user display name on home screen', async function () {
    const displayName = await waitForElement(driver, '~user-display-name');
    expect(await displayName.isDisplayed()).to.be.true;

    const nameText = await getText(driver, '~user-display-name');
    expect(nameText.length).to.be.greaterThan(0);

    await screenshot(driver, 'user-display-name-visible');
  });

  it('should show wallet address badge', async function () {
    const connected = await isWalletConnected(driver);
    expect(connected).to.be.true;

    await screenshot(driver, 'wallet-badge-visible');
  });

  it('should handle disconnect flow', async function () {
    await disconnectWallet(driver);

    const connectButton = await waitForElement(driver, '~connect-wallet-button', 10000);
    expect(await connectButton.isDisplayed()).to.be.true;

    const isConnected = await isWalletConnected(driver);
    expect(isConnected).to.be.false;

    await screenshot(driver, 'after-disconnect');
  });
});
