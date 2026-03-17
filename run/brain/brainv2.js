const fs = require("fs");
const {
  startSession,
  readData,
  writeData,
  deleteData,
} = require("../../mongodb/db");
const _ = require("lodash");
const { fuzzMatch } = require("../../utils/fuzzMatch");

// Market and Period ID constants
const MARKET_IDS = {
  ASIAN_HANDICAP: [17, 18],
  OVER_UNDER: [19, 20],
  MATCH_RESULT: [11, 12, 13],
};

const PERIOD_IDS = {
  FIRST_HALF: 10,
  REGULAR_TIME: 4,
};

// all need to convert to EU odds first
const brainv2 = async (refAcc, acc) => {
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
      } else if (acc.startsWith("obet")) {
        leagueFilter = leagueFilter.obet;
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
      // // console.log(data_target)
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
      let tempFailBetListTarget_refMaxStakeNotInRange =
        tempFailBetListTarget.filter(
          (entry) =>
            entry.betFailedReason === "refMaxStake" &&
            currentTime - new Date(entry.betFailedTime) <
              brainParams.timeBetweenRefMaxStakeFail * 1000,
        );
      let tempFailBetListTarget_targetMaxStakeNotInRange =
        tempFailBetListTarget.filter(
          (entry) =>
            entry.betFailedReason === "targetMaxStake" &&
            currentTime - new Date(entry.betFailedTime) <
              brainParams.timeBetweenTargetMaxStakeFail * 1000,
        );

      // Get games with recent bets from waiting and success (within 30 seconds)
      const waitingListBets = waitingBetList.filter((bet) => {
        const timeDiff = currentTime - new Date(bet.betEnteredTime);
        const isGlobalMatch = timeDiff < brainParams.sameGameDelayInSeconds * 1000;
        
        const isAHMatch = MARKET_IDS.ASIAN_HANDICAP.includes(bet.marketId) && 
                          brainParams.sameGameAHDelay && 
                          timeDiff < brainParams.sameGameAHDelay * 1000;
                          
        const isOUMatch = MARKET_IDS.OVER_UNDER.includes(bet.marketId) && 
                          brainParams.sameGameOUDelay && 
                          timeDiff < brainParams.sameGameOUDelay * 1000;

        return isGlobalMatch || isAHMatch || isOUMatch;
      });

      const recentSuccessBetList = successBetList.filter((bet) => {
        const timeDiff = currentTime - new Date(bet.betPlacedTime);
        const isGlobalMatch = timeDiff < brainParams.sameGameDelayInSeconds * 1000;
        
        const isAHMatch = MARKET_IDS.ASIAN_HANDICAP.includes(bet.marketId) && 
                          brainParams.sameGameAHDelay && 
                          timeDiff < brainParams.sameGameAHDelay * 1000;
                          
        const isOUMatch = MARKET_IDS.OVER_UNDER.includes(bet.marketId) && 
                          brainParams.sameGameOUDelay && 
                          timeDiff < brainParams.sameGameOUDelay * 1000;

        return isGlobalMatch || isAHMatch || isOUMatch;
      });

      // console.log('data_target before filter', acc, data_target.length)
      data_target = data_target.filter((entry) => {
        if (
          brainParams.allowFirstHalf === false &&
          entry.periodId === PERIOD_IDS.FIRST_HALF
        ) {
          return false;
        }

        if (
          brainParams.allowRegularTime === false &&
          entry.periodId === PERIOD_IDS.REGULAR_TIME
        ) {
          return false;
        }

        if (brainParams.allowOver === false && entry.marketId === 19) {
          return false;
        }

        if (brainParams.allowUnder === false && entry.marketId === 20) {
          return false;
        }

        // Filter by allowed time periods in startedAt
        if (acc.startsWith("sbo")) {
          // Helper to check Match Minute
          const isMatchMinuteDisallowed = (startedAt, disallowedMatchMinutes) => {
            if (
              !startedAt ||
              !disallowedMatchMinutes ||
              disallowedMatchMinutes.trim() === ""
            )
              return false;
            const minuteMatches = startedAt.match(/(\d+)'/g);
            if (!minuteMatches || minuteMatches.length === 0) return false;
            const minute = parseInt(minuteMatches[0].replace("'", ""));
            const rules = disallowedMatchMinutes.split(",").map((s) => s.trim());
            for (const rule of rules) {
              if (rule.includes("-")) {
                const [start, end] = rule.split("-").map((s) =>
                  parseInt(s.trim()),
                );
                if (minute >= start && minute <= end) return true;
              } else {
                if (parseInt(rule) === minute) return true;
              }
            }
            return false;
          };

          if (
            isMatchMinuteDisallowed(
              entry.startedAt,
              brainParams.disallowedMatchMinutes,
            )
          ) {
            return false;
          }

          if (
            Array.isArray(brainParams.timePeriodOfBetPlaced) &&
            brainParams.timePeriodOfBetPlaced.length > 0
          ) {
            const allowedPeriods = brainParams.timePeriodOfBetPlaced.map((p) =>
              p.trim().toUpperCase(),
            );
            let periodMatch =
              entry.startedAt && entry.startedAt.match(/(1H|2H|HT|LIVE)/i);
            let period = periodMatch ? periodMatch[1].toUpperCase() : null;
            if (!period || !allowedPeriods.includes(period)) return false;
          }
        }

        // Add filtering for allowHandicap and allow1X2
        if (
          brainParams.allowHandicap === false &&
          [17, 18].includes(entry.marketId)
        ) {
          return false;
        }

        if (
          brainParams.allow1X2 === false &&
          [11, 12, 13].includes(entry.marketId)
        ) {
          return false;
        }

        // Filter by marketParam regex for Asian Handicap markets
        if (
          brainParams.allowAHMarketParamsRegex &&
          brainParams.allowAHMarketParamsRegex.trim() !== "" &&
          MARKET_IDS.ASIAN_HANDICAP.includes(entry.marketId)
        ) {
          const regex = new RegExp(brainParams.allowAHMarketParamsRegex);
          if (!regex.test(entry.marketParam)) {
            return false;
          }
        }

        // Filter by marketParam regex for Over markets (marketId: 19)
        if (
          brainParams.allowOverMarketParamsRegex &&
          brainParams.allowOverMarketParamsRegex.trim() !== "" &&
          entry.marketId === 19
        ) {
          const regex = new RegExp(brainParams.allowOverMarketParamsRegex);
          if (!regex.test(entry.marketParam)) {
            return false;
          }
        }

        // Filter by marketParam regex for Under markets (marketId: 20)
        if (
          brainParams.allowUnderMarketParamsRegex &&
          brainParams.allowUnderMarketParamsRegex.trim() !== "" &&
          entry.marketId === 20
        ) {
          const regex = new RegExp(brainParams.allowUnderMarketParamsRegex);
          if (!regex.test(entry.marketParam)) {
            return false;
          }
        }

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
          ) ||
          tempFailBetListTarget_refMaxStakeNotInRange.some((failBet) =>
            isSameBet(entry, failBet),
          ) ||
          tempFailBetListTarget_targetMaxStakeNotInRange.some((failBet) =>
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
        const isWaitingListBet = waitingListBets.some((bet) => {
          const isSameGame = bet.homeName === entry.homeName && bet.awayName === entry.awayName;
          if (!isSameGame) return false;

          const timeDiff = currentTime - new Date(bet.betEnteredTime);
          
          // Global Block
          if (timeDiff < brainParams.sameGameDelayInSeconds * 1000) return true;

          // AH Specific Block
          if (MARKET_IDS.ASIAN_HANDICAP.includes(entry.marketId) && 
              MARKET_IDS.ASIAN_HANDICAP.includes(bet.marketId) &&
              brainParams.sameGameAHDelay && 
              timeDiff < brainParams.sameGameAHDelay * 1000) return true;

          // OU Specific Block
          if (MARKET_IDS.OVER_UNDER.includes(entry.marketId) && 
              MARKET_IDS.OVER_UNDER.includes(bet.marketId) &&
              brainParams.sameGameOUDelay && 
              timeDiff < brainParams.sameGameOUDelay * 1000) return true;

          return false;
        });

        // Check if there's a recent success bet for this game
        const isRecentSuccessBet = recentSuccessBetList.some((bet) => {
          const isSameGame = bet.homeName === entry.homeName && bet.awayName === entry.awayName;
          if (!isSameGame) return false;

          const timeDiff = currentTime - new Date(bet.betPlacedTime);
          
          // Global Block
          if (timeDiff < brainParams.sameGameDelayInSeconds * 1000) return true;

          // AH Specific Block
          if (MARKET_IDS.ASIAN_HANDICAP.includes(entry.marketId) && 
              MARKET_IDS.ASIAN_HANDICAP.includes(bet.marketId) &&
              brainParams.sameGameAHDelay && 
              timeDiff < brainParams.sameGameAHDelay * 1000) return true;

          // OU Specific Block
          if (MARKET_IDS.OVER_UNDER.includes(entry.marketId) && 
              MARKET_IDS.OVER_UNDER.includes(bet.marketId) &&
              brainParams.sameGameOUDelay && 
              timeDiff < brainParams.sameGameOUDelay * 1000) return true;

          return false;
        });

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
              let referenceContraButtonId;
              if (refAcc.startsWith("ps3838")) {
                referenceButtonId = entryReference.buttonId3838;
                referenceContraButtonId =
                  entryReference.referenceContraButtonId;
              } else if (refAcc.startsWith("isn")) {
                referenceButtonId = entryReference.buttonIdISN;
              }

              pendingBetList.push({
                ...entryWithoutId,
                referenceButtonId: referenceButtonId,
                referenceContraButtonId: referenceContraButtonId,
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
  return entry.periodId === PERIOD_IDS.FIRST_HALF
    ? successBetList.filter(
        (successBet) =>
          successBet.homeName === entry.homeName &&
          successBet.awayName === entry.awayName &&
          successBet.periodId === PERIOD_IDS.FIRST_HALF,
      ).length < maxNumber
    : true;
}

function checkRepeatedEventsAH(entry, successBetList, maxNumber) {
  return MARKET_IDS.ASIAN_HANDICAP.includes(entry.marketId)
    ? successBetList.filter(
        (successBet) =>
          successBet.homeName === entry.homeName &&
          successBet.awayName === entry.awayName &&
          MARKET_IDS.ASIAN_HANDICAP.includes(successBet.marketId),
      ).length < maxNumber
    : true;
}

function checkRepeatedEventsOU(entry, successBetList, maxNumber) {
  return MARKET_IDS.OVER_UNDER.includes(entry.marketId)
    ? successBetList.filter(
        (successBet) =>
          successBet.homeName === entry.homeName &&
          successBet.awayName === entry.awayName &&
          MARKET_IDS.OVER_UNDER.includes(successBet.marketId),
      ).length < maxNumber
    : true;
}

function checkRepeatedEvents1X2(entry, successBetList, maxNumber) {
  return MARKET_IDS.MATCH_RESULT.includes(entry.marketId)
    ? successBetList.filter(
        (successBet) =>
          successBet.homeName === entry.homeName &&
          successBet.awayName === entry.awayName &&
          MARKET_IDS.MATCH_RESULT.includes(successBet.marketId),
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

module.exports = { brainv2 };
