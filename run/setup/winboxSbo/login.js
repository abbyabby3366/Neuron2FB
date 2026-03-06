const fs = require("fs").promises;
const fsSync = require("fs");
const puppeteer = require("puppeteer");
const { getCurrentTime } = require("../../../utils/getCurrentTime");
const { createWorker } = require("tesseract.js");

const login = async (defaultPage, browser, user) => {
  try {
    let winboxSBOLoggedIn = {
      url: "https://www.winbox88my1.com/winbox-login",
      targetPageString: "ssmmtt",
      loggedIn: true,
    };

    await defaultPage.goto(winboxSBOLoggedIn.url);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    // Get the main iframe with class 'wuksD5'
    const mainFrameElement = await defaultPage.$("iframe.wuksD5");
    if (!mainFrameElement)
      throw new Error('Main iframe with class "wuksD5" not found');
    console.log("Main iframe found");
    const mainFrame = await mainFrameElement.contentFrame();
    if (!mainFrame)
      throw new Error("Could not get content frame from main iframe");
    console.log("Main frame accessed");
    // Get the nested iframe with id 'frame-login'
    const loginFrameElement = await mainFrame.$("#frame-login");
    if (!loginFrameElement)
      throw new Error('Login iframe with id "frame-login" not found');
    console.log("Login iframe found");
    console.log("Please proceed to login to your SBO manually");

    //find target page
    let page;
    let pages;
    let targetPage = null;
    let i = 0;
    while (!targetPage) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      pages = await browser.pages();
      targetPage = pages.find((page) =>
        page.url().includes(winboxSBOLoggedIn.targetPageString),
      );
      if (targetPage) {
        //change url to EU odds
        const originalUrl = targetPage.url();
        const modifiedUrl = originalUrl.replace(/(oddstyle=)MY/i, "$1EU");

        console.log("Modified URL:", modifiedUrl);
        console.log("target found, changing to EU odds now");
        targetPage.goto(modifiedUrl);
        page = targetPage;
        break;
      } else console.log(i++, "Finding target page");
    }

    console.log("Login successful:", getCurrentTime());
  } catch (error) {
    console.error("Error in login:", error);
  }
};

module.exports = { login };
