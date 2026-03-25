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
const { isOddsInRange, formatOddsRangeForLog } = require("../../utils/isOddsInRange");

let isAutoBettingObj = {};

async function autoBetHGA(page, betEvent, referenceAcc, successBetListKey) {
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
      throw new Error(`Failed to ticket in ${acc}, stopped betting this event`);
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
      referenceVig: betEvent.referenceVig,
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
    stake = adjustStakeToLimits(stake, ticketDataTarget, params, acc);

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

    await page.waitForSelector("#bet_gold_pc", { timeout: 5000 });
    await page.click("#bet_gold_pc");

    await page.type("input#bet_gold_pc", stake.toString());

    // // Check if the checkbox is checked
    // const isChecked = await page.$eval("#acceptAnyOdds", checkbox => checkbox.checked);
    // if (isChecked) {
    //   console.log(`SBO ${acc} - Unchecking acceptAnyOdds: ` + getCurrentTime());
    //   await page.click("#acceptAnyOdds");
    // }

    // Focus on the input field
    await page.focus("input#bet_gold_pc");

    // await new Promise(resolve => setTimeout(resolve, 500000));
    //wait for debug

    await page.keyboard.press("Enter");
    console.log(
      `HGA ${acc} - Bet pressed "Enter", now waiting confirmation: ` +
        getCurrentTime(),
    );

    const now = new Date();

    // try {
    // Check for success message using waitForFunction
    await page.waitForFunction(
      () => {
        const successElement = document.querySelector("#orderMsg li");

        // //internal testing
        // if (document.querySelector('#orderMsg li').textContent.includes('pending')) {
        //   console.log('HGA - Bet placed successfully but pending');
        // } else if (document.querySelector('#orderMsg li').textContent.includes('successfully placed')) {
        //   console.log('HGA - Bet placed successfully without pending!');
        // }

        // return document.querySelector('#orderMsg li').textContent.includes('successfully placed') || document.querySelector('#orderMsg li').textContent.includes('pending');

        return (
          successElement &&
          (successElement.textContent.includes("successfully placed") ||
            successElement.textContent.includes("pending"))
        );
      },
      { timeout: 50000 },
    );

    //} catch (e) {
    //   throw new Error('HGA - Bet failed to place, didnt show pending or success');
    // }

    console.log("HGA - Bet placed successfully, might be pending!");
    await new Promise((resolve) => setTimeout(resolve, 500));

    //add to waitingBetList first
    betEvent.maxStake = ticketDataTarget.maxStake;
    betEvent.minStake = ticketDataTarget.minStake;
    betEvent.referenceMaxStake = ticketDataReference.maxStake;
    betEvent.referenceMinStake = ticketDataReference.minStake;
    betEvent.unconvertedTickettedOdds =
      ticketDataTarget.unconvertedTickettedOdds;
    betEvent.tickettedOddsEU = ticketDataTarget.tickettedOddsEU;

    betEvent.referenceTickettedOdds = ticketDataReference.tickettedOddsEU;
    betEvent.referenceTickettedNoVigOdds = referenceTickettedNoVigOdds;
    // betEvent.referenceVig = ticketData.referenceVig; (because previous adi got)
    betEvent.stake = stake;
    betEvent.betTickettedTime = ticketDataTarget.tickettedTime;

    betEvent.referenceTickettedTime = ticketDataReference.tickettedTime;
    betEvent.betEnteredTime = now;

    await writeData("waitingBetList", betEvent);
    console.log(`${acc} - Added bet to waitingList`);

    setProceedSBB(true);
    console.log("ProceedSBB should be set to true", getProceedSBB());

    // Check for success message using waitForFunction
    await page.waitForFunction(
      () => {
        const successElement = document.querySelector("#orderMsg li");
        return (
          successElement &&
          successElement.textContent ===
            "Your bets have been successfully placed."
        );
      },
      { timeout: 60000 },
    );

    bettedOdds = await page.evaluate(async () => {
      const bettedOdds = document.querySelector("#bet_finish_ior").innerText;
      if (!bettedOdds) {
        throw new Error("HGA - Betted odds not deteced");
      }
      return parseFloat(bettedOdds);
    });

    console.log(
      `HGA ${acc} - Bet confirmed "running". Odds= `,
      bettedOdds,
      getCurrentTime(),
    );

    let betPlacedTime = new Date();
    betEvent.bettedOdds = bettedOdds;

    const convertToEU = eval(`(${convertToEUString})`);
    betEvent.finalOvervalue =
      convertToEU(bettedOdds) / referenceTickettedNoVigOdds - 1;
    betEvent.betPlacedTime = betPlacedTime;

    //close betting slip HGA
    await page.waitForSelector(
      "#finishBtn_show",
      { timeout: 5000 },
      { visible: true },
    );
    await page.click("#finishBtn_show");
    console.log(
      `HGA ${acc} - Done betting(${betEvent.homeName} - ${betEvent.awayName}) : ${betPlacedTime}`,
    );

    //write data to successList
    if (successBetListKey) betEvent.successBetListKey = successBetListKey;
    await writeData("successBetList", betEvent);
    console.log(`${acc} - Saved success bet: ` + getCurrentTime());

    // start cooldown
    let cooldownTimeInSeconds = params.cooldownTimeInSeconds;
    startCooldown(cooldownTimeInSeconds, acc);
    console.log("isCoolingDownObj autobetHGA", isCoolingDownObj);

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

module.exports = { autoBetHGA, isAutoBettingObj };
