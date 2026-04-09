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
const {
  ticketEventSBO,
  clickTicketSBO,
  readTicketDataSBO,
} = require("./ticketSBO");
const { addTicketEventToQueue } = require("../../utils/addTicketEventToQueue");
const { writeToGoogleSheet } = require("../../mongodb/writeSheet");
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

    console.log(
      `${acc} - Ticketting reference (${referenceAcc}) odds: ` +
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

    // console.log(`${acc} - Ticketting reference contra (${referenceAcc}) odds: ` + getCurrentTime());
    // console.log(`${acc} - Ticketting target: ` + getCurrentTime());
    // const [ticketDataReferenceContra, ticketDataTarget] = await Promise.all([
    //   addTicketEventToQueue(referenceAcc, betEvent, closeTicket = true, targetReference = 'referenceContra'),
    //   addTicketEventToQueue(acc, betEvent, closeTicket = false, targetReference = 'target')
    // ]);

    // console.log(`${acc} - Ticketting reference (${referenceAcc}) odds: ` + getCurrentTime());
    // let ticketDataReference = await addTicketEventToQueue(referenceAcc, betEvent, closeTicket = true, targetReference = 'reference');
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

    // //get the real ticketted vig
    // let tickettedRefVig = 1 / ticketDataReference.tickettedOddsEU + 1 / ticketDataReferenceContra.tickettedOddsEU - 1;
    let tickettedRefVig = null;
    // console.log('tickettedRefVig', tickettedRefVig);
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
      betEvent.betFailedReason = "ticketTarget";
      await writeData("tempFailBetList", betEvent);
      throw new Error("Failed to ticket in SBO, stopped betting this event");
    }

    //CHECK OVERVALUE
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
      !ticketDataTarget.maxStake ||
      isNaN(ticketDataTarget.maxStake) ||
      ticketDataTarget.maxStake < brain_params.minTargetMaxStake ||
      ticketDataTarget.maxStake > brain_params.maxTargetMaxStake
    ) {
      let betFailedTime = new Date();
      betEvent.betFailedTime = betFailedTime;
      betEvent.betFailedReason = "targetMaxStake";
      await writeData("tempFailBetList", betEvent);
      throw new Error(
        `${acc} - TargetMaxStake is not within range. Min: ` +
          brain_params.minTargetMaxStake +
          " Max: " +
          brain_params.maxTargetMaxStake +
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
      // referenceVig: referenceVig, //useless
      maxEVCap: params.brainParams.maxEVCap,
      sameWinRatio: params.stakeInput.sameWinRatio,
      probability: betEvent.probability, //useless
      noVigOdds: betEvent.noVigOdds, //useless
    };

    let stake = calcStakeFunction(calcStakeParam);
    stake = adjustStakeToLimits(stake, ticketDataTarget, params, acc);

    let betEnteredTime = await placeBetSBO(page, stake, acc);

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
    betEvent.betEnteredTime = betEnteredTime;

    await writeData("waitingBetList", betEvent);
    console.log(`${acc} - Added bet to waitingList: ` + getCurrentTime());

    setProceedSBB(true);

    //delayed ticket for other SBO
    if (params.delayedTicketContraSBOAcc) {
      delayedTicketContraSBO(
        tickettedOddsEU,
        params.delayedTicketContraSBOAcc,
        betEvent,
        convertToEUString,
      );
    }

    let bettedOdds = await waitBetSBO(page, betEnteredTime, acc);
    betEvent.bettedOdds = bettedOdds;
    let betPlacedTime = new Date();

    betEvent.finalOvervalue =
      convertToEU(bettedOdds) / referenceTickettedNoVigOdds - 1;
    betEvent.betPlacedTime = betPlacedTime;

    await page.waitForSelector(
      "div.tabs.component.component-float.show.autoGrow",
      { timeout: 5000 },
    );
    await page.click(
      "div.tabs.component.component-float.show.autoGrow div.tabs_header",
    );
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

async function placeBetSBO(page, stake, acc) {
  await page.waitForSelector("input.input.input-stake", { timeout: 5000 });
  //check if input got value (if no only type, if yes, then remmove all only type)
  //or can just backspace everything first, before typing
  await page.type("input.input.input-stake", stake.toString());

  // Check if the checkbox is checked
  const isChecked = await page.$eval(
    "#acceptAnyOdds",
    (checkbox) => checkbox.checked,
  );
  if (isChecked) {
    console.log(`${acc} - Unchecking acceptAnyOdds: ` + getCurrentTime());
    await page.click("#acceptAnyOdds");
  }

  // Focus on the input field
  await page.focus("input.input.input-stake");
  await page.keyboard.press("Enter");
  console.log(
    `${acc} - Bet pressed "Enter", now waiting confirmation: ` +
      getCurrentTime(),
  );

  const betEnteredTime = new Date();

  // Wait for the green dialog box
  await page.waitForFunction(
    () => {
      const element = document.querySelector(
        "div.states.states-top.states-success div.states_content span",
      );
      return element && element.innerText.includes("processed");
    },
    { timeout: 5000 },
  );
  console.log(`${acc} - Green dialog box appeared: ` + getCurrentTime());

  await page.waitForFunction(
    () => {
      const element = document.querySelector(
        "div.states.states-top.states-success div.states_content span",
      );
      return element && !element.innerText.includes("processed");
    },
    { timeout: 5000 },
  );
  console.log(`${acc} - Green dialog box disappeared: ` + getCurrentTime());

  return betEnteredTime;
}

async function waitBetSBO(page, betEnteredTime, acc) {
  let bettedOdds = await page.evaluate(async (betEnteredTime) => {
    let mostRecentBet;
    let dateInDiv;
    let currentDateTime;
    let difference;
    let targettedBet;
    let mostRecentBetFound = false;
    while (!mostRecentBetFound) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const recentBets = document.querySelectorAll("div.myBets div.bet.live");
      for (let i = 0; i < recentBets.length; i++) {
        targettedBet = recentBets[i];
        if (targettedBet && targettedBet.innerText.trim().length > 0) {
          // Check if date is compatible
          let dateDiv = targettedBet.querySelector(
            "div.bet_detail_info div.detailText div:nth-child(2)",
          );

          //if got rejected bets, the date div will be in del tag
          if (!dateDiv) {
            dateDiv = targettedBet.querySelector(
              "div.bet_detail > div > del > div:nth-child(2)",
            );
            console.log("del date div detected");
          }

          const dateText = dateDiv.innerText;
          const [_, dateStr, timeStr] =
            dateText.match(/(\d{2}\/\d{2}) (\d{2}:\d{2}:\d{2})/) || [];
          if (!dateStr || !timeStr) continue;
          const dateTimeStr = `${new Date().getFullYear()} / ${dateStr} ${timeStr} GMT-0400`;
          dateInDiv = new Date(dateTimeStr);
          currentDateTime = new Date(betEnteredTime);
          diff = dateInDiv - currentDateTime;
          console.log("Wrong diff in ms", diff);
          if (Math.abs(diff) <= 10000) {
            console.log("Math abs <= 10000 detected");
            difference = diff;
            mostRecentBetFound = true;
            mostRecentBet = targettedBet;
          }
        }
      }
    }
    console.log("new bet that is within 10 seconds detected in bet slip");
    console.log("dateInDiv", dateInDiv);
    console.log("currentDateTime", currentDateTime);
    console.log("diff in ms", difference);

    let bettedOdds;
    //wait for the new div to appear just in case
    await new Promise((resolve) => setTimeout(resolve, 300));
    while (true) {
      const status = mostRecentBet.querySelector(
        "div.detailStatus span.stateTag",
      ).innerText;
      if (status === "Waiting") {
        console.log(status, ". Most recent bet is waiting" + new Date());
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      } else if (status === "Running") {
        console.log(status, ". Most recent bet is running" + new Date());
        bettedOdds = mostRecentBet.querySelector(
          "strong.optionOddsPrice span",
        ).innerText;
        break;
      } else {
        console.log(
          status,
          ". Most recent bet is not waiting or running, likely got rejected",
        );
        break;
      }
    }

    return parseFloat(bettedOdds);
  }, betEnteredTime);

  console.log(
    `${acc} - Bet confirmed "running". Odds= `,
    bettedOdds,
    getCurrentTime(),
  );
  return bettedOdds;
}

