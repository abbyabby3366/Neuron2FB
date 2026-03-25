const fs = require("fs");
const {
  startSession,
  readData,
  writeData,
  deleteData,
} = require("../../mongodb/db");
const _ = require("lodash");
const { fuzzMatch } = require("../../utils/fuzzMatch");
const { isOddsInRange } = require("../../utils/isOddsInRange");

// all need to convert to EU odds first
const brainContraV2 = async (refAcc, acc) => {
  let pendingBetList = [];
  let pendingBetListTemp = [];
  let session;

  try {
    session = await startSession();

    await session.withTransaction(async () => {
      const params = JSON.parse(
        fs.readFileSync(`./TargetBookie/${acc}.json`, "utf-8"),
      );
      const { brainParams } = params;

      let leagueFilter = JSON.parse(
        fs.readFileSync(`./run/brain/leagueFilter.json`, "utf-8"),
      );
      if (leagueFilter[acc]) {
        leagueFilter = leagueFilter[acc];
      } else if (acc.startsWith("sbo")) {
        leagueFilter = leagueFilter.sbo;
      } else if (acc.startsWith("hga")) {
        leagueFilter = leagueFilter.hga;
      } else if (acc.startsWith("ibc")) {
        leagueFilter = leagueFilter.ibc;
      } else if (acc.startsWith("isn")) {
        leagueFilter = leagueFilter.isn;
      }

      const currentTime = new Date();

      const accFilter = { acc: acc };
      const refAccFilter = { acc: refAcc };
      // Read data from MongoDB
      let [
        data_reference,
        data_target,
        successBetListTarget,
        tempFailBetListTarget,
        waitingBetList,
        successBetList,
      ] = await Promise.all([
        readData("data_target", refAccFilter),
        readData("data_target", accFilter),
        readData("successBetList", accFilter),
        readData("tempFailBetList", accFilter),
        readData("waitingBetList"),
        readData("successBetList"),
      ]);

      // console.log('data_target', data_target.length)
      // console.log(data_target)
      // console.log('data_reference', data_reference.length)

      // Process and filter data_reference
      data_reference = data_reference.map((el) => ({
        ...el,
        leagueName: el.leagueName.replace(/(Group.*)/gi, "").trim(),
      }));

      data_reference = data_reference.filter((el) => {
        if (brainParams.minRefVig) {
          const isVigTooLow = parseFloat(el.vig) < brainParams.minRefVig;
          if (isVigTooLow) return false;
        }

        if (brainParams.maxRefVig) {
          const isVigTooHigh = parseFloat(el.vig) > brainParams.maxRefVig;
          if (isVigTooHigh) return false;
        }

        const isUnwantedLeague = el.leagueName.includes("e-Football");
        const isUnwantedMatchType =
          el.awayName.includes("(ET)") ||
          el.awayName.includes("(PEN)") ||
          el.awayName.includes("Winner") ||
          el.awayName.includes("Which team");
        const isDataStale =
          currentTime - new Date(el.timeScraped) >
          brainParams.dataStaleTimeInSeconds * 1000;

        return !(isUnwantedLeague || isUnwantedMatchType || isDataStale);
      });

      // console.log('ps3838 length', data_reference.length)
      // Filter tempFailBetListTarget
      let tempFailBetListTarget_ticketReference = tempFailBetListTarget.filter(
        (entry) =>
          entry.betFailedReason === "ticketReference" &&
          currentTime - new Date(entry.betFailedTime) <
            brainParams.timeBetweenTicketFail * 1000,
      );
      let tempFailBetListTarget_ticketTarget = tempFailBetListTarget.filter(
        (entry) =>
          entry.betFailedReason === "ticketTarget" &&
          currentTime - new Date(entry.betFailedTime) <
            brainParams.timeBetweenTicketFail * 1000,
      );
      let tempFailBetListTarget_ev = tempFailBetListTarget.filter(
        (entry) =>
          entry.betFailedReason === "ev" &&
          currentTime - new Date(entry.betFailedTime) <
            brainParams.timeBetweenEVFail * 1000,
      );
      let tempFailBetListTarget_oddsNotInRange = tempFailBetListTarget.filter(
        (entry) =>
          entry.betFailedReason === "oddsNotInRange" &&
          currentTime - new Date(entry.betFailedTime) <
            brainParams.timeBetweenOddsFail * 1000,
      );

      // Get games with recent bets from waiting and success (within 30 seconds)
      const waitingListBets = waitingBetList.filter(
        (bet) =>
          currentTime - new Date(bet.betEnteredTime) <
          brainParams.sameGameDelayInSeconds * 1000, // 30 seconds in milliseconds
      );

      const recentSuccessBetList = successBetList.filter((bet) => {
        currentTime - new Date(bet.betPlacedTime) <
          brainParams.sameGameDelayInSeconds * 1000; // 30 seconds in milliseconds
      });

      // console.log('data_target before filter', data_target.length)
      data_target = data_target.filter((entry) => {
        //filter based on league
        if (brainParams.whitelistLeague) {
          const wantedLeagues = leagueFilter.whitelist.map((league) =>
            league.toUpperCase(),
          );
          const isWantedLeague = wantedLeagues.some(
            (league) => entry.leagueName.toUpperCase() === league,
          );
          if (!isWantedLeague) return false;
        }

        if (brainParams.blacklistLeague) {
          const unwantedLeagues = leagueFilter.blacklist.map((league) =>
            league.toUpperCase(),
          );
          const isUnwantedLeague = unwantedLeagues.some((league) =>
            entry.leagueName.toUpperCase().includes(league),
          );
          if (isUnwantedLeague) return false;
        }

        if (brainParams.minVig) {
          const isVigTooLow = parseFloat(entry.vig) < brainParams.minVig;
          if (isVigTooLow) return false;
        }

        if (brainParams.maxVig) {
          const isVigTooHigh = parseFloat(entry.vig) > brainParams.maxVig;
          if (isVigTooHigh) return false;
        }

        // Check various conditions for filtering
        const isStaleData =
          currentTime - new Date(entry.timeScraped) >
          brainParams.dataStaleTimeInSeconds * 1000;
        const isFailedBet =
          tempFailBetListTarget_ticketReference.some((failBet) =>
            isSameBet(entry, failBet),
          ) ||
          tempFailBetListTarget_ticketTarget.some((failBet) =>
            isSameBet(entry, failBet),
          ) ||
          tempFailBetListTarget_ev.some((failBet) =>
            isSameBet(entry, failBet),
          ) ||
          tempFailBetListTarget_oddsNotInRange.some((failBet) =>
            isSameBet(entry, failBet),
          );

        // Check all 6 criteria
        const checkCriteria1 = checkRepeatedEvents(
          entry,
          successBetListTarget,
          brainParams.maxNumberOfRepeatedEvents,
        );
        const checkCriteria2 = checkRepeatedEvents1stHalf(
          entry,
          successBetListTarget,
          brainParams.maxNumberOfRepeatedEvents1stHalf,
        );
        const checkCriteria3 = checkRepeatedEventsAH(
          entry,
          successBetListTarget,
          brainParams.maxNumberOfRepeatedEventsAH,
        );
        const checkCriteria4 = checkRepeatedEventsOU(
          entry,
          successBetListTarget,
          brainParams.maxNumberOfRepeatedEventsOU,
        );
        const checkCriteria5 = checkRepeatedEvents1X2(
          entry,
          successBetListTarget,
          brainParams.maxNumberOfRepeatedEvents1X2,
        );
        const checkCriteria6 = checkRepeatBets(
          entry,
          successBetListTarget,
          brainParams.maxNumberOfRepeatBets,
        );

        const isOutOfOddsRange = !isOddsInRange(entry.odds, brainParams);

        const isUnwantedEntry =
          entry.leagueName.includes("e-Football") ||
          entry.homeName.includes("(ET)") ||
          entry.awayName.includes("(PEN)") ||
          entry.homeName.includes("Winner") ||
          entry.awayName.includes("Which team");

        // Check if there's a recent bet for this game
        const isWaitingListBet = waitingListBets.some(
          (bet) =>
            bet.homeName === entry.homeName && bet.awayName === entry.awayName,
        );

        // Check if there's a recent bet for this game
        const isRecentSuccessBet = recentSuccessBetList.some(
          (bet) =>
            bet.homeName === entry.homeName && bet.awayName === entry.awayName,
        );

        return !(
          isStaleData ||
          isFailedBet ||
          isOutOfOddsRange ||
          isUnwantedEntry ||
          isWaitingListBet ||
          isRecentSuccessBet ||
          !checkCriteria1 ||
          !checkCriteria2 ||
          !checkCriteria3 ||
          !checkCriteria4 ||
          !checkCriteria5 ||
          !checkCriteria6
        );
      });

      // Find matching entries and calculate overvalue
      for (let entry of data_target) {
        const searchCriteria = {
          sportId: entry.sportId,
          periodId: entry.periodId,
          marketId: entry.marketId,
          marketParam: entry.marketParam,
        };
        if (brainParams.matchLeagueBoolean)
          searchCriteria.leagueId = entry.leagueId;

        for (let entryReference of data_reference) {
          if (
            Object.keys(searchCriteria).every(
              (key) => entryReference[key] === searchCriteria[key],
            ) &&
            fuzzMatch(entry, entryReference, brainParams.fuzzMatchMinScore)
          ) {
            const overvalue =
              parseFloat(entry.odds) / parseFloat(entryReference.noVigOdds) - 1;
            if (
              overvalue > brainParams.minEV &&
              overvalue < brainParams.maxEV
            ) {
              const { _id, ...entryWithoutId } = entry; // Remove _id to prevent duplication

              let referenceButtonId;
              if (refAcc.startsWith("ps3838")) {
                referenceButtonId = entryReference.buttonId3838;
              } else if (refAcc.startsWith("isn")) {
                referenceButtonId = entryReference.buttonIdISN;
              }

              pendingBetList.push({
                ...entryWithoutId,
                referenceButtonId: referenceButtonId,
                referenceOdds: entryReference.odds,
                referenceNoVigOdds: entryReference.noVigOdds,
                referenceVig: entryReference.vig,
                referenceNoVigIncreased: entryReference.noVigIncreased,
                referenceHomeName: entryReference.homeName,
                referenceAwayName: entryReference.awayName,
                referenceScrapedTime: entryReference.timeScraped,
                overvalue,
              });
            }
          }
        }
      }

      // Sort pendingBetList
      pendingBetList = _.orderBy(pendingBetList, ["overvalue"], ["desc"]);
      pendingBetListTemp = _.cloneDeep(pendingBetList);

      // Update database
      await deleteData("pendingBetList", accFilter);
      if (pendingBetList.length > 0) {
        const insertResult = await writeData("pendingBetList", pendingBetList);
        if (insertResult.error) {
          console.warn(
            `${acc} - MongoDB (brain) - Some documents were not inserted in pendingBetList. Error:`,
            insertResult.error,
          );
        }
      }

      if (brainParams.consoleLogPendingBetList) {
        console.log(
          `${acc} -------------- PENDING BET LIST ${pendingBetList.length} -----------`,
        );
        console.log(`${acc} - filtered data_target length`, data_target.length);
        console.log(
          `${refAcc} - filtered data_reference length`,
          data_reference.length,
        );
      }
    });
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    if (session) {
      session.endSession();
    }
  }

  return pendingBetListTemp;
};

