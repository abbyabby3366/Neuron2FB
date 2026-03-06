const { launch3838 } = require("./setup/ps3838/launch");
const { login } = require("./setup/ps3838/login");

const { scrape3838 } = require("./scrape/ps3838");
const fsSync = require("fs");
const { getCurrentTime } = require("../../utils/getCurrentTime");
const oddsType = ""; //to be filled
const { setupPage } = require("./setup/ps3838/setupPage");

let page;
const runPS3838 = async (acc) => {
  try {
    const user = userAccountList[acc];

    console.log("3838 Login Credential: ", acc, user.username);
    browser1 = await launch3838(acc);
    page = await browser1.newPage();
    await login(page, user);
    await setupPage(page);

    while (true) scrape3838();
  } catch (err) {
    console.log(err);
  }
};

const brainAndBet = async (acc) => {
  //big brain to run every 100ms, or every time a scrape function is completed (for now i would prefer to run evrey 100ms,)

  //import page

  //scrape (take note only scrape AH OU, no 1x2 for now)
  //while scraping, check odds correct or not

  while (true) {
    await bigBrain();
    //for each acc, brain with the contraBookie
    //get pending bet list in 2fastbet format

    if (pendingBetList) autobet((index = 0)); //for now i think dont need to do queue (since there are only max few transactions an hour)
    //if meet criteria
    //ticket both side again

    //if still meet criteria
    //bet the one that i want
  }
};

