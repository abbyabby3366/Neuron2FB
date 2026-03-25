const { calcStakeFunction } = require("../../utils/calcStakeFunction");
// const { ticketEvent3838, ticketContraEvent, ticketingQueue } = require('../runPS3838'); // deprecated
const { getCurrentTime } = require("../../utils/getCurrentTime");
const fs = require("fs").promises;
const fsSync = require("fs");
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
const {
  ticketEventSBO,
  clickTicketSBO,
  readTicketDataSBO,
} = require("./ticketSBO");
const { addTicketEventToQueue } = require("../../utils/addTicketEventToQueue");
const { writeToGoogleSheet } = require("../../mongodb/writeSheet");
const { getDataPS3838 } = require("../runPS3838s");
const { isOddsInRange, formatOddsRangeForLog } = require("../../utils/isOddsInRange");

async function autoBetSbo(page, betEvent, referenceAcc) {
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

    console.log(
      `${acc} - Ticketting reference  (${referenceAcc}) odds: ` +
        getCurrentTime(),
    );
    console.log(`${acc} - Ticketting target: ` + getCurrentTime());
    const [ticketDataReference, ticketDataTarget] = await Promise.all([
      addTicketEventToQueue(
        referenceAcc,
        betEvent,
        (closeTicket = true),
        (targetReference = "reference"),
      ),
      addTicketEventToQueue(
        acc,
        betEvent,
        (closeTicket = false),
        (targetReference = "target"),
      ),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 10000));
    //dont close the tickettedContra
    let ticketDataReferenceContra = await addTicketEventToQueue(
      referenceAcc,
      betEvent,
      (closeTicket = false),
      (targetReference = "referenceContra"),
    );

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

    //get the real ticketted vig
    let tickettedRefVig =
      1 / ticketDataReference.tickettedOddsEU +
      1 / ticketDataReferenceContra.tickettedOddsEU -
      1;

    console.log("tickettedRefVig", tickettedRefVig);
    betEvent.tickettedRefVig = tickettedRefVig;

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
      // referenceVig: referenceVig, //useless
      maxEVCap: params.brainParams.maxEVCap,
      sameWinRatio: params.stakeInput.sameWinRatio,
      probability: betEvent.probability, //useless
      noVigOdds: betEvent.noVigOdds, //useless
    };
    let stake = calcStakeFunction(calcStakeParam);

    // check for min/max stake, account balance, and stake
    console.log(
      `${acc} - Check min/max stake and balance: ` + getCurrentTime(),
    );
    if (stake < ticketDataTarget.minStake) {
      // if stake is less than min bet
      throw new Error("Min bet is higher than calculated stake"); // If not enough then no bet
    } else if (stake > ticketDataTarget.maxStake) {
      // if stake is more than max bet
      if (ticketDataTarget.accountBalance > ticketDataTarget.maxStake) {
        // Check if enough balance to place the max bet
        console.log(
          `${acc} - Bet Amount (Max Stake):`,
          ticketDataTarget.maxStake,
        );
        let round = params.stakeInput.round;
        stake = Math.floor(ticketDataTarget.maxStake / round) * round;
      } else {
        // Not enough balance, place the balance as stake
        console.log(
          `${acc} - Bet Amount (Remaining Balance):`,
          ticketDataTarget.accountBalance,
        );
        let round = params.stakeInput.round;
        stake = Math.floor(ticketDataTarget.accountBalance / round) * round;
      }
    } else {
      // if stake is between max and min bet (normal)
      if (ticketDataTarget.accountBalance > stake) {
        // Check if enough balance to place the calculated stake
        console.log(`${acc} - Bet Amount (Expected Stake):`, stake);
      } else {
        // Not enough balance, place the balance as stake
        console.log(
          `${acc} - Bet Amount (Remaining Balance):`,
          ticketDataTarget.accountBalance,
        );
        let round = params.stakeInput.round;
        stake = Math.floor(ticketDataTarget.accountBalance / round) * round;
      }
    }
    console.log({
      Odds: ticketDataTarget.tickettedOddsEU,
      Stake: stake,
      Max: ticketDataTarget.maxStake,
      Min: ticketDataTarget.minStake,
      Balance: ticketDataTarget.accountBalance,
    });

    const { pages } = getDataPS3838();
    const ps3838Page = pages[referenceAcc];

    await ps3838Page.waitForSelector("input.input-stake.stake.risk", {
      timeout: 5000,
    });
    await ps3838Page.type("input.input-stake.stake.risk", stake.toString());

    // Focus on the input field
    await ps3838Page.focus("input.input-stake.stake.risk");
    await ps3838Page.keyboard.press("Enter");
    await ps3838Page.waitForSelector(
      "#wrapper > div.alert-overlay > div > div.alert-action.confirm-action > button.okBtn",
      { visible: true },
    );
    await new Promise((resolve) => setTimeout(resolve, 700));
    await ps3838Page.click(
      "#wrapper > div.alert-overlay > div > div.alert-action.confirm-action > button.okBtn",
    );
    console.log(
      `${acc} - Bet pressed "Enter", now waiting confirmation: ` +
        getCurrentTime(),
    );

    const now = new Date();

    // Wait for either the "Bet Accepted" dialog or the "pending-acceptance" message
    await Promise.race([
      ps3838Page.waitForFunction(
        () => {
          const element = document.querySelector("div.BetAcceptedHeader");
          return element && element.innerText.includes("Accepted Bet");
        },
        { timeout: 15000 },
      ),
      ps3838Page.waitForFunction(
        () => {
          const element = document.querySelector(
            "div.BetItemError.pending-acceptance",
          );
          return element && element.innerText.includes("Waiting");
        },
        { timeout: 15000 },
      ),
    ]);

    //wait for real accepted bet
    await ps3838Page.waitForFunction(
      () => {
        const element = document.querySelector("div.BetAcceptedHeader");
        return element && element.innerText.includes("Accepted Bet");
      },
      { timeout: 60000 },
    );

    console.log(`${acc} - Bet accepted: ` + getCurrentTime());

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

    let bettedOdds = await ps3838Page.evaluate(() => {
      const element = document.querySelector(
        "#BodyLeftComponent > div > div > div > div.SideBarContentComponent > div > div.scroll-content > div > div.SingleBetComponent > div.bet-body > div > div > div.BetItemContent > div.team > div.odds-info-container > span > span.odds",
      );
      return element ? parseFloat(element.innerText) : null;
    });

    console.log(
      `${acc} - Bet confirmed "running". Betted Odds= `,
      bettedOdds,
      getCurrentTime(),
    );

    let betPlacedTime = new Date();
    betEvent.bettedOdds = bettedOdds;

    const convertToEU = eval(`(${convertToEUString})`);
    betEvent.finalOvervalue =
      convertToEU(bettedOdds) / referenceTickettedNoVigOdds - 1;
    betEvent.betPlacedTime = betPlacedTime;

    console.log(`${acc} - Clicking remove icon: ` + getCurrentTime());
    await ps3838Page.evaluate(() => {
      const element = document.querySelector(
        "div.BetAcceptedHeader > div.remove-icon",
      );
      if (element) {
        element.click();
      }
    });

    console.log(
      `${acc} - Done betting(${betEvent.homeName} - ${betEvent.awayName}) : ${betPlacedTime}`,
    );

    //write data to successList
    await writeData("successBetList", betEvent);
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
    console.log(`${acc} - Failed to bet: ` + getCurrentTime());
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

