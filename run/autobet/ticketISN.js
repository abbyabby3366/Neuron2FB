const { getCurrentTime } = require("../../utils/getCurrentTime");

const clickTicketISN = async (page, acc, betEvent, targetReference) => {
  //ticketISN by ID
  //if this ticketing is not origin from normal SBB (DEPRECATED)
  // if (!betEvent.buttonIdISN) {
  //   betEvent.buttonIdISN = betEvent.referenceButtonId;
  //   console.log('betEvent.buttonIdISN', betEvent.buttonIdISN)
  // }

  if (targetReference == "reference") {
    ticketHomeName = betEvent.referenceHomeName;
    ticketAwayName = betEvent.referenceAwayName;
  } else if (targetReference == "target") {
    ticketHomeName = betEvent.homeName;
    ticketAwayName = betEvent.awayName;
  }

  const targetItemHandle = await page.evaluateHandle((betEvent) => {
    const targetItem = document.querySelector(
      `a[data-id="${betEvent.buttonIdISN}"]`,
    );
    if (!targetItem) {
      throw new Error(`Element with ID ${betEvent.buttonIdISN} not found`);
    }
    return targetItem;
  }, betEvent);

  if (!targetItemHandle)
    throw new Error(`ISN ${acc} - Bet event not found, empty handler`);
  const targetItemElement = await targetItemHandle.evaluateHandle(
    (element) => element,
  );
  if (!targetItemElement.asElement())
    throw new Error(`ISN ${acc} - Bet event not found, empty element`);
  console.log(`ISN ${acc} - Clicking event: ` + getCurrentTime());
  await targetItemElement.asElement().click();
  console.log(`ISN ${acc} - Clicked event: ` + getCurrentTime());
};

const readTicketDataISN = async (page, convertToEUString) => {
  let ticketDataISN;
  try {
    ticketDataISN = await page.evaluate(async (convertToEUString) => {
      //wait for a while to let it load finish
      await new Promise((resolve) => setTimeout(resolve, 200));
      try {
        const tickettedOdds = document.querySelector("#ticket_detail .odds");

        const convertToEU = eval(`(${convertToEUString})`);
        const tickettedOddsEU = tickettedOdds
          ? convertToEU(parseFloat(tickettedOdds.textContent))
          : 0;

        const accountBalance = parseFloat(
          document
            .querySelector('span.pull-right.focusable[data-tooltip="CNY"]')
            .textContent.replace(/[^\d.]/g, "") +
            document.querySelector(
              'span.pull-right.focusable[data-tooltip="CNY"] span.cents',
            ).textContent,
        );

        // Updated selectors to get min/max stake
        const minStake = parseFloat(
          document
            .querySelector(
              "#ticket_detail .info-group:nth-of-type(3) .info-val",
            )
            .textContent.replace(/[^\d.]/g, ""),
        );
        const maxStake = parseFloat(
          document
            .querySelector(
              "#ticket_detail .info-group:nth-of-type(4) .info-val",
            )
            .textContent.replace(/[^\d.]/g, ""),
        );

        return {
          unconvertedTickettedOdds: parseFloat(tickettedOdds.textContent),
          tickettedOddsEU,
          accountBalance,
          minStake,
          maxStake,
        };
      } catch {
        return {
          unconvertedTickettedOdds: null,
          tickettedOddsEU: null,
          accountBalance: null,
          minStake: null,
          maxStake: null,
        };
      }
    }, convertToEUString);
  } catch (e) {
    console.log("Error in readTicketDataISN", e);
  } finally {
    // Check if the popup exists
    const popupExists = await page.evaluate(() => {
      const popup = document.querySelector("div.modal-container");
      return popup !== null;
    });

    if (popupExists) {
      console.log(
        "Selection unavailable popup detected. Attempting to close...",
      );

      try {
        // Click the cancel button
        await page.click(
          "div.modal-container div.modal-footer button.btn-cancel",
        );
        console.log("Successfully closed the popup.");
      } catch (error) {
        console.error("Failed to close the popup:", error);

        // Fallback: Try closing using JavaScript if Puppeteer click fails
        await page.evaluate(() => {
          const cancelButton = document.querySelector(
            "div.modal-container div.modal-footer button.btn-cancel",
          );
          if (cancelButton) {
            cancelButton.click();
          }
        });
        console.log("Attempted to close popup using JavaScript.");
      }
    }
  }
  return ticketDataISN;
};

const ticketEventISN = async (
  page,
  acc,
  betEvent,
  convertToEUString,
  closeTicket,
  targetReference,
) => {
  await clickTicketISN(page, acc, betEvent, targetReference);
  let ticketDataISN = await readTicketDataISN(
    page,
    convertToEUString,
    targetReference,
  );

  //taking note of targetReference de "noVigIncrease"
  if (targetReference === "target") {
    ticketDataISN.tickettedNoVigOddsEU =
      ticketDataISN.tickettedOddsEU * betEvent.noVigIncreased;
  } else if (targetReference === "reference") {
    ticketDataISN.tickettedNoVigOddsEU =
      ticketDataISN.tickettedOddsEU * betEvent.referenceNoVigIncreased;
  }

  ticketDataISN.tickettedTime = new Date();

  if (closeTicket) {
    await page.evaluate(() => {
      const closeButton = document.querySelector(
        "#ticket_wrap > div.panel-heading > button > span:nth-child(1)",
      );
      if (closeButton) {
        closeButton.click();
      }
    });
  }

  return ticketDataISN;
};

module.exports = {
  clickTicketISN,
  readTicketDataISN,
  ticketEventISN,
};
