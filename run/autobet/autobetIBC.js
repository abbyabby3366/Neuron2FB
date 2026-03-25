const fs = require("fs").promises;
const fsSync = require("fs");
const {
  calcStakeFunction,
  adjustStakeToLimits,
} = require("../../utils/calcStakeFunction");
const { getCurrentTime } = require("../../utils/getCurrentTime");
const {
  connect,
  getCollection,
  startSession,
  readData,
  writeData,
  updateData,
  deleteData,
} = require("../../mongodb/db");
const {
  startCooldown,
  isCoolingDownObj,
} = require("../../utils/isCoolingDown");
const { getProceedSBB, setProceedSBB } = require("../../utils/proceedSBB");
const {
  EUtoEU,
  MYtoEU,
  HKtoEU,
  IDtoEU,
  UStoEU,
} = require("../../utils/oddsConverter");
const { addTicketEventToQueue } = require("../../utils/addTicketEventToQueue");
const { writeToGoogleSheet } = require("../../mongodb/writeSheet");
const { isOddsInRange, formatOddsRangeForLog } = require("../../utils/isOddsInRange");

async function autoBetIbc(page, betEvent, referenceAcc, successBetListKey) {
  const { isAutoBettingObj } = require("../../utils/SBB");
  setProceedSBB(false);
  // console.log('proceedSBB should be set to false', getProceedSBB())
  const acc = betEvent.acc;
  let params = JSON.parse(
    fsSync.readFileSync(`TargetBookie/${acc}.json`, "utf-8"),
  );
  let oddsType = params.oddsType;
  let convertToEUString;

  if (oddsType == "EU") {
    convertToEUString = EUtoEU.toString();
  } else if (oddsType == "ID") {
    convertToEUString = IDtoEU.toString();
  } else if (oddsType == "MY") {
    convertToEUString = MYtoEU.toString();
  } else if (oddsType == "HK") {
    convertToEUString = HKtoEU.toString();
  } else if (oddsType == "IN") {
    convertToEUString = IDtoEU.toString();
  } else if (oddsType == "US") {
    convertToEUString = UStoEU.toString();
  }

  let isAutoBetting = isAutoBettingObj[acc];
  if (isAutoBetting) {
    console.log(` ${acc} - is auto betting another event: ` + getCurrentTime());
    return;
  }

  try {
    isAutoBettingObj[acc] = true;

    console.log(
      `${acc} - auto betting: ${betEvent.homeName} - ${betEvent.awayName}: ${getCurrentTime()}`,
    );
    console.log("Bet Event: ", betEvent);

    console.log(`${acc} - Ticketting target: ` + getCurrentTime());
    let ticketDataTarget = await addTicketEventToQueue(
      acc,
      betEvent,
      (closeTicket = false),
      (targetReference = "target"),
    );

    console.log(
      `${acc} - Ticketting reference (${referenceAcc}) odds: ` +
        getCurrentTime(),
    );
    let ticketDataReference = await addTicketEventToQueue(
      referenceAcc,
      betEvent,
      (closeTicket = true),
      (targetReference = "reference"),
    );
    console.log("ticketDataReference", ticketDataReference);

    let {
      unconvertedTickettedOdds: referenceUnconvertedTickettedOdds,
      tickettedOddsEU: referenceTickettedOdds,
      tickettedNoVigOddsEU: referenceTickettedNoVigOdds,
      vig: referenceVig,
      oddsNoVigIncreased: referenceNoVigIncreased,
      accountBalance: referenceAccountBalance,
      minStake: referenceMinStake,
      maxStake: referenceMaxStake,
      tickettedTime: referenceTickettedTime,
    } = ticketDataReference;

    if (!ticketDataReference) {
      //if ticketing fail, add to tempFailBetList
      let betFailedTime = new Date();
      betEvent.betFailedTime = betFailedTime;
      betEvent.betFailedReason = "ticketReference";
      await writeData("tempFailBetList", betEvent);
      throw new Error(
        "Failed to ticket in ps3838, No Vig Odds cannot be calculated",
      );
    }

    if (!ticketDataTarget.unconvertedTickettedOdds) {
      //if ticketing fail, add to tempFailBetList
      let betFailedTime = new Date();
      betEvent.betFailedTime = betFailedTime;
      betEvent.betFailedReason = "ticketSBO";
      await writeData("tempFailBetList", betEvent);
      throw new Error("Failed to ticket in SBO, stopped betting this event");
    }

    let tickettedOvervalue =
      ticketDataTarget.tickettedOddsEU / referenceTickettedNoVigOdds - 1;

    //check if ticketed odds and EV is within range
    let brain_params = params.brainParams;

    if (!isOddsInRange(ticketDataTarget.tickettedOddsEU, brain_params)) {
      let betFailedTime = new Date();
      betEvent.betFailedTime = betFailedTime;
      betEvent.betFailedReason = "oddsNotInRange";
      await writeData("tempFailBetList", betEvent);
      throw new Error(
        `${acc} - Current odds is not within range. ${formatOddsRangeForLog(brain_params)}` +
          " Current: " +
          ticketDataTarget.tickettedOddsEU,
      );
    }

    //if overvalue not within range, add to tempFailBetList
    if (
      tickettedOvervalue < brain_params.minEV ||
      tickettedOvervalue > brain_params.maxEV
    ) {
      let betFailedTime = new Date();
      betEvent.betFailedTime = betFailedTime;
      betEvent.betFailedReason = "ev";
      await writeData("tempFailBetList", betEvent);
      throw new Error(
        `${acc} - New overvalue is not within range. Min: ` +
          brain_params.minEV +
          " Max: " +
          brain_params.maxEV +
          " Ticketted: " +
          tickettedOvervalue,
      );
    }

    if (
      referenceMaxStake < brain_params.minRefMaxStake ||
      referenceMaxStake > brain_params.maxRefMaxStake
    ) {
      let betFailedTime = new Date();
      betEvent.betFailedTime = betFailedTime;
      betEvent.betFailedReason = "refMaxStake";
      await writeData("tempFailBetList", betEvent);
      throw new Error(
        `${acc} - RefMaxStake is not within range. Min: ` +
          brain_params.minRefMaxStake +
          " Max: " +
          brain_params.maxRefMaxStake +
          " Current: " +
          referenceMaxStake,
      );
    }

    if (
      ticketDataTarget.maxStake < brain_params.minTargetMaxStake ||
      ticketDataTarget.maxStake > brain_params.maxTargetMaxStake
    ) {
      let betFailedTime = new Date();
      betEvent.betFailedTime = betFailedTime;
      betEvent.betFailedReason = "targetMaxStake";
      await writeData("tempFailBetList", betEvent);
      throw new Error(
        `${acc} - TargetMaxStake is not within range. Min: ` +
          brain_params.minMaxStake +
          " Max: " +
          brain_params.maxMaxStake +
          " Current: " +
          ticketDataTarget.maxStake,
      );
    }

    // //minus vig threshold for 3838
    // if (params.refVigThreshold > 0) {
    //   tickettedOvervalue = tickettedOvervalue - Math.max(0, (ticketData.referenceVig - params.refVigThreshold) / 2);
    //   console.log("Reference Vig:", ticketData.referenceVig, ". RefVigThreshold:", params.refVigThreshold, ". Minusing from current overvalue:", Math.max(0, (ticketData.referenceVig - params.refVigThreshold) / 2)
    //   );
    // }

    const calcStakeParam = {
      oddsType: params.oddsType,
      calcStakeMethod: params.stakeInput.calcStakeMethod,
      capital: params.stakeInput.capital,
      kellyMultiplier: params.stakeInput.kellyMultiplier,
      maxBet: params.stakeInput.maxBet,
      round: params.stakeInput.round,
      EVForceCut: params.stakeInput.EVForceCut,
      overvalue: tickettedOvervalue,
      unconvertedOdds: ticketDataTarget.unconvertedTickettedOdds,
      odds: ticketDataTarget.tickettedOddsEU,
      flatRatio: params.stakeInput.flatRatio,
      targetVig: betEvent.vig,
      referenceVig: betEvent.referenceVig, //useless
      maxEVCap: params.brainParams.maxEVCap,
      sameWinRatio: params.stakeInput.sameWinRatio,
      probability: betEvent.probability, //useless
      noVigOdds: betEvent.noVigOdds, //useless
    };
    let stake = calcStakeFunction(calcStakeParam);
    stake = adjustStakeToLimits(stake, ticketDataTarget, params, acc);

    //Start betting
    await page.waitForSelector(
      "#betcart > div.c-betcart__main > div.c-betcart__container > div > div > div > div.c-betting-group > div > div.c-betting-stake-group > div.c-betting-stake > div > input",
      { timeout: 10000 },
    );
    //might need to wait up to 10 seconds for input to load

    //check if input got value (if no only type, if yes, then remmove all only type)
    //or can just backspace everything first, before typing (haven't do)

    // Focus on the input field
    await page.focus(
      "#betcart > div.c-betcart__main > div.c-betcart__container > div > div > div > div.c-betting-group > div > div.c-betting-stake-group > div.c-betting-stake > div > input",
    );

    await page.type(
      "#betcart > div.c-betcart__main > div.c-betcart__container > div > div > div > div.c-betting-group > div > div.c-betting-stake-group > div.c-betting-stake > div > input",
      stake.toString(),
    );

    // // Check if the checkbox is checked
    // const isChecked = await page.$eval("#acceptAnyOdds", checkbox => checkbox.checked);
    // if (isChecked) {
    //   console.log(`SBO ${acc} - Unchecking acceptAnyOdds: ` + getCurrentTime());
    //   await page.click("#acceptAnyOdds");
    // }

    await page.keyboard.press("Enter");
    console.log(
      `IBC ${acc} - Bet pressed "Enter", now waiting confirmation: ` +
        getCurrentTime(),
    );

    // Handle popup panel
    try {
      await page.waitForSelector("div#popupPanel", { timeout: 2000 });
      await page.waitForSelector("#popup_confirm_button", { timeout: 2000 });
      // Wait a brief moment for the popup to fully render
      await new Promise((resolve) => setTimeout(resolve, 200));
      await page.keyboard.press("Enter");
    } catch (error) {
      throw new Error("IBC - Pop up panel NOT DETECTED, bet failed");
    }

    const now = new Date();
    if (successBetListKey) betEvent.successBetListKey = successBetListKey;
    await writeData("successBetList", betEvent);

    // //check for pop up panel and close notification
    // console.log('IBC - Checking for popup panel');
    // await page.waitForFunction(
    //   () => {
    //     const element = document.querySelector("div#popupPanel");
    //     if (element) {
    //       console.log('Popup panel detected, ticking and closing now');
    //       const tickButton = element.querySelector("i.c-icon.c-icon--checkbox");
    //       if (tickButton) {
    //         tickButton.click();
    //         document.querySelector('#popup_confirm_button').click();
    //       }
    //       return true;
    //     }
    //     return false;
    //   },
    //   { timeout: 2000 }
    // );

    // Check which tab is currently selected
    const currentTab = await page.evaluate(() => {
      const waitingTab = document.querySelector(
        '.c-betlist__tab span[title="Waiting"]',
      ).parentElement;
      return waitingTab.getAttribute("data-selected") === "true"
        ? "Waiting"
        : "Running";
    });

    if (currentTab === "Waiting") {
      // Wait for the waiting element to appear
      await page.waitForSelector(".c-betting-waiting", { visible: true });
      console.log("Waiting element appeared: " + getCurrentTime());
      // Wait for the waiting element to disappear
      await page.waitForSelector(".c-betting-waiting", { hidden: true });

      // Switch to running tab and get odds
      bettedOdds = await page.evaluate(async () => {
        // Click the running tab
        document
          .querySelector('.c-betlist__tab span[title="Running"]')
          .parentElement.click();
        // Wait briefly for the tab to switch
        await new Promise((resolve) => setTimeout(resolve, 500));
        const oddsElement = document.querySelector(
          ".c-ticket .c-ticket__odds .c-odds",
        );
        return oddsElement ? parseFloat(oddsElement.innerText) : 0;
      });
      console.log("Waiting element disappeared: " + getCurrentTime());
    } else if (currentTab === "Running") {
      console.log("Proceeding with running tab: " + getCurrentTime());
      // Already on running tab, just get odds
      bettedOdds = await page.evaluate(async () => {
        const oddsElement = document.querySelector(
          ".c-ticket .c-ticket__odds .c-odds",
        );
        return oddsElement ? parseFloat(oddsElement.innerText) : 0;
      });
    }

    //add to waitingBetList first
    betEvent.maxStake = ticketDataTarget.maxStake;
    betEvent.minStake = ticketDataTarget.minStake;
    betEvent.referenceMaxStake = referenceMaxStake;
    betEvent.referenceMinStake = referenceMinStake;
    betEvent.unconvertedTickettedOdds =
      ticketDataTarget.unconvertedTickettedOdds;
    betEvent.tickettedOddsEU = ticketDataTarget.tickettedOddsEU;
    betEvent.referenceTickettedOdds = referenceTickettedOdds;
    betEvent.referenceTickettedNoVigOdds = referenceTickettedNoVigOdds;
    betEvent.stake = stake;
    betEvent.betTickettedTime = ticketDataTarget.tickettedTime;
    betEvent.referenceTickettedTime = referenceTickettedTime;
    betEvent.betEnteredTime = now;

    await writeData("waitingBetList", betEvent);
    console.log(`${acc} - Added bet to waitingList: ` + getCurrentTime());

    setProceedSBB(true);
    console.log("ProceedSBB should be set to true", getProceedSBB());

    console.log(
      `IBC ${acc} - Bet confirmed "running". Odds= `,
      bettedOdds,
      getCurrentTime(),
    );

    let betPlacedTime = new Date();
    betEvent.bettedOdds = bettedOdds;

    const convertToEU = eval(`(${convertToEUString})`);
    betEvent.finalOvervalue =
      convertToEU(bettedOdds) / referenceTickettedNoVigOdds - 1;
    betEvent.betPlacedTime = betPlacedTime;

    // await page.waitForSelector('div.tabs.component.component-float.show.autoGrow', { timeout: 5000 });
    // await page.click("div.tabs.component.component-float.show.autoGrow div.tabs_header");

    //close tabs if needed (HAVEN'T DO)
    console.log(
      `IBC ${acc} - Done betting(${betEvent.homeName} - ${betEvent.awayName}) : ${betPlacedTime}`,
    );

    //write data to successList
    //temporarily move up
    // await writeData("successBetList", betEvent);
    console.log(`${acc} - Saved success bet: ` + getCurrentTime());

    // start cooldown
    let cooldownTimeInSeconds = params.cooldownTimeInSeconds;
    startCooldown(cooldownTimeInSeconds, acc);
    // console.log('isCoolingDownObj autobetSbo', isCoolingDownObj)

    // Write the successful bet event to Google Sheet
    try {
      if (params.writeToSpreadsheet.enabled) {
        await writeToGoogleSheet(
          [betEvent],
          true,
          params.writeToSpreadsheet.spreadsheetId,
          params.writeToSpreadsheet.sheetName,
        ); // Pass betEvent as an array and append data
      }
    } catch (sheetError) {
      console.error(`${acc} - Failed to write to Google Sheet:`, sheetError);
    }
  } catch (error) {
    console.log(`IBC ${acc} - Failed to bet`);
    console.log(error);
  } finally {
    isAutoBettingObj[acc] = false;
    console.log("finally, isAutobettingObj:", isAutoBettingObj);
    setProceedSBB(true);
    console.log(
      "ProceedSBB should be set back to true finally",
      getProceedSBB(),
    );
  }
}

module.exports = { autoBetIbc };
