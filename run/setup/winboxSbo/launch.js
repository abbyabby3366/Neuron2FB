const puppeteer = require("puppeteer");
const fs = require("fs");

const launchWinboxSBO = async (acc) => {
  let browser2;
  let proxyServerSBO = JSON.parse(
    fs.readFileSync(`./TargetBookie/${acc}.json`, "utf-8"),
  ).proxy;
  let proxyServerSBOUsername;
  let proxyServerSBOPassword;
  if (!proxyServerSBO) {
    browser2 = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 30000 },
    });
  } else {
    const parts = proxyServerSBO.split(":");
    if (parts.length === 2) {
      proxyServerSBO = proxyServerSBO.trim();
      browser2 = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 30000 },
        args: [`--proxy-server=${proxyServerSBO}`],
      });
    } else if (parts.length === 4) {
      proxyServerSBO = `${parts[0].trim()}: ${parts[1].trim()}`;
      proxyServerSBOUsername = parts[2].trim();
      proxyServerSBOPassword = parts[3].trim();
      browser2 = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 30000 },
        args: [`--proxy-server=${proxyServerSBO}`],
      });
      const page20 = await browser2.newPage();
      await page20.authenticate({
        username: proxyServerSBOUsername,
        password: proxyServerSBOPassword,
      });
      await page20.goto("https://whoer.net");
    } else {
      console.warn(`Unexpected format for entry: ${entry} `);
    }
  }
  return browser2;
};

module.exports = { launchWinboxSBO };
