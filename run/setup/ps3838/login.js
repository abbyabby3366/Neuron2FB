async function login(page, user) {
  if (user.userAgent) {
    await page.setUserAgent(user.userAgent);
  }

  await page.goto(user.website);
  await new Promise((resolve) => setTimeout(resolve, 1500));

  try {
    await page.reload();
    await page.waitForSelector("input#loginId", { timeout: 5000 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    await page.focus("input#loginId");
    await page.keyboard.type(user.username);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await page.focus('input[type="password"]');
    await page.keyboard.type(user.password);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await page.keyboard.press("Enter");

    try {
      await page.waitForSelector("div.loginId", { timeout: 8000 });
    } catch {
      await page.reload();
    }

    await page.waitForSelector("div.loginId", { timeout: 8000 });

    console.log("3838 - logged in SUCCESSFULLY!");

    // await page.evaluate(() => {
    //   // Remove all external stylesheets
    // for (let i = document.styleSheets.length - 1; i >= 0; i--) {
    //   document.styleSheets[i].disabled = true;
    // }

    //   // // Remove all style tags
    //   // const styleTags = document.getElementsByTagName('style');
    //   // for (let i = styleTags.length - 1; i >= 0; i--) {
    //   //   styleTags[i].parentNode.removeChild(styleTags[i]);
    //   // }

    //   // // Remove inline styles
    //   // const allElements = document.getElementsByTagName('*');
    //   // for (let i = 0; i < allElements.length; i++) {
    //   //   allElements[i].style = '';
    //   // }
    // });

    return true;
  } catch {
    console.log("3838 - login failed, retrying in 5 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

module.exports = { login };
