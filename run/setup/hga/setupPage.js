async function setupPage(page) {
  console.log("HGA - preparing to setup");
  let status = false;

  try {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    //click no passcode button
    await page.waitForSelector("div#C_no_btn", {
      timeout: 10000,
      visible: true,
    });
    console.log("HGA - Selector found: div#C_no_btn");
    await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const button = document.querySelector("div#C_no_btn");
      button.click();
    });
    console.log("HGA - Clicked div#C_no_btn");

    //click soccer in play
    console.log("HGA - Waiting for selector: div#h_ft_live_league");
    await page.waitForSelector("div#h_ft_live_league", { visible: true });

    await new Promise((resolve) => setTimeout(resolve, 1500));
    await page.evaluate(() => {
      document.querySelector("div#h_ft_live_league").click();
    });
    console.log("HGA - Clicked div#h_ft_live_league");

    console.log("HGA - Waiting for selector: div#tab_rnou");
    //go do hdp&ou tab
    await page.waitForSelector("div#tab_rnou", {
      timeout: 30000,
      visible: true,
    });
    await page.waitForSelector("div#main_content", {
      timeout: 30000,
      visible: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await page.evaluate(() => {
      document.querySelector("div#tab_rnou").click();
    });

    //wait for odds to load
    await page.waitForSelector("div#main_content");

    //wait for game_loading to disappear
    await page.waitForSelector("div#game_loading", {
      timeout: 30000,
      visible: false,
    });
    await page.waitForSelector(
      "div#main_content  div#div_show div.btn_title_le",
      { timeout: 30000, visible: true },
    );
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log("HGA - done loading all");

    //open all leagues (new version)
    await page.evaluate(() => {
      const leagueNameButtons = document.querySelectorAll('[id^="LEG_"]');
      leagueNameButtons.forEach((button) => {
        // Get the immediately following sibling element, which should be the game content div
        const gameContentDiv = button.nextElementSibling;

        // Check if the game content div exists, has the 'box_lebet' class,
        // and is currently hidden (collapsed)
        if (
          gameContentDiv &&
          gameContentDiv.classList.contains("box_lebet") &&
          gameContentDiv.style.display === "none"
        )
          button.click();
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log("HGA - Live & Main Markets setup completed: " + new Date());

    status = true;
  } catch (e) {
    console.log("HGA - Error in setupPage (possibly no live trades): " + e);
  }

  return status;
}

module.exports = { setupPage };
