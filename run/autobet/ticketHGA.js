const { getCurrentTime } = require("../../utils/getCurrentTime");

const clickTicketHGA = async (page, acc, betEvent) => {
  const targetItemHandle = await page.evaluateHandle((betEvent) => {
    const targetItem = document.querySelector(`#${betEvent.buttonIdHGA}`);
    if (!targetItem) {
      throw new Error(`Element with ID ${betEvent.buttonIdISN} not found`);
    }
    return targetItem;
  }, betEvent);

  if (!targetItemHandle)
    throw new Error(`HGA ${acc} - Bet event not found, empty handler`);
  const targetItemElement = await targetItemHandle.evaluateHandle(
    (element) => element,
  );
  if (!targetItemElement.asElement())
    throw new Error(`HGA ${acc} - Bet event not found, empty element`);
  console.log(`HGA ${acc} - Clicking event: ` + getCurrentTime());
  await targetItemElement.asElement().click();
  console.log(`HGA ${acc} - Clicked event: ` + getCurrentTime());

  //check if is correct ticketted Data is correct
};

const readTicketDataHGA = async (page, convertToEUString) => {
  let tickettedHGAdata = await page.evaluate(async (convertToEUString) => {
    //wait for a while to let it load finish (not sure if 1000 is too long)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // await new Promise(resolve => setTimeout(resolve, 200));
    try {
      const tickettedOdds = parseFloat(
        document.querySelector("#bet_ior").innerText,
      );

      const convertToEU = eval(`(${convertToEUString})`);
      const tickettedOddsEU = tickettedOdds ? convertToEU(tickettedOdds) : null;

      const accountBalance = parseFloat(
        document.querySelector("#acc_credit").textContent.replace(/,/g, ""),
      );

      // // Updated selectors to get min/max stake
      // const minStake = parseFloat(document.querySelector('#ticket_detail .info-group:nth-of-type(3) .info-val').textContent.replace(/[^\d.]/g, ''));
      // const maxStake = parseFloat(document.querySelector('#ticket_detail .info-group:nth-of-type(4) .info-val').textContent.replace(/[^\d.]/g, ''));

      const minStake = 50;
      const maxStake = 100000; //set temporary first

      return {
        unconvertedTickettedOdds: tickettedOdds,
        tickettedOddsEU: tickettedOddsEU,
        accountBalance: accountBalance,
        minStake: minStake,
        maxStake: maxStake,
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
  return tickettedHGAdata;
};

const ticketEventHGA = async (
  page,
  acc,
  betEvent,
  convertToEUString,
  closeTicket,
  targetReference,
) => {
  //currently not in queue, shoudld make it in queue
  await clickTicketHGA(page, acc, betEvent, targetReference);
  let ticketDataHGA = await readTicketDataHGA(
    page,
    convertToEUString,
    targetReference,
  );
  await checkTicketDataHGA(page, acc, betEvent);

  //taking note of targetReference de "noVigIncrease"
  if (targetReference === "target") {
    ticketDataHGA.tickettedNoVigOddsEU =
      ticketDataHGA.tickettedOddsEU * betEvent.noVigIncreased;
  } else if (targetReference === "reference") {
    ticketDataHGA.tickettedNoVigOddsEU =
      ticketDataHGA.tickettedOddsEU * betEvent.referenceNoVigIncreased;
  }

  ticketDataHGA.tickettedTime = new Date();

  if (closeTicket) {
    await page.evaluate(() => {
      const closeButton = document.querySelector("button#order_close");
      if (closeButton) {
        closeButton.click();
      }
    });
  }

  return ticketDataHGA;
};

//currently on treat HGA as target (no treat as reference)
const checkTicketDataHGA = async (page, acc, betEvent) => {
  await page.waitForFunction(
    "document.querySelector('#bet_chose_con')?.innerText?.trim()",
    { timeout: 10000 },
  );

  const ticketInfo = await page.evaluate(() => {
    const homeName = document.querySelector("#bet_team_h")?.innerText.trim();
    const awayName = document.querySelector("#bet_team_c")?.innerText.trim();
    const menuType = document.querySelector("#bet_menutype")?.innerText.trim();
    const chosenTeam = document
      .querySelector("#bet_chose_team")
      ?.innerText.trim();
    const chosenCon = document.querySelector("#bet_chose_con")?.innerText;
    return { homeName, awayName, menuType, chosenTeam, chosenCon };
  });

  console.log("CheckTicketDataHGA", ticketInfo);

  if (ticketInfo.homeName !== betEvent.homeName) {
    throw new Error(
      `HGA ${acc} - Error in checkTicketDataHGA : Home name mismatch. Page: ${ticketInfo.homeName}, BetEvent: ${betEvent.homeName}`,
    );
  }

  if (ticketInfo.awayName !== betEvent.awayName) {
    throw new Error(
      `HGA ${acc} - Error in checkTicketDataHGA : Away name mismatch. Page: ${ticketInfo.awayName}, BetEvent: ${betEvent.awayName}`,
    );
  }

  const calculateParam = (str) => {
    if (!str) return null;
    const nums = str.split("/").map((s) => parseFloat(s.trim()));
    if (nums.length == 1) return nums[0];
    if (str.trim().startsWith("-") && nums[0] < 0 && nums.length > 1) {
      nums[1] = -Math.abs(nums[1]);
    }
    return (nums[0] + nums[1]) / 2;
  };

  if (betEvent.marketId === 17) {
    if (!ticketInfo.menuType || !ticketInfo.menuType.includes("Handicap")) {
      throw new Error(
        `HGA ${acc} - Error in checkTicketDataHGA : Market type mismatch for marketId 17 (AH1). Page: ${ticketInfo.menuType}`,
      );
    }
    if (ticketInfo.chosenTeam !== betEvent.homeName) {
      throw new Error(
        `HGA ${acc} - Error in checkTicketDataHGA : Chosen team mismatch for marketId 17 (AH1). Page: ${ticketInfo.chosenTeam}, Expected: ${betEvent.homeName}`,
      );
    }
    const marketParam = calculateParam(ticketInfo.chosenCon);
    if (marketParam !== betEvent.marketParam) {
      throw new Error(
        `HGA ${acc} - Error in checkTicketDataHGA : Market param mismatch for marketId 17 (AH1). Page: ${marketParam}, BetEvent: ${betEvent.marketParam}`,
      );
    }
  } else if (betEvent.marketId === 18) {
    if (!ticketInfo.menuType || !ticketInfo.menuType.includes("Handicap")) {
      throw new Error(
        `HGA ${acc} - Error in checkTicketDataHGA : Market type mismatch for marketId 18 (AH2). Page: ${ticketInfo.menuType}`,
      );
    }
    if (ticketInfo.chosenTeam !== betEvent.awayName) {
      throw new Error(
        `HGA ${acc} - Error in checkTicketDataHGA : Chosen team mismatch for marketId 18 (AH2). Page: ${ticketInfo.chosenTeam}, Expected: ${betEvent.awayName}`,
      );
    }
    const marketParam = calculateParam(ticketInfo.chosenCon);
    if (marketParam !== betEvent.marketParam) {
      throw new Error(
        `HGA ${acc} - Error in checkTicketDataHGA : Market param mismatch for marketId 18 (AH2). Page: ${marketParam}, BetEvent: ${betEvent.marketParam}`,
      );
    }
  } else if (betEvent.marketId === 19) {
    if (!ticketInfo.menuType || !ticketInfo.menuType.includes("Over / Under")) {
      throw new Error(
        `HGA ${acc} - Error in checkTicketDataHGA : Market type mismatch for marketId 19 (Over). Page: ${ticketInfo.menuType}`,
      );
    }
    if (ticketInfo.chosenTeam !== "Over") {
      throw new Error(
        `HGA ${acc} - Error in checkTicketDataHGA : Chosen team mismatch for marketId 19 (Over). Page: ${ticketInfo.chosenTeam}, Expected: "Over"`,
      );
    }
    const marketParam = calculateParam(ticketInfo.chosenCon);
    if (marketParam !== betEvent.marketParam) {
      throw new Error(
        `HGA ${acc} - Error in checkTicketDataHGA : Market param mismatch for marketId 19 (Over). Page: ${marketParam}, BetEvent: ${betEvent.marketParam}`,
      );
    }
  } else if (betEvent.marketId === 20) {
    if (!ticketInfo.menuType || !ticketInfo.menuType.includes("Over / Under")) {
      throw new Error(
        `HGA ${acc} - Error in checkTicketDataHGA : Market type mismatch for marketId 20 (Under). Page: ${ticketInfo.menuType}`,
      );
    }
    if (ticketInfo.chosenTeam !== "Under") {
      throw new Error(
        `HGA ${acc} - Error in checkTicketDataHGA : Chosen team mismatch for marketId 20 (Under). Page: ${ticketInfo.chosenTeam}, Expected: "Under"`,
      );
    }
    const marketParam = calculateParam(ticketInfo.chosenCon);
    if (marketParam !== betEvent.marketParam) {
      throw new Error(
        `HGA ${acc} - Error in checkTicketDataHGA : Market param mismatch for marketId 20 (Under). Page: ${marketParam}, BetEvent: ${betEvent.marketParam}`,
      );
    }
  }
};

module.exports = {
  clickTicketHGA,
  readTicketDataHGA,
  checkTicketDataHGA,
  ticketEventHGA,
};
