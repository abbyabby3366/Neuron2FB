async function setupPage(page) {
  console.log("preparing to setup");
  //close banner
  // try {
  //   const closeButton = await page.waitForSelector('svg.popupBanner_content_close', { timeout: 500 });
  //   await closeButton.click();
  //   console.log('SBO - Banner close button clicked: ' + new Date());
  // } catch (error) {
  //   console.log('SBO - Banner close button not found / closed manually: ' + new Date());
  // }

  try {
    //setup live & main markets
    await page.click("div.navbarItem_content.navbarItem_content_hasCount", {
      timeout: 5000,
    });
    await page.click(
      "#sports > div > div > section > div > div.column.column-center > div.navbar.sticky > div:nth-child(1) > div:nth-child(3) > button:nth-child(9) > span > svg.svgIcon.svgIcon-default.rotated.svgIcon-right > use",
      { timeout: 5000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await page.click(
      "#sports > div.dropdown_content > div > div:nth-child(4) > div:nth-child(3) > div",
      { timeout: 5000 },
    );
    console.log("SBO - Live & Main Markets setup completed: " + new Date());

    //close rejected bets if any
    await page.evaluate(async () => {
      while (true) {
        const handle = document.querySelector(
          "div.myBets div.bet.rejected.live span.btn-content",
        );
        if (!handle) break;
        console.log("SBO - closing a rejected bet...");
        handle.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    });
  } catch (e) {
    console.log(e);
  } finally {
    console.log();
  }
}

module.exports = { setupPage };
