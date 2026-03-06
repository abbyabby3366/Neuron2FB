const { parse } = require("papaparse");

function addMethod(numberOfOutcomes, ...args) {
  if (numberOfOutcomes === 2) {
    const [odds1, odds2] = args;
    const vig = 1 / odds1 + 1 / odds2 - 1;
    const splitHalfVig = vig / numberOfOutcomes; // Split the vig equally between the two outcomes
    const noVigOdds1 = parseFloat((1 / (1 / odds1 - splitHalfVig)).toFixed(4));
    const noVigOdds2 = parseFloat((1 / (1 / odds2 - splitHalfVig)).toFixed(4));
    const oddsIncrease1 = parseFloat((noVigOdds1 / odds1).toFixed(4));
    const oddsIncrease2 = parseFloat((noVigOdds2 / odds2).toFixed(4));
    const vigFixed = parseFloat(vig.toFixed(4));
    return [noVigOdds1, noVigOdds2, vigFixed, oddsIncrease1, oddsIncrease2];
  } else if (numberOfOutcomes === 3) {
    const [odds1, odds2, odds3] = args;
    const vig = (1 / odds1 + 1 / odds2 + 1 / odds3 - 1) / numberOfOutcomes;
    const splitVig = vig / numberOfOutcomes; // Split the vig equally between the three outcomes
    const noVigOdds1 = parseFloat((1 / (1 / odds1 - splitVig)).toFixed(4));
    const noVigOdds2 = parseFloat((1 / (1 / odds2 - splitVig)).toFixed(4));
    const noVigOdds3 = parseFloat((1 / (1 / odds3 - splitVig)).toFixed(4));
    const oddsIncrease1 = parseFloat((noVigOdds1 / odds1).toFixed(4));
    const oddsIncrease2 = parseFloat((noVigOdds2 / odds2).toFixed(4));
    const oddsIncrease3 = parseFloat((noVigOdds3 / odds3).toFixed(4));
    const vigFixed = parseFloat(vig.toFixed(4));
    return [
      noVigOdds1,
      noVigOdds2,
      noVigOdds3,
      vigFixed,
      oddsIncrease1,
      oddsIncrease2,
      oddsIncrease3,
    ];
  }
}

// console.log(addMethod(2, 1.2, 4));

function mulMethod(numberOfOutcomes, ...args) {
  if (numberOfOutcomes === 2) {
    const [odds1, odds2] = args;
    const vig = 1 / odds1 + 1 / odds2 - 1;
    const oneMinusVig = 1 - vig;
    const noVigOdds1 = parseFloat((1 / ((1 / odds1) * oneMinusVig)).toFixed(4));
    const noVigOdds2 = parseFloat((1 / ((1 / odds2) * oneMinusVig)).toFixed(4));
    const oddsIncrease1 = parseFloat((noVigOdds1 / odds1).toFixed(4));
    const oddsIncrease2 = parseFloat((noVigOdds2 / odds2).toFixed(4));
    const vigFixed = parseFloat(vig.toFixed(4));
    return [noVigOdds1, noVigOdds2, vigFixed, oddsIncrease1, oddsIncrease2];
  } else if (numberOfOutcomes === 3) {
    const [odds1, odds2, odds3] = args;
    const vig = 1 / odds1 + 1 / odds2 + 1 / odds3 - 1;
    const oneMinusVig = 1 - vig;
    const noVigOdds1 = parseFloat((1 / ((1 / odds1) * oneMinusVig)).toFixed(4));
    const noVigOdds2 = parseFloat((1 / ((1 / odds2) * oneMinusVig)).toFixed(4));
    const noVigOdds3 = parseFloat((1 / ((1 / odds3) * oneMinusVig)).toFixed(4));
    const oddsIncrease1 = parseFloat((noVigOdds1 / odds1).toFixed(4));
    const oddsIncrease2 = parseFloat((noVigOdds2 / odds2).toFixed(4));
    const oddsIncrease3 = parseFloat((noVigOdds3 / odds3).toFixed(4));
    const vigFixed = parseFloat(vig.toFixed(4));
    return [
      noVigOdds1,
      noVigOdds2,
      noVigOdds3,
      vigFixed,
      oddsIncrease1,
      oddsIncrease2,
      oddsIncrease3,
    ];
  }
}

