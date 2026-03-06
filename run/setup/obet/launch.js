const puppeteer = require("puppeteer");
const fs = require("fs");

const launchObet = async (acc) => {
  let browser2;
  let params = JSON.parse(
    fs.readFileSync(`./TargetBookie/${acc}.json`, "utf-8"),
  );
  let proxyServerSBO = params.proxy;
  let proxyServerSBOUsername;
  let proxyServerSBOPassword;
  if (!proxyServerSBO) {
    browser2 = await puppeteer.launch({
      headless: params.headless,
      defaultViewport: { width: 1280, height: 8000 },
      executablePath:
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      // userDataDir: 'C:\\Users\\desmo\\AppData\\Local\\Google\\Chrome\\User Data\\Default',
      args: [
        // '--start-maximized',
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        // '--no-zygote',
        // '--single-process', // <- this one is important
        "--disable-gpu",
      ],
      // ignoreDefaultArgs: ['--enable-automation']
    });
    console.log("browser launched for Obet");
  } else {
    const parts = proxyServerSBO.split(":");
    if (parts.length === 2) {
      proxyServerSBO = proxyServerSBO.trim();
      browser2 = await puppeteer.launch({
        headless: params.headless,
        defaultViewport: { width: 1280, height: 30000 },
        args: [`--proxy-server=${proxyServerSBO}`],
      });
    } else if (parts.length === 4) {
      proxyServerSBO = `${parts[0].trim()}:${parts[1].trim()}`;
      proxyServerSBOUsername = parts[2].trim();
      proxyServerSBOPassword = parts[3].trim();
      browser2 = await puppeteer.launch({
        headless: params.headless,
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

module.exports = { launchObet };
