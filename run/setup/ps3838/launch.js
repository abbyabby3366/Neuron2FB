const puppeteer = require("puppeteer");
const fs = require("fs");

const launch3838 = async (acc) => {
  let browser1;
  let params = JSON.parse(
    fs.readFileSync(`./TargetBookie/${acc}.json`, "utf-8"),
  );
  let proxyServerPS3838 = params.proxy;
  let proxyServerPS3838Username;
  let proxyServerPS3838Password;
  if (!proxyServerPS3838) {
    browser1 = await puppeteer.launch({
      headless: params.headless,
      defaultViewport: { width: 1280, height: 30000 },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        // '--single-process', // <- this one is important
        "--disable-gpu",
      ],
    });
  } else {
    const parts = proxyServerPS3838.split(":");
    if (parts.length === 2) {
      proxyServerPS3838 = proxyServerPS3838.trim();
      browser1 = await puppeteer.launch({
        headless: params.headless,
        defaultViewport: { width: 1280, height: 30000 },
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          // '--single-process', // <- this one is important
          "--disable-gpu",
          `--proxy-server=${proxyServerPS3838}`,
        ],
      });
    } else if (parts.length === 4) {
      proxyServerPS3838 = `${parts[0].trim()}:${parts[1].trim()}`;
      proxyServerPS3838Username = parts[2].trim();
      proxyServerPS3838Password = parts[3].trim();

      browser1 = await puppeteer.launch({
        headless: params.headless,
        defaultViewport: { width: 1280, height: 30000 },
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          // '--single-process', // <- this one is important
          "--disable-gpu",
          `--proxy-server=${proxyServerPS3838}`,
        ],
      });

      const page10 = await browser1.newPage();
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
