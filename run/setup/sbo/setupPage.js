async function setupPage(page) {
  console.log("SBO - preparing to setup");
  let status = false;

  // //close all popups
  // try {
  //   await page.click('#sports > div > div > div.tutorialWrapper > div > div > div.tour.tour-top > div.tour_content > div.tour_content_header > span.close > svg > use', { timeout: 3000 });
  //   console.log('SBO - closed popups: ' + new Date());
  // } catch (e) {
  //   console.log('SBO - no popups to close')
  // }

  try {
    await new Promise((resolve) => setTimeout(resolve, 200));
    //setup live & main markets (by pressing each button accordingly)
    await page.waitForSelector(
      "div.navbarItem_content.navbarItem_content_hasCount",
      { timeout: 5000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.evaluate(() => {
      document
        .querySelector("div.navbarItem_content.navbarItem_content_hasCount")
        .click();
    });

    await page.waitForSelector(
      "#sports > div > div > section > div > div.column.column-center > div.navbar.sticky > div:nth-child(1) > div:nth-child(3) > button:nth-child(9) > span > svg.svgIcon.svgIcon-default.rotated.svgIcon-right > use",
      { timeout: 5000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await page.evaluate(() => {
      const button = document.querySelector(
        "#sports > div > div > section > div > div.column.column-center > div.navbar.sticky > div:nth-child(1) > div:nth-child(3) > button:nth-child(9)",
      );
      button.dispatchEvent(
        new MouseEvent("mouseover", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
      button.dispatchEvent(
        new MouseEvent("mouseenter", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    //click main markets
    await page.waitForSelector(
      "#sports > div.dropdown_content > div > div:nth-child(4) > div:nth-child(3) > div",
      { timeout: 5000 },
    );
    await page.evaluate(() => {
      document
        .querySelector(
          "#sports > div.dropdown_content > div > div:nth-child(4) > div:nth-child(3) > div",
        )
        .click();
    });

    //click odds (but default will set to euro)
    // await page.evaluate(() => {
    //   // Find the dropdown group with title "Odds type"
    //   const dropdownGroups = Array.from(document.querySelectorAll('div.dropdownGroup'));
    //   const oddsTypeGroup = dropdownGroups.find(group => {
    //     const title = group.querySelector('.dropdownGroup_title');
    //     return title && title.textContent.trim() === 'Odds type';
    //   });
    //   if (oddsTypeGroup) {
    //     // Find all dropdown items under this group
    //     const items = Array.from(oddsTypeGroup.querySelectorAll('.dropdownItem'));
    //     const euroOddsItem = items.find(item => {
    //       const title = item.querySelector('.dropdownItem_title');
    //       return title && title.textContent.trim() === 'Euro Odds';
    //     });
    //     if (euroOddsItem) {
    //       euroOddsItem.click();
    //     }
    //   }
    // });

    console.log("SBO - Live & Main Markets setup completed: " + new Date());

    status = true;
  } catch (e) {
    console.log(e);
  }

  try {
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
  }

  return status;
}

module.exports = { setupPage };
