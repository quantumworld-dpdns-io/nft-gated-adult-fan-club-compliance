const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');

exports.config = {
  runner: 'local',

  specs: [
    './specs/**/*.e2e.js',
  ],

  exclude: [],

  maxInstances: 1,

  capabilities: [
    {
      platformName: 'Android',
      'appium:deviceName': 'Pixel_API_34',
      'appium:platformVersion': '14.0',
      'appium:automationName': 'UiAutomator2',
      'appium:app': path.resolve(__dirname, '../../android/app/build/outputs/apk/debug/app-debug.apk'),
      'appium:autoGrantPermissions': true,
      'appium:noReset': false,
      'appium:fullReset': true,
      'appium:autoDownloadDrivers': true,
    },
    {
      platformName: 'iOS',
      'appium:deviceName': 'iPhone 15',
      'appium:platformVersion': '17.0',
      'appium:automationName': 'XCUITest',
      'appium:app': path.resolve(__dirname, '../../ios/build/Build/Products/Debug-iphonesimulator/NFTFanclub.app'),
      'appium:autoAcceptAlerts': true,
      'appium:noReset': false,
      'appium:fullReset': true,
      'appium:autoDownloadDrivers': true,
    },
  ],

  logLevel: 'info',

  bail: 0,

  baseUrl: '',

  waitforTimeout: 10000,

  connectionRetryTimeout: 120000,

  connectionRetryCount: 3,

  framework: 'mocha',

  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
    grep: '',
  },

  services: [
    [
      'appium',
      {
        args: {
          relaxedSecurity: true,
          address: 'localhost',
          port: 4723,
        },
        command: 'appium',
      },
    ],
  ],

  before: function () {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    const chai = require('chai');
    global.expect = chai.expect;
    global.assert = chai.assert;
    global.should = chai.should();
  },

  afterTest: function (test, context, { error, result, duration, passed, retries }) {
    if (error) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${test.title.replace(/\s+/g, '_')}_FAILED_${timestamp}.png`;
      const filepath = path.join(SCREENSHOT_DIR, filename);
      try {
        driver.saveScreenshot(filepath);
        console.log(`Screenshot saved: ${filepath}`);
      } catch (e) {
        console.error(`Failed to save screenshot: ${e.message}`);
      }
    }
  },

  after: async function () {
    try {
      await driver.closeApp();
    } catch {}
  },

  onComplete: function () {
    const screenshots = fs.readdirSync(SCREENSHOT_DIR);
    console.log(`Total screenshots captured: ${screenshots.length}`);
  },
};