// const delayedTicketContraSBO = async (oriTickettedOdds, acc, betEvent, convertToEUString) => {
//   const { getPages } = require('../runSBOs');
//   const pages = getPages();

//   // Create the initial document
//   const document = {
//     createdAt: new Date(),
//     homeName: betEvent.homeName,
//     awayName: betEvent.awayName,
//     normal: {
//       marketId: betEvent.marketId,
//       marketParam: betEvent.marketParam,
//       marketDescription: betEvent.marketIdDescription,
//       oriTickettedOdds: oriTickettedOdds
//     },
//     contra: {
//       marketId: contra(betEvent).marketId,
//       marketParam: contra(betEvent).marketParam,
//       marketDescription: contra(betEvent).marketIdDescription,
//       min1: undefined,
//       min2: undefined,
//       min3: undefined,
//       min4: undefined,
//       min5: undefined
//     }
//   };

//   // Insert a new document
//   let insertedId;
//   try {
//     const result = await writeData('delayedTickets', document);
//     insertedId = result.insertedId;
//     console.log(`Inserted new document for ${betEvent.homeName} vs ${betEvent.awayName}`);
//   } catch (error) {
//     console.error('Error inserting document:', error);
//     return; // Exit the function if we couldn't insert the document
//   }

//   const runSetTimeout = (time, minField) => {
//     setTimeout(async () => {
//       let contraBetEvent = contra(betEvent);
//       try {
//         await ticketSBO(pages[acc], acc, contraBetEvent);
//         [unconvertedTickettedOdds, tickettedOddsEU, accountBalance, minStake, maxStake] = await readTicketDataSBO(pages[acc], convertToEUString);
//         let page = pages[acc];

