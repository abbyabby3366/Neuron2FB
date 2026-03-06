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
    await page.waitForNavigation({ waitUntil: "domcontentloaded" });
    await new Promise((resolve) => setTimeout(resolve, 4000));
    console.log("HGA - Login page should have loaded");
    console.log('Waiting for selector: input[id="usr"]');
    await page.waitForSelector('input[id="usr"]', {
      hidden: false,
      timeout: 60000,
    });
    console.log("Selector found");
    await page.reload();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("HGA - Attempting to type login credentials now");
    await page.focus('input[id="usr"]');
    await page.keyboard.type(user.username);
    await page.focus('input[id="pwd"]');
    await new Promise((resolve) => setTimeout(resolve, 200));
    await page.keyboard.type(user.password);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await page.keyboard.press("Enter");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("HGA - Login successful: " + new Date());
    return true;
  } catch (err) {
    console.log("HGA - Error occurred in login", err);
    return false;
  }
}

module.exports = { login };
