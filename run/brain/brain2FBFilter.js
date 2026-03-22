const fs = require("fs");

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

function isMatchMinuteDisallowed(startedAt, disallowedMatchMinutes) {
  if (
    !startedAt ||
    !disallowedMatchMinutes ||
    disallowedMatchMinutes.trim() === ""
  )
    return false;

  // Extract all occurrences of a number followed by a single quote
  const minuteMatches = startedAt.match(/(\d+)'/g);
  if (!minuteMatches || minuteMatches.length === 0) return false;

  // Take the first match as the base match minute
  const minute = parseInt(minuteMatches[0].replace("'", ""));

  // Parse disallowedMatchMinutes: "0-10, 45, 85-90"
  const rules = disallowedMatchMinutes.split(",").map((s) => s.trim());

  for (const rule of rules) {
    if (rule.includes("-")) {
      const [start, end] = rule.split("-").map((s) => parseInt(s.trim()));
      if (minute >= start && minute <= end) return true;
    } else {
      if (parseInt(rule) === minute) return true;
    }
  }

  return false;
}

/**
 * Robust filtering for any account data (Target or Reference).
 * @param {Array} data - The array of betting entries.
 * @param {string} acc - Account name (e.g., 'sbo0').
 * @param {Object} brainParams - The brainParams for this specific account.
 * @param {Date} currentTime - The current time.
 * @param {Array} successBetList - The list of successful bets for this account.
 * @param {Array} tempFailBetList - The list of temporary failed bets for this account.
 * @param {Array} waitingBetList - The global waiting bet list.
 * @param {Array} globalSuccessBetList - The global success bet list (optional).
 * @returns {Array} - Filtered data.
 */
function filterData(
  data,
  acc,
  brainParams,
  currentTime,
  successBetList,
  tempFailBetList,
  waitingBetList,
  globalSuccessBetList,
) {
  if (!brainParams) return data;

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
  } else if (acc.startsWith("2fb")) {
    leagueFilter = leagueFilter["2fb"] || { whitelist: [], blacklist: [] };
  } else {
    leagueFilter = { whitelist: [], blacklist: [] };
  }

  // Filter tempFailBetList
  let tempFail_ticketReference = tempFailBetList.filter(
    (entry) =>
      entry.betFailedReason === "ticketReference" &&
      currentTime - new Date(entry.betFailedTime) <
        brainParams.timeBetweenTicketFail * 1000,
  );
  let tempFail_ticketTarget = tempFailBetList.filter(
    (entry) =>
      entry.betFailedReason === "ticketTarget" &&
      currentTime - new Date(entry.betFailedTime) <
        brainParams.timeBetweenTicketFail * 1000,
  );
  let tempFail_ev = tempFailBetList.filter(
    (entry) =>
      entry.betFailedReason === "ev" &&
      currentTime - new Date(entry.betFailedTime) <
        brainParams.timeBetweenEVFail * 1000,
  );
  let tempFail_oddsNotInRange = tempFailBetList.filter(
    (entry) =>
      entry.betFailedReason === "oddsNotInRange" &&
      currentTime - new Date(entry.betFailedTime) <
        brainParams.timeBetweenOddsFail * 1000,
  );
  let tempFail_refMaxStakeNotInRange = tempFailBetList.filter(
    (entry) =>
      entry.betFailedReason === "refMaxStake" &&
      currentTime - new Date(entry.betFailedTime) <
        brainParams.timeBetweenRefMaxStakeFail * 1000,
  );
  let tempFail_targetMaxStakeNotInRange = tempFailBetList.filter(
    (entry) =>
      entry.betFailedReason === "targetMaxStake" &&
      currentTime - new Date(entry.betFailedTime) <
        brainParams.timeBetweenTargetMaxStakeFail * 1000,
  );

  // Get games with recent bets
  const filteredWaitingListBets = waitingBetList.filter((bet) => {
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

  const filteredRecentSuccessBetList = (globalSuccessBetList || []).filter(
    (bet) => {
      const timeDiff = currentTime - new Date(bet.betPlacedTime);
      const isGlobalMatch = timeDiff < brainParams.sameGameDelayInSeconds * 1000;
      
      const isAHMatch = MARKET_IDS.ASIAN_HANDICAP.includes(bet.marketId) && 
                        brainParams.sameGameAHDelay && 
                        timeDiff < brainParams.sameGameAHDelay * 1000;
                        
      const isOUMatch = MARKET_IDS.OVER_UNDER.includes(bet.marketId) && 
                        brainParams.sameGameOUDelay && 
                        timeDiff < brainParams.sameGameOUDelay * 1000;

      return isGlobalMatch || isAHMatch || isOUMatch;
    },
  );

  return data
    .map((el) => ({
      ...el,
      leagueName: (el.leagueName || "").replace(/(Group.*)/gi, "").trim(),
    }))
    .filter((entry) => {
      // Basic unwanted check
      const isUnwantedEntry =
        entry.leagueName.includes("e-Football") ||
        (entry.homeName && entry.homeName.includes("(ET)")) ||
        (entry.awayName && entry.awayName.includes("(PEN)")) ||
        (entry.homeName && entry.homeName.includes("Winner")) ||
        (entry.awayName && entry.awayName.includes("Which team"));
      if (isUnwantedEntry) return false;

      // Stale data check
      if (
        currentTime - new Date(entry.timeScraped) >
        brainParams.dataStaleTimeInSeconds * 1000
      )
        return false;

      // Period/Market Restrictions
      if (
        brainParams.allowFirstHalf === false &&
        entry.periodId === PERIOD_IDS.FIRST_HALF
      )
        return false;
      if (
        brainParams.allowRegularTime === false &&
        entry.periodId === PERIOD_IDS.REGULAR_TIME
      )
        return false;
      if (brainParams.allowOver === false && entry.marketId === 19)
        return false;
      if (brainParams.allowUnder === false && entry.marketId === 20)
        return false;
      if (
        brainParams.allowHandicap === false &&
        [17, 18].includes(entry.marketId)
      )
        return false;
      if (
        brainParams.allow1X2 === false &&
        [11, 12, 13].includes(entry.marketId)
      )
        return false;

      // Odds Range
      if (
        parseFloat(entry.odds) < brainParams.minOdds ||
        parseFloat(entry.odds) > brainParams.maxOdds
      )
        return false;

      // Vig Check (Support both generic and ref-specific names)
      const minV = brainParams.minVig || brainParams.minRefVig;
      const maxV = brainParams.maxVig || brainParams.maxRefVig;
      if (minV && parseFloat(entry.vig) < minV) return false;
      if (maxV && parseFloat(entry.vig) > maxV) return false;

      // Account specific time periods (SBO)
      if (acc.startsWith("sbo")) {
        // Match Minute Filter
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

      // Regex Market Param filters
      if (
        brainParams.allowAHMarketParamsRegex &&
        MARKET_IDS.ASIAN_HANDICAP.includes(entry.marketId)
      ) {
        if (
          !new RegExp(brainParams.allowAHMarketParamsRegex).test(
            entry.marketParam,
          )
        )
          return false;
      }
      if (
        brainParams.allowOverMarketParamsRegex &&
        entry.marketId === 19
      ) {
        if (
          !new RegExp(brainParams.allowOverMarketParamsRegex).test(
            entry.marketParam,
          )
        )
          return false;
      }
      if (
        brainParams.allowUnderMarketParamsRegex &&
        entry.marketId === 20
      ) {
        if (
          !new RegExp(brainParams.allowUnderMarketParamsRegex).test(
            entry.marketParam,
          )
        )
          return false;
      }

      // League Filter
      if (brainParams.whitelistLeague) {
        const wantedLeagues = leagueFilter.whitelist.map((l) =>
          l.toUpperCase(),
        );
        if (!wantedLeagues.includes(entry.leagueName.toUpperCase()))
          return false;
      }
      if (brainParams.blacklistLeague) {
        const unwantedLeagues = leagueFilter.blacklist.map((l) =>
          l.toUpperCase(),
        );
        if (
          unwantedLeagues.some((l) =>
            entry.leagueName.toUpperCase().includes(l),
          )
        )
          return false;
      }

      // Repeat Bet/Event Checks
      if (
        !checkRepeatedEvents(
          entry,
          successBetList,
          brainParams.maxNumberOfRepeatedEvents,
        )
      )
        return false;
      if (
        !checkRepeatedEvents1stHalf(
          entry,
          successBetList,
          brainParams.maxNumberOfRepeatedEvents1stHalf,
        )
      )
        return false;
      if (
        !checkRepeatedEventsAH(
          entry,
          successBetList,
          brainParams.maxNumberOfRepeatedEventsAH,
        )
      )
        return false;
      if (
        !checkRepeatedEventsOU(
          entry,
          successBetList,
          brainParams.maxNumberOfRepeatedEventsOU,
        )
      )
        return false;
      if (
        !checkRepeatedEvents1X2(
          entry,
          successBetList,
          brainParams.maxNumberOfRepeatedEvents1X2,
        )
      )
        return false;
      if (
        !checkRepeatBets(
          entry,
          successBetList,
          brainParams.maxNumberOfRepeatBets,
        )
      )
        return false;

      // Failed Bet check
      const isFailed =
        tempFail_ticketReference.some((fb) => isSameBet(entry, fb)) ||
        tempFail_ticketTarget.some((fb) => isSameBet(entry, fb)) ||
        tempFail_ev.some((fb) => isSameBet(entry, fb)) ||
        tempFail_oddsNotInRange.some((fb) => isSameBet(entry, fb)) ||
        tempFail_refMaxStakeNotInRange.some((fb) => isSameBet(entry, fb)) ||
        tempFail_targetMaxStakeNotInRange.some((fb) => isSameBet(entry, fb));
      if (isFailed) return false;

      // Waiting list check
      if (
        filteredWaitingListBets.some((bet) => {
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
        })
      )
        return false;
      if (
        filteredRecentSuccessBetList.some((bet) => {
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
        })
      )
        return false;

      return true;
    });
}

module.exports = {
  MARKET_IDS,
  PERIOD_IDS,
  filterData,
};
