const fs = require("fs").promises;
const fsSync = require("fs");
const {
  connect,
  getCollection,
  startSession,
  readData,
  writeData,
  updateData,
  deleteData,
} = require("../../mongodb/db");
const leagueIdMap = require("../../database/ISNDB/output/ISNConfirmedLeagues");
const {
  addMethod,
  mulMethod,
  powMethod,
  brimMethod,
} = require("../../utils/noVigOdds");
const _ = require("lodash");
const {
  EUtoEU,
  MYtoEU,
  HKtoEU,
  IDtoEU,
  UStoEU,
} = require("../../utils/oddsConverter");

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
    // console.log('ISN - Data changed at:', new Date(currentTime).toLocaleString());
    previousData = JSON.parse(JSON.stringify(newData)); // Store original data with time properties
    return;
  }

  // 3. One minute has passed and data hasn't changed
  if (
    currentTime - lastChangedTime > 2 * 60 * 1000 &&
    JSON.stringify(cleanNewData) === JSON.stringify(cleanPreviousData)
  ) {
    console.log(
      "ISN - WARNING: Data has not changed for 2 minutes",
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
async function scrape(page, acc) {
  const params = JSON.parse(
    await fs.readFile(`./TargetBookie/${acc}.json`, "utf-8"),
  );

  //check if the odds div exists
  try {
    await page.waitForSelector("#main-listing .live", { timeout: 3000 });
  } catch {
    console.log("ISN - no live odds found");
    return;
  }

  let devigMethod = params.devigMethod;
  let devigMethodString;
  if (devigMethod == "pow") {
    devigMethodString = powMethod.toString();
  } else if (devigMethod == "brim") {
    devigMethodString = brimMethod.toString();
  } else if (devigMethod == "mul") {
    devigMethodString = mulMethod.toString();
  } else if (devigMethod == "add") {
    devigMethodString = addMethod.toString();
  }

  let oddsType = params.oddsType;
  let convertToEUString;
  if (oddsType == "EU") {
    convertToEUString = EUtoEU.toString();
  } else if (oddsType == "ID") {
    convertToEUString = IDtoEU.toString();
  } else if (oddsType == "MY") {
    convertToEUString = MYtoEU.toString();
  } else if (oddsType == "HK") {
    convertToEUString = HKtoEU.toString();
  } else if (oddsType == "IN") {
    convertToEUString = IDtoEU.toString();
  } else if (oddsType == "US") {
    convertToEUString = UStoEU.toString();
  }

  //start scraping live odds
  try {
    const result = await page.evaluate(
      (acc, mode, leagueIdMap, devigMethodString, convertToEUString) => {
        const devigFunction = eval(`(${devigMethodString})`);
        const convertToEU = eval(`(${convertToEUString})`);
        const calculateParam = (str) => {
          if (!str) return 0;
          const [a, b] = str.split("/").map(Number);
          return b !== undefined ? (a + b) / 2 : a;
        };

        const allLeagueName = [];
        const sportId = 7; // Soccer
        const periodIdRegularTime = 4;
        const periodId1stHalf = 10;
        let timeScraped = new Date().toLocaleString();

        const dataJSON = [];

        let oddsContainer;
        if (mode === "live")
          oddsContainer = document.querySelector("div.sch-item.border.live");
        else if (mode === "today")
          oddsContainer = document.querySelector(
            "div.sch-item.border:not(.live)",
          );

        let tBodies = oddsContainer.querySelectorAll(
          "table.match-data.s1 tbody",
        );

        let leagueName;
        let leagueId;
        for (let i = 0; i < tBodies.length; i++) {
          const tbody = tBodies[i];
          const tempLeagueName =
            tbody.querySelector("tr.league")?.innerText || null;

          if (tempLeagueName) {
            // if is a league name tbody
            leagueName = tempLeagueName
              .trim()
              .split(" ")
              .slice(0, -1)
              .join(" ");
            allLeagueName.push(leagueName);
            const confirmedLeague = leagueIdMap.find((i) =>
              i.leagueName
                .trim()
                .toLowerCase()
                .includes(leagueName?.trim().toLowerCase()),
            );
            leagueId = confirmedLeague ? confirmedLeague.leagueId : null;
            continue;
          }

          const rows = tbody.querySelectorAll("tr");
          let homeName;
          let awayName;
          let startedAt;

          for (let j = 0; j < rows.length; j++) {
            const row = rows[j];
            if (row.classList.contains("match")) {
              // if is a team name row
              startedAt = row.querySelector("span.period")?.innerText;
              const teamName = row.querySelectorAll("div.team");
              homeName = teamName[0]?.innerText;
              awayName = teamName[1]?.innerText;
              continue;
            }

            if (!row?.innerText) continue; // if is empty row then skip

            const data = {
              bookmakerId: 5,
              acc: `${acc}`,
              leagueId: leagueId,
              leagueName: leagueName,
              homeName: homeName,
              awayName: awayName,
              startedAt: startedAt,
              sportId: sportId,
              sportIdDescription: "Soccer",
              timeScraped,
            };

            const tds = row.querySelectorAll("td");
            const market = tds[0]?.innerText.trim();
            if (market.includes("HDP")) {
              const isHalfTime = market.includes("HT");
              const homeWin = tds[1]?.querySelector("a");
              const homeWinId = homeWin.getAttribute("data-id");
              const homeWinParam = calculateParam(homeWin.innerText.trim());
              const homeWinOdds = tds[2]
                ?.querySelector("a.odds")
                .innerText.trim();

              const awayWin = tds[5]?.querySelector("a");
              const awayWinId = awayWin.getAttribute("data-id");
              const awayWinParam = calculateParam(awayWin.innerText.trim());
              const awayWinOdds = tds[4]
                ?.querySelector("a.odds")
                .innerText.trim();

              const noVigOddsArray = devigFunction(2, homeWinOdds, awayWinOdds);
              dataJSON.push({
                buttonIdISN: homeWinId,
                ...data,
                periodId: isHalfTime ? periodId1stHalf : periodIdRegularTime,
                periodIdDescription: isHalfTime ? "1st half" : "regular time",
                marketId: 17,
                marketIdDescription: "Asian Handicap1(%s)",
                marketParam: homeWinParam,
                // eventName: eventName,
                unconvertedOdds: parseFloat(homeWinOdds),
                odds: parseFloat(convertToEU(homeWinOdds)),
                noVigOdds: noVigOddsArray[0],
                vig: noVigOddsArray[2],
                noVigIncreased: noVigOddsArray[3],
              });
              dataJSON.push({
                buttonIdISN: awayWinId,
                ...data,
                periodId: isHalfTime ? periodId1stHalf : periodIdRegularTime,
                periodIdDescription: isHalfTime ? "1st half" : "regular time",
                marketId: 18,
                marketIdDescription: "Asian Handicap2(%s)",
                marketParam: awayWinParam,
                // eventName: eventName,
                unconvertedOdds: parseFloat(awayWinOdds),
                odds: parseFloat(convertToEU(awayWinOdds)),
                noVigOdds: noVigOddsArray[1],
                vig: noVigOddsArray[2],
                noVigIncreased: noVigOddsArray[4],
              });
            } else if (market.includes("OU")) {
              const isHalfTime = market.includes("HT");
              const isOver = tds[1]?.querySelector("a");
              const isOverId = isOver.getAttribute("data-id");
              const isOverParam = calculateParam(isOver.innerText.trim());
              const isOverOdds = tds[2]
                ?.querySelector("a.odds")
                .innerText.trim();

              const isUnder = tds[5]?.querySelector("a");
              const isUnderId = isUnder.getAttribute("data-id");
              const isUnderParam = calculateParam(isUnder.innerText.trim());
              const isUnderOdds = tds[4]
                ?.querySelector("a.odds")
                .innerText.trim();

              const noVigOddsArray = devigFunction(2, isOverOdds, isUnderOdds);
              dataJSON.push({
                buttonIdISN: isOverId,
                ...data,
                periodId: isHalfTime ? periodId1stHalf : periodIdRegularTime,
                periodIdDescription: isHalfTime ? "1st half" : "regular time",
                marketId: 19, // Total Over(s%)
                marketIdDescription: "Total Over(%s)",
                marketParam: isOverParam,
                // eventName: eventName,
                unconvertedOdds: parseFloat(isOverOdds),
                odds: parseFloat(convertToEU(isOverOdds)),
                noVigOdds: noVigOddsArray[0],
                vig: noVigOddsArray[2],
                noVigIncreased: noVigOddsArray[3],
              });
              dataJSON.push({
                buttonIdISN: isUnderId,
                ...data,
                periodId: isHalfTime ? periodId1stHalf : periodIdRegularTime,
                periodIdDescription: isHalfTime ? "1st half" : "regular time",
                marketId: 20, // Total Under(s%)
                marketIdDescription: "Total Under(%s)",
                marketParam: isUnderParam,
                // eventName: eventName,
                unconvertedOdds: parseFloat(isUnderOdds),
                odds: parseFloat(convertToEU(isUnderOdds)),
                noVigOdds: noVigOddsArray[1],
                vig: noVigOddsArray[2],
                noVigIncreased: noVigOddsArray[4],
              });
            } else if (market.includes("1x2")) {
              const isHalfTime = market.includes("HT");
              const homeWin = tds[1]?.querySelector("a.odds");
              const homeWinId = homeWin.getAttribute("data-id");
              const homeWinOdds = homeWin.innerText.trim();

              const draw = tds[2]?.querySelector("a.odds");
              const drawId = draw.getAttribute("data-id");
              const drawOdds = draw.innerText.trim();

              const awayWin = tds[3]?.querySelector("a.odds");
              const awayWinId = awayWin.getAttribute("data-id");
              const awayWinOdds = awayWin.innerText.trim();

              const noVigOddsArray = devigFunction(
                3,
                homeWinOdds,
                awayWinOdds,
                drawOdds,
              );
              dataJSON.push({
                buttonIdISN: homeWinId,
                ...data,
                periodId: isHalfTime ? periodId1stHalf : periodIdRegularTime,
                periodIdDescription: isHalfTime ? "1st half" : "regular time",
                marketId: 11,
                marketIdDescription: "1",
                // eventName: eventName,
                unconvertedOdds: parseFloat(homeWinOdds),
                odds: parseFloat(convertToEU(homeWinOdds)),
                noVigOdds: noVigOddsArray[0],
                vig: noVigOddsArray[3],
                noVigIncreased: noVigOddsArray[4],
              });
              dataJSON.push({
                buttonIdISN: awayWinId,
                ...data,
                periodId: isHalfTime ? periodId1stHalf : periodIdRegularTime,
                periodIdDescription: isHalfTime ? "1st half" : "regular time",
                marketId: 13,
                marketIdDescription: "2",
                // eventName: eventName,
                unconvertedOdds: parseFloat(awayWinOdds),
                odds: parseFloat(convertToEU(awayWinOdds)),
                noVigOdds: noVigOddsArray[1],
                vig: noVigOddsArray[3],
                noVigIncreased: noVigOddsArray[5],
              });
              dataJSON.push({
                buttonIdISN: drawId,
                ...data,
                periodId: isHalfTime ? periodId1stHalf : periodIdRegularTime,
                periodIdDescription: isHalfTime ? "1st half" : "regular time",
                marketId: 12,
                marketIdDescription: "X",
                // eventName: eventName,
                unconvertedOdds: parseFloat(drawOdds),
                odds: parseFloat(convertToEU(drawOdds)),
                noVigOdds: noVigOddsArray[2],
                vig: noVigOddsArray[3],
                noVigIncreased: noVigOddsArray[6],
              });
            }
          }
        }
        return { dataJSON, allLeagueName };
      },
      acc,
      params.mode,
      leagueIdMap,
      devigMethodString,
      convertToEUString,
    );

    checkDataChange(result.dataJSON);

    // Delete old data first
    const accFilter = { acc: acc };
    try {
      const deleteResult = await deleteData("data_target", accFilter);
      // console.log(`Deleted ${deleteResult.deletedCount} document(s)`);
    } catch (error) {
      console.error("Error deleting data:", error);
    }

    // Write new data to MongoDB
    try {
      if (result.dataJSON && result.dataJSON.length > 0) {
        const insertResult = await writeData("data_target", result.dataJSON);
        // console.log(`${insertResult.insertedCount} documents were inserted`);
      }
    } catch (error) {
      console.error("Error inserting data:", error);
    }

    // console.log(result.dataJSON.length)
    if (params.createScrapedDataJSON)
      await fs.writeFile(
        `./TargetBookie/data_${acc}.json`,
        JSON.stringify(result.dataJSON),
      );

    // Read and write to the existing file
    // const existingData = await fs.readFile('./database/ISNDB/scrapedISNLeagues.json');
    // const existingLeagueNames = JSON.parse(existingData);
    // const uniqueLeagueNames = [...new Set([...existingLeagueNames, ...result.allLeagueName])];
    // await fs.writeFile('./database/ISNDB/scrapedISNLeagues.json', JSON.stringify(uniqueLeagueNames.sort()));

    if (params.mode === "live" && params.consoleLogSBOScrape)
      console.log(
        "ISN - done writing LIVE to file ISN: " + new Date().toLocaleString(),
      );
    else if (params.mode === "today" && params.consoleLogSBOScrape)
      console.log(
        "ISN - done writing TODAY to file ISN: " + new Date().toLocaleString(),
      );

    return { status: true };
  } catch (error) {
    console.log(error);
    return { status: false };
  }
}

module.exports = { scrape };
