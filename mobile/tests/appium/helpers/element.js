const DEFAULT_TIMEOUT = 10000;

export async function waitForElement(driver, selector, timeout = DEFAULT_TIMEOUT) {
  const element = await driver.$(selector);
  await element.waitForDisplayed({ timeout });
  return element;
}

export async function tapElement(driver, selector) {
  const element = await waitForElement(driver, selector);
  await element.click();
  return element;
}

export async function getText(driver, selector) {
  const element = await waitForElement(driver, selector);
  return await element.getText();
}

export async function setValue(driver, selector, value) {
  const element = await waitForElement(driver, selector);
  await element.setValue(value);
  return element;
}

export async function scrollToElement(driver, selector, maxSwipes = 10) {
  for (let i = 0; i < maxSwipes; i++) {
    try {
      const element = await driver.$(selector);
      if (await element.isDisplayed()) {
        return element;
      }
    } catch {}
    const { width, height } = await driver.getWindowSize();
    const startX = width / 2;
    const startY = height * 0.7;
    const endY = height * 0.3;
    await driver.touchPerform([
      { action: 'press', options: { x: startX, y: startY } },
      { action: 'wait', options: { ms: 500 } },
      { action: 'moveTo', options: { x: startX, y: endY } },
      { action: 'release' },
    ]);
  }
  throw new Error(`Element not found after ${maxSwipes} swipes: ${selector}`);
}

export async function screenshot(driver, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}_${timestamp}.png`;
  const screenshotDir = './screenshots/';
  await driver.saveScreenshot(`${screenshotDir}${filename}`);
  return filename;
}

export async function isElementDisplayed(driver, selector) {
  try {
    const element = await driver.$(selector);
    return await element.isDisplayed();
  } catch {
    return false;
  }
}

export async function waitForElementNotPresent(driver, selector, timeout = DEFAULT_TIMEOUT) {
  const element = await driver.$(selector);
  await element.waitForDisplayed({ timeout, reverse: true });
}

export async function getElementCount(driver, selector) {
  const elements = await driver.$$(selector);
  return elements.length;
}
