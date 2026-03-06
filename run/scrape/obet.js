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
const leagueIdMap = require("../../database/SBODB/output/SBOConfirmedLeagues");
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

async function scrollToBottom(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      setTimeout(() => {
        var totalHeight = 0;
        var distance = 500;
        var timer = setInterval(() => {
          var scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      }, 1000);
    });
  });
}

async function closeEFootballDiv(page) {
  page.evaluate(() => {
    const leagueTitles = document.querySelectorAll(".leagueTitle");
    leagueTitles.forEach((leagueTitle) => {
      const leagueNameElement = leagueTitle.querySelector(
        "span.leagueTitle_name",
      );
      if (!leagueNameElement) return;
      const leagueName = leagueNameElement.textContent.toLowerCase();
      if (!leagueName.includes("e-football")) return;
      const svgIcon = leagueTitle.querySelector("svg.svgIcon.svgIcon-default");
      if (!svgIcon || svgIcon.classList.contains("rotated")) return;

      // If all criteria are met, find and click the button
      const button = leagueTitle.querySelector(
        ".leagueTitle_collapseBtn button",
      );
      if (button) {
        button.click();
        console.log("Closed e-football div successfully.");
      }
    });
  });
}

async function closeRejectedBet(page) {
  await page.evaluate(async () => {
    while (true) {
      const handle = document.querySelector(
        "div.myBets div.bet.rejected.live span.btn-content",
      );
      if (!handle) break;
      console.log("SBO - closing a rejected bet...");
      handle.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  });
}

async function closeShowMore(page) {
  await page.$$eval(
    "div.matches_row_cell.matchesMore.showMore button",
    (buttons) => {
      buttons.forEach((button) => {
        button.click();
        console.log(
          "SBO - Show more buttons detected and clicked: " + new Date(),
        );
      });
    },
  );
}

async function closePopUpIfAny(page) {
  await page.evaluate(() => {
    const popup = document.querySelector(
      "#sports > div > div > div.tutorialWrapper > div > div > div.tour.tour-top > div.tour_content > div.tour_content_header > span.close",
    );
    if (popup) {
      popup.click();
      console.log("SBO - closed popups: " + new Date());
    } else {
      console.log("SBO - no popups to close");
    }
  });
}

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
    // console.log('SBO - Data changed at:', new Date(currentTime).toLocaleString());
    previousData = JSON.parse(JSON.stringify(newData)); // Store original data with time properties
    return;
  }

  // 3. One minute has passed and data hasn't changed
  if (
    currentTime - lastChangedTime > 2 * 60 * 1000 &&
    JSON.stringify(cleanNewData) === JSON.stringify(cleanPreviousData)
  ) {
    console.log(
      "SBO - WARNING: Data has not changed for 2 minutes",
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

function calculateAverageVig(data) {
  let averageVig =
    data.reduce((acc, el) => acc + parseFloat(el.vig), 0) / data.length;
  if (data.length > 0) console.log("SBO - Average Vig:", averageVig);
  else console.log("SBO - No data to calculate average vig");
}

function checkAverageVig(data) {
  let averageVig =
    data.reduce((acc, el) => acc + parseFloat(el.vig), 0) / data.length;
  if (averageVig > 0.13 && data.length > 0) {
    console.log("SBO POSSIBLE VIP, PLS CHECK! Average Vig:", averageVig);
  }
}

let lastChangedTime;
let previousData;
async function scrape(page, acc) {
  // Get the iframe reference and reassign page to point to it
  const frames = await page.frames();
  const frame = frames.find((f) => f.name() === "frame-sport");
  if (!frame) {
    throw new Error("iframe#frame-sport not found");
  }
  page = frame; // Reassign page to point to the frame

  const params = JSON.parse(
    await fs.readFile(`./TargetBookie/${acc}.json`, "utf-8"),
  );

  //Check if got live odds
  if (params.mode === "live") {
    try {
      await page.waitForSelector("#matches table.live", { timeout: 3000 });
    } catch {
      console.log("Obet (0) - no live odds found");
      return;
    }

    //close rejected waiting at bet list if any
    // await closeRejectedBet(page)
    // //close e-football if any
    // await closeEFootballDiv(page)
    // //make sure show more is collapse
    // await closeShowMore(page)
    // //close any tutorial popups
    // await closePopUpIfAny(page)

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
            if (!str) return null;
            if (str.split("-").length > 1)
              return (
                str.split("-").reduce((sum, num) => sum + parseFloat(num), 0) /
                2
              );
            else return parseFloat(str);
          };

          const allLeagueName = [];
          const sportId = 7; // Soccer
          const periodIdRegularTime = 4;
          const periodId1stHalf = 10;
          let timeScraped = new Date().toLocaleString();

          const dataJSON = [];
          let matchesRow;
          if (mode === "live") {
            matchesRow = document.querySelectorAll(
              "table.matches.live tr.match",
            ); // get all live matches
          }
          // else if (mode === 'today') {
          //   matchesRow = document.querySelectorAll('.oddsDisplayHeader.sticky + .oddsDisplay_content .matches_row'); // get today matches
          // }

          matchesRow.forEach((row, index) => {
            // Find tr.league sibling above
            let leagueRow = (() => {
              let sibling = row.previousElementSibling;
              while (sibling) {
                if (sibling.classList?.contains("league")) return sibling;
                sibling = sibling.previousElementSibling;
              }
              return null;
            })();
            const leagueName =
              leagueRow?.querySelector("span:not([class])")?.innerText;

            allLeagueName.push(leagueName);
            const confirmedLeague = leagueIdMap.find((i) =>
              i.leagueName
                .trim()
                .toLowerCase()
                .includes(leagueName?.trim().toLowerCase()),
            );
            const leagueId = confirmedLeague ? confirmedLeague.leagueId : null;

            // Extract startedAt with fallback logic similar to team names
            let startedAt;
            // Check if current row has time data
            const timeElement = row.querySelector(".datetime span.playing");
            if (timeElement) {
              // Current row has time data
              startedAt = timeElement.innerText;
            } else {
              // Current row doesn't have time data, look for previous row with time data
              let searchIndex = index - 1;
              let previousRow = null;

              while (searchIndex >= 0) {
                const candidateRow = matchesRow[searchIndex];
                const candidateTimeElement = candidateRow.querySelector(
                  ".datetime span.playing",
                );
                if (candidateTimeElement) {
                  previousRow = candidateRow;
                  break;
                }
                searchIndex--;
              }

              if (previousRow) {
                const prevTimeElement = previousRow.querySelector(
                  ".datetime span.playing",
                );
                startedAt = prevTimeElement?.innerText;
              }
            }

            //If the row dont have homeName / awayName, then take the above one
            let homeName, awayName;
            // Check if current row has team data
            const teamElements = row.querySelectorAll("span.team");
            if (teamElements.length >= 2) {
              // Current row has team data
              homeName = teamElements[0]?.innerText;
              awayName = teamElements[1]?.innerText;
            } else {
              // Current row doesn't have team data, look for previous row with team data
              let searchIndex = index - 1;
              let previousRow = null;

              while (searchIndex >= 0) {
                const candidateRow = matchesRow[searchIndex];
                const candidateTeamElements =
                  candidateRow.querySelectorAll("span.team");
                if (candidateTeamElements.length >= 2) {
                  previousRow = candidateRow;
                  break;
                }
                searchIndex--;
              }

              if (previousRow) {
                const prevTeamElements =
                  previousRow.querySelectorAll("span.team");
                homeName = prevTeamElements[0]?.innerText;
                awayName = prevTeamElements[1]?.innerText;
              }
            }

            const data = {
              bookmakerId: 2,
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

            // Extract odds and handicaps directly from td elements
            const tds = row.querySelectorAll("td");

            // Full Time Markets
            // Asian Handicap (Full Time) - columns 4-5
            if (tds[3] && tds[4]) {
              const hdpDivs = tds[3].querySelectorAll("div");
              const oddsCells = tds[4].querySelectorAll(":scope > div");

              // Find the actual handicap value (not empty or &nbsp;)
              let handicapValue = null;
              let team1Handicap = false;

              for (let i = 0; i < hdpDivs.length; i++) {
                const divText = hdpDivs[i].innerText.trim();
                if (divText && divText !== "&nbsp;" && divText !== "") {
                  handicapValue = divText;
                  team1Handicap = i === 0; // First div = team1 handicap
                  break;
                }
              }

              if (handicapValue && oddsCells.length >= 2) {
                let param = calculateParam(handicapValue);
                const homeWin = parseFloat(oddsCells[0]?.innerText);
                const awayWin = parseFloat(oddsCells[1]?.innerText);

                if (!isNaN(homeWin) && !isNaN(awayWin)) {
                  const noVigOddsArray = devigFunction(2, homeWin, awayWin);

                  dataJSON.push({
                    ...data,
                    periodId: periodIdRegularTime,
                    periodIdDescription: "regular time",
                    marketId: 17,
                    marketIdDescription: "Asian Handicap1(%s)",
                    marketParam: team1Handicap ? param * -1 : param,
                    unconvertedOdds: homeWin,
                    odds: convertToEU(homeWin),
                    noVigOdds: noVigOddsArray[0],
                    vig: noVigOddsArray[2],
                    noVigIncreased: noVigOddsArray[3],
                  });

                  dataJSON.push({
                    ...data,
                    periodId: periodIdRegularTime,
                    periodIdDescription: "regular time",
                    marketId: 18,
                    marketIdDescription: "Asian Handicap2(%s)",
                    marketParam: team1Handicap ? param : param * -1,
                    unconvertedOdds: awayWin,
                    odds: convertToEU(awayWin),
                    noVigOdds: noVigOddsArray[1],
                    vig: noVigOddsArray[2],
                    noVigIncreased: noVigOddsArray[4],
                  });
                }
              }
            }

            // Over/Under (Full Time) - columns 6-7
            if (tds[5] && tds[6]) {
              const hdpDivs = tds[5].querySelectorAll("div");
              const oddsCells = tds[6].querySelectorAll(":scope > div");

              // Find the actual handicap value (not empty or &nbsp;)
              let handicapValue = null;

              for (let i = 0; i < hdpDivs.length; i++) {
                const divText = hdpDivs[i].innerText.trim();
                if (divText && divText !== "&nbsp;" && divText !== "") {
                  handicapValue = divText;
                  break;
                }
              }

              if (handicapValue && oddsCells.length >= 2) {
                let param = calculateParam(handicapValue);
                const isOver = parseFloat(oddsCells[1]?.innerText);
                const isUnder = parseFloat(oddsCells[2]?.innerText);

                if (!isNaN(isOver) && !isNaN(isUnder)) {
                  const noVigOddsArray = devigFunction(2, isOver, isUnder);

                  dataJSON.push({
                    ...data,
                    periodId: periodIdRegularTime,
                    periodIdDescription: "regular time",
                    marketId: 19,
                    marketIdDescription: "Total Over(%s)",
                    marketParam: param,
                    unconvertedOdds: isOver,
                    odds: convertToEU(isOver),
                    noVigOdds: noVigOddsArray[0],
                    vig: noVigOddsArray[2],
                    noVigIncreased: noVigOddsArray[3],
                  });

                  dataJSON.push({
                    ...data,
                    periodId: periodIdRegularTime,
                    periodIdDescription: "regular time",
                    marketId: 20,
                    marketIdDescription: "Total Under(%s)",
                    marketParam: param,
                    unconvertedOdds: isUnder,
                    odds: convertToEU(isUnder),
                    noVigOdds: noVigOddsArray[1],
                    vig: noVigOddsArray[2],
                    noVigIncreased: noVigOddsArray[4],
                  });
                }
              }
            }

            // 1X2 (Full Time) - column 8
            if (tds[7]) {
              const oddsCells = tds[7].querySelectorAll(":scope > div");

              if (oddsCells.length >= 3) {
                const homeWin = parseFloat(oddsCells[0]?.innerText);
                const awayWin = parseFloat(oddsCells[1]?.innerText);
                const draw = parseFloat(oddsCells[2]?.innerText);

                if (!isNaN(homeWin) && !isNaN(awayWin) && !isNaN(draw)) {
                  const noVigOddsArray = devigFunction(
                    3,
                    homeWin,
                    awayWin,
                    draw,
                  );

                  dataJSON.push({
                    ...data,
                    periodId: periodIdRegularTime,
                    periodIdDescription: "regular time",
                    marketId: 11,
                    marketIdDescription: "1",
                    unconvertedOdds: homeWin,
                    odds: convertToEU(homeWin),
                    noVigOdds: noVigOddsArray[0],
                    vig: noVigOddsArray[3],
                    noVigIncreased: noVigOddsArray[4],
                  });

                  dataJSON.push({
                    ...data,
                    periodId: periodIdRegularTime,
                    periodIdDescription: "regular time",
                    marketId: 13,
                    marketIdDescription: "2",
                    unconvertedOdds: awayWin,
                    odds: convertToEU(awayWin),
                    noVigOdds: noVigOddsArray[1],
                    vig: noVigOddsArray[3],
                    noVigIncreased: noVigOddsArray[5],
                  });

                  dataJSON.push({
                    ...data,
                    periodId: periodIdRegularTime,
                    periodIdDescription: "regular time",
                    marketId: 12,
                    marketIdDescription: "X",
                    unconvertedOdds: draw,
                    odds: convertToEU(draw),
                    noVigOdds: noVigOddsArray[2],
                    vig: noVigOddsArray[3],
                    noVigIncreased: noVigOddsArray[6],
                  });
                }
              }
            }

            // 1st Half Markets
            // Asian Handicap (1st Half) - columns 10-11
            if (tds[9] && tds[10]) {
              const hdpDivs = tds[9].querySelectorAll("div");
              const oddsCells = tds[10].querySelectorAll(":scope > div");

              // Find the actual handicap value (not empty or &nbsp;)
              let handicapValue = null;
              let team1Handicap = false;

              for (let i = 0; i < hdpDivs.length; i++) {
                const divText = hdpDivs[i].innerText.trim();
                if (divText && divText !== "&nbsp;" && divText !== "") {
                  handicapValue = divText;
                  team1Handicap = i === 0; // First div = team1 handicap
                  break;
                }
              }

              if (handicapValue && oddsCells.length >= 2) {
                let param = calculateParam(handicapValue);
                const homeWin = parseFloat(oddsCells[0]?.innerText);
                const awayWin = parseFloat(oddsCells[1]?.innerText);

                if (!isNaN(homeWin) && !isNaN(awayWin)) {
                  const noVigOddsArray = devigFunction(2, homeWin, awayWin);

                  dataJSON.push({
                    ...data,
                    periodId: periodId1stHalf,
                    periodIdDescription: "1st half",
                    marketId: 17,
                    marketIdDescription: "Asian Handicap1(%s)",
                    marketParam: team1Handicap ? param * -1 : param,
                    unconvertedOdds: homeWin,
                    odds: convertToEU(homeWin),
                    noVigOdds: noVigOddsArray[0],
                    vig: noVigOddsArray[2],
                    noVigIncreased: noVigOddsArray[3],
                  });

                  dataJSON.push({
                    ...data,
                    periodId: periodId1stHalf,
                    periodIdDescription: "1st half",
                    marketId: 18,
                    marketIdDescription: "Asian Handicap2(%s)",
                    marketParam: team1Handicap ? param : param * -1,
                    unconvertedOdds: awayWin,
                    odds: convertToEU(awayWin),
                    noVigOdds: noVigOddsArray[1],
                    vig: noVigOddsArray[2],
                    noVigIncreased: noVigOddsArray[4],
                  });
                }
              }
            }

            // Over/Under (1st Half) - columns 12-13
            if (tds[11] && tds[12]) {
              const hdpDivs = tds[11].querySelectorAll("div");
              const oddsCells = tds[12].querySelectorAll(":scope > div");

              // Find the actual handicap value (not empty or &nbsp;)
              let handicapValue = null;

              for (let i = 0; i < hdpDivs.length; i++) {
                const divText = hdpDivs[i].innerText.trim();
                if (divText && divText !== "&nbsp;" && divText !== "") {
                  handicapValue = divText;
                  break;
                }
              }

              if (handicapValue && oddsCells.length >= 2) {
                let param = calculateParam(handicapValue);
                const isOver = parseFloat(oddsCells[1]?.innerText);
                const isUnder = parseFloat(oddsCells[2]?.innerText);

                if (!isNaN(isOver) && !isNaN(isUnder)) {
                  const noVigOddsArray = devigFunction(2, isOver, isUnder);

                  dataJSON.push({
                    ...data,
                    periodId: periodId1stHalf,
                    periodIdDescription: "1st half",
                    marketId: 19,
                    marketIdDescription: "Total Over(%s)",
                    marketParam: param,
                    unconvertedOdds: isOver,
                    odds: convertToEU(isOver),
                    noVigOdds: noVigOddsArray[0],
                    vig: noVigOddsArray[2],
                    noVigIncreased: noVigOddsArray[3],
                  });

                  dataJSON.push({
                    ...data,
                    periodId: periodId1stHalf,
                    periodIdDescription: "1st half",
                    marketId: 20,
                    marketIdDescription: "Total Under(%s)",
                    marketParam: param,
                    unconvertedOdds: isUnder,
                    odds: convertToEU(isUnder),
                    noVigOdds: noVigOddsArray[1],
                    vig: noVigOddsArray[2],
                    noVigIncreased: noVigOddsArray[4],
                  });
                }
              }
            }

            // 1X2 (1st Half) - column 14
            if (tds[13]) {
              const oddsCells = tds[13].querySelectorAll(":scope > div");

              if (oddsCells.length >= 3) {
                const homeWin = parseFloat(oddsCells[0]?.innerText);
                const awayWin = parseFloat(oddsCells[1]?.innerText);
                const draw = parseFloat(oddsCells[2]?.innerText);

                if (!isNaN(homeWin) && !isNaN(awayWin) && !isNaN(draw)) {
                  const noVigOddsArray = devigFunction(
                    3,
                    homeWin,
                    awayWin,
                    draw,
                  );

                  dataJSON.push({
                    ...data,
                    periodId: periodId1stHalf,
                    periodIdDescription: "1st half",
                    marketId: 11,
                    marketIdDescription: "1",
                    unconvertedOdds: homeWin,
                    odds: convertToEU(homeWin),
                    noVigOdds: noVigOddsArray[0],
                    vig: noVigOddsArray[3],
                    noVigIncreased: noVigOddsArray[4],
                  });

                  dataJSON.push({
                    ...data,
                    periodId: periodId1stHalf,
                    periodIdDescription: "1st half",
                    marketId: 13,
                    marketIdDescription: "2",
                    unconvertedOdds: awayWin,
                    odds: convertToEU(awayWin),
                    noVigOdds: noVigOddsArray[1],
                    vig: noVigOddsArray[3],
                    noVigIncreased: noVigOddsArray[5],
                  });

                  dataJSON.push({
                    ...data,
                    periodId: periodId1stHalf,
                    periodIdDescription: "1st half",
                    marketId: 12,
                    marketIdDescription: "X",
                    unconvertedOdds: draw,
                    odds: convertToEU(draw),
                    noVigOdds: noVigOddsArray[2],
                    vig: noVigOddsArray[3],
                    noVigIncreased: noVigOddsArray[6],
                  });
                }
              }
            }
          });
          return { dataJSON, allLeagueName };
        },
        acc,
        params.mode,
        leagueIdMap,
        devigMethodString,
        convertToEUString,
      );

      // ####LOG ALL BUGS
      // console.log(result.dataJSON)

      checkDataChange(result.dataJSON);
      if (params.consoleLogAverageVig) calculateAverageVig(result.dataJSON);
      checkAverageVig(result.dataJSON);

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

      if (params.createScrapedDataJSON)
        await fs.writeFile(
          `./TargetBookie/data_${acc}.json`,
          JSON.stringify(result.dataJSON),
        );

      // Read and write to the existing file
      // const existingData = await fs.readFile('./database/SBODB/scrapedSBOLeagues.json');
      // const existingLeagueNames = JSON.parse(existingData);
      // const uniqueLeagueNames = [...new Set([...existingLeagueNames, ...result.allLeagueName])];
      // await fs.writeFile('./database/SBODB/scrapedSBOLeagues.json', JSON.stringify(uniqueLeagueNames.sort()));

      if (params.mode === "live" && params.consoleLogSBOScrape)
        console.log(
          "SBO - done writing LIVE to file SBO: " + new Date().toLocaleString(),
        );
      else if (params.mode === "today" && params.consoleLogSBOScrape)
        console.log(
          "SBO - done writing TODAY to file SBO: " +
            new Date().toLocaleString(),
        );

      return { status: true };
    } catch (error) {
      console.log(error);
      return { status: false };
    }
  }
}

module.exports = { scrape };
