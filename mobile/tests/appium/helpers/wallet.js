const MOCK_WALLET_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18';
const MOCK_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

let connectedAddress = null;

export async function connectMockWallet(driver) {
  const connectButton = await driver.$('~connect-wallet-button');
  await connectButton.waitForDisplayed({ timeout: 5000 });
  await connectButton.click();

  const walletModal = await driver.$('~wallet-connection-modal');
  await walletModal.waitForDisplayed({ timeout: 5000 });

  const mockOption = await driver.$('~mock-wallet-option');
  await mockOption.waitForDisplayed({ timeout: 3000 });
  await mockOption.click();

  const confirmButton = await driver.$('~confirm-connection');
  await confirmButton.waitForDisplayed({ timeout: 3000 });
  await confirmButton.click();

  connectedAddress = MOCK_WALLET_ADDRESS;
  return MOCK_WALLET_ADDRESS;
}

export async function disconnectWallet(driver) {
  try {
    const disconnectButton = await driver.$('~disconnect-wallet-button');
    if (await disconnectButton.isDisplayed()) {
      await disconnectButton.click();
      const confirmButton = await driver.$('~confirm-disconnect');
      if (await confirmButton.isDisplayed()) {
        await confirmButton.click();
      }
    }
  } catch {
  } finally {
    connectedAddress = null;
  }
}

export async function getConnectedAddress() {
  return connectedAddress;
}

export async function signMessage(message) {
  if (!connectedAddress) {
    throw new Error('No wallet connected');
  }
  return `0x${Buffer.from(message).toString('hex')}_signed_by_${connectedAddress}`;
}

export async function isWalletConnected(driver) {
  try {
    const walletBadge = await driver.$('~wallet-address-badge');
    return await walletBadge.isDisplayed();
  } catch {
    return false;
  }
}