// Helper functions
function isSameBet(entry, failBet) {
  return (
    failBet.homeName === entry.homeName &&
    failBet.awayName === entry.awayName &&
    failBet.periodId === entry.periodId &&
    failBet.marketId === entry.marketId &&
    failBet.marketParam === entry.marketParam
  );
}

function checkRepeatedEvents(entry, successBetList, maxNumber) {
  return (
    successBetList.filter(
      (successBet) =>
        successBet.homeName === entry.homeName &&
        successBet.awayName === entry.awayName,
    ).length < maxNumber
  );
}

function checkRepeatedEvents1stHalf(entry, successBetList, maxNumber) {
  return [10].includes(entry.periodId)
    ? successBetList.filter(
        (successBet) =>
          successBet.homeName === entry.homeName &&
          successBet.awayName === entry.awayName &&
          [10].includes(successBet.periodId),
      ).length < maxNumber
    : true;
}

function checkRepeatedEventsAH(entry, successBetList, maxNumber) {
  return [17, 18].includes(entry.marketId)
    ? successBetList.filter(
        (successBet) =>
          successBet.homeName === entry.homeName &&
          successBet.awayName === entry.awayName &&
          [17, 18].includes(successBet.marketId),
      ).length < maxNumber
    : true;
}

function checkRepeatedEventsOU(entry, successBetList, maxNumber) {
  return [19, 20].includes(entry.marketId)
    ? successBetList.filter(
        (successBet) =>
          successBet.homeName === entry.homeName &&
          successBet.awayName === entry.awayName &&
          successBet.marketId === entry.marketId,
      ).length < maxNumber
    : true;
}

function checkRepeatedEvents1X2(entry, successBetList, maxNumber) {
  return [11, 12, 13].includes(entry.marketId)
    ? successBetList.filter(
        (successBet) =>
          successBet.homeName === entry.homeName &&
          successBet.awayName === entry.awayName &&
          [11, 12, 13].includes(successBet.marketId),
      ).length < maxNumber
    : true;
}

function checkRepeatBets(entry, successBetList, maxNumber) {
  return (
    successBetList.filter(
      (successBet) =>
        successBet.homeName === entry.homeName &&
        successBet.awayName === entry.awayName &&
        successBet.periodId === entry.periodId &&
        successBet.marketId === entry.marketId &&
        successBet.marketParam === entry.marketParam,
    ).length < maxNumber
  );
}

module.exports = { brainContraV2 };
