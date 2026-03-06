const {
  calcStakeFunction,
  adjustStakeToLimits,
} = require("../../utils/calcStakeFunction");
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
const { addTicketEventToQueue } = require("../../utils/addTicketEventToQueue");
const { writeToGoogleSheet } = require("../../mongodb/writeSheet");

let isAutoBettingObj = {};

async function autoBetISN(page, betEvent, referenceAcc, successBetListKey) {
  const { isAutoBettingObj } = require("../../utils/SBB");
  setProceedSBB(false);
  // console.log('proceedSBB should be set to false', getProceedSBB())
  const acc = betEvent.acc;
  let params = JSON.parse(
    fsSync.readFileSync(`TargetBookie/${acc}.json`, "utf-8"),
  );

  let oddsType = params.oddsType;
  const oddsTypeMap = {
    EU: EUtoEU,
    ID: IDtoEU,
    MY: MYtoEU,
    HK: HKtoEU,
    IN: IDtoEU,
    US: UStoEU,
  };
  const convertToEU = oddsTypeMap[oddsType] || EUtoEU;

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
      betEvent.betFailedReason = "ticketTarget";
      await writeData("tempFailBetList", betEvent);
      throw new Error(
        `Failed to ticket in Target ${acc}, stopped betting this event`,
      );
    }

    let tickettedOvervalue =
      ticketDataTarget.tickettedOddsEU / referenceTickettedNoVigOdds - 1;
    let brain_params = params.brainParams;

    //check if ticketed odds is within range
    if (
      ticketDataTarget.tickettedOddsEU < brain_params.minOdds ||
      ticketDataTarget.tickettedOddsEU > brain_params.maxOdds
    ) {
      let betFailedTime = new Date();
      betEvent.betFailedTime = betFailedTime;
      betEvent.betFailedReason = "oddsNotInRange";
      await writeData("tempFailBetList", betEvent);
      throw new Error(
        `${acc} - Current odds is not within range. Min: ` +
          brain_params.minOdds +
          " Max: " +
          brain_params.maxOdds +
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
      // referenceVig: betEvent.referenceVig, //useless
      maxEVCap: params.brainParams.maxEVCap,
      sameWinRatio: params.stakeInput.sameWinRatio,
      probability: betEvent.probability, //useless
      noVigOdds: betEvent.noVigOdds, //useless
    };
    let stake = calcStakeFunction(calcStakeParam);

    // check for min/max stake, account balance, and stake
    stake = adjustStakeToLimits(stake, ticketDataTarget, params, acc);

    let betEnteredTime = await placeBetISN(page, stake, acc);

    //add to waitingBetList first
    betEvent.maxStake = ticketDataTarget.maxStake;
    betEvent.minStake = ticketDataTarget.minStake;
    betEvent.referenceMaxStake = ticketDataReference.maxStake;
    betEvent.referenceMinStake = ticketDataReference.minStake;
    betEvent.unconvertedTickettedOdds =
      ticketDataTarget.unconvertedTickettedOdds;
    betEvent.tickettedOddsEU = ticketDataTarget.tickettedOddsEU;
    betEvent.referenceTickettedOdds = ticketDataReference.tickettedOddsEU;
    betEvent.referenceTickettedNoVigOdds =
      ticketDataReference.tickettedNoVigOddsEU;
    betEvent.stake = stake;
    betEvent.betTickettedTime = ticketDataTarget.tickettedTime;
    betEvent.referenceTickettedTime = ticketDataReference.tickettedTime;
    betEvent.betEnteredTime = betEnteredTime;

    await writeData("waitingBetList", betEvent);
    console.log(`ISN ${acc} - Added bet to waitingList`);

    setProceedSBB(true);
    console.log("ProceedSBB should be set to true", getProceedSBB());

    //wait for bet to be confirmed
    let bettedOdds = await waitBetISN(page, acc);

    let betPlacedTime = new Date();
    betEvent.bettedOdds = bettedOdds;
    betEvent.finalOvervalue =
      convertToEU(bettedOdds) / referenceTickettedNoVigOdds - 1;
    betEvent.betPlacedTime = betPlacedTime;

    console.log(
      `ISN ${acc} - Done betting(${betEvent.homeName} - ${betEvent.awayName}) : ${betPlacedTime}`,
    );

    //write data to successList
    if (successBetListKey) betEvent.successBetListKey = successBetListKey;
    await writeData("successBetList", betEvent);
    console.log(`ISN ${acc} - Saved success bet ` + getCurrentTime());

    // start cooldown
    let cooldownTimeInSeconds = params.cooldownTimeInSeconds;
    startCooldown(cooldownTimeInSeconds, acc);

    // Write the successful bet event to Google Sheet
    try {
      if (params.writeToSpreadsheet.enabled)
        await writeToGoogleSheet(
          [betEvent],
          true,
          params.writeToSpreadsheet.spreadsheetId,
          params.writeToSpreadsheet.sheetName,
        );
    } catch (sheetError) {
      console.error(`${acc} - Failed to write to Google Sheet:`, sheetError);
    }
  } catch (error) {
    console.log(`${acc} - Failed to bet`);
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

async function placeBetISN(page, stake, acc) {
  await page.waitForSelector("input#stake", { timeout: 5000 });
  await page.type("input#stake", stake.toString());
  await page.focus("input#stake");
  await page.keyboard.press("Enter");
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.keyboard.press("Enter");
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log(
    `ISN ${acc} - Bet pressed "Enter" twice, now waiting confirmation: ` +
      getCurrentTime(),
  );
  // await new Promise(resolve => setTimeout(resolve, 15000));

  const now = new Date();

  //await for confirmation
  // Wait for modal and check bet success
  await page.waitForFunction(
    () => {
      const modal = document.querySelector(".modal-container");
      return modal;
    },
    { timeout: 100000 },
  );
  console.log("modal detected");

  let oddsChanged = await page.evaluate(() => {
    let modal = document.querySelector(".modal-container");
    console.log("modal odds changed detected");
    if (
      modal &&
      modal.textContent.includes("Odds have changed from") &&
      !!modal.querySelector("button.btn-ok")
    ) {
      modal.querySelector("button.btn-ok").click();
      console.log("clicked ok button");
      return true;
    }

    console.log('should have finished "odds change"');
    return false;
  });

  if (oddsChanged) {
    console.log(
      "Odds have changed, clicked Ok button, waiting for confirmation",
    );
  } else {
    console.log("Odds have not changed, waiting for confirmation");
  }
  await new Promise((resolve) => setTimeout(resolve, 500));

  let betStatus = await page.evaluate(async () => {
    let modal = document.querySelector(".modal-container");
    if (modal.textContent.includes("pending approval")) {
      modal.querySelector("button.btn-cancel")?.click();
      console.log("Clicked Ok button for pending");
      return "pending";
    } else if (modal.textContent.includes("Bet placement is successful")) {
      modal.querySelector("button.btn-cancel")?.click();
      console.log("Clicked Ok button for success");
      return "success";
    } else if (modal.textContent.includes("Odds have changed")) {
      modal.querySelector("button.btn-cancel")?.click();
      console.log("Clicked Ok button for failed");
      return "odds changed";
    } else if (modal.textContent.includes("is not open for betting")) {
      if (modal.querySelector("button.btn-cancel")) {
        modal.querySelector("button.btn-cancel").click();
        console.log("Clicked Ok button for not open");
      }
      return "not open";
    }

    return "unknown";
  });
  console.log("ISN betStatus: ", betStatus);

  // Check if bet was successful before proceeding
  if (betStatus !== "success" && betStatus !== "pending") {
    throw new Error(`Bet failed with status: ${betStatus}`);
  }
  return now;
}
async function waitBetISN(page, acc) {
  //wait for success bet button to appear
  await page.waitForSelector("div.result-group button.btn-success", {
    timeout: 5000,
  });
  console.log("success bet button detected (result)");

  //wait for pending bet to disappear?
  await page.waitForFunction(
    () => {
      return document
        .querySelector("div.no-listing")
        ?.textContent.includes("No records available");
    },
    { timeout: 60000 },
  );
  // console.log('no-listing detected');

  let bettedOdds = await page.evaluate(() => {
    //take the first one
    const cell = document.querySelector("td.bl-left");
    if (!cell) return null;

    // Extract the last number that appears after an @ symbol
    const match = cell.textContent.match(/@\s*([\d.]+)(?!.*@)/);
    return match ? parseFloat(match[1]) : null;
  });

  console.log(`ISN ${acc} detected bettedOdds`, bettedOdds);
  console.log(
    `ISN ${acc} - Bet confirmed "running". Odds= `,
    bettedOdds,
    getCurrentTime(),
  );

  return bettedOdds;
}

module.exports = { autoBetISN };
