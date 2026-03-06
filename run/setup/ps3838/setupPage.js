async function setupPage(page) {
  try {

    //1. CLICK PREFERENCE BUTTON TO CHANGE LINE
    let preferenceButton = await page.waitForSelector(
      "button.btn_change_preferences",
      { timeout: 5000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await page.evaluate(() => {
      const element = document.querySelector("button.btn_change_preferences");
      if (element) element.click();
    });
    let oddsSelection = await page.waitForSelector("button#line", {
      timeout: 5000,
    });
    // First click - converted to JS click
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.evaluate(() => {
      const element = document.querySelector("button#line");
      if (element) element.click();
    });

    // Second click - converted to JS click

    await new Promise((resolve) => setTimeout(resolve, 500));

    let ps3838MarketLineIndex = process.env.PS3838_MARKET_LINE_INDEX || 4;
    await page.evaluate(async (marketLineIndex) => {
      // const element = document.querySelector("#line > div > div > ul > li:nth-child(4) span");
      const element = document.querySelector(
        `#line > div > div > ul > li:nth-child(${marketLineIndex}) span`,
      );
      if (element) element.click();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const saveButton = document.querySelector(
        "button > div > div.preferences_action_buttons.toggle_content_container.normal_button > button.save",
      );
      if (saveButton) saveButton.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }, ps3838MarketLineIndex);

    // preferenceButton = await page.waitForSelector('button.btn_change_preferences', { timeout: 5000 });
    // await page.evaluate(() => {
    //   const element = document.querySelector('button.btn_change_preferences');
    //   if (element) element.click();
    // });


//2. CHANGE TIME TO "NOW-X AM"
    await page.waitForSelector("button#time", { timeout: 5000 });
    await page.evaluate(() => {
      const timeButton = document.querySelector("button#time");
      if (timeButton) timeButton.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.evaluate(() => {
      const menuItems = document.querySelectorAll('ul.dropdown-menu[aria-labelledby="time"] li');
      if (menuItems.length > 1) {
        const targetLink = menuItems[1].querySelector('a');
        if (targetLink) targetLink.click();
      }
    });


    return true;
  } catch (error) {
    console.log("3838 - Error in setupPage", error);
  }
}
module.exports = { setupPage };
