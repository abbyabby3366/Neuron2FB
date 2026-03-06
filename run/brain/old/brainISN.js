const fs = require("fs");
const {
  startSession,
  readData,
  writeData,
  deleteData,
} = require("../../../mongodb/db");
const _ = require("lodash");
const { fuzzMatch } = require("../../../utils/fuzzMatch");

// all need to convert to EU odds
const brain = async (acc) => {
  let pendingBetList = [];
  let pendingBetListTemp = [];
  let session;

  try {
    session = await startSession();

    await session.withTransaction(async () => {
      const accFilter = { acc: acc };
      const params = JSON.parse(
        fs.readFileSync(`./TargetBookie/${acc}.json`, "utf-8"),
      );
      const { brainParams } = params;

      const currentTime = new Date();

      // Read data from MongoDB
      let [
        data_reference,
        data_Target,
        successBetListTarget,
        tempFailBetListTarget,
        waitingBetList,
        successBetList,
      ] = await Promise.all([
        readData("data_ps3838"),
        readData(`data_Isn`, accFilter),
        readData("successBetList", accFilter),
        readData("tempFailBetList", accFilter),
        readData("waitingBetList"),
        readData("successBetList"),
      ]);

      // Process and filter data_reference for ps3838
      data_reference = data_reference
        .map((el) => ({
          ...el,
          leagueName: el.leagueName.replace(/(Group.*)/gi, "").trim(),
        }))
        .filter((el) => {
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

      // Filter tempFailBetListTarget
      let tempFailBetListTarget_ticket3838 = tempFailBetListTarget.filter(
        (entry) =>
          entry.betFailedReason === "ticket3838" &&
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

      data_Target = data_Target.filter((entry) => {
        // Check various conditions for filtering
        const isStaleData =
          currentTime - new Date(entry.timeScraped) >
          brainParams.dataStaleTimeInSeconds * 1000;
        const isFailedBet =
          tempFailBetListTarget_ticket3838.some((failBet) =>
            isSameBet(entry, failBet),
          ) ||
          tempFailBetListTarget_ticketTarget.some((failBet) =>
            isSameBet(entry, failBet),
          ) ||
          tempFailBetListTarget_ev.some((failBet) => isSameBet(entry, failBet));

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

        const isOutOfOddsRange =
          parseFloat(entry.odds) < brainParams.minOdds ||
          parseFloat(entry.odds) > brainParams.maxOdds;
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
      for (let entry of data_Target) {
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
              pendingBetList.push({
                ...entryWithoutId,
                buttonId3838: entryReference.buttonId3838,
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
            "MongoDB (brain) - Some documents were not inserted in pendingBetList. Error:",
            insertResult.error,
          );
        }
      }

      if (brainParams.consoleLogPendingBetList) {
        console.log(
          `---------PENDING BET LIST${pendingBetList.length}-----------`,
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

module.exports = { brain };
