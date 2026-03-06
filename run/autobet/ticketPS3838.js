const fsSync = require("fs");
const { getCurrentTime } = require("../../utils/getCurrentTime");

const clickTicketPS3838 = async (page, acc, betEvent, targetReference) => {
  //ticketPS3838 by ID
  let buttonId;
  if (targetReference == "reference" && betEvent.referenceButtonId) {
    buttonId = betEvent.referenceButtonId;
    console.log(
      "ps3838 - Finding reference event by ID: " +
        betEvent.referenceButtonId +
        "  " +
        getCurrentTime(),
    );
  } else if (targetReference == "target" && betEvent.buttonId3838) {
    buttonId = betEvent.buttonId3838;
    console.log(
      "ps3838 - Finding event by buttonId3838: " +
        betEvent.buttonId3838 +
        "  " +
        getCurrentTime(),
    );
  } else if (
    targetReference == "referenceContra" &&
    betEvent.referenceContraButtonId
  ) {
    buttonId = betEvent.referenceContraButtonId;
    console.log(
      "ps3838 - Finding reference contra event by ID: " +
        betEvent.referenceContraButtonId +
        "  " +
        getCurrentTime(),
    );
  }

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
  }, buttonId);

  if (!targetItemHandle)
    throw new Error(
      `ps3838 - Bet event NOT FOUND by buttonId = ${buttonId}, empty handler`,
    );
  const targetItemElement = await targetItemHandle.asElement();
  if (!targetItemElement) {
    // await page.setJavaScriptEnabled(false);
    // console.log('JAVASCRIPT DISABLED FOR DEBUGGING PURPOSES');
    throw new Error(
      `ps3838 - Bet event asElement NOT FOUND by buttonId = ${buttonId}, empty handler`,
    );
  }

  console.log(`PS3838 ${acc} - Clicking event: ` + getCurrentTime());

  //consider error handling?

  // Scroll the element into view
  await page.evaluate((el) => {
    el.scrollIntoView({ behavior: "auto", block: "center" });
  }, targetItemElement);

  await page.evaluate((el) => {
    el.click();
  }, targetItemElement);
  console.log(`PS3838 ${acc} - Clicked event: ` + getCurrentTime());
};

