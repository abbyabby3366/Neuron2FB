const fs = require("fs");
const {
  startSession,
  readData,
  writeData,
  updateData,
  deleteData,
} = require("../../mongodb/db");
const _ = require("lodash");

const bigBrain = async () => {
  let contraAccountList = JSON.parse(
    fs.readFileSync("../contraAccountList.JSON"),
  );
  let allContraPendingBetList = [];

  //run for all pairs
  for (let contraPair of contraAccountList) {
    let result = await brainContra(contraPair.acc1, contraPair.acc2);
    allContraPendingBetList.push(...result);
  }

  //sort by odds difference descending order using lodash
  allContraPendingBetList = _.orderBy(
    allContraPendingBetList,
    ["difference"],
    ["desc"],
  );

  console.log("---ALL CONTRA PENDING BET LIST-------", allContraPendingBetList);

  // write to db
  if (allContraPendingBetList.length > 0)
    await writeData("allContraPendingBetList", allContraPendingBetList);
};

const brainContra = async (acc1, acc2) => {
  //to output pending betlist

  let pendingBetList = [];
  let session;
  const params = JSON.parse(fs.readFileSync("../contraParams.JSON"));

  try {
    session = await startSession();

    await session.withTransaction(async () => {
      let filter1 = {};
      let filter2 = {};
      let filter3 = {};
      let filter4 = {};
      let data_acc1 = await readData(`data_${acc1}`, filter1);
      let data_acc2 = await readData(`data_${acc2}`, filter2);
      let tempFailBetList = await readData(`tempFailBetList`, filter3);
      let successBetList = await readData(`successBetList`, filter4);

      //process data (remove 'group', remove unwanted leagues(efootball, winner, pen, ET),)

      const {
        MYOddsMinSum,
        EUOddsMaxVig,
        minOdds,
        maxOdds,
        maxNumberOfRepeatedEvents,
        maxNumberOfRepeatedEvents1stHalf,
        maxNumberOfRepeatedEventsAH,
        maxNumberOfRepeatedEventsOU,
        maxNumberOfRepeatBets,
        matchLeagueBoolean,
        fuzzMatchMinScore,
        timeBetweenTicketFail,
        timeBetweenContraFail,
        dataStaleTimeInSeconds,
        consoleLogPendingBetList,
      } = params.brainParams;

      //filter for temp fail bet list, dataStaleTimeInSeconds, minOdds, maxOdds
      const currentTime = new Date();

      data_acc1.filter((entry) => {
        //filter -> if the condition is true, the entry will be removed from the data

        //check if the data is stale
        const isStaleData =
          entry.timeScraped &&
          currentTime - new Date(entry.timeScraped) >
            dataStaleTimeInSeconds * 1000;

        //filter tempFailBetList
        const hasMatchingFailBetTicket = tempFailBetList.find(
          (failBet) =>
            failBet.betFailedReason === "ticket" &&
            currentTime - new Date(failBet.betFailedTime) <
              timeBetweenTicketFail * 1000 &&
            failBet.homeName === entry.homeName &&
            failBet.awayName === entry.awayName &&
            failBet.periodId === entry.periodId &&
            failBet.marketId === entry.marketId &&
            failBet.marketParam === entry.marketParam,
        );

        const hasMatchingFailBetContra = tempFailBetList.find(
          (failBet) =>
            failBet.betFailedReason === "ticket" &&
            currentTime - new Date(failBet.betFailedTime) <
              timeBetweenContraFail * 1000 &&
            failBet.homeName === entry.homeName &&
            failBet.awayName === entry.awayName &&
            failBet.periodId === entry.periodId &&
            failBet.marketId === entry.marketId &&
            failBet.marketParam === entry.marketParam,
        );

        //filter repeatedEvents
        // criteria1 = max 4 bet per event within 24 hours
        const numberOfRepeatedEvents = successBetList.filter(
          (successBet) =>
            successBet.homeName === entry.homeName &&
            successBet.awayName === entry.awayName,
        ).length;
        let checkCriteria1 =
          numberOfRepeatedEvents >= maxNumberOfRepeatedEvents;

        // criteria2 = max 2 bet for 1st half per event within 24 hours
        const numberOfRepeatedEvents1stHalf = successBetListSBO.filter(
          (successBet) =>
            successBet.homeName === entry.homeName &&
            successBet.awayName === entry.awayName &&
            [10].includes(entry.periodId) &&
            [10].includes(successBet.periodId),
        ).length;
        let checkCriteria2 =
          numberOfRepeatedEvents1stHalf >= maxNumberOfRepeatedEvents1stHalf;

        // criteria3 = max 2 bet of AH per event within 24 hours
        const numberOfRepeatedEventsAH = successBetListSBO.filter(
          (successBet) =>
            successBet.homeName === entry.homeName &&
            successBet.awayName === entry.awayName &&
            [17, 18].includes(entry.marketId) &&
            [17, 18].includes(successBet.marketId),
        ).length;
        let checkCriteria3 =
          numberOfRepeatedEventsAH >= maxNumberOfRepeatedEventsAH;

        // criteria4 = max 2 bet of OU per event within 24 hours
        const numberOfRepeatedEventsOU = successBetList.filter(
          (successBet) =>
            successBet.homeName === entry.homeName &&
            successBet.awayName === entry.awayName &&
            successBet.marketId === entry.marketId &&
            [19, 20].includes(entry.marketId) &&
            [19, 20].includes(successBet.marketId),
        ).length;
        let checkCriteria4 =
          numberOfRepeatedEventsOU >= maxNumberOfRepeatedEventsOU;

        // criteria5 = max 2 bet of 1X2 per event within 24 hours
        const numberOfRepeatedEvents1X2 = successBetListSBO.filter(
          (successBet) =>
            successBet.homeName === entry.homeName &&
            successBet.awayName === entry.awayName &&
            [11, 12, 13].includes(entry.marketId) &&
            [11, 12, 13].includes(successBet.marketId),
        ).length;
        let checkCriteria5 =
          numberOfRepeatedEvents1X2 >= maxNumberOfRepeatedEvents1X2;

        // criteria6 = max 1 bet per market (no repeated bets)
        const numberOfRepeatBets = successBetListSBO.filter(
          (successBet) =>
            successBet.homeName === entry.homeName &&
            successBet.awayName === entry.awayName &&
            successBet.periodId === entry.periodId &&
            successBet.marketId === entry.marketId &&
            successBet.marketParam === entry.marketParam,
        ).length;
        let checkCriteria6 = numberOfRepeatBets >= maxNumberOfRepeatBets;

        //check is within odds
        const isOutOfOddsRange =
          parseFloat(entry.odds) < minOdds || parseFloat(entry.odds) > maxOdds;

        // Keep the entry only if it doesn't meet any of the removal conditions
        return !(
          hasMatchingFailBetTicket ||
          hasMatchingFailBetContra ||
          isStaleData ||
          isOutOfOddsRange ||
          checkCriteria1 ||
          checkCriteria2 ||
          checkCriteria3 ||
          checkCriteria4 ||
          checkCriteria5 ||
          checkCriteria6
        );
      });

      if ((oddsType = "MY")) {
        for (let entry1 of data_acc1) {
          for (let entry2 of data_acc2) {
            if (
              entry1.sportId === entry2.sportId &&
              entry1.periodId === entry2.periodId
            ) {
              // match team name
              if (fuzzMatch(entry1, entry2, fuzzMatchMinScore)) {
                // CHECK AH
                if (
                  (entry1.marketId === 17 && entry2.marketId === 18) ||
                  (entry1.marketId === 18 && entry2.marketId === 17)
                ) {
                  // check arb condition
                  if (
                    entry1.marketParam === -entry2.marketParam &&
                    entry1.odds + entry2.odds >= MYOddsMinSum
                  ) {
                    pendingBetList.push({
                      acc1id: acc1,
                      acc2id: acc2,
                      acc1: {
                        homeName: entry1.homeName,
                        awayName: entry1.awayName,
                        leagueName: entry1.leagueName,
                        malayOdds: entry1.odds,
                        buttonID: entry1.buttonId3838,
                        scrapedTime: entry1.timeScraped,
                        brainTime: new Date(),
                        vig: entry1.vig,
                      },
                      acc2: {
                        homeName: entry2.homeName,
                        awayName: entry2.awayName,
                        leagueName: entry2.leagueName,
                        malayOdds: entry2.odds,
                        buttonID: entry2.buttonId3838,
                        scrapedTime: entry2.timeScraped,
                        brainTime: new Date(),
                        vig: entry2.vig,
                      },
                      difference: entry1.odds + entry2.odds,
                      expectedStake: 100,
                    });
                  }

                  // CHECK OU
                } else if (
                  (entry1.marketId === 19 && entry2.marketId === 20) ||
                  (entry1.marketId === 20 && entry2.marketId === 19)
                ) {
                  // check arb condition
                  if (
                    entry1.marketParam === entry2.marketParam &&
                    entry1.odds + entry2.odds >= MYOddsMinSum
                  ) {
                    pendingBetList.push({
                      acc1id: acc1,
                      acc2id: acc2,
                      acc1: {
                        ...entry1,
                        homeName: entry1.homeName,
                        awayName: entry1.awayName,
                        leagueName: entry1.leagueName,
                        malayOdds: entry1.odds,
                        buttonID: entry1.buttonId3838,
                        scrapedTime: entry1.timeScraped,
                        brainTime: new Date(),
                        vig: entry1.vig,
                      },
                      acc2: {
                        ...entry2,
                        homeName: entry2.homeName,
                        awayName: entry2.awayName,
                        leagueName: entry2.leagueName,
                        malayOdds: entry2.odds,
                        buttonID: entry2.buttonId3838,
                        scrapedTime: entry2.timeScraped,
                        brainTime: new Date(),
                        vig: entry2.vig,
                      },
                      difference: entry1.odds + entry2.odds,
                      expectedStake: 100,
                    });
                  }
                }
              }
            }
          }
        }

        //sort by odds difference descending order using lodash
        pendingBetList = _.orderBy(pendingBetList, ["difference"], ["desc"]);

        // write the data to pending(acc1, acc2).JSON or db
        if (pendingBetList.length > 0) {
          await writeData(`pendingBetList_${acc1}_${acc2}`, pendingBetList);
        }

        if (consoleLogPendingBetList)
          console.log(
            `---${acc1}-v-${acc2}----PENDING BET LIST-------`,
            pendingBetList,
          );
      }
    });
  } catch (err) {
    console.log(err);
  }

  return pendingBetList;
};

bigBrain();