function powMethod(numberOfOutcomes, ...args) {
  if (numberOfOutcomes === 2) {
    const [odds1, odds2] = args;
    const vig = 1 / odds1 + 1 / odds2 - 1;
    const oneMinusVig = 1 - vig;
    const k =
      Math.log(numberOfOutcomes) / Math.log(numberOfOutcomes / oneMinusVig);
    const noVigOdds1 = parseFloat((1 / Math.pow(1 / odds1, 1 / k)).toFixed(4));
    const noVigOdds2 = parseFloat((1 / Math.pow(1 / odds2, 1 / k)).toFixed(4));
    const oddsIncrease1 = parseFloat((noVigOdds1 / odds1).toFixed(4));
    const oddsIncrease2 = parseFloat((noVigOdds2 / odds2).toFixed(4));
    const vigFixed = parseFloat(vig.toFixed(4));
    return [noVigOdds1, noVigOdds2, vigFixed, oddsIncrease1, oddsIncrease2];
  } else if (numberOfOutcomes === 3) {
    const [odds1, odds2, odds3] = args;
    const vig = 1 / odds1 + 1 / odds2 + 1 / odds3 - 1;
    const oneMinusVig = 1 - vig;
    const k = Math.log(numberOfOutcomes) / Math.log(numberOfOutcomes / vig);
    const noVigOdds1 = parseFloat(Math.pow(1 / odds1, 1 / k).toFixed(4));
    const noVigOdds2 = parseFloat(Math.pow(1 / odds2, 1 / k).toFixed(4));
    const noVigOdds3 = parseFloat(Math.pow(1 / odds3, 1 / k).toFixed(4));
    const vigFixed = parseFloat(vig.toFixed(4));
    const oddsIncrease1 = parseFloat((noVigOdds1 / odds1).toFixed(4));
    const oddsIncrease2 = parseFloat((noVigOdds2 / odds2).toFixed(4));
    const oddsIncrease3 = parseFloat((noVigOdds3 / odds3).toFixed(4));
    return [
      noVigOdds1,
      noVigOdds2,
      noVigOdds3,
      vigFixed,
      oddsIncrease1,
      oddsIncrease2,
      oddsIncrease3,
    ];
  }
}

console.log(powMethod(2, 1.88, 2, 5));
console.log(mulMethod(2, 1.88, 2, 5));
console.log(addMethod(2, 1.88, 2, 5));
console.log(brimMethod(2, 1.88, 20, 5));

function brimMethod(numberOfOutcomes, ...args) {
  if (numberOfOutcomes === 2) {
    const [odds1, odds2] = args;
    const vig = 1 / odds1 + 1 / odds2 - 1;
    const noVigOdds1 = parseFloat((1 / (1 - 1 / odds2)).toFixed(4));
    const noVigOdds2 = parseFloat((1 / (1 - 1 / odds1)).toFixed(4));
    const oddsIncrease1 = parseFloat((noVigOdds1 / odds1).toFixed(4));
    const oddsIncrease2 = parseFloat((noVigOdds2 / odds2).toFixed(4));
    const vigFixed = parseFloat(vig.toFixed(4));
    return [noVigOdds1, noVigOdds2, vigFixed, oddsIncrease1, oddsIncrease2];
  } else if (numberOfOutcomes === 3) {
    const [odds1, odds2, odds3] = args;
    const vig = 1 / odds1 + 1 / odds2 + 1 / odds3 - 1;
    const noVigOdds1 = parseFloat((1 / (1 - 1 / odds2 - 1 / odds3)).toFixed(4));
    const noVigOdds2 = parseFloat((1 / (1 - 1 / odds1 - 1 / odds3)).toFixed(4));
    const noVigOdds3 = parseFloat((1 / (1 - 1 / odds1 - 1 / odds2)).toFixed(4));
    const oddsIncrease1 = parseFloat((noVigOdds1 / odds1).toFixed(4));
    const oddsIncrease2 = parseFloat((noVigOdds2 / odds2).toFixed(4));
    const oddsIncrease3 = parseFloat((noVigOdds3 / odds3).toFixed(4));
    const vigFixed = parseFloat(vig.toFixed(4));
    return [
      noVigOdds1,
      noVigOdds2,
      noVigOdds3,
      vigFixed,
      oddsIncrease1,
      oddsIncrease2,
      oddsIncrease3,
    ];
  }
}

module.exports = { addMethod, mulMethod, powMethod, brimMethod };

// Example usage:

// Odds for 1-2
// const odds1 = 1.88;
// const odds2 = 1.88;

// console.log("Additive Method: ", addMethod(2, odds1, odds2));
// console.log("Multiplicative Method: ", mulMethod(2, odds1, odds2));
// console.log("Power Method: ", powMethod(2, odds1, odds2));

// // Odds for 1X2 (3 numberOfOutcomes)
// const A1 = 1.74;
// const A2 = 3.32;
// const A3 = 4.08;

// console.log("\nAdditive Method: ", addMethod(3, A1, A2, A3));
// console.log("Multiplicative Method: ", mulMethod(3, A1, A2, A3));
// console.log("Power Method: ", powMethod(3, A1, A2, A3));
