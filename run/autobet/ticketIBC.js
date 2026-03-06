const { getCurrentTime } = require("../../utils/getCurrentTime");

const clickTicketIBC = async (page, acc, betEvent, targetReference) => {
  //ticketIBC by ID

  const targetItemHandle = await page.evaluateHandle(
    ({ betEvent, targetReference }) => {
      let buttonId;
      if (targetReference == "reference") {
        buttonId = betEvent.referenceButtonId;
      } else if (targetReference == "target") {
        buttonId = betEvent.buttonIdIBC;
      }

      const targetItem = document.getElementById(`${buttonId}`);
      if (!targetItem) {
        throw new Error(`Element with ID ${buttonId} not found`);
      }
      return targetItem;
    },
    { betEvent, targetReference },
  );

  if (!targetItemHandle)
    throw new Error(`IBC ${acc} - Bet event not found, empty handler`);
  const targetItemElement = await targetItemHandle.evaluateHandle(
    (element) => element,
  );
  if (!targetItemElement.asElement())
    throw new Error(`IBC ${acc} - Bet event not found, empty element`);
  console.log(`IBC ${acc} - Clicking event: ` + getCurrentTime());
  await targetItemElement.asElement().click();
  console.log(`IBC ${acc} - Clicked event: ` + getCurrentTime());
};

const readTicketDataIBC = async (page, convertToEUString) => {
  let tickettedIBCdata = await page.evaluate(async (convertToEUString) => {
    //wait a while to prevent bugs, jic havent load finish
    await new Promise((resolve) => setTimeout(resolve, 200));
    try {
      const tickettedOdds = document.querySelector(
        "#betcart > div.c-betcart__main > div.c-betcart__container > div > div > div > div.c-betting-group > div > div.c-ticket > div.c-ticket__main > div.c-ticket__odds > span.c-text-odds > span",
      );

      const convertToEU = eval(`(${convertToEUString})`);
      const tickettedOddsEU = tickettedOdds
        ? convertToEU(parseFloat(tickettedOdds.textContent))
        : 0;

      const accountBalance = parseFloat(
        document
          .querySelector(
            "#leftBar > div > div.scroll-panel.disable-passive > div.scroll-content > div.c-side-features > div.c-side-account > div > div.c-side-account__table > div > div > div.c-side-account__col > span:nth-child(2)",
          )
          .textContent.replace(",", ""),
      );

      const inputBox = document.querySelector(
        "#betcart > div.c-betcart__main > div.c-betcart__container > div > div > div > div.c-betting-group > div > div.c-betting-stake-group > div.c-betting-stake > div > input",
      );

      if (inputBox) {
        const minStake = parseFloat(
          inputBox["placeholder"].split("-")[0].replace(",", ""),
        );
        const maxStake = parseFloat(
          inputBox["placeholder"].split("-")[1].replace(",", ""),
        );

        return {
          unconvertedTickettedOdds: parseFloat(tickettedOdds.textContent),
          tickettedOddsEU,
          accountBalance,
          minStake,
          maxStake,
        };
      }
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
  return tickettedIBCdata;
};

const ticketEventIBC = async (
  page,
  acc,
  betEvent,
  convertToEUString,
  closeTicket,
  targetReference,
) => {
  //currently not in queue, shoudld make it in queue
  await clickTicketIBC(page, acc, betEvent, targetReference);
  let ticketDataIBC = await readTicketDataIBC(
    page,
    convertToEUString,
    targetReference,
  );
  ticketDataIBC.tickettedNoVigOddsEU =
    ticketDataIBC.tickettedOddsEU * betEvent.referenceNoVigIncreased;
  ticketDataIBC.vig = betEvent.vig;
  ticketDataIBC.oddsNoVigIncreased = betEvent.noVigIncreased;
  ticketDataIBC.tickettedTime = new Date();

  // if (closeTicket) {
  //   await page.evaluate(() => {
  //     const closeButton = document.querySelector('span.ticket_header_cancel');
  //     if (closeButton) {
  //       closeButton.click();
  //     }
  //   });
  // }

  return ticketDataIBC;
};

module.exports = {
  clickTicketIBC,
  readTicketDataIBC,
  ticketEventIBC,
};
