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
  ticketEventObet,
  clickTicketObet,
  readTicketDataObet,
} = require("./ticketObet");
const { addTicketEventToQueue } = require("../../utils/addTicketEventToQueue");
const { writeToGoogleSheet } = require("../../mongodb/writeSheet");
const { isOddsInRange, formatOddsRangeForLog } = require("../../utils/isOddsInRange");

async function autoBetObet(page, betEvent, referenceAcc, successBetListKey) {
  // Get the iframe reference and reassign page to point to it
  const frames = await page.frames();
  const frame = frames.find((f) => f.name() === "frame-sport");
  if (!frame) throw new Error("iframe#frame-sport not found");
  page = frame; // Reassign page to point to the frame

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
    console.log("ticketDataObet", ticketDataTarget);

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

    betEvent.tickettedRefVig = null;

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
    stake = adjustStakeToLimits(stake, ticketDataTarget, params, acc);

    await page.waitForSelector("div.stake input", { timeout: 5000 });
    //check if input got value (if no only type, if yes, then remmove all only type)
    //or can just backspace everything first, before typing
    await page.focus("div.stake input");
    // Clear the input field by selecting all and deleting
    await page.evaluate(() => {
      const input = document.querySelector("div.stake input");
      if (input) {
        input.value = "";
        input.focus();
      }
    });
    await page.type("div.stake input", stake.toString());

    // Verify that the input field actually contains the stake value
    const inputValue = await page.$eval(
      "div.stake input",
      (input) => input.value,
    );
    // Handle comma formatting by removing commas before comparison
    const normalizedInputValue = inputValue.replace(/,/g, "");
    if (normalizedInputValue !== stake.toString()) {
      throw new Error(
        `${acc} - Stake input verification failed. Expected: ${stake.toString()}, Actual: ${inputValue}`,
      );
    }

    // // Check if the checkbox is checked
    // const isChecked = await page.$eval("#acceptAnyOdds", checkbox => checkbox.checked);
    // if (isChecked) {
    //   console.log(`${acc} - Unchecking acceptAnyOdds: ` + getCurrentTime());
    //   await page.click("#acceptAnyOdds");
    // }

    // Focus on the input field and then click the bet button
    await page.focus("div.stake input");
    await page.click("#menu-betslip button.btn-bet");
    // await page.keyboard.press('Enter');
    await new Promise((resolve) => setTimeout(resolve, 200));
    await page.click("#menu-betslip button.btn-bet");

    // Wait up to 300ms for the .mainSection .hint element to appear
    const hintElement = await page
      .waitForSelector(".mainSection .hint", { timeout: 300 })
      .catch(() => null);
    if (hintElement) {
      // Get the innerText of the .mainSection .hint .content element
      const hintText = await page
        .$eval(".mainSection .hint .content", (el) => el.innerText)
        .catch(() => "");
      // Click the cancel button
      await page.click("#menu-betslip button.btn-cancel");
      throw new Error(`Bet failed: ${hintText}`);
    }
    // await page.keyboard.press('Enter');

    console.log(
      `${acc} - Bet pressed "Enter", now waiting confirmation: ` +
        getCurrentTime(),
    );

    const now = new Date();

    // Wait for the green dialog box
    await page.waitForFunction(
      () => {
        const element = document.querySelector("div.loader-dots");
        return element;
      },
      { timeout: 5000 },
    );
    console.log(`${acc} - Loader dots appeared: ` + getCurrentTime());

    await page.waitForFunction(
      () => {
        const element = document.querySelector("div.loader-dots");
        return !element;
      },
      { timeout: 30000 },
    );
    console.log(`${acc} - Loader dots disappeared: ` + getCurrentTime());

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

    let bettedOdds = await page.evaluate(async (now) => {
      let mostRecentBet;
      let dateInDiv;
      let currentDateTime;
      let difference;
      let targettedBet;
      let mostRecentBetFound = false;

      // Loop until we find the most recent bet within 10 seconds of our bet time
      while (!mostRecentBetFound) {
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Get all recent bet tickets from Obet's my bets section
        const recentBets = document.querySelectorAll(
          "div#menu-mybets div.tickets div.ticket",
        );

        for (let i = 0; i < recentBets.length; i++) {
          targettedBet = recentBets[i];
          if (targettedBet && targettedBet.innerText.trim().length > 0) {
            // Extract date from the small text at the bottom of each ticket
            let dateDiv = targettedBet.querySelector("div.text-right small");

            if (dateDiv) {
              const dateText = dateDiv.innerText;
              // Parse date format: "28/06 15:06:17"
              const [_, dateStr, timeStr] =
                dateText.match(/(\d{2}\/\d{2}) (\d{2}:\d{2}:\d{2})/) || [];

              if (dateStr && timeStr) {
                // Create date string with current year - fix the format
                const [day, month] = dateStr.split("/");
                const [hour, minute, second] = timeStr.split(":");
                const currentYear = new Date().getFullYear();

                // Create date object directly
                dateInDiv = new Date(
                  currentYear,
                  month - 1,
                  day,
                  hour,
                  minute,
                  second,
                );
                currentDateTime = new Date(now);
                diff = dateInDiv - currentDateTime;
                console.log("Date parsing:", {
                  dateText,
                  dateStr,
                  timeStr,
                  dateInDiv,
                  currentDateTime,
                  diff,
                });

                // Check if bet is within 10 seconds of our bet time
                if (Math.abs(diff) <= 10000) {
                  console.log("Math abs <= 10000 detected");
                  difference = diff;
                  mostRecentBetFound = true;
                  mostRecentBet = targettedBet;
                }
              }
            }
          }
        }
      }

      console.log("new bet that is within 10 seconds detected in bet slip");
      console.log("dateInDiv", dateInDiv);
      console.log("currentDateTime", currentDateTime);
      console.log("diff in ms", difference);

      let bettedOdds;
      // Wait for the new div to appear just in case
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Wait for the bet status to change from pending to accepted
      while (true) {
        const statusText = mostRecentBet.innerText;
        console.log("Current status text:", statusText);

        if (statusText.includes("Pending")) {
          console.log("Pending. Most recent bet is pending" + new Date());
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        } else if (statusText.includes("Accepted")) {
          console.log("Accepted. Most recent bet is accepted" + new Date());
          // Extract odds from the ticket - look for the odds span
          const oddsElement = mostRecentBet.querySelector("span.odds");
          if (oddsElement) {
            bettedOdds = oddsElement.innerText;
            console.log("Extracted odds:", bettedOdds);
          }
          break;
        } else {
          console.log(
            "Most recent bet status:",
            statusText,
            ". Likely got rejected",
          );
          break;
        }
      }

      return parseFloat(bettedOdds);
    }, now);

    console.log(
      `${acc} - Bet confirmed "running". Odds= `,
      bettedOdds,
      getCurrentTime(),
    );

    let betPlacedTime = new Date();
    betEvent.bettedOdds = bettedOdds;

    const convertToEU = eval(`(${convertToEUString})`);
    betEvent.finalOvervalue =
      convertToEU(bettedOdds) / referenceTickettedNoVigOdds - 1;
    betEvent.betPlacedTime = betPlacedTime;

    //close bet slip? not sure
    // await page.waitForSelector('div.tabs.component.component-float.show.autoGrow', { timeout: 5000 });
    // await page.click("div.tabs.component.component-float.show.autoGrow div.tabs_header");
    console.log(
      `${acc} - Done betting(${betEvent.homeName} - ${betEvent.awayName}) : ${betPlacedTime}`,
    );

    //write data to successList
    if (successBetListKey) betEvent.successBetListKey = successBetListKey;
    await writeData("successBetList", betEvent);
    console.log(`${acc} - Saved success bet: ` + getCurrentTime());

    // start cooldown
    let cooldownTimeInSeconds = params.cooldownTimeInSeconds;
    startCooldown(cooldownTimeInSeconds, acc);

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

module.exports = { autoBetObet };
