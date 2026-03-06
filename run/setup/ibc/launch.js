const puppeteer = require("puppeteer");
const fs = require("fs");

const launchIBC = async (acc) => {
  let browser2;
  let params = JSON.parse(
    fs.readFileSync(`./TargetBookie/${acc}.json`, "utf-8"),
  );
  let proxyServerIBC = params.proxy;
  let proxyServerIBCUsername;
  let proxyServerIBCPassword;
  if (!proxyServerIBC) {
    browser2 = await puppeteer.launch({
      headless: params.headless,
      defaultViewport: { width: 1280, height: 960 },
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
        // '--max-old-space-size=4096'
        // "--enable-precise-memory-info", "--js-flags=\"--max-old-space-size=596\""
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
    console.log("browser launched for IBC");
  } else {
    const parts = proxyServerIBC.split(":");
    if (parts.length === 2) {
      proxyServerIBC = proxyServerIBC.trim();
      browser2 = await puppeteer.launch({
        headless: params.headless,
        defaultViewport: { width: 1280, height: 30000 },
        args: [`--proxy-server=${proxyServerIBC}`],
      });
    } else if (parts.length === 4) {
      proxyServerIBC = `${parts[0].trim()}:${parts[1].trim()}`;
      proxyServerIBCUsername = parts[2].trim();
      proxyServerIBCPassword = parts[3].trim();
      browser2 = await puppeteer.launch({
        headless: params.headless,
        defaultViewport: { width: 1280, height: 30000 },
        args: [`--proxy-server=${proxyServerIBC}`],
      });
      const page20 = await browser2.newPage();
      await page20.authenticate({
        username: proxyServerIBCUsername,
        password: proxyServerIBCPassword,
      });
      await page20.goto("https://whoer.net");
    } else {
      console.warn(`Unexpected format for entry: ${entry} `);
    }
  }
  return browser2;
};

module.exports = { launchIBC };
