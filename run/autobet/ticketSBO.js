const { getCurrentTime } = require("../../utils/getCurrentTime");

const clickTicketSBO = async (page, acc, betEvent, targetReference) => {
  const targetItemHandle = await page.evaluateHandle(
    ({ betEvent, targetReference }) => {
      const calculateParam = (str) => {
        if (!str) return null;
        if (str.split("-").length > 1)
          return (
            str.split("-").reduce((sum, num) => sum + parseFloat(num), 0) / 2
          );
        else return parseFloat(str);
      };

      if (targetReference == "reference") {
        ticketHomeName = betEvent.referenceHomeName;
        ticketAwayName = betEvent.referenceAwayName;
      } else if (targetReference == "target") {
        ticketHomeName = betEvent.homeName;
        ticketAwayName = betEvent.awayName;
      }

      let targetItem = null;
      let matchesRow = document.querySelectorAll(
        ".oddsDisplayHeader.live.sticky + .oddsDisplay_content .matches_row",
      ); // get all live matches

      let cellNumber;
      let itemNumber;
      if ([11, 12, 13].includes(betEvent.marketId)) {
        // 1X2
        cellNumber = betEvent.periodId === 4 ? 3 : 6;
        itemNumber =
          betEvent.marketId === 11 ? 0 : betEvent.marketId === 12 ? 2 : 1;
      } else if ([17, 18].includes(betEvent.marketId)) {
        // HDP
        cellNumber = betEvent.periodId === 4 ? 1 : 4;
        itemNumber = betEvent.marketId === 17 ? 0 : 1;
      } else if ([19, 20].includes(betEvent.marketId)) {
        // OU
        cellNumber = betEvent.periodId === 4 ? 2 : 5;
        itemNumber = betEvent.marketId === 19 ? 0 : 1;
      }

      matchesRowsLoop: for (const row of matchesRow) {
        // const leagueName = row.parentNode.parentNode.parentNode.querySelector('span.leagueTitle_name')?.innerText;
        // if(!leagueName.trim().toLowerCase().includes(betEvent.leagueName?.trim().toLowerCase())) {
        //     continue; // if league name does not match then skip
        // }

        const teamName = row.querySelectorAll("div.team");
        const homeName = teamName[0]?.innerText;
        const awayName = teamName[1]?.innerText;

        if (
          !homeName
            .trim()
            .toLowerCase()
            .includes(ticketHomeName?.trim().toLowerCase()) ||
          !awayName
            .trim()
            .toLowerCase()
            .includes(ticketAwayName?.trim().toLowerCase())
        ) {
          continue; // if home name or away does not match then skip to next row
        }

        const subRows = row.querySelectorAll(".matches_subRow");
        for (const subRow of subRows) {
          const targetCell = subRow.querySelectorAll("div.matches_row_cell")[
            cellNumber
          ];
          if (targetCell?.innerText) {
            // get market cell
            const oddsPoint = targetCell.querySelectorAll("div.oddsPoint");
            let param;
            if (oddsPoint[0]?.innerText) {
              param = calculateParam(oddsPoint[0]?.innerText);
              param = betEvent.marketId == 17 ? param * -1 : param; // AH1
            } else {
              param = calculateParam(oddsPoint[1]?.innerText);
              param = betEvent.marketId == 18 ? param * -1 : param; // AH2
            }

            if (
              param === betEvent.marketParam ||
              [11, 12, 13].includes(betEvent.marketId)
            ) {
              // check if param matches or is 1X2
              targetItem = targetCell.querySelectorAll(".oddsItem")[itemNumber];
              if (targetItem) {
                const odds = targetItem.querySelector("div.oddsValue");
                return odds; // exit both loops since the target event is found
              }
            }
          }
        }
      }
      return null;
    },
    { betEvent, targetReference },
  );

  if (!targetItemHandle)
    throw new Error(`SBO ${acc} - Bet event not found, empty handler`);
  const targetItemElement = await targetItemHandle.evaluateHandle(
    (element) => element,
  );
  if (!targetItemElement.asElement())
    throw new Error(`SBO ${acc} - Bet event not found, empty element`);
  console.log(`SBO ${acc} - Clicking event: ` + getCurrentTime());
  await targetItemElement.asElement().click();
  console.log(`SBO ${acc} - Clicked event: ` + getCurrentTime());
};

