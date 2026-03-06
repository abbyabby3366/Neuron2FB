async function login(page, user) {
  await page.goto("https://www.tek789.com");
  while (true) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await page.waitForSelector('input[id="username"]');
      await page.focus('input[id="username"]');
      await page.keyboard.type(user.username);
      await page.focus('input[id="password"]');
      await page.keyboard.type(user.password);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await page.keyboard.press("Enter");
      await page.waitForSelector("div.matches_row");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      break;
    } catch {
      console.log(
        "SBO - Error occured in login and going to home page. Retrying",
      );
    }
  }
}

module.exports = { login };