const readTicketDataPS3838 = async (
  page,
  betEvent,
  convertToEUString,
  targetReference,
) => {
  //the betEvent here is solely used to cross check home and away name

  let ticketDataPS3838;

  try {
    // Wait for the odds to be present in the DOM
    console.log("PS3838 - Waiting for odds: " + getCurrentTime());
    // Wait for the odds span to be present and have a non-zero, valid value
    await page.waitForFunction(
      () => {
        const spanOdds = document.querySelector("span.odds");
        if (spanOdds && spanOdds.textContent) {
          const oddsValue = parseFloat(spanOdds.textContent.replace(/,/g, ""));
          return !isNaN(oddsValue) && oddsValue !== 0;
        }
        return false;
      },
      { timeout: 5000 },
    );

    console.log("PS3838 - Waited successfully: " + getCurrentTime());

    let ticketHomeName;
    let ticketAwayName;
    if (
      targetReference == "reference" ||
      targetReference == "referenceContra"
    ) {
      ticketHomeName = betEvent.referenceHomeName;
      ticketAwayName = betEvent.referenceAwayName;
    } else if (targetReference == "target") {
      ticketHomeName = betEvent.homeName;
      ticketAwayName = betEvent.awayName;
    }

    // Wait for the betslip to contain both home and away names in the innerHTML before proceeding
    await page.waitForFunction(
      (ticketHomeName, ticketAwayName) => {
        const betBodyItem = document.querySelector("div.bet-body-item");
        if (!betBodyItem) return false;
        const html = betBodyItem.innerHTML;
        return html.includes(ticketHomeName) && html.includes(ticketAwayName);
      },
      { timeout: 10000 },
      ticketHomeName,
      ticketAwayName,
    );

    let tickettedOdds = await page.$eval(
      "div.bet-body-item",
      (element, { ticketHomeName, ticketAwayName }) => {
        // Ensure the element has exactly one class, which is 'odds', check for name also
        let oddsSpanElement = element.querySelector("span.odds");
        if (
          element.innerHTML.includes(ticketAwayName) &&
          element.innerHTML.includes(ticketHomeName) &&
          oddsSpanElement &&
          oddsSpanElement.classList.length === 1
        ) {
          return oddsSpanElement.textContent;
        }
        return null;
      },
      { ticketHomeName, ticketAwayName },
    );

    const convertToEU = eval(`(${convertToEUString})`);
    let tickettedOddsEU = tickettedOdds
      ? convertToEU(parseFloat(tickettedOdds))
      : 0;

    if (!tickettedOdds)
      throw new Error(
        `ps3838 - Cant read from betslip, odds not found. tickettedOdds value: ${tickettedOdds}`,
      );

    tickettedOdds = parseFloat(tickettedOdds.trim());
    let tickettedNoVigOdds = tickettedOdds * betEvent.referenceNoVigIncreased;

    console.log(
      `ps3838 - Ticketted No Vig Odds retrieved ${tickettedNoVigOdds}: ` +
        getCurrentTime(),
    );

    //get min stake and max stake (even if this fails, no vig odds still will be returned
    let minStake;
    let maxStake;
    let accountBalance;
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

      accountBalance = await page.evaluate(() => {
        const el = document.querySelector(
          "div.user-infor > div.infor > div.balance > span.total",
        );
        return el ? el.innerText : null;
      });
      accountBalance = accountBalance
        ? parseFloat(accountBalance.replace(/,/g, ""))
        : null;
    } catch (error) {
      console.log("ps3838 - Error getting min and max stake: ", error);
      minStake = null;
      maxStake = null;
      accountBalance = null;
    }

    let referenceTickettedTime = new Date();

    ticketDataPS3838 = {
      unconvertedTickettedOdds: tickettedOdds,
      tickettedOddsEU: tickettedOddsEU,
      tickettedNoVigOddsEU: null, // Initialize the property
      // referenceVig: betEvent.referenceVig,
      // referenceNoVigIncreased: betEvent.referenceNoVigIncreased,
      accountBalance: accountBalance,
      minStake,
      maxStake,
      // referenceTickettedTime
    };
  } catch (e) {
    console.log("ps3838 - Error reading ticket data: ", e);
  } finally {
    // Check if the popup exists
    const popupExists = await page.evaluate(() => {
      const popup = document.querySelector("div.AlertComponent");
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
  }
  return ticketDataPS3838;
};

const ticketEventPS3838 = async (
  page,
  acc,
  betEvent,
  convertToEUString,
  closeTicket,
  targetReference,
) => {
  await clickTicketPS3838(page, acc, betEvent, targetReference);
  let ticketDataPS3838 = await readTicketDataPS3838(
    page,
    betEvent,
    convertToEUString,
    targetReference,
  );

  let params = JSON.parse(
    fsSync.readFileSync(`TargetBookie/${acc}.json`, "utf-8"),
  );

  if (targetReference === "target") {
    ticketDataPS3838.tickettedNoVigOddsEU =
      ticketDataPS3838.tickettedOddsEU * betEvent.noVigIncreased;
  } else if (targetReference === "reference") {
    if ((params.devigMethod = "brim")) {
      //use "fixed vig" method when brim
      let tickettedContraOddsEU =
        1 / (1 + betEvent.referenceVig - 1 / ticketDataPS3838.tickettedOddsEU);
      ticketDataPS3838.tickettedNoVigOddsEU =
        1 / (1 - 1 / tickettedContraOddsEU);
      ticketDataPS3838.vig = betEvent.referenceVig;
    } else {
      ticketDataPS3838.tickettedNoVigOddsEU =
        ticketDataPS3838.tickettedOddsEU * betEvent.referenceNoVigIncreased;
    }
  }

  ticketDataPS3838.tickettedTime = new Date();

  //close all ticketed bet slips
  if (closeTicket) {
    await page.evaluate(() => {
      const removeAllButtons = document.querySelectorAll("div.remove-icon");
      removeAllButtons.forEach((button) => button.click());
    });
  }

  return ticketDataPS3838;
};

module.exports = {
  clickTicketPS3838,
  readTicketDataPS3838,
  ticketEventPS3838,
};
