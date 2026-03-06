const fs = require("fs").promises;
const fsSync = require("fs");
const { writeData, deleteData } = require("../../../mongodb/db");
const leagueIdMap = require("../../database/SBODB/output/SBOConfirmedLeagues");
const {
  addMethod,
  mulMethod,
  powMethod,
  brimMethod,
} = require("../../../utils/noVigOdds");
const _ = require("lodash");

function checkDataChange(newData) {
  const currentTime = Date.now();

  // Remove time-related properties before comparison
  const cleanNewData = newData.map((item) =>
    _.omit(item, ["startedAt", "timeScraped"]),
  );
  const cleanPreviousData = previousData
    ? previousData.map((item) => _.omit(item, ["startedAt", "timeScraped"]))
    : null;

  // 1. Both arrays are empty (don't compare)
  if (
    Array.isArray(cleanPreviousData) &&
    cleanPreviousData.length === 0 &&
    cleanNewData.length === 0
  ) {
    // console.log('No live data found');
    return;
  }

  // 2. Arrays are different and both have length > 0
  if (
    JSON.stringify(cleanNewData) !== JSON.stringify(cleanPreviousData) &&
    cleanNewData.length > 0
  ) {
    lastChangedTime = currentTime;
    // console.log('3838 - Data changed at:', new Date(currentTime).toLocaleString());
    previousData = JSON.parse(JSON.stringify(newData)); // Store original data with time properties
    return;
  }

  // 3. One minute has passed and data hasn't changed
  if (
    currentTime - lastChangedTime > 2 * 60 * 1000 &&
    JSON.stringify(cleanNewData) === JSON.stringify(cleanPreviousData)
  ) {
    console.log(
      "3838 - WARNING: Data has not changed for 2 minutes",
      new Date(currentTime).toLocaleString(),
    );
    // lastChangedTime = currentTime; (uncomment to reset timer to avoid continuous notifications)
  }

  // Update previousData if it's null (first run) or if it's different from newData
  if (
    previousData === null ||
    JSON.stringify(cleanNewData) !== JSON.stringify(cleanPreviousData)
  ) {
    previousData = JSON.parse(JSON.stringify(newData)); // Store original data with time properties
  }
}

