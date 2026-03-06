async function setupPage(page) {
  console.log("Obet - preparing to setup");
  let status = false;

  // Get the iframe reference and reassign page to point to it
  const frames = await page.frames();
  const frame = frames.find((f) => f.name() === "frame-sport");
  if (!frame) {
    throw new Error("iframe#frame-sport not found");
  }
  page = frame; // Reassign page to point to the frame

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
    //press football
    await page.waitForSelector(
      "#menu-sport > div.content.sports > table > tbody > tr:nth-child(1) > td.text > span.icon.icon-Soccer",
      { timeout: 5000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.evaluate(() => {
      document
        .querySelector(
          "#menu-sport > div.content.sports > table > tbody > tr:nth-child(1) > td.text > span.icon.icon-Soccer",
        )
        .click();
    });

    //press live
    await page.waitForSelector(
      "#menu-sport > div.content.markets > table > tbody > tr:nth-child(1) > td.text > span.icon",
      { timeout: 5000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await page.evaluate(() => {
      const button = document.querySelector(
        "#menu-sport > div.content.markets > table > tbody > tr:nth-child(1) > td.text > span.icon",
      );
      if (button) {
        button.click();
      }
    });

    try {
      await page.waitForSelector("a.odds", { timeout: 5000 });
      const oddsLinkClicked = await page.evaluate(() => {
        const oddsLink = document.querySelector("a.odds");
        if (oddsLink) {
          oddsLink.click();
          return true;
        }
        return false;
      });

      if (oddsLinkClicked) {
        console.log("Obet - Clicked a.odds element");
        // Wait for the page to respond to the first click
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Then click 'span.odds-eu'
        const oddsEuClicked = await page.evaluate(() => {
          const oddsEu = document.querySelector("span.odds-eu");
          if (oddsEu) {
            oddsEu.click();
            return true;
          }
          return false;
        });

        if (oddsEuClicked) {
          console.log("Obet - Clicked span.odds-eu element");
          await new Promise((resolve) => setTimeout(resolve, 300));
        } else console.log("Obet - span.odds-eu element not found");
      } else console.log("Obet - a.odds element not found");
    } catch (e) {
      throw new Error(`Obet - Error clicking odds elements: ${e.message}`);
    }

    console.log("Obet - Live & Main Markets setup completed: " + new Date());

    status = true;
  } catch (e) {
    console.log("Obet, error in setting up page", e);
  }

  try {
    //close rejected bets if any (To be done, below is still SBO)
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