function contra(betEvent) {
  // Create a deep copy of the input data
  const result = JSON.parse(JSON.stringify(betEvent));
  const currentMarketId = betEvent.marketId;
  switch (currentMarketId) {
    case 19:
      result.marketId = 20;
      result.marketIdDescription = "Total Under(%s)";
      break;
    case 20:
      result.marketId = 19;
      result.marketIdDescription = "Total Over(%s)";
      break;
    case 18:
      result.marketId = 17;
      result.marketIdDescription = "Asian Handicap1(%s)";
      result.marketParam = betEvent.marketParam * -1;
      // console.log('contra 18', betEvent.marketParam, result.marketParam);
      break;
    case 17:
      result.marketId = 18;
      result.marketIdDescription = "Asian Handicap2(%s)";
      result.marketParam = betEvent.marketParam * -1;
      // console.log('contra 17', betEvent.marketParam, result.marketParam);
      break;
  }
  return result;
}

// At the top of the file
function createQueue() {
  const queue = [];
  let isProcessing = false;

  async function enqueue(task) {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      processQueue();
    });
  }

  async function processQueue() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    while (queue.length > 0) {
      const { task, resolve, reject } = queue.shift();
      try {
        const result = await task();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    isProcessing = false;
  }

  return { enqueue };
}

const delayedTicketingQueue = createQueue();

module.exports = { autoBetSbo };
