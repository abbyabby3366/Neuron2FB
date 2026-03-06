async function login(page, user) {
  if (user.modHeaderIP) {
    // Set up request interception
    await page.setRequestInterception(true);

    // Modify headers for all requests
    page.on("request", (request) => {
      const headers = request.headers();
      headers["X-Forwarded-For"] = user.modHeaderIP;

      // console.log('Modified headers:', headers); // Log headers before sending
      request.continue({
        headers: headers,
      });
    });
  }

  // await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  if (user.userAgent) {
    await page.setUserAgent(user.userAgent);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (!page || !page.target().url()) {
    let page2 = await browser.newPage();
    await page.close();
    page = page2;
    if (user.userAgent) {
      await page.setUserAgent(user.userAgent);
    }
    console.log("No detected page, so opened new page");
  }

  try {
    await page.goto(user.website);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await page.waitForSelector('input[id="username"]');
    await page.focus('input[id="username"]');
    await page.keyboard.type(user.username);
    await page.focus('input[id="password"]');
    await new Promise((resolve) => setTimeout(resolve, 200));
    await page.keyboard.type(user.password);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await page.keyboard.press("Enter");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      //close pop up?
      await page.waitForSelector(
        "#sports > div > div > div.tutorialWrapper > div > div > div.tour.tour-top > div.tour_content > div.tour_content_header > span.close > svg > use",
        { timeout: 7000 },
      );
      await page.evaluate(() => {
        document
          .querySelector(
            "#sports > div > div > div.tutorialWrapper > div > div > div.tour.tour-top > div.tour_content > div.tour_content_header > span.close",
          )
          .click();
      });
      console.log("SBO - closed popups: " + new Date());
    } catch (e) {
      console.log("SBO - no popups to close");
    }

    await page.waitForSelector("div.matches_row", { timeout: 20000 });

    // console.log('Attempting to click navbarItem');
    await page.evaluate(() => {
      document
        .querySelector("div.navbarItem_content.navbarItem_content_hasCount")
        .click();
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("SBO - Login successful: " + new Date());
    return true;
  } catch (err) {
    console.log("SBO - Error occurred in login", err);
    return false;
  }
}

module.exports = { login };