//         await page.evaluate(() => {
//           const closeButton = document.querySelector('span.ticket_header_cancel');
//           if (closeButton) {
//             closeButton.click();
//           }
//         });

//         // Update the specific document with the new odds
//         try {
//           await updateData('delayedTickets',
//             { _id: insertedId },
//             { $set: { [`contra.${minField}`]: tickettedOddsEU } }
//           );
//           console.log(`Updated ${minField} for ${betEvent.homeName} vs ${betEvent.awayName}`);
//         } catch (error) {
//           console.error(`Error updating ${minField}:`, error);
//         }

//       } catch (e) {
//         console.log(`SBO ${acc} - Failed to delayed ticket`);
//         console.log(e.message);
//       }
//       console.log('delayed ticket done')
//       console.log('ori market ID', betEvent.marketId, 'delayed market ID', contraBetEvent.marketId);
//       console.log('ori market param', betEvent.marketParam, 'delayed market param', contraBetEvent.marketParam);
//       console.log('Delayed tickettedOddsEU', tickettedOddsEU);
//     }, time)
//   }

//   runSetTimeout(1 * 60 * 1000, 'min1');
//   runSetTimeout(2 * 60 * 1000, 'min2');
//   runSetTimeout(3 * 60 * 1000, 'min3');
//   runSetTimeout(4 * 60 * 1000, 'min4');
//   runSetTimeout(5 * 60 * 1000, 'min5');
// }

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

const delayedTicketContraSBO = async (
  oriTickettedOdds,
  acc,
  betEvent,
  convertToEUString,
) => {
  // Create the initial document
  const document = {
    createdAt: new Date(),
    homeName: betEvent.homeName,
    awayName: betEvent.awayName,
    normal: {
      marketId: betEvent.marketId,
      marketParam: betEvent.marketParam,
      marketDescription: betEvent.marketIdDescription,
      oriTickettedOdds: oriTickettedOdds,
    },
    contra: {
      marketId: contra(betEvent).marketId,
      marketParam: contra(betEvent).marketParam,
      marketDescription: contra(betEvent).marketIdDescription,
      min1: undefined,
      min2: undefined,
      min3: undefined,
      min4: undefined,
      min5: undefined,
    },
  };

  // Insert a new document
  let insertedId;
  try {
    const result = await writeData("delayedTickets", document);
    insertedId = result.insertedId;
    console.log(
      `Inserted new document for ${betEvent.homeName} vs ${betEvent.awayName}`,
    );
  } catch (error) {
    console.error("Error inserting document:", error);
    return; // Exit the function if we couldn't insert the document
  }

  const performTicketingOperations = async (
    acc,
    betEvent,
    convertToEUString,
  ) => {
    const { getPages } = require("../runSBOs");
    const pages = getPages();
    const page = pages[acc];

    if (!page || page.isClosed()) {
      throw new Error(
        `${acc} - Page not opened or closed: ` + getCurrentTime(),
      );
    }

    let contraBetEvent = contra(betEvent);
    await ticketSBO(page, acc, contraBetEvent);
    const [
      unconvertedTickettedOdds,
      tickettedOddsEU,
      accountBalance,
      minStake,
      maxStake,
    ] = await readTicketDataSBO(page, convertToEUString);

    await page.evaluate(() => {
      const closeButton = document.querySelector("span.ticket_header_cancel");
      if (closeButton) {
        closeButton.click();
      }
    });

    return { tickettedOddsEU, minStake, maxStake };
  };

  const checkAndRunTicket = async (minField) => {
    try {
      const { tickettedOddsEU } = await delayedTicketingQueue.enqueue(() =>
        performTicketingOperations(acc, betEvent, convertToEUString),
      );

      // Update the specific document with the new odds
      try {
        await updateData(
          "delayedTickets",
          { _id: insertedId },
          { $set: { [`contra.${minField}`]: tickettedOddsEU } },
        );
        console.log(
          `Updated ${minField} for ${betEvent.homeName} vs ${betEvent.awayName}`,
        );
      } catch (error) {
        console.error(`Error updating ${minField}:`, error);
      }
    } catch (e) {
      console.log(`${acc} - Failed to delayed ticket: ` + getCurrentTime());
      console.log(e.message);

      if (e.message.includes("Page not opened or closed")) {
        console.log(`${acc} - Page not opened, waiting 15 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 15000));

        // Try again after waiting
        await checkAndRunTicket(minField);
      }
    }
  };

  const runSetTimeout = (time, minField) => {
    setTimeout(() => checkAndRunTicket(minField), time);
  };

  runSetTimeout(1 * 60 * 1000, "min1");
  runSetTimeout(2 * 60 * 1000, "min2");
  runSetTimeout(3 * 60 * 1000, "min3");
  runSetTimeout(4 * 60 * 1000, "min4");
  runSetTimeout(5 * 60 * 1000, "min5");
};

module.exports = { autoBetSbo };
