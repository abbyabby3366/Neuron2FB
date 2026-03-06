const puppeteer = require("puppeteer");

const launchLocalHost = async () => {
  let browser0;
  browser0 = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 700 },
  }); //localhost
  const page01 = await browser0.newPage();
  await page01.setViewport({ width: 1200, height: 700 });
  await page01.goto("http://localhost:3000/pending");
  const page02 = await browser0.newPage();
  await page02.setViewport({ width: 1200, height: 700 });
  await page02.goto("http://localhost:3000/success");
  // const page03 = await browser0.newPage();
  // await page03.setViewport({ width: 1200, height: 700 });
  // await page03.goto('http://localhost:3000/screen');
  return browser0;
};

module.exports = { launchLocalHost };
