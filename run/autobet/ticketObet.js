const { getCurrentTime } = require("../../utils/getCurrentTime");

const clickTicketObet = async (page, acc, betEvent, targetReference) => {
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
      let matchesRow = document.querySelectorAll("table.matches.live tr.match"); // get all live matches

      let cellNumber;
      let itemNumber;
      if ([11, 12, 13].includes(betEvent.marketId)) {
        // 1X2
        cellNumber = betEvent.periodId === 4 ? 7 : 13; // Full Time: column 8, 1st Half: column 14
        itemNumber =
          betEvent.marketId === 11 ? 0 : betEvent.marketId === 12 ? 2 : 1;
      } else if ([17, 18].includes(betEvent.marketId)) {
        // HDP
        cellNumber = betEvent.periodId === 4 ? 4 : 10; // Full Time: column 5 (odds), 1st Half: column 11 (odds)
        itemNumber = betEvent.marketId === 17 ? 0 : 1;
      } else if ([19, 20].includes(betEvent.marketId)) {
        // OU
        cellNumber = betEvent.periodId === 4 ? 6 : 12; // Full Time: column 7 (odds), 1st Half: column 13 (odds)
        itemNumber = betEvent.marketId === 19 ? 1 : 2; // Over: position 1, Under: position 2
      }

      matchesRowsLoop: for (let index = 0; index < matchesRow.length; index++) {
        const row = matchesRow[index];

        // Get team names with fallback logic (same as scraper)
        let homeName, awayName;
        const teamElements = row.querySelectorAll("span.team");
        if (teamElements.length >= 2) {
          // Current row has team data
          homeName = teamElements[0]?.innerText;
          awayName = teamElements[1]?.innerText;
        } else {
          // Current row doesn't have team data, look for previous row with team data
          let searchIndex = index - 1;
          let previousRow = null;

          while (searchIndex >= 0) {
            const candidateRow = matchesRow[searchIndex];
            const candidateTeamElements =
              candidateRow.querySelectorAll("span.team");
            if (candidateTeamElements.length >= 2) {
              previousRow = candidateRow;
              break;
            }
            searchIndex--;
          }

          if (previousRow) {
            const prevTeamElements = previousRow.querySelectorAll("span.team");
            homeName = prevTeamElements[0]?.innerText;
            awayName = prevTeamElements[1]?.innerText;
          }
        }

        if (
          homeName?.trim().toLowerCase() !==
            ticketHomeName?.trim().toLowerCase() ||
          awayName?.trim().toLowerCase() !==
            ticketAwayName?.trim().toLowerCase()
        ) {
          continue; // if home name or away does not match then skip to next row
        }

        const tds = row.querySelectorAll("td");
        const targetCell = tds[cellNumber];

        if (targetCell?.innerText) {
          // get market cell
          let param = null;
          let paramMatches = false;

          // Handle different market types
          if ([17, 18].includes(betEvent.marketId)) {
            // HDP
            // Check parameter in handicap cell (previous column)
            const hdpCell = tds[cellNumber - 1];
            const hdpDivs = hdpCell.querySelectorAll(":scope > div");
            for (let i = 0; i < hdpDivs.length; i++) {
              const divText = hdpDivs[i].innerText.trim();
              if (divText && divText !== "&nbsp;" && divText !== "") {
                param = calculateParam(divText);
                param =
                  (i === 0 && betEvent.marketId === 17) ||
                  (i !== 0 && betEvent.marketId === 18)
                    ? param * -1
                    : param;
                paramMatches = param === betEvent.marketParam;
                break;
              }
            }
          } else if ([19, 20].includes(betEvent.marketId)) {
            // OU
            // Check parameter in handicap cell (previous column)
            const hdpCell = tds[cellNumber - 1];
            const hdpDivs = hdpCell.querySelectorAll(":scope > div");
            for (let i = 0; i < hdpDivs.length; i++) {
              const divText = hdpDivs[i].innerText.trim();
              if (divText && divText !== "&nbsp;" && divText !== "") {
                param = calculateParam(divText);
                paramMatches = param === betEvent.marketParam;
                break;
              }
            }
          } else {
            // 1X2 doesn't need parameter matching
            paramMatches = true;
          }

          if (paramMatches) {
            // check if param matches or is 1X2
            const oddsCells = targetCell.querySelectorAll(":scope > div");
            targetItem = oddsCells[itemNumber];
            if (targetItem) {
              return targetItem; // exit both loops since the target event is found
            }
          }
        }
      }
      return null;
    },
    { betEvent, targetReference },
  );

  if (!targetItemHandle)
    throw new Error(`Obet ${acc} - Bet event not found, empty handler`);
  const targetItemElement = await targetItemHandle.evaluateHandle(
    (element) => element,
  );
  if (!targetItemElement.asElement())
    throw new Error(`Obet ${acc} - Bet event not found, empty element`);
  console.log(`Obet ${acc} - Clicking event: ` + getCurrentTime());
  await targetItemElement.asElement().click();
  console.log(`Obet ${acc} - Clicked event: ` + getCurrentTime());
};

