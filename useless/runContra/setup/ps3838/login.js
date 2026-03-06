async function login(page, user) {
  await page.goto("https://www.ps3838.com/en/compact/sports");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  while (true) {
    try {
      await page.reload();
      await page.waitForSelector("input#loginId", { timeout: 3000 });
      await new Promise((resolve) => setTimeout(resolve, 200));
      await page.focus("input#loginId");
      await page.keyboard.type(user.username);
      await new Promise((resolve) => setTimeout(resolve, 200));
      await page.focus('input[type="password"]');
      await page.keyboard.type(user.password);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await page.keyboard.press("Enter");
      await page.waitForSelector("div.loginId", { timeout: 5000 });
      console.log("3838 - logged in SUCCESSFULLY!");
      break;
    } catch {
      console.log("3838 - login failed, retrying in 5 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
module.exports = { login };