async function ticketEvent(betEvent) {
  try {
    let targetButtonId = betEvent.buttonId3838;
    console.log(
      "ps3838 - Finding event by ID: " +
        targetButtonId +
        "  " +
        getCurrentTime(),
    );

    const targetItemHandle = await page.evaluateHandle((id) => {
      let buttonHandle = document
        .querySelector(".odds-container-live")
        .querySelector(`#${CSS.escape(id)}`)
        .querySelector("span");
      if (buttonHandle) {
        console.log(
          "ps3838 - Ticketing Event, Found button handle within DOM: ",
          buttonHandle,
        );
        return buttonHandle;
      } else {
        console.log(
          "ps3838 - Ticketing Event, Button handle not found within DOM: ",
          buttonHandle,
        );
        return null;
      }
    }, targetButtonId);

    if (!targetItemHandle)
      throw new Error(
        `ps3838 - Bet event NOT FOUND by targetButtonId = ${targetButtonId}, empty handler`,
      );
    const targetItemElement = await targetItemHandle.asElement();
    if (!targetItemElement) {
      // await page.setJavaScriptEnabled(false);
      // console.log('JAVASCRIPT DISABLED FOR DEBUGGING PURPOSES');
      throw new Error(
        `ps3838 - Bet event asElement NOT FOUND by targetButtonId = ${targetButtonId}, empty handler`,
      );
    }

    // console.log('ps3838 - Bet event handle FOUND by targetButtonId = ', targetItemHandle);
    // console.log('ps3838 - Bet event asElement FOUND by targetButtonId = ', targetItemElement);

    // Scroll the element into view
    await page.evaluate((el) => {
      el.scrollIntoView({ behavior: "auto", block: "center" });
    }, targetItemElement);

    // Try to click the element
    console.log("ps3838 - Clicking event: " + getCurrentTime());
    try {
      await targetItemElement.click({ timeout: 800 }); // Add a timeout to the click operation
      console.log("ps3838 - Clicked event: " + getCurrentTime());
    } catch (error) {
      console.error("Failed to click the element:", error);
      // If click fails, try using JavaScript to click
      await page.evaluate((el) => {
        el.click();
      }, targetItemElement);
      console.log("ps3838 - Attempted JavaScript click: " + getCurrentTime());
    }

    // Wait for the odds to be present in the DOM
    await page.waitForSelector("span.odds", { timeout: 3000 });

    // Use page.$eval to select the element and get its text content
    let newOdds = await page.$eval("span.odds", (element) => {
      // Ensure the element has exactly one class, which is 'abc'
      if (element.classList.length === 1) {
        return element.textContent;
      }
      return null;
    });
    if (!newOdds)
      throw new Error("ps3838 - Cant read from betslip, odds not found");

    newOdds = parseFloat(newOdds.trim());
    let noVigOdds = betEvent.referenceNoVigOdds;
    if (newOdds != betEvent.referenceOdds) {
      // recalculate no vig odds
      noVigOdds =
        (newOdds * betEvent.referenceNoVigOdds) / betEvent.referenceOdds;
    }
    console.log(
      `ps3838 - Ticketted No Vig Odds retrieved ${noVigOdds}: ` +
        getCurrentTime(),
    );

    //get min stake and max stake (even if this fails, no vig odds still will be returned
    let minStake;
    let maxStake;
    try {
      const minValueElement = await page.waitForSelector(".min-value", {
        timeout: 5000,
      });
      const maxValueElement = await page.waitForSelector(".max-value", {
        timeout: 5000,
      });
      minStake = await page.evaluate(
        (element) => element.innerText,
        minValueElement,
      );
      minStake = parseFloat(minStake.replace(/,/g, ""));
      maxStake = await page.evaluate(
        (element) => element.innerText,
        maxValueElement,
      );
      maxStake = parseFloat(maxStake.replace(/,/g, ""));
    } catch (error) {
      console.log("ps3838 - Error getting min and max stake: ", error);
      minStake = null;
      maxStake = null;
    }

    //close the ticketed bet slip
    const closeButton = await page.waitForSelector("div.remove-icon", {
      timeout: 5000,
    });
    await closeButton.click();

    let referenceTickettedTime = new Date().toLocaleString();

    console.log("ps3838 - Ticketted data: ", {
      referenceTickettedOdds: newOdds,
      referenceTickettedNoVigOdds: noVigOdds,
      minStake,
      maxStake,
      referenceTickettedTime,
    });
    return {
      referenceTickettedOdds: newOdds,
      referenceTickettedNoVigOdds: noVigOdds,
      minStake,
      maxStake,
      referenceTickettedTime,
    };
  } catch (error) {
    console.log("ps3838 - Error in ticketing:", error);
  } finally {
    // Check if the popup exists
    const popupExists = await page.evaluate(() => {
      const popup = document.querySelector("div.AlertComponent.confirm-alert");
      return popup !== null;
    });

    if (popupExists) {
      console.log(
        "Selection unavailable popup detected. Attempting to close...",
      );

      try {
        // Click the OK button
        await page.click("div.AlertComponent.confirm-alert button.okBtn");
        console.log("Successfully closed the popup.");
      } catch (error) {
        console.error("Failed to close the popup:", error);

        // Fallback: Try closing using JavaScript if Puppeteer click fails
        await page.evaluate(() => {
          const okButton = document.querySelector(
            "div.AlertComponent.confirm-alert button.okBtn",
          );
          if (okButton) {
            okButton.click();
          }
        });
        console.log("Attempted to close popup using JavaScript.");
      }
    }
    // else {
    //   console.log('No popup detected.');
    // }
    // console.log('ps3838 - "Finally" event ticketting: ' + getCurrentTime());
  }
}

