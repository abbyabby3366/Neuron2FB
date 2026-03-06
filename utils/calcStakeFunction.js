// overvalue, capital, kellymultiplier, unconvertedOdds, odds(convertedToEU), maxBet, round, flatratio, EVForceCut， referenceVig, targetVig, oddsType, calcStakeMethod
const calcStakeFunction = (data) => {
  let stakeConvertMuliplier;
  if (data.oddsType === "EU") {
    stakeConvertMuliplier = 1;
  } else if (data.oddsType === "ID") {
    if (data.unconvertedOdds > 0) {
      stakeConvertMuliplier = 1;
    } else if (data.unconvertedOdds < 0) {
      stakeConvertMuliplier = -1 / data.unconvertedOdds; //unconfirmed, confirmed once
    }
  } else if (data.oddsType === "MY") {
    if (data.unconvertedOdds > 0) {
      stakeConvertMuliplier = 1;
    } else if (data.unconvertedOdds < 0) {
      stakeConvertMuliplier = -1 / data.unconvertedOdds; //unconfirmed, confirmed once
    }
  }

  const round = data.round;
  const maxStake = data.maxBet * data.capital;

  if (data.calcStakeMethod === "kelly") {
    if (data.overvalue + data.EVForceCut <= 0) {
      console.warn("Stake data: overvalue <= 0, set stake = 10");
      return 10;
    }
    let probability = (1 + data.overvalue) / data.odds;
    let cappedOvervalue = Math.min(data.overvalue, data.maxEVCap);
    let forcedOvervalue = cappedOvervalue + data.EVForceCut;
    const kelly =
      forcedOvervalue / ((1 / probability) * (1 + forcedOvervalue) - 1);
    const expectedStake =
      data.capital * data.kellyMultiplier * kelly * stakeConvertMuliplier;
    // console.log("Stake data: ", {
    //   odds: data.odds,
    //   overvalue: data.overvalue,
    //   EVForceCut: data.EVForceCut,
    //   forcedOvervalue: forcedOvervalue,
    //   kelly,
    //   kellyMultiplier: data.kellyMultiplier,
    //   expectedStake,
    //   maxStake,
    //   round,
    //   stakeConvertMuliplier
    // })
    return expectedStake < maxStake
      ? Math.floor(expectedStake / round) * round
      : Math.floor(maxStake / round) * round;
  } else if (data.calcStakeMethod === "flat") {
    console.log("calcStakeMethod: flat");
    const flatRatio = data.flatRatio;
    const expectedStake = data.capital * flatRatio * stakeConvertMuliplier;
    return expectedStake < maxStake
      ? Math.floor(expectedStake / round) * round
      : Math.floor(maxStake / round) * round;
  } else if (data.calcStakeMethod === "samewin") {
    console.log("calcStakeMethod: samewin");
    const sameWinRatio = data.sameWinRatio;
    const odds = data.odds;
    console.log("odds: ", odds);
    console.log("sameWinRatio: ", sameWinRatio);
    console.log("stakeConvertMuliplier: ", stakeConvertMuliplier);
    console.log("data.capital: ", data.capital);
    const expectedStake =
      (data.capital * sameWinRatio * stakeConvertMuliplier) / odds;
    console.log("expectedStake: ", expectedStake);
    return expectedStake < maxStake
      ? Math.floor(expectedStake / round) * round
      : Math.floor(maxStake / round) * round;
  }
};

const { getCurrentTime } = require("./getCurrentTime");

function adjustStakeToLimits(stake, ticketDataTarget, params, acc) {
  // console.log(`${acc} - Check min/max stake and balance: ` + getCurrentTime());
  let round = params.stakeInput.round;

  if (stake < ticketDataTarget.minStake) {
    throw new Error("Min bet is higher than calculated stake");
  } else if (stake > ticketDataTarget.maxStake) {
    if (ticketDataTarget.accountBalance > ticketDataTarget.maxStake) {
      console.log(
        `${acc} - Bet Amount (Max Stake):`,
        ticketDataTarget.maxStake,
      );
      stake = Math.floor(ticketDataTarget.maxStake / round) * round;
    } else {
      console.log(
        `${acc} - Bet Amount (Remaining Balance):`,
        ticketDataTarget.accountBalance,
      );
      stake = Math.floor(ticketDataTarget.accountBalance / round) * round;
    }
  } else {
    if (ticketDataTarget.accountBalance > stake) {
      console.log(`${acc} - Bet Amount (Expected Stake):`, stake);
    } else {
      console.log(
        `${acc} - Bet Amount (Remaining Balance):`,
        ticketDataTarget.accountBalance,
      );
      stake = Math.floor(ticketDataTarget.accountBalance / round) * round;
    }
  }

  // console.log({
  //   Odds: ticketDataTarget.tickettedOddsEU,
  //   Stake: stake,
  //   Max: ticketDataTarget.maxStake,
  //   Min: ticketDataTarget.minStake,
  //   Balance: ticketDataTarget.accountBalance,
  // });

  return stake;
}

module.exports = { calcStakeFunction, adjustStakeToLimits };
