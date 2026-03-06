const puppeteer = require("puppeteer");
const fs = require("fs");

const launch3838 = async (acc) => {
  let browser1;
  let proxyServerPS3838 = JSON.parse(
    fs.readFileSync(`./TargetBookie/ps3838${acc}.json`, "utf-8"),
  ).proxy;
  let proxyServerSBOUsername;
  let proxyServerSBOPassword;
  if (!proxyServerPS3838) {
    browser1 = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 30000 },
    });
  } else {
    const parts = proxyServerPS3838.split(":");
    if (parts.length === 2) {
      proxyServerPS3838 = proxyServerPS3838.trim();
      browser1 = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 30000 },
        args: [`--proxy-server=${proxyServerPS3838}`],
      });
    } else if (parts.length === 4) {
      proxyServerPS3838 = `${parts[0].trim()}:${parts[1].trim()}`;
      proxyServerPS3838Username = parts[2].trim();
      proxyServerPS3838Password = parts[3].trim();
      browser1 = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 30000 },
        args: [`--proxy-server=${proxyServerPS3838}`],
      });
      const page10 = await browser2.newPage();
      await page10.authenticate({
        username: proxyServerPS3838Username,
        password: proxyServerPS3838Password,
      });
      await page10.goto("https://whoer.net");
    } else {
      console.warn(`Unexpected format for entry: ${entry}`);
    }
  }
  return browser1;
};

module.exports = { launch3838 };
