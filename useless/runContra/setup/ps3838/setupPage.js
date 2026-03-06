async function setupPage(page, oddsType = "MY") {
  try {
    let oddsSelection = await page.waitForSelector("button#odds", {
      timeout: 5000,
    });
    // First click
    oddsSelection.click();

    // Second click
    await page.click("#odds > div > div > ul > li:nth-child(5) > a", {
      timeout: 1000,
    });
  } catch (error) {
    console.log("Initial clicks failed. Attempting fallback method.");

    // Fallback method: Click body and retry
    await page.evaluate(() => {
      document.body.click();
    });

    try {
      // Retry first click
      await page.click("button#odds", { timeout: 1000 });

      // Retry second click
      await page.click("#odds > div > div > ul > li:nth-child(5) > a", {
        timeout: 1000,
      });
    } catch (fallbackError) {
      console.error("Fallback method also failed:", fallbackError);
      throw new Error("Unable to perform required clicks");
    }
  } finally {
    console.log("Finally setup page for oddsType:", oddsType);
  }
}
module.exports = { setupPage };
