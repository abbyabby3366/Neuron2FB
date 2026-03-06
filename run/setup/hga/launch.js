const puppeteer = require("puppeteer");
const fs = require("fs");

const launchHGA = async (acc) => {
  let browser2;
  let params = JSON.parse(
    fs.readFileSync(`./TargetBookie/${acc}.json`, "utf-8"),
  );
  let proxyServerHGA = params.proxy;
  let proxyServerHGAUsername;
  let proxyServerHGAPassword;
  if (!proxyServerHGA) {
    browser2 = await puppeteer.launch({
      headless: params.headless,
      defaultViewport: { width: 960, height: 600 },
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
      ignoreDefaultArgs: ["--enable-automation"],
    });
    console.log("browser launched for HGA");
  } else {
    const parts = proxyServerHGA.split(":");
    if (parts.length === 2) {
      proxyServerHGA = proxyServerHGA.trim();
      browser2 = await puppeteer.launch({
        headless: params.headless,
        defaultViewport: { width: 1280, height: 30000 },
        args: [`--proxy-server=${proxyServerHGA}`],
      });
    } else if (parts.length === 4) {
      proxyServerHGA = `${parts[0].trim()}:${parts[1].trim()}`;
      proxyServerHGAUsername = parts[2].trim();
      proxyServerHGAPassword = parts[3].trim();
      browser2 = await puppeteer.launch({
        headless: params.headless,
        defaultViewport: { width: 1280, height: 30000 },
        args: [`--proxy-server=${proxyServerHGA}`],
      });
      const page20 = await browser2.newPage();
      await page20.authenticate({
        username: proxyServerHGAUsername,
        password: proxyServerHGAPassword,
      });
      await page20.goto("https://whoer.net");
    } else {
      console.warn(`Unexpected format for entry: ${entry} `);
    }
  }
  return browser2;
};

module.exports = { launchHGA };
