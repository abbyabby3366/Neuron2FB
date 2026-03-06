const fs = require("fs");
const {
  startSession,
  readData,
  writeData,
  deleteData,
} = require("../../../mongodb/db");
const _ = require("lodash");
const { fuzzMatch } = require("../../../utils/fuzzMatch");

// all need to convert to EU odds first
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
        data_ps3838,
        data_Sbo,
        successBetListSBO,
        tempFailBetListSBO,
        waitingBetList,
        successBetList,
      ] = await Promise.all([
        readData("data_ps3838"),
        readData("data_Sbo", accFilter),
        readData("successBetList", accFilter),
        readData("tempFailBetList", accFilter),
        readData("waitingBetList"),
        readData("successBetList"),
      ]);

      let data_reference = data_ps3838;

      // if (params.consoleLogAverageVig) {
      //   console.log('data_reference_average_vig', data_reference.reduce((acc, el) => acc + parseFloat(el.vig), 0) / data_reference.length)
      //   console.log('data_target_average_vig', data_Sbo.reduce((acc, el) => acc + parseFloat(el.vig), 0) / data_Sbo.length)
      // }

      // Process and filter data_reference
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

      // Filter tempFailBetListSBO
      let tempFailBetListSBO_ticket3838 = tempFailBetListSBO.filter(
        (entry) =>
          entry.betFailedReason === "ticket3838" &&
          currentTime - new Date(entry.betFailedTime) <
            brainParams.timeBetweenTicketFail * 1000,
      );
      let tempFailBetListSBO_ticketSBO = tempFailBetListSBO.filter(
        (entry) =>
          entry.betFailedReason === "ticketSBO" &&
          currentTime - new Date(entry.betFailedTime) <
            brainParams.timeBetweenTicketFail * 1000,
      );
      let tempFailBetListSBO_ev = tempFailBetListSBO.filter(
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

      // data_Sbo = data_Sbo.filter(entry => {

      // })

      data_Sbo = data_Sbo.filter((entry) => {
        //filter based on league
        if (brainParams.whitelistLeague) {
          const wantedLeagues = [
            "ENGLISH PREMIER LEAGUE",
            "ITALY SERIE A",
            "SPAIN LA LIGA",
            "GERMANY BUNDESLIGA",
            "UEFA CHAMPIONS LEAGUE",
            "UEFA EUROPA LEAGUE",
            "FRANCE LIGUE 1",
            "NETHERLANDS EREDIVISIE",
          ].map((league) => league.toUpperCase()); // Convert all leagues to uppercase

          const isWantedLeague = wantedLeagues.some((league) =>
            entry.leagueName.toUpperCase().includes(league),
          );
          if (!isWantedLeague) return false;
        }

        if (brainParams.blacklistLeague) {
          const unwantedLeagues = [
            "abcedfhdjsjfkdjfhskjdhkjsf",
            "ajkshdfkjasdhkjf",
          ].map((league) => league.toUpperCase()); // Convert all leagues to uppercase
          const isUnwantedLeague = unwantedLeagues.some((league) =>
            entry.leagueName.toUpperCase().includes(league),
          );
          if (isUnwantedLeague) return false;
        }

        // Check various conditions for filtering
        const isStaleData =
          currentTime - new Date(entry.timeScraped) >
          brainParams.dataStaleTimeInSeconds * 1000;
        const isFailedBet =
          tempFailBetListSBO_ticket3838.some((failBet) =>
            isSameBet(entry, failBet),
          ) ||
          tempFailBetListSBO_ticketSBO.some((failBet) =>
            isSameBet(entry, failBet),
          ) ||
          tempFailBetListSBO_ev.some((failBet) => isSameBet(entry, failBet));

        // Check all 6 criteria
        const checkCriteria1 = checkRepeatedEvents(
          entry,
          successBetListSBO,
          brainParams.maxNumberOfRepeatedEvents,
        );
        const checkCriteria2 = checkRepeatedEvents1stHalf(
          entry,
          successBetListSBO,
          brainParams.maxNumberOfRepeatedEvents1stHalf,
        );
        const checkCriteria3 = checkRepeatedEventsAH(
          entry,
          successBetListSBO,
          brainParams.maxNumberOfRepeatedEventsAH,
        );
        const checkCriteria4 = checkRepeatedEventsOU(
          entry,
          successBetListSBO,
          brainParams.maxNumberOfRepeatedEventsOU,
        );
        const checkCriteria5 = checkRepeatedEvents1X2(
          entry,
          successBetListSBO,
          brainParams.maxNumberOfRepeatedEvents1X2,
        );
        const checkCriteria6 = checkRepeatBets(
          entry,
          successBetListSBO,
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
      for (let entry of data_Sbo) {
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