const readTicketDataObet = async (page, convertToEUString, targetReference) => {
  // Wait for min/max stake values to be loaded
  await page.waitForFunction(
    () => {
      const maxDiv = document.querySelector("div.content.tickets.live .max");
      if (!maxDiv) return false;
      const minMaxText = maxDiv.innerText;
      if (!minMaxText) return false;
      const minMaxMatch = minMaxText.match(
        /(\d+(?:,\d+)?)\s*-\s*(\d+(?:,\d+)?)/,
      );
      return minMaxMatch && minMaxMatch[1] && minMaxMatch[2];
    },
    { timeout: 10000 },
  );

  const ticketData = await page.evaluate(
    async (convertToEUString, targetReference) => {
      //wait a while to prevent bugs, jic havent load finish
      await new Promise((resolve) => setTimeout(resolve, 200));

      try {
        const convertToEU = eval(`(${convertToEUString})`);

        // Get the ticket element
        const ticket = document.querySelector("div.content.tickets.live");
        if (!ticket)
          return {
            unconvertedTickettedOdds: null,
            tickettedOddsEU: null,
            accountBalance: null,
            minStake: null,
            maxStake: null,
          };

        // Extract odds
        const selection = ticket.querySelector(".bet-info .selection");
        const oddsElement = selection?.querySelector(".odds");

        let unconvertedTickettedOdds = null;
        const changedOddsElement = oddsElement?.querySelector(".el-changed");
        if (changedOddsElement) {
          const changedOddsText = changedOddsElement.innerText.trim();
          const oddsValue = parseFloat(changedOddsText);
          if (oddsValue > 0) {
            unconvertedTickettedOdds = oddsValue;
          }
        } else {
          // Fallback to regular odds if no changed odds
          const regularOddsElement = oddsElement?.querySelector(
            "span:not(.el-changed)",
          );
          if (regularOddsElement) {
            const regularOddsText = regularOddsElement.innerText.trim();
            unconvertedTickettedOdds = parseFloat(regularOddsText);
          }
        }

        const tickettedOddsEU = unconvertedTickettedOdds
          ? convertToEU(unconvertedTickettedOdds)
          : 0;

        // Extract min/max stakes
        const maxDiv = ticket.querySelector(".max");
        const minMaxText = maxDiv?.innerText;
        let minStake = null,
          maxStake = null;

        if (minMaxText) {
          const minMaxMatch = minMaxText.match(
            /(\d+(?:,\d+)?)\s*-\s*(\d+(?:,\d+)?)/,
          );
          if (minMaxMatch) {
            minStake = parseFloat(minMaxMatch[1].replace(",", ""));
            maxStake = parseFloat(minMaxMatch[2].replace(",", ""));
          }
        }

        return {
          unconvertedTickettedOdds,
          tickettedOddsEU,
          accountBalance: null,
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
    },
    convertToEUString,
    targetReference,
  );
  return ticketData;
};

const ticketEventObet = async (
  page,
  acc,
  betEvent,
  convertToEUString,
  closeTicket,
  targetReference,
) => {
  // Get account balance from main page context first
  let accountBalance = 0;
  try {
    const balanceElement = await page.$(
      "#panel-header > div.header-top.full > div > span > span.credits > span.group > span.text",
    );
    if (balanceElement) {
      const balanceText = await balanceElement.evaluate((el) => el.innerText);
      const balanceMatch = balanceText.match(/[\d,]+\.?\d*/);
      if (balanceMatch) {
        accountBalance = parseFloat(balanceMatch[0].replace(/,/g, ""));
      }
    }
  } catch (e) {
    console.log("Could not get account balance:", e.message);
  }

  // Get the iframe reference and reassign page to point to it
  const frames = await page.frames();
  const frame = frames.find((f) => f.name() === "frame-sport");
  if (!frame) throw new Error("iframe#frame-sport not found");
  page = frame; // Reassign page to point to the frame

  try {
    //currently not in queue, shoudld make it in queue
    await clickTicketObet(page, acc, betEvent, targetReference);
    let ticketDataObet = await readTicketDataObet(
      page,
      convertToEUString,
      targetReference,
    );
    // Set the account balance we got from main page
    ticketDataObet.accountBalance = accountBalance;

    //taking note of targetReference de "noVigIncrease"
    if (targetReference === "target") {
      ticketDataObet.tickettedNoVigOddsEU =
        ticketDataObet.tickettedOddsEU * betEvent.noVigIncreased;
    } else if (targetReference === "reference") {
      ticketDataObet.tickettedNoVigOddsEU =
        ticketDataObet.tickettedOddsEU * betEvent.referenceNoVigIncreased;
    }

    ticketDataObet.tickettedTime = new Date();

    if (closeTicket) {
      await page.evaluate(() => {
        const closeButton = document.querySelector(
          "#menu-betslip button.btn-cancel",
        );
        if (closeButton) {
          closeButton.click();
        }
      });
    }

    return ticketDataObet;
  } catch (e) {
    console.log(e.message);
  }
};

module.exports = {
  clickTicketObet,
  readTicketDataObet,
  ticketEventObet,
};