async function ticketContraEvent(betEvent) {
  try {
    let targetButtonId = betEvent.contraButtonId3838;
    console.log(
      "ps3838 - Finding event by ID: " +
        targetButtonId +
        "   " +
        getCurrentTime(),
    );

    const targetItemHandle = await page.evaluateHandle((id) => {
      let buttonHandle = document
        .querySelector(".odds-container-live")
        .querySelector(`#${CSS.escape(id)}`)
        .querySelector("span");
      if (buttonHandle) {
        console.log(
          "ps3838 - Ticketing Event, Found button handle within DOM: ",
          buttonHandle,
        );
        return buttonHandle;
      } else {
        console.log(
          "ps3838 - Ticketing Event, Button handle not found within DOM: ",
          buttonHandle,
        );
        return null;
      }
    }, targetButtonId);

    if (!targetItemHandle)
      throw new Error(
        `ps3838 - Bet event NOT FOUND by targetButtonId = ${targetButtonId}, empty handler`,
      );
    const targetItemElement = await targetItemHandle.asElement();
    if (!targetItemElement)
      throw new Error(
        `ps3838 - Bet event asElement NOT FOUND by targetButtonId = ${targetButtonId}, empty handler`,
      );

    console.log(
      "ps3838 - Bet event handle FOUND by targetButtonId = ",
      targetItemHandle,
    );

    // Scroll the element into view
    await page.evaluate((el) => {
      el.scrollIntoView({ behavior: "auto", block: "center" });
    }, targetItemElement);

    // Try to click the element
    console.log("ps3838 - Clicking event: " + getCurrentTime());
    try {
      await targetItemElement.click({ timeout: 800 }); // Add a timeout to the click operation
      console.log("ps3838 - Clicked event: " + getCurrentTime());
    } catch (error) {
      console.error("Failed to click the element:", error);
      // If click fails, try using JavaScript to click
      await page.evaluate((el) => {
        el.click();
      }, targetItemElement);
      console.log("ps3838 - Attempted JavaScript click: " + getCurrentTime());
    }

    // Wait for the odds to be present in the DOM
    await page.waitForSelector("span.odds", { timeout: 3000 }).catch(() => {
      throw new Error(
        "ps3838 - span.odds not found, could be event not clicked or odds cant load",
      );
    });

    // Use page.$eval to select the element and get its text content
    let newOdds = await page.$eval("span.odds", (element) => {
      // Ensure the element has exactly one class, which is 'abc'
      if (element.classList.length === 1) {
        return element.textContent;
      }
      return null;
    });
    if (!newOdds)
      throw new Error("ps3838 - Cant read from betslip, odds not found");
    newOdds = parseFloat(newOdds.trim());

    //get min stake and max stake (even if this fails, no vig odds still will be returned
    let minStake;
    let maxStake;
    try {
      const minValueElement = await page.waitForSelector(".min-value", {
        timeout: 5000,
      });
      const maxValueElement = await page.waitForSelector(".max-value", {
        timeout: 5000,
      });
      minStake = await page.evaluate(
        (element) => element.innerText,
        minValueElement,
      );
      minStake = parseFloat(minStake.replace(/,/g, ""));
      maxStake = await page.evaluate(
        (element) => element.innerText,
        maxValueElement,
      );
      maxStake = parseFloat(maxStake.replace(/,/g, ""));
    } catch (error) {
      console.log("ps3838 - Error getting min and max stake: ", error);
      minStake = null;
      maxStake = null;
    }

    //close the ticketed bet slip
    const closeButton = await page.waitForSelector("div.remove-icon", {
      timeout: 5000,
    });
    await closeButton.click();

    let contraTickettedTime = new Date().toLocaleString();

    console.log("ps3838 - Ticketted data: ", {
      tickettedContraOdds: newOdds,
      minStake,
      maxStake,
      contraTickettedTime,
    });
    return {
      tickettedContraOdds: newOdds,
      minStake,
      maxStake,
      contraTickettedTime,
    };
  } catch (error) {
    console.log("ps3838 - Error in ticketing:", error);
  } finally {
    // Check if the popup exists
    const popupExists = await page.evaluate(() => {
      const popup = document.querySelector("div.AlertComponent.confirm-alert");
      return popup !== null;
    });

    if (popupExists) {
      console.log(
        "Selection unavailable popup detected. Attempting to close...",
      );

      try {
        // Click the OK button
        await page.click("div.AlertComponent.confirm-alert button.okBtn");
        console.log("Successfully closed the popup.");
      } catch (error) {
        console.error("Failed to close the popup:", error);

        // Fallback: Try closing using JavaScript if Puppeteer click fails
        await page.evaluate(() => {
          const okButton = document.querySelector(
            "div.AlertComponent.confirm-alert button.okBtn",
          );
          if (okButton) {
            okButton.click();
          }
        });
        console.log("Attempted to close popup using JavaScript.");
      }
    }
    // else {
    //   console.log('No popup detected.');
    // }
    // console.log('ps3838 - "Finally" event ticketting: ' + getCurrentTime());
  }
}

module.exports = { runPS3838, ticketEvent, ticketContraEvent };
