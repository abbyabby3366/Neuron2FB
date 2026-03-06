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
const leagueIdMap = require("../../database/HGADB/output/HGAConfirmedLeagues");
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
    // console.log('HGA - Data changed at:', new Date(currentTime).toLocaleString());
    previousData = JSON.parse(JSON.stringify(newData)); // Store original data with time properties
    return;
  }

  // 3. One minute has passed and data hasn't changed
  if (
    currentTime - lastChangedTime > 2 * 60 * 1000 &&
    JSON.stringify(cleanNewData) === JSON.stringify(cleanPreviousData)
  ) {
    console.log(
      "HGA - WARNING: Data has not changed for 2 minutes",
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

async function openAllLeagues(page) {
  //open all leagues
  await page.evaluate(() => {
    const leagues = document.querySelectorAll("div.btn_title_le");
    leagues.forEach((league) => {
      const nextSibling = league.nextElementSibling;
      if (nextSibling && nextSibling.style.display === "none") {
        league.click();
      }
    });
  });
}

async function clearBetSlipIfLargerThanOne(page) {
  await page.evaluate(() => {
    const betSlipCount = document.querySelector("#bet_select_count");
    if (betSlipCount && parseFloat(betSlipCount.innerHTML) > 1) {
      betSlipCount.click();

      const showRemoveAll = document.querySelector("#showRemoveALL");
      if (showRemoveAll) {
        showRemoveAll.click();
      }

      const removeAll = document.querySelector("#removeALL");
      if (removeAll) {
        removeAll.click();
      }
    }
  });
}

async function checkAHOUTab(page) {
  try {
    const tabIsOn = await page.evaluate(() => {
      const tab = document.querySelector("div#tab_rnou");
      if (tab) {
        return tab.classList.contains("on");
      }
      return false; // Assuming if tab not found, it's not "on"
    });

    if (!tabIsOn) {
      console.log("HGA - HDP & O/U tab is not active, clicking it.");
      await page.evaluate(() => {
        const tab = document.querySelector("div#tab_rnou");
        if (tab) {
          tab.click();
        }
      });

      // Wait for the content to load after clicking, similar to setupPage.js
      await page.waitForSelector("div#game_loading", {
        timeout: 10000,
        visible: false,
      });
      await page.waitForSelector(
        "div#main_content div#div_show div.btn_title_le",
        { timeout: 10000, visible: true },
      );
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log("HGA - HDP & O/U tab clicked and content loaded.");
    }
  } catch (e) {
    console.log(`HGA - Error in checkAHOUTab: ${e.message}`);
  }
}

async function checkPasscodeScreen(page) {
  try {
    const onPasscodeScreen = await page.evaluate(() => {
      const titleElement = document.querySelector("span.tool_title_txt");
      if (
        titleElement &&
        titleElement.innerText.trim().toUpperCase() === "PASSCODE LOGIN"
      ) {
        const backButton = document.querySelector("button#toback");
        if (backButton) {
          backButton.click();
          return true;
        }
      }
      return false;
    });

    if (onPasscodeScreen) {
      console.log("HGA - Passcode screen detected. Clicking back button.");
      // Wait for a moment to ensure the page navigates back
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } catch (e) {
    console.log(`HGA - Error in checkPasscodeScreen: ${e.message}`);
  }
}

async function closeBetSlipIfAny(page) {
  try {
    await page.evaluate(() => {
      const betslip = document.querySelector("div#betslip_show.bet_slip");
      if (betslip && betslip.classList.contains("on")) {
        const closeButton = betslip.querySelector("button#order_close");
        if (closeButton) closeButton.click();
      }
    });
  } catch (e) {
    console.log(`HGA - Error in pressBetslipXButtonNoMatterWhat: ${e.message}`);
  }
}

// Checks if #menu_myGame has class 'on', and if so, clicks #back_btn
async function checkAndBackFromWrongPage(page) {
  try {
    const activeMenuInfo = await page.evaluate(() => {
      const menuMyGame = document.querySelector("#menu_myGame");
      const menuTodayWagers = document.querySelector("#menu_todaywagers");
      const menuTv = document.querySelector("#menu_tv");

      if (menuMyGame && menuMyGame.classList.contains("on")) {
        return { shouldClickBack: true, backButtonId: "#back_btn" };
      }
      if (menuTodayWagers && menuTodayWagers.classList.contains("on")) {
        return { shouldClickBack: true, backButtonId: "#backpage" };
      }
      if (menuTv && menuTv.classList.contains("on")) {
        return { shouldClickBack: true, backButtonId: "#back_btn" };
      }
      return { shouldClickBack: false, backButtonId: null };
    });

    if (activeMenuInfo.shouldClickBack) {
      console.log(
        `HGA - One of the menu buttons is on. Waiting for ${activeMenuInfo.backButtonId} to appear...`,
      );

      // Wait for the back button to appear (up to 5 seconds)
      try {
        await page.waitForSelector(activeMenuInfo.backButtonId, {
          timeout: 5000,
          visible: true,
        });
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await page.click(activeMenuInfo.backButtonId);
        console.log(
          `HGA - Clicked ${activeMenuInfo.backButtonId}, wait 8 seconds`,
        );
        await new Promise((resolve) => setTimeout(resolve, 8000));
      } catch (timeoutError) {
        console.log(
          `HGA - ${activeMenuInfo.backButtonId} did not appear within 5 seconds`,
        );
      }
    }
  } catch (e) {
    console.log(`HGA - Error in checkAndBackFromWrongPage: ${e.message}`);
  }
}

let lastChangedTime;
let previousData;

async function scrape(page, acc) {
  try {
    // Wait for a key element to ensure the page is loaded and ready
    await page.waitForSelector("div#main", { timeout: 3000 });
    await checkPasscodeScreen(page);
    await page.waitForSelector("div#div_show", { timeout: 3000 });
  } catch (e) {
    console.log(
      `HGA - Page not ready or closed, skipping scrape for ${acc}. Error: ${e.message}`,
    );
    return { status: false };
  }

  await checkAndBackFromWrongPage(page);
  await closeBetSlipIfAny(page);
  await openAllLeagues(page);
  await clearBetSlipIfLargerThanOne(page);
  await checkAHOUTab(page);

  const params = JSON.parse(
    await fs.readFile(`./TargetBookie/${acc}.json`, "utf-8"),
  );

  //Check if got live odds
  if (params.mode == "live") {
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

    // console.log('HGA - scrape starting now')

    //start scraping live odds
    try {
      const result = await page.evaluate(
        (acc, mode, leagueIdMap, devigMethodString, convertToEUString) => {
          const devigFunction = eval(`(${devigMethodString})`);
          const convertToEU = eval(`(${convertToEUString})`);

          const calculateParam = (str) => {
            if (!str) return null;
            const nums = str.split("/").map((s) => parseFloat(s.trim()));
            if (nums.length == 1) return nums[0];
            if (str.trim().startsWith("-") && nums[0] < 0 && nums.length > 1) {
              nums[1] = -Math.abs(nums[1]);
            }
            return (nums[0] + nums[1]) / 2;
          };

          const isNumber = (str) =>
            str && str.trim() !== "" && !isNaN(str) && !isNaN(parseFloat(str));

          const allLeagueName = [];
          const sportId = 7; // Soccer
          const periodIdRegularTime = 4;
          // const periodId1stHalf = 10;
          let timeScraped = new Date().toLocaleString();

          const dataJSON = [];
          // let mainDiv = document.querySelector('div#div_show.box_outer.ft_outer');
          let mainDiv = document.querySelector("div#div_show");
          if (!mainDiv) return { dataJSON: [], allLeagueName: [] };

          // Select all divs that have a direct child div whose id starts with "LEG"
          const events = Array.from(mainDiv.querySelectorAll("div")).filter(
            (div) =>
              Array.from(div.children).some(
                (child) =>
                  child.tagName === "DIV" &&
                  child.id &&
                  child.id.startsWith("LEG"),
              ),
          );

          let leagueId;
          for (let i = 0; i < events.length; i++) {
            const event = events[i];
            if (event.id || event.classList?.length > 0) continue; // skip div that has attributes

            const leagueName =
              event.querySelector("tt#lea_name")?.innerText.trim() || null;

            const confirmedLeague = leagueIdMap.find((i) =>
              i.leagueName
                .trim()
                .toLowerCase()
                .includes(leagueName?.trim().toLowerCase()),
            );
            leagueId = confirmedLeague ? confirmedLeague.leagueId : null;

            const startedAt = event
              .querySelector("tt.text_time")
              ?.innerText.trim();
            const homeName = event
              .querySelector("div.box_team.teamH")
              ?.innerText.trim();
            const awayName = event
              .querySelector("div.box_team.teamC")
              ?.innerText.trim();

            const data = {
              bookmakerId: 6,
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

            const markets = event.querySelectorAll(
              "div.form_lebet_hdpou.hdpou_ft",
            );

            // HDP
            const HDP = markets[0];
            const hdpColumns = HDP.querySelectorAll("div.col_hdpou"); // div[class="box_lebet_odd"] // div.col_hdpou
            hdpColumns.forEach((column) => {
              if (column.classList.contains("odd_empty")) return;
              const rows = column.querySelectorAll("div.btn_hdpou_odd"); // div.btn_hdpou_odd // div.btn_lebet_odd.odd_chg
              const homeWin = rows[0];
              const homeWinOdds = homeWin
                ?.querySelector("span.text_odds")
                .innerText.trim();

              const awayWin = rows[1];
              const awayWinOdds = awayWin
                ?.querySelector("span.text_odds")
                .innerText.trim();

              // if any of them is not proper number
              if (!isNumber(homeWinOdds) || !isNumber(awayWinOdds)) return;

              const homeWinId = homeWin?.getAttribute("id");
              const homeWinParam = calculateParam(
                homeWin.querySelector("tt.text_ballhead")?.innerText.trim(),
              );

              const awayWinId = awayWin?.getAttribute("id");
              const awayWinParam = calculateParam(
                awayWin.querySelector("tt.text_ballhead")?.innerText.trim(),
              );
              const noVigOddsArray = devigFunction(2, homeWinOdds, awayWinOdds);

              dataJSON.push({
                buttonIdHGA: homeWinId,
                ...data,
                periodId: periodIdRegularTime,
                periodIdDescription: "regular time",
                marketId: 17,
                marketIdDescription: "Asian Handicap1(%s)",
                marketParam: homeWinParam,
                // eventName: eventName,
                unconvertedOdds: parseFloat(homeWinOdds),
                odds: convertToEU(parseFloat(homeWinOdds)),
                noVigOdds: noVigOddsArray[0],
                vig: noVigOddsArray[2],
                noVigIncreased: noVigOddsArray[3],
              });
              dataJSON.push({
                buttonIdHGA: awayWinId,
                ...data,
                periodId: periodIdRegularTime,
                periodIdDescription: "regular time",
                marketId: 18,
                marketIdDescription: "Asian Handicap2(%s)",
                marketParam: awayWinParam,
                // eventName: eventName,
                unconvertedOdds: parseFloat(awayWinOdds),
                odds: convertToEU(parseFloat(awayWinOdds)),
                noVigOdds: noVigOddsArray[1],
                vig: noVigOddsArray[2],
                noVigIncreased: noVigOddsArray[4],
              });
            });

            // OU
            const OU = markets[1];
            const ouColumns = OU.querySelectorAll("div.col_hdpou"); // div[class="box_lebet_odd"] // div.col_hdpou
            ouColumns.forEach((column) => {
              if (column.classList.contains("odd_empty")) return;
              const rows = column.querySelectorAll("div.btn_hdpou_odd"); // div.btn_lebet_odd.odd_chg // div.btn_hdpou_odd
              const isOver = rows[0];
              const isOverOdds = isOver
                ?.querySelector("span.text_odds")
                .innerText.trim();

              const isUnder = rows[1];
              const isUnderOdds = isUnder
                ?.querySelector("span.text_odds")
                .innerText.trim();

              // if any of them is not proper number
              if (!isNumber(isOverOdds) || !isNumber(isUnderOdds)) return;

              const isOverId = isOver?.getAttribute("id");
              const isOverParam = calculateParam(
                isOver.querySelector("tt.text_ballhead")?.innerText.trim(),
              );

              const isUnderId = isUnder?.getAttribute("id");
              const isUnderParam = calculateParam(
                isUnder.querySelector("tt.text_ballhead")?.innerText.trim(),
              );
              const noVigOddsArray = devigFunction(2, isOverOdds, isUnderOdds);

              dataJSON.push({
                buttonIdHGA: isOverId,
                ...data,
                periodId: periodIdRegularTime,
                periodIdDescription: "regular time",
                marketId: 19, // Total Over(s%)
                marketIdDescription: "Total Over(%s)",
                marketParam: isOverParam,
                // eventName: eventName,
                unconvertedOdds: parseFloat(isOverOdds),
                odds: convertToEU(parseFloat(isOverOdds)),
                noVigOdds: noVigOddsArray[0],
                vig: noVigOddsArray[2],
                noVigIncreased: noVigOddsArray[3],
              });
              dataJSON.push({
                buttonIdHGA: isUnderId,
                ...data,
                periodId: periodIdRegularTime,
                periodIdDescription: "regular time",
                marketId: 20, // Total Under(s%)
                marketIdDescription: "Total Under(%s)",
                marketParam: isUnderParam,
                // eventName: eventName,
                unconvertedOdds: parseFloat(isUnderOdds),
                odds: convertToEU(parseFloat(isUnderOdds)),
                noVigOdds: noVigOddsArray[1],
                vig: noVigOddsArray[2],
                noVigIncreased: noVigOddsArray[4],
              });
            });
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
        // await deleteData('data_target', accFilter);
        // console.log(`Deleted ${deleteResult.deletedCount} document(s)`);
      } catch (error) {
        console.error("Error deleting data:", error);
      }

      // Write new data to MongoDB
      try {
        if (result.dataJSON && result.dataJSON.length > 0) {
          const insertResult = await writeData("data_target", result.dataJSON);
          // await writeData('data_target', result.dataJSON);
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
      const existingData = await fs.readFile(
        "./database/HGADB/scrapedHGALeagues.json",
      );
      const existingLeagueNames = JSON.parse(existingData);
      const uniqueLeagueNames = [
        ...new Set([...existingLeagueNames, ...result.allLeagueName]),
      ];
      await fs.writeFile(
        "./database/HGADB/scrapedHGALeagues.json",
        JSON.stringify(uniqueLeagueNames.sort()),
      );

      if (params.mode === 0 && params.consoleLogHGAScrape)
        console.log(
          "HGA - done writing LIVE to file HGA: " + new Date().toLocaleString(),
        );
      else if (params.mode === 1 && params.consoleLogHGAScrape)
        console.log(
          "HGA - done writing TODAY to file HGA: " +
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
