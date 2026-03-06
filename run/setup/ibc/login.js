const { timeout } = require("puppeteer");

async function login(page, user) {
  // await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));
  try {
    let loaded = false;
    const loadTimeout = 5000; // 5 seconds

    const loadPromise = page.goto("https://www.168977.net/b/en").then(() => {
      loaded = true;
    });

    await Promise.race([
      loadPromise,
      new Promise((resolve) => setTimeout(resolve, loadTimeout)),
    ]);

    if (!loaded) {
      await page.goto(
        "https://robinjescott.com/web-development/fastest-website-world/",
      );
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 2 seconds
      await page.goto("https://www.168977.net/b/en");
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Click the "Login" button with the specific class and text content
    const loginButtonClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll("a.btn.btn--secondary");
      for (const button of buttons) {
        const text = button.querySelector("span.text")?.textContent.trim();
        if (text === "Login") {
          button.click();
          return true; // Stop after clicking the first matching button
        }
      }
      return false; // Return false if no matching button is found
    });

    if (!loginButtonClicked) {
      throw new Error("Login button not found");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await page.waitForSelector('input[id="username"]');
    await page.focus('input[id="username"]');
    await page.keyboard.type(user.username);
    await page.focus('input[id="password"]');
    await page.keyboard.type(user.password);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await page.keyboard.press("Enter");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check for rate limit message
    const hasRateLimit = await page.evaluate(() => {
      const element = document.querySelector(
        "div.login-form__item--failed span.text-void",
      );
      return element?.textContent?.includes("Login too often") || false;
    });

    if (hasRateLimit) {
      throw new Error("Login too often. Trying again in 2 mins");
    }

    try {
      const closeButton = await page.waitForSelector(".n-close-icon", {
        visible: true,
        timeout: 2000,
      });
      await closeButton.click();
      console.log("IBC - closed popups: " + new Date());
    } catch (e) {
      console.log("IBC - no popups to close");
    }

    try {
      //close pop up?
      await page.waitForSelector("#popupPanel > div > div > a > i", {
        timeout: 2000,
      });
      await page.evaluate(() => {
        document.querySelector("#popupPanel > div > div > a > i").click();
      });
      console.log("IBC - closed popups: " + new Date());
    } catch (e) {
      console.log("IBC - no popups to close");
    }

    console.log("IBC - Login successful: " + new Date());

    return true;
  } catch (err) {
    console.log("IBC - Error occurred in login", err);

    if (err.message.includes("Login too often")) {
      console.log("IBC - Waiting for 2 mins now");
      await new Promise((resolve) => setTimeout(resolve, 120000));
      console.log("IBC - Waiting for 2 mins done");
    }
    return false;
  }
}

module.exports = { login };