const readTicketDataSBO = async (page, convertToEUString) => {
  await page.waitForSelector(
    "span.optionOdds.optionOdds-price strong.optionOddsPrice",
    { timeout: 5000 },
  );
  console.log("SBO - Waiting for detailText_item: " + getCurrentTime());
  await page.waitForSelector("li.detailText_item", { timeout: 5000 });

  // Wait for the min stake value to be present and non-zero
  await page
    .waitForFunction(
      () => {
        const detailTextItems = document.querySelectorAll("li.detailText_item");
        // Ensure the element exists and has the span containing the value
        if (detailTextItems && detailTextItems.length > 0) {
          const minStakeElement =
            detailTextItems[0].querySelector("span:last-child");
          if (minStakeElement && minStakeElement.innerText) {
            // Parse the text content and check if it's a non-zero number
            const minStake = parseFloat(
              minStakeElement.innerText.replace(/,/g, ""),
            );
            // Simplified check: ensure it's a valid number (not NaN) and not zero
            return !isNaN(minStake) && minStake !== 0;
          }
        }
        return false; // Condition not met yet
      },
      { timeout: 10000 },
    )
    .catch((error) => {
      console.log("SBO - Timeout waiting for non-zero min stake value.");
      // Optionally re-throw or handle the timeout error as needed
      throw new Error("SBO - Timed out waiting for min stake to be non-zero");
    });

  console.log("SBO - Waited successfully: " + getCurrentTime());

  tickettedSBOdata = await page.evaluate(async (convertToEUString) => {
    //wait a while to prevent bugs, jic havent load finish
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      const tickettedOdds = document.querySelector(
        "span.optionOdds.optionOdds-price strong.optionOddsPrice",
      );
      const convertToEU = eval(`(${convertToEUString})`);
      const tickettedOddsEU = tickettedOdds
        ? convertToEU(parseFloat(tickettedOdds.textContent))
        : 0;

      const accountBalance = parseFloat(
        document
          .querySelector("span.balance")
          ?.innerText.replace(/[^\d.]/g, ""), // Remove everything except digits and dot
      );

      const detailTextItems = document.querySelectorAll("li.detailText_item");
      if (detailTextItems) {
        const minStake = parseFloat(
          detailTextItems[0].querySelector("span:last-child")?.innerText,
        );
        const maxStake = parseFloat(
          detailTextItems[1]
            .querySelector("span:last-child")
            ?.innerText.replace(/,/g, ""),
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
  return tickettedSBOdata;
};

const ticketEventSBO = async (
  page,
  acc,
  betEvent,
  convertToEUString,
  closeTicket,
  targetReference,
) => {
  //currently not in queue, shoudld make it in queue
  await clickTicketSBO(page, acc, betEvent, targetReference);
  let ticketDataSBO = await readTicketDataSBO(
    page,
    convertToEUString,
    targetReference,
  );

  //taking note of targetReference de "noVigIncrease"
  if (targetReference === "target") {
    ticketDataSBO.tickettedNoVigOddsEU =
      ticketDataSBO.tickettedOddsEU * betEvent.noVigIncreased;
  } else if (targetReference === "reference") {
    ticketDataSBO.tickettedNoVigOddsEU =
      ticketDataSBO.tickettedOddsEU * betEvent.referenceNoVigIncreased;
  }

  ticketDataSBO.tickettedTime = new Date();

  if (closeTicket) {
    await page.evaluate(() => {
      const closeButton = document.querySelector("span.ticket_header_cancel");
      if (closeButton) {
        closeButton.click();
      }
    });
  }

  return ticketDataSBO;
};

module.exports = {
  clickTicketSBO,
  readTicketDataSBO,
  ticketEventSBO,
};
