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
const leagueIdMap = require("../../database/IBCDB/output/IBCConfirmedLeagues");
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
const { match } = require("assert");

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
      console.log("IBC - closing a rejected bet...");
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
          "IBC - Show more buttons detected and clicked: " + new Date(),
        );
      });
    },
  );
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
    // console.log('IBC - Data changed at:', new Date(currentTime).toLocaleString());
    previousData = JSON.parse(JSON.stringify(newData)); // Store original data with time properties
    return;
  }

  // 3. One minute has passed and data hasn't changed
  if (
    currentTime - lastChangedTime > 2 * 60 * 1000 &&
    JSON.stringify(cleanNewData) === JSON.stringify(cleanPreviousData)
  ) {
    console.log(
      "IBC - WARNING: Data has not changed for 2 minutes",
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

async function showMoreAsianLinesIBC(page) {
  const buttons = await page.$$("a.c-btn.c-btn--more-lines.c-is-close");

  // Loop through each button and click it
  for (const button of buttons) {
    const buttonText = await button.evaluate((el) => el.textContent.trim());
    if (buttonText === "More Asian Lines") {
      await button.click();
    }
  }
}

async function hideUnwantedLeagesIBC(page) {
  page.evaluate(() => {
    let SABALeague = document.querySelectorAll("div.c-league .c-league__name");
    for (const divLeague of SABALeague) {
      if (
        divLeague.innerHTML.includes("SABA") ||
        divLeague.innerHTML.includes("Saba") ||
        divLeague.innerHTML.includes("FANTASY") ||
        divLeague.innerHTML.includes("Soccer Marble") ||
        divLeague.innerHTML.includes("Soccer PinGoal")
      ) {
        let collapseButton = divLeague.parentElement.querySelector(
          "div.c-league__header > div > div.c-league__btn-collapse.c-is-open",
        );
        if (collapseButton) {
          collapseButton.click();
        }
      }
    }
  });
}

async function clearBetListIBC(page) {
  await page.evaluate(async () => {
    while (true) {
      const clearButton = document.querySelector(
        ".c-betting .c-icon.c-icon--clear",
      );
      if (!clearButton) break;
      console.log("IBC - clearing bet list...");
      clearButton.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  });
}

async function closePopUpIfAny(page) {
  try {
    //close pop up?
    await page.evaluate(() => {
      const button = document.querySelector("#popupPanel > div > div > a > i");
      if (button) {
        button.click();
      }
    });
  } catch (e) {
    // Silent catch
  }
}

let lastChangedTime;
let previousData;
async function scrape(page, acc) {
  const params = JSON.parse(
    await fs.readFile(`./TargetBookie/${acc}.json`, "utf-8"),
  );
  //Check if got live odds
  if (params.mode === "live") {
    //check if page exists to prevent "node detached" error
    try {
      await page.waitForSelector("div.c-odds-page div.c-odds-page__header", {
        timeout: 3000,
      });
    } catch {
      console.log(`${acc} - no live odds found`);
      return;
    }

    // //close rejected waiting at bet list if any
    await closeRejectedBet(page);
    // //close e-football if any (not sure if this is deprecated?)
    // await closeEFootballDiv(page)
    // //make sure show more is collapse
    // await closeShowMore(page)

    await showMoreAsianLinesIBC(page);
    await hideUnwantedLeagesIBC(page);
    await clearBetListIBC(page);
    await closePopUpIfAny(page);

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
            if (str.split("/").length > 1)
              return (
                str.split("/").reduce((sum, num) => sum + parseFloat(num), 0) /
                2
              );
            else return parseFloat(str);
          };
          const allLeagueName = [];
          const sportId = 7; // Soccer
          const periodIdRegularTime = 4;
          const periodId1stHalf = 10;
          let timeScraped = new Date().toLocaleString();
          const parentDiv = document.querySelector(
            "div.c-odds-table.c-odds-table--in-play",
          );
          if (!parentDiv) {
            return { dataJSON: [], allLeagueName: [] };
          }

          const dataJSON = [];
          let leaguesRows = parentDiv.querySelectorAll("div.c-league"); // div.c-match__bets
          leaguesRows.forEach((leagueRow) => {
            if (leagueRow.getAttribute("data-open") === "false") {
              leagueRow.click();
            }
          });

          leaguesRows = parentDiv.querySelectorAll("div.c-league"); // div.c-match__bets
          leaguesRows.forEach((leagueRow) => {
            const leagueName =
              leagueRow.querySelector("div.c-league__name")?.innerText;
            allLeagueName.push(leagueName);
            const confirmedLeague = leagueIdMap.find((i) =>
              i.leagueName
                .trim()
                .toLowerCase()
                .includes(leagueName?.trim().toLowerCase()),
            );
            const leagueId = confirmedLeague ? confirmedLeague.leagueId : null;

            const matches = leagueRow.querySelectorAll("div.c-match");
            matches.forEach((match) => {
              const matchTimeElem = match.querySelector(".c-match-time__item");
              const matchMinuteElem = match.querySelector(
                ".c-match-time__minute",
              );
              const startedAt =
                matchTimeElem && matchMinuteElem
                  ? `${matchTimeElem.innerText?.trim()}`
                  : "";

              const teamName = match.querySelectorAll("div.c-team");
              // Check if the div exists and get its title attribute
              const homeName = teamName[0]?.getAttribute("title").trim() ?? "";
              const awayName = teamName[1]?.getAttribute("title").trim() ?? "";
              const data = {
                bookmakerId: 4,
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

              const betTypes = match.querySelectorAll("div.c-bettype-col");
              // 1 - FT.HDP
              // 3 - FT.O/U
              // 5 - FT.1X2
              // 7 - 1H.HDP
              // 8 - 1H.O/U
              // 15 - 1H.1X2

              // 2 - O/E
              betTypes.forEach((betType) => {
                try {
                  const dataBt = betType?.getAttribute("data-bt") ?? null;
                  if (!dataBt) return;
                  const cells = betType.querySelectorAll("div.c-odds-button");
                  if (dataBt == "1") {
                    //  FT HDP
                    const homeWin = parseFloat(
                      cells[0]?.querySelector("span.c-odds")?.innerText,
                    );
                    const awayWin = parseFloat(
                      cells[1]?.querySelector("span.c-odds")?.innerText,
                    );
                    let oddsPoint = cells[0]?.querySelector("span.c-text-goal");
                    let param;
                    let team1Handicap = false;
                    if (oddsPoint) {
                      team1Handicap = true;
                      param = calculateParam(oddsPoint?.innerText);
                    } else {
                      oddsPoint = cells[1]?.querySelector("span.c-text-goal");
                      param = calculateParam(oddsPoint?.innerText);
                    }
                    const noVigOddsArray = devigFunction(2, homeWin, awayWin);
                    if (homeWin) {
                      dataJSON.push({
                        buttonIdIBC: cells[0].id,
                        ...data,
                        periodId: periodIdRegularTime,
                        periodIdDescription: "regular time",
                        marketId: 17,
                        marketIdDescription: "Asian Handicap1(%s)",
                        marketParam: team1Handicap ? param * -1 : param,
                        // eventName: eventName,
                        unconvertedOdds: homeWin,
                        odds: convertToEU(homeWin),
                        noVigOdds: noVigOddsArray[0],
                        vig: noVigOddsArray[2],
                        noVigIncreased: noVigOddsArray[3],
                      });
                    }
                    if (awayWin) {
                      dataJSON.push({
                        buttonIdIBC: cells[1].id,
                        ...data,
                        periodId: periodIdRegularTime,
                        periodIdDescription: "regular time",
                        marketId: 18,
                        marketIdDescription: "Asian Handicap2(%s)",
                        marketParam: team1Handicap ? param : param * -1,
                        // eventName: eventName,
                        unconvertedOdds: awayWin,
                        odds: convertToEU(awayWin),
                        noVigOdds: noVigOddsArray[1],
                        vig: noVigOddsArray[2],
                        noVigIncreased: noVigOddsArray[4],
                      });
                    }
                  } else if (dataBt == "3") {
                    // FT O/U
                    let oddsPoint = cells[0]?.querySelector("span.c-text-goal");
                    let param = calculateParam(oddsPoint?.innerText);
                    const isOver = parseFloat(
                      cells[0]?.querySelector("span.c-odds")?.innerText,
                    );
                    const isUnder = parseFloat(
                      cells[1]?.querySelector("span.c-odds")?.innerText,
                    );
                    const noVigOddsArray = devigFunction(2, isOver, isUnder);
                    if (isOver) {
                      dataJSON.push({
                        buttonIdIBC: cells[0].id,
                        ...data,
                        periodId: periodIdRegularTime,
                        periodIdDescription: "regular time",
                        marketId: 19, // Total Over(s%)
                        marketIdDescription: "Total Over(%s)",
                        marketParam: param,
                        // eventName: eventName,
                        unconvertedOdds: isOver,
                        odds: convertToEU(isOver),
                        noVigOdds: noVigOddsArray[0],
                        vig: noVigOddsArray[2],
                        noVigIncreased: noVigOddsArray[3],
                      });
                    }
                    if (isUnder) {
                      dataJSON.push({
                        buttonIdIBC: cells[1].id,
                        ...data,
                        periodId: periodIdRegularTime,
                        periodIdDescription: "regular time",
                        marketId: 20, // Total Under(s%)
                        marketIdDescription: "Total Under(%s)",
                        marketParam: param,
                        // eventName: eventName,
                        unconvertedOdds: isUnder,
                        odds: convertToEU(isUnder),
                        noVigOdds: noVigOddsArray[1],
                        vig: noVigOddsArray[2],
                        noVigIncreased: noVigOddsArray[4],
                      });
                    }
                  } else if (dataBt == "5") {
                    // FT 1X2
                    const homeWin = parseFloat(
                      cells[0].querySelector("span.c-odds")?.innerText,
                    );
                    const awayWin = parseFloat(
                      cells[1].querySelector("span.c-odds")?.innerText,
                    );
                    const draw = parseFloat(
                      cells[2].querySelector("span.c-odds")?.innerText,
                    );
                    const noVigOddsArray = devigFunction(
                      3,
                      homeWin,
                      awayWin,
                      draw,
                    );

                    if (homeWin) {
                      dataJSON.push({
                        buttonIdIBC: cells[0].id,
                        ...data,
                        periodId: periodIdRegularTime,
                        periodIdDescription: "regular time",
                        marketId: 11,
                        marketIdDescription: "1",
                        // eventName: eventName,
                        unconvertedOdds: homeWin,
                        odds: convertToEU(homeWin),
                        noVigOdds: noVigOddsArray[0],
                        vig: noVigOddsArray[3],
                        noVigIncreased: noVigOddsArray[4],
                      });
                    }
                    if (awayWin) {
                      dataJSON.push({
                        buttonIdIBC: cells[1].id,
                        ...data,
                        periodId: periodIdRegularTime,
                        periodIdDescription: "regular time",
                        marketId: 13,
                        marketIdDescription: "2",
                        // eventName: eventName,
                        unconvertedOdds: awayWin,
                        odds: convertToEU(awayWin),
                        noVigOdds: noVigOddsArray[1],
                        vig: noVigOddsArray[3],
                        noVigIncreased: noVigOddsArray[5],
                      });
                    }
                    if (draw) {
                      dataJSON.push({
                        buttonIdIBC: cells[2].id,
                        ...data,
                        periodId: periodIdRegularTime,
                        periodIdDescription: "regular time",
                        marketId: 12,
                        marketIdDescription: "X",
                        // eventName: eventName,
                        unconvertedOdds: draw,
                        odds: convertToEU(draw),
                        noVigOdds: noVigOddsArray[2],
                        vig: noVigOddsArray[3],
                        noVigIncreased: noVigOddsArray[6],
                      });
                    }
                  } else if (dataBt == "7") {
                    // 1H HDP
                    const homeWin = parseFloat(
                      cells[0].querySelector("span.c-odds")?.innerText,
                    );
                    const awayWin = parseFloat(
                      cells[1].querySelector("span.c-odds")?.innerText,
                    );
                    let oddsPoint = cells[0].querySelector("span.c-text-goal");
                    let param;
                    let team1Handicap = false;
                    if (oddsPoint) {
                      team1Handicap = true;
                      param = calculateParam(oddsPoint?.innerText);
                    } else {
                      oddsPoint = cells[1].querySelector("span.c-text-goal");
                      param = calculateParam(oddsPoint?.innerText);
                    }
                    const noVigOddsArray = devigFunction(2, homeWin, awayWin);
                    if (homeWin) {
                      dataJSON.push({
                        buttonIdIBC: cells[0].id,
                        ...data,
                        periodId: periodId1stHalf,
                        periodIdDescription: "1st half",
                        marketId: 17,
                        marketIdDescription: "Asian Handicap1(%s)",
                        marketParam: team1Handicap ? param * -1 : param,
                        // eventName: eventName,
                        unconvertedOdds: homeWin,
                        odds: convertToEU(homeWin),
                        noVigOdds: noVigOddsArray[0],
                        vig: noVigOddsArray[2],
                        noVigIncreased: noVigOddsArray[3],
                      });
                    }
                    if (awayWin) {
                      dataJSON.push({
                        buttonIdIBC: cells[1].id,
                        ...data,
                        periodId: periodId1stHalf,
                        periodIdDescription: "1st half",
                        marketId: 18,
                        marketIdDescription: "Asian Handicap2(%s)",
                        marketParam: team1Handicap ? param : param * -1,
                        // eventName: eventName,
                        unconvertedOdds: awayWin,
                        odds: convertToEU(awayWin),
                        noVigOdds: noVigOddsArray[1],
                        vig: noVigOddsArray[2],
                        noVigIncreased: noVigOddsArray[4],
                      });
                    }
                  } else if (dataBt == "8") {
                    // 1H OU
                    let oddsPoint = cells[0]?.querySelector("span.c-text-goal");
                    let param = calculateParam(oddsPoint?.innerText);
                    const isOver = parseFloat(
                      cells[0]?.querySelector("span.c-odds")?.innerText,
                    );
                    const isUnder = parseFloat(
                      cells[1]?.querySelector("span.c-odds")?.innerText,
                    );
                    const noVigOddsArray = devigFunction(2, isOver, isUnder);

                    if (isOver) {
                      dataJSON.push({
                        buttonIdIBC: cells[0].id,
                        ...data,
                        periodId: periodId1stHalf,
                        periodIdDescription: "1st half",
                        marketId: 19, // Total Over(s%)
                        marketIdDescription: "Total Over(%s)",
                        marketParam: param,
                        // eventName: eventName,
                        unconvertedOdds: isOver,
                        odds: convertToEU(isOver),
                        noVigOdds: noVigOddsArray[0],
                        vig: noVigOddsArray[2],
                        noVigIncreased: noVigOddsArray[3],
                      });
                    }
                    if (isUnder) {
                      dataJSON.push({
                        buttonIdIBC: cells[1].id,
                        ...data,
                        periodId: periodId1stHalf,
                        periodIdDescription: "1st half",
                        marketId: 20, // Total Under(s%)
                        marketIdDescription: "Total Under(%s)",
                        marketParam: param,
                        // eventName: eventName,
                        unconvertedOdds: isUnder,
                        odds: convertToEU(isUnder),
                        noVigOdds: noVigOddsArray[1],
                        vig: noVigOddsArray[2],
                        noVigIncreased: noVigOddsArray[4],
                      });
                    }
                  } else if (dataBt == "15") {
                    // 1H 1X2
                    const homeWin = parseFloat(
                      cells[0].querySelector("span.c-odds")?.innerText,
                    );
                    const awayWin = parseFloat(
                      cells[1].querySelector("span.c-odds")?.innerText,
                    );
                    const draw = parseFloat(
                      cells[2].querySelector("span.c-odds")?.innerText,
                    );
                    const noVigOddsArray = devigFunction(
                      3,
                      homeWin,
                      awayWin,
                      draw,
                    );

                    if (homeWin) {
                      dataJSON.push({
                        buttonIdIBC: cells[0].id,
                        ...data,
                        periodId: periodId1stHalf,
                        periodIdDescription: "1st half",
                        marketId: 11,
                        marketIdDescription: "1",
                        // eventName: eventName,
                        unconvertedOdds: homeWin,
                        odds: convertToEU(homeWin),
                        noVigOdds: noVigOddsArray[0],
                        vig: noVigOddsArray[3],
                        noVigIncreased: noVigOddsArray[4],
                      });
                    }
                    if (awayWin) {
                      dataJSON.push({
                        buttonIdIBC: cells[1].id,
                        ...data,
                        periodId: periodId1stHalf,
                        periodIdDescription: "1st half",
                        marketId: 13,
                        marketIdDescription: "2",
                        // eventName: eventName,
                        unconvertedOdds: awayWin,
                        odds: convertToEU(awayWin),
                        noVigOdds: noVigOddsArray[1],
                        vig: noVigOddsArray[3],
                        noVigIncreased: noVigOddsArray[5],
                      });
                    }
                    if (draw) {
                      dataJSON.push({
                        buttonIdIBC: cells[2].id,
                        ...data,
                        periodId: periodId1stHalf,
                        periodIdDescription: "1st half",
                        marketId: 12,
                        marketIdDescription: "X",
                        // eventName: eventName,
                        unconvertedOdds: draw,
                        odds: convertToEU(draw),
                        noVigOdds: noVigOddsArray[2],
                        vig: noVigOddsArray[3],
                        noVigIncreased: noVigOddsArray[6],
                      });
                    }
                  }
                } catch (error) {
                  // console.log(error)
                }
              });
            });
          });
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

      if (params.createScrapedDataJSON)
        await fs.writeFile(
          `./TargetBookie/data_${acc}.json`,
          JSON.stringify(result.dataJSON),
        );

      // Read and write to the existing file
      // const existingData = await fs.readFile('./database/IBCDB/scrapedIBCLeagues.json');
      // const existingLeagueNames = JSON.parse(existingData);
      // const uniqueLeagueNames = [...new Set([...existingLeagueNames, ...result.allLeagueName])];
      // await fs.writeFile('./database/IBCDB/scrapedIBCLeagues.json', JSON.stringify(uniqueLeagueNames.sort()));

      if (params.mode === "live" && params.consoleLogIBCScrape)
        console.log(
          "IBC - done writing LIVE to file IBC: " + new Date().toLocaleString(),
        );
      else if (params.mode === "today" && params.consoleLogIBCScrape)
        console.log(
          "IBC - done writing TODAY to file IBC: " +
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