let lastChangedTime;
let previousData;
async function scrape3838(page, acc) {
  let params = JSON.parse(
    fsSync.readFileSync(`./TargetBookie/ps3838${acc}.json`, "utf-8"),
  );

  //Check if got live odds
  if (params.mode === "live") {
    try {
      await page.waitForSelector(".odds-container-live", { timeout: 3000 });
    } catch {
      console.log("3838 (0) - no live odds found");
      await deleteData("data_ps3838", { acc: `ps3838${acc}` });
      return;
    }
  }
  if (params.mode == "today") {
    try {
      await page.waitForSelector(".odds-container", { timeout: 3000 });
    } catch {
      console.log("3838(1) - no today odds found");
      // await fs.writeFile('./data/data_ps3838.json', '[]');
      return;
    }
  }
  let devigMethod = params.devigMethod;
  if (devigMethod == "pow") {
    devigMethodString = powMethod.toString();
  } else if (devigMethod == "brim") {
    devigMethodString = brimMethod.toString();
  } else if (devigMethod == "mul") {
    devigMethodString = mulMethod.toString();
  } else if (devigMethod == "add") {
    devigMethodString = addMethod.toString();
  }

  try {
    await page.waitForSelector(".odds-container-live tr.mkline td.col-time", {
      timeout: 3000,
    });
    const result = await page.evaluate(
      async (acc, devigMethodString, leagueIdMap, autobet_mode) => {
        const devigFunction = eval(`(${devigMethodString})`);
        const calculateParam = (str) => {
          const result =
            str.split("-").length > 1
              ? str.split("-").reduce((sum, num) => sum + parseFloat(num), 0) /
                2
              : parseFloat(str);
          return Math.abs(result);
        };

        const allLeagueName = [];
        const sportId = 7; // Soccer
        const periodIdRegularTime = 4;
        const periodId1stHalf = 10;
        let timeScraped = new Date().toLocaleString();
        let leagueId = null;
        let leagueName = "-";
        let startedAt = null;
        let homeName = "-";
        let awayName = "-";

        let oddsContainer;
        if (autobet_mode === "live")
          oddsContainer = document.querySelector(".odds-container-live");
        else if (autobet_mode === "today")
          oddsContainer = document.querySelector(".odds-container-nolive");
        // else if (autobet_mode == 2) havent do early

        const dataJSON = [];
        const trElements = oddsContainer.querySelectorAll("tr.mkline");
        trElements.forEach((element) => {
          const tdTime = element.querySelector("td.col-time");
          if (tdTime) {
            const liveTm = tdTime.querySelector("span.liveTm");
            startedAt = liveTm ? liveTm.innerText : "-";
            leagueName =
              element.parentNode.parentNode.parentNode.previousElementSibling
                .querySelectorAll("span")[1]
                .textContent.trim();
            allLeagueName.push(leagueName);
            const confirmedLeague = leagueIdMap.find((i) =>
              i.leagueName
                .trim()
                .toLowerCase()
                .includes(leagueName?.trim().toLowerCase()),
            );
            leagueId = confirmedLeague ? confirmedLeague.leagueId : null;
            const tdName = element.querySelector("td.col-name");
            const teamName = tdName.querySelectorAll(
              "div.team-name-container span",
            );
            homeName = teamName[0].getAttribute("title");
            awayName = teamName[1].getAttribute("title");
          }

          const data = {
            bookmakerId: 1,
            acc: `ps3838${acc}`,
            leagueId: leagueId,
            leagueName: leagueName,
            homeName: homeName,
            awayName: awayName,
            startedAt: startedAt,
            sportId: sportId,
            sportIdDescription: "Soccer",
            timeScraped,
          };

          // full time
          // 1 X 2
          const td1X2 = element.querySelector('td.col-1x2[data-period="0"]');
          if (td1X2 && td1X2.innerText) {
            // 11, 12, 13
            const homeWinButton = td1X2.querySelector('a[data-team-type="0"]');
            const awayWinButton = td1X2.querySelector('a[data-team-type="1"]');
            const drawButton = td1X2.querySelector('a[data-team-type="2"]');
            const homeWin = parseFloat(homeWinButton.innerText);
            const awayWin = parseFloat(awayWinButton.innerText);
            const draw = parseFloat(drawButton.innerText);
            const noVigOddsArray = devigFunction(3, homeWin, awayWin, draw);
            dataJSON.push({
              buttonId3838: homeWinButton.id,
              ...data,
              periodId: periodIdRegularTime,
              periodIdDescription: "regular time",
              marketId: 11, // 1
              marketIdDescription: "1", // 1
              odds: homeWin,
              noVigOdds: noVigOddsArray[0],
              vig: noVigOddsArray[3],
              noVigIncreased: noVigOddsArray[4],
            });
            dataJSON.push({
              buttonId3838: awayWinButton.id,
              ...data,
              periodId: periodIdRegularTime,
              periodIdDescription: "regular time",
              marketId: 13,
              marketIdDescription: "2",
              odds: awayWin,
              noVigOdds: noVigOddsArray[1],
              vig: noVigOddsArray[3],
              noVigIncreased: noVigOddsArray[5],
            });
            dataJSON.push({
              buttonId3838: drawButton.id,
              ...data,
              periodId: periodIdRegularTime,
              periodIdDescription: "regular time",
              marketId: 12,
              marketIdDescription: "x",
              odds: draw,
              noVigOdds: noVigOddsArray[2],
              vig: noVigOddsArray[3],
              noVigIncreased: noVigOddsArray[6],
            });
          }
          // HDP (Asian Handicap)
          const tdhdp = element.querySelector('td.col-hdp[data-period="0"]');
          if (tdhdp && tdhdp.innerText) {
            // 17, 18
            let param = tdhdp.querySelectorAll("div.hdp span");
            let team1Handicap = false;
            if (param[0].innerText.trim()) {
              param = calculateParam(param[0].innerText);
              team1Handicap = true;
            } else {
              param = calculateParam(param[1].innerText);
            }

            const homeWinButton = tdhdp.querySelector('a[data-team-type="0"]');
            const awayWinButton = tdhdp.querySelector('a[data-team-type="1"]');
            const homeWin = parseFloat(homeWinButton.innerText);
            const awayWin = parseFloat(awayWinButton.innerText);
            const noVigOddsArray = devigFunction(2, homeWin, awayWin);

            dataJSON.push({
              buttonId3838: homeWinButton.id,
              ...data,
              periodId: periodIdRegularTime,
              periodIdDescription: "regular time",
              marketId: 17,
              marketIdDescription: "Asian Handicap1(%s)",
              marketParam: team1Handicap ? param * -1 : param,
              odds: homeWin,
              noVigOdds: noVigOddsArray[0],
              vig: noVigOddsArray[2],
              noVigIncreased: noVigOddsArray[3],
            });
            dataJSON.push({
              buttonId3838: awayWinButton.id,
              ...data,
              periodId: periodIdRegularTime,
              periodIdDescription: "regular time",
              marketId: 18,
              marketIdDescription: "Asian Handicap2(%s)",
              marketParam: team1Handicap ? param : param * -1,
              odds: awayWin,
              noVigOdds: noVigOddsArray[1],
              vig: noVigOddsArray[2],
              noVigIncreased: noVigOddsArray[4],
            });
          }
          // OU
          const tdou = element.querySelector('td.col-ou[data-period="0"]');
          if (tdou && tdou.innerText.trim()) {
            // 19, 20
            let param = tdou.querySelector("div.hdp span").innerText;
            param = calculateParam(param); // e.g. 2-2.5 become 2.25

            const isOverButton = tdou.querySelector('a[data-team-type="0"]');
            const isUnderButton = tdou.querySelector('a[data-team-type="1"]');
            const isOver = parseFloat(isOverButton.innerText);
            const isUnder = parseFloat(isUnderButton.innerText);
            const noVigOddsArray = devigFunction(2, isOver, isUnder);

            dataJSON.push({
              buttonId3838: isOverButton.id,
              ...data,
              periodId: periodIdRegularTime,
              periodIdDescription: "regular time",
              marketId: 19, // Total Over(s%)
              marketIdDescription: "Total Over(%s)",
              marketParam: param,
              odds: isOver,
              noVigOdds: noVigOddsArray[0],
              vig: noVigOddsArray[2],
              noVigIncreased: noVigOddsArray[3],
            });
            dataJSON.push({
              buttonId3838: isUnderButton.id,
              ...data,
              periodId: periodIdRegularTime,
              periodIdDescription: "regular time",
              marketId: 20, // Total Under(s%)
              marketIdDescription: "Total Under(%s)",
              marketParam: param,
              odds: isUnder,
              noVigOdds: noVigOddsArray[1],
              vig: noVigOddsArray[2],
              noVigIncreased: noVigOddsArray[4],
            });
          }

          // 1st half
          // 1 X 2
          const td1X2_firstHalf = element.querySelector(
            'td.col-1x2[data-period="1"]',
          );
          if (td1X2_firstHalf && td1X2_firstHalf.innerText) {
            // 11, 12, 13
            const homeWinButton = td1X2_firstHalf.querySelector(
              'a[data-team-type="0"]',
            );
            const awayWinButton = td1X2_firstHalf.querySelector(
              'a[data-team-type="1"]',
            );
            const drawButton = td1X2_firstHalf.querySelector(
              'a[data-team-type="2"]',
            );
            const homeWin = parseFloat(homeWinButton.innerText);
            const awayWin = parseFloat(awayWinButton.innerText);
            const draw = parseFloat(drawButton.innerText);
            const noVigOddsArray = devigFunction(3, homeWin, awayWin, draw);
            dataJSON.push({
              buttonId3838: homeWinButton.id,
              ...data,
              periodId: periodId1stHalf,
              periodIdDescription: "1st half",
              marketId: 11, // 1
              marketIdDescription: "1",
              odds: homeWin,
              noVigOdds: noVigOddsArray[0],
              vig: noVigOddsArray[3],
              noVigIncreased: noVigOddsArray[4],
            });
            dataJSON.push({
              buttonId3838: awayWinButton.id,
              ...data,
              periodId: periodId1stHalf,
              periodIdDescription: "1st half",
              marketId: 13, // 2
              marketIdDescription: "2",
              odds: awayWin,
              noVigOdds: noVigOddsArray[1],
              vig: noVigOddsArray[3],
              noVigIncreased: noVigOddsArray[5],
            });
            dataJSON.push({
              buttonId3838: drawButton.id,
              ...data,
              periodId: periodId1stHalf,
              periodIdDescription: "1st half",
              marketId: 12,
              marketIdDescription: "X",
              odds: draw,
              noVigOdds: noVigOddsArray[2],
              vig: noVigOddsArray[3],
              noVigIncreased: noVigOddsArray[6],
            });
          }

          // HDP (Asian Handicap)
          const tdhdp_firstHalf = element.querySelector(
            'td.col-hdp[data-period="1"]',
          );
          if (tdhdp_firstHalf && tdhdp_firstHalf.innerText) {
            // 17, 18
            let param = tdhdp_firstHalf.querySelectorAll("div.hdp span");
            let team1Handicap = false;

            if (param[0].innerText.trim()) {
              param = calculateParam(param[0].innerText);
              team1Handicap = true;
            } else {
              param = calculateParam(param[1].innerText);
            }

            const homeWinButton = tdhdp_firstHalf.querySelector(
              'a[data-team-type="0"]',
            );
            const awayWinButton = tdhdp_firstHalf.querySelector(
              'a[data-team-type="1"]',
            );
            const homeWin = parseFloat(homeWinButton.innerText);
            const awayWin = parseFloat(awayWinButton.innerText);
            const noVigOddsArray = devigFunction(2, homeWin, awayWin);
            dataJSON.push({
              buttonId3838: homeWinButton.id,
              ...data,
              periodId: periodId1stHalf,
              periodIdDescription: "1st half",
              marketId: 17, // 1
              marketIdDescription: "Asian Handicap1(%s)",
              marketParam: team1Handicap ? param * -1 : param,
              odds: homeWin,
              noVigOdds: noVigOddsArray[0],
              vig: noVigOddsArray[2],
              noVigIncreased: noVigOddsArray[3],
            });
            dataJSON.push({
              buttonId3838: awayWinButton.id,
              ...data,
              periodId: periodId1stHalf,
              periodIdDescription: "1st half",
              marketId: 18, // 2
              marketIdDescription: "Asian Handicap2(%s)",
              marketParam: team1Handicap ? param : param * -1,
              odds: awayWin,
              noVigOdds: noVigOddsArray[1],
              vig: noVigOddsArray[2],
              noVigIncreased: noVigOddsArray[4],
            });
          }

          // OU
          const tdou_firstHalf = element.querySelector(
            'td.col-ou[data-period="1"]',
          );
          if (tdou_firstHalf && tdou_firstHalf.innerText.trim()) {
            // 19, 20
            let param = tdou_firstHalf.querySelector("div.hdp span").innerText;
            param = calculateParam(param); // e.g. 2-2.5 become 2.25

            const isOverButton = tdou_firstHalf.querySelector(
              'a[data-team-type="0"]',
            );
            const isUnderButton = tdou_firstHalf.querySelector(
              'a[data-team-type="1"]',
            );
            const isOver = parseFloat(isOverButton.innerText);
            const isUnder = parseFloat(isUnderButton.innerText);
            const noVigOddsArray = devigFunction(2, isOver, isUnder);
            dataJSON.push({
              buttonId3838: isOverButton.id,
              ...data,
              periodId: periodId1stHalf,
              periodIdDescription: "1st half",
              marketId: 19, // Total Over(s%)
              marketIdDescription: "Total Over(%s)",
              marketParam: param,
              odds: isOver,
              noVigOdds: noVigOddsArray[0],
              vig: noVigOddsArray[2],
              noVigIncreased: noVigOddsArray[3],
            });
            dataJSON.push({
              buttonId3838: isUnderButton.id,
              ...data,
              periodId: periodId1stHalf,
              periodIdDescription: "1st half",
              marketId: 20, // Total Under(s%)
              marketIdDescription: "Total Under(%s)",
              marketParam: param,
              odds: isUnder,
              noVigOdds: noVigOddsArray[1],
              vig: noVigOddsArray[2],
              noVigIncreased: noVigOddsArray[4],
            });
          }
        });
        return { dataJSON, allLeagueName };
      },
      acc,
      devigMethodString,
      leagueIdMap,
      params.mode,
    );

    checkDataChange(result.dataJSON);

    // Delete old data first
    const accFilter = { acc: `ps3838${acc}` };
    try {
      const deleteResult = await deleteData("data_ps3838", accFilter);
      // console.log(`3838 - Deleted ${deleteResult.deletedCount} document(s)`);
    } catch (error) {
      console.error("3838 - Error deleting data:", error);
    }

    // Write new data to MongoDB
    try {
      if (result.dataJSON && result.dataJSON.length > 0) {
        const insertResult = await writeData("data_ps3838", result.dataJSON);
        // console.log(`3838 - ${insertResult.insertedCount} documents were inserted`);
      }
    } catch (error) {
      console.error("3838 - Error inserting data:", error);
    }

    // // Read and write to the existing file
    // const existingData = await fs.readFile('./database/3838DB/scraped3838Leagues.json');
    // let existingLeagueNames = [];
    // try {
    //   existingLeagueNames = JSON.parse(existingData);
    // }
    // catch {
    //   existingLeagueNames = [];
    // }
    // const uniqueLeagueNames = [...new Set([...existingLeagueNames, ...result.allLeagueName])];
    // await fs.writeFile('./database/3838DB/scraped3838Leagues.json', JSON.stringify(uniqueLeagueNames.sort()));

    if (params.createScrapedDataJSON)
      await fs.writeFile(
        `./TargetBookie/data_3838${acc}.json`,
        JSON.stringify(result.dataJSON),
      );
    if (params.consoleLog3838Scrape)
      console.log(
        "ps3838 (" +
          params.mode +
          ")- done writing to file ps3838: " +
          new Date().toLocaleString(),
      );
    console.log(result.dataJSON);
  } catch (error) {
    console.log(error);
  }
}

module.exports = { scrape3838 };

//while scraping, check odds correct or not
