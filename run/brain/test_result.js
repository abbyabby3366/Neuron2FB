const _ = require('lodash');

/**
 * Verification Script for Brain2FB Logic (Self-Contained)
 * This script demonstrates the Malay Odds Sum and Contra lookup logic.
 */

// --- LOGIC UNDER TEST (Simplified from brain2FB.js) ---

function fuzzMatchMock(entry, entryReference) {
    // Simple mock fuzz match (matches if names are same)
    return entry.homeName === entryReference.homeName && entry.awayName === entryReference.awayName;
}

function processLogic(data_target, data_reference, brainParams) {
    let pendingBetList = [];

    for (let entry of data_target) {
        // Find matching entries in data_reference (Same Market)
        for (let entryReference of data_reference) {
            const isMatch = 
                entryReference.sportId === entry.sportId &&
                entryReference.periodId === entry.periodId &&
                entryReference.marketId === entry.marketId &&
                entryReference.marketParam === entry.marketParam &&
                fuzzMatchMock(entry, entryReference);

            if (isMatch) {
                // Determine Contra criteria
                let targetContraMarketId;
                let targetContraParam;

                if (entryReference.marketId === 19) { targetContraMarketId = 20; targetContraParam = entryReference.marketParam; }
                else if (entryReference.marketId === 20) { targetContraMarketId = 19; targetContraParam = entryReference.marketParam; }
                else if (entryReference.marketId === 17) { targetContraMarketId = 18; targetContraParam = entryReference.marketParam * -1; }
                else if (entryReference.marketId === 18) { targetContraMarketId = 17; targetContraParam = entryReference.marketParam * -1; }

                // Find the contra entry in data_reference
                const contraEntry = data_reference.find(ref => 
                    ref.sportId === entryReference.sportId &&
                    ref.periodId === entryReference.periodId &&
                    ref.marketId === targetContraMarketId &&
                    parseFloat(ref.marketParam) === parseFloat(targetContraParam) &&
                    ref.homeName === entryReference.homeName &&
                    ref.awayName === entryReference.awayName
                );

                if (contraEntry) {
                    const leftOdds = parseFloat(entry.odds);
                    const rightOdds = parseFloat(contraEntry.odds);
                    const ev = leftOdds + rightOdds;

                    if (ev > brainParams.minEV && ev < brainParams.maxEV) {
                        pendingBetList.push({
                            leftBet: { ...entry },
                            rightBet: {
                                buttonId: contraEntry.buttonId3838,
                                odds: rightOdds,
                                marketId: contraEntry.marketId,
                                marketParam: contraEntry.marketParam
                            },
                            ev: ev
                        });
                    }
                }
            }
        }
    }
    return pendingBetList;
}

// --- TEST EXECUTION ---

const data_target = [
    { sportId: 1, periodId: 10, marketId: 20, marketParam: 2.5, homeName: "Man Utd", awayName: "Liverpool", odds: 0.88 },
    { sportId: 1, periodId: 10, marketId: 18, marketParam: 0.5, homeName: "Arsenal", awayName: "Chelsea", odds: 0.95 }
];

const data_reference = [
    { sportId: 1, periodId: 10, marketId: 19, marketParam: 2.5, homeName: "Man Utd", awayName: "Liverpool", odds: 0.90, buttonId3838: "B1" },
    { sportId: 1, periodId: 10, marketId: 20, marketParam: 2.5, homeName: "Man Utd", awayName: "Liverpool", odds: 0.95, buttonId3838: "B2" },
    { sportId: 1, periodId: 10, marketId: 17, marketParam: -0.5, homeName: "Arsenal", awayName: "Chelsea", odds: 0.80, buttonId3838: "B3" },
    { sportId: 1, periodId: 10, marketId: 18, marketParam: 0.5, homeName: "Arsenal", awayName: "Chelsea", odds: -0.90, buttonId3838: "B4" }
];

const brainParams = { minEV: 0.01, maxEV: 5.0 };

console.log("====================================================");
console.log("  VERIFYING BRAIN2FB LOGIC: MALAY ODDS & CONTRA");
console.log("====================================================\n");

const results = processLogic(data_target, data_reference, brainParams);

if (results.length === 0) {
    console.log("❌ FAILURE: No bets generated.");
} else {
    console.log(`✅ SUCCESS: Found ${results.length} betting opportunities.\n`);
    results.forEach((res, i) => {
        console.log(`--- Opportunity #${i + 1} ---`);
        console.log(`Match: ${res.leftBet.homeName} vs ${res.leftBet.awayName}`);
        console.log(`Left Bet (Selection: ${res.leftBet.marketId === 20 ? "Under" : "Away"}):`);
        console.log(`  Odds: ${res.leftBet.odds}`);
        console.log(`Right Bet (Selection: ${res.rightBet.marketId === 19 ? "Over" : "Home"}):`);
        console.log(`  Odds: ${res.rightBet.odds} (Found via contra-market lookup)`);
        console.log(`Calculated EV: ${res.leftBet.odds} + ${res.rightBet.odds} = ${res.ev}\n`);
    });
}
console.log("====================================================");
