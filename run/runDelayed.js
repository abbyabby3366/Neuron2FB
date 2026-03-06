const { launch3838 } = require("./setup/ps3838/launch");
const { login } = require("./setup/ps3838/login");

const leagueIdMap = require("../database/SBODB/output/SBOConfirmedLeagues");
const { scrape3838 } = require("./scrape/ps3838");
const fsSync = require("fs");
const { getCurrentTime } = require("../utils/getCurrentTime");
const { setupPage } = require("./setup/ps3838/setupPage");

let browsers = {};
let pages = {};
let isSetupReady = {};

const setupDelayed3838 = async (accNo) => {
  let acc = `Delayedps3838${accNo}`;

  let startTime = Date.now();
  try {
    const user = userAccountList[accNo];
    console.log("3838 Login Credential: ", accNo, user.username);
    let browser = await launch3838(acc);
    browsers[acc] = browser;
    let page = await browser.newPage();
    pages[acc] = page;
    await login(page, user);
    await setupPage(page);

    await new Promise((resolve) => setTimeout(resolve, 10 * 60 * 1000));

    await browser.close();
  } catch (err) {
    console.log(err);
  }
};

function contra(betEvent) {
  // Create a deep copy of the input data
  const result = JSON.parse(JSON.stringify(betEvent));
  const currentMarketId = betEvent.marketId;
  switch (currentMarketId) {
    case 19:
      result.marketId = 20;
      result.marketIdDescription = "Total Under(%s)";
      break;
    case 20:
      result.marketId = 19;
      result.marketIdDescription = "Total Over(%s)";
      break;
    case 18:
      result.marketId = 17;
      result.marketIdDescription = "Asian Handicap1(%s)";

      result.marketParam = betEvent.marketParam * -1;
      break;
    case 17:
      result.marketId = 18;
      result.marketIdDescription = "Asian Handicap2(%s)";
      result.marketParam = betEvent.marketParam * -1;
      break;
  }
  return result;
}

async function delayedTicketContra3838(betEvent) {
  let acc = `Delayedps3838${7}`;
  let page = pages[acc];

  let contraBetEvent = contra(betEvent);

  console.log("ps3838 - Contra Bet Event: ", contraBetEvent);
  await new Promise((resolve) => setTimeout(resolve, 10000));

  try {
    console.log("ps3838 - Finding event: " + getCurrentTime());
    await page.waitForSelector(".odds-container-live", { timeout: 2000 });
    const targetItemHandle = await page.evaluateHandle(
      async (contraBetEvent, leagueIdMap) => {
        const calculateParam = (str) => {
          if (str.split("-").length > 1)
            return (
              str.split("-").reduce((sum, num) => sum + parseFloat(num), 0) / 2
            );
          else return parseFloat(str);
        };

        const liveContainer = document.querySelector(".odds-container-live");
        const trElements = liveContainer.querySelectorAll("tr.mkline");
        console.log(trElements);
        for (const element of trElements) {
          let leagueId = null;
          let leagueName = "-";
          let homeName = "-";
          let awayName = "-";

          leagueName =
            element.parentNode.parentNode.parentNode.previousElementSibling
              .querySelectorAll("span")[1]
              .textContent.trim();
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
          if (
            leagueId != contraBetEvent.leagueId ||
            homeName != contraBetEvent.referenceHomeName ||
            awayName != contraBetEvent.referenceAwayName
          )
            continue;
          if (contraBetEvent.periodId == 4) {
            // Full time
            if ([11, 12, 13].includes(contraBetEvent.marketId)) {
              // 1X2
              const td1X2 = element.querySelector(
                'td.col-1x2[data-period="0"]',
              );
              if (!td1X2) continue;
              if (
                contraBetEvent.marketId == 11 &&
                td1X2.querySelector('a[data-team-type="0"]') != null
              )
                return td1X2.querySelector('a[data-team-type="0"]'); // home win
              else if (
                contraBetEvent.marketId == 13 &&
                td1X2.querySelector('a[data-team-type="1"]') != null
              )
                return td1X2.querySelector('a[data-team-type="1"]'); // away win
              else if (
                contraBetEvent.marketId == 12 &&
                td1X2.querySelector('a[data-team-type="2"]') != null
              )
                return td1X2.querySelector('a[data-team-type="2"]'); // draw
            } else if ([17, 18].includes(contraBetEvent.marketId)) {
              // HDP (Asian Handicap)
              const tdhdp = element.querySelector(
                'td.col-hdp[data-period="0"]',
              );
              if (!tdhdp) continue;

              let param = tdhdp.querySelectorAll("div.hdp span");
              let team1Handicap = false;
              if (param[0].innerText.trim()) {
                param = calculateParam(param[0].innerText);
                team1Handicap = true;
              } else {
                param = calculateParam(param[1].innerText);
              }
              if (team1Handicap && contraBetEvent.marketId == 17)
                param = param * -1;
              if (param != contraBetEvent.marketParam) continue; // skip if is not the event
              if (
                contraBetEvent.marketId == 17 &&
                tdhdp.querySelector('a[data-team-type="0"]') != null
              )
                return tdhdp.querySelector('a[data-team-type="0"]'); // home win
              else if (
                contraBetEvent.marketId == 18 &&
                tdhdp.querySelector('a[data-team-type="1"]') != null
              )
                return tdhdp.querySelector('a[data-team-type="1"]'); // away win
            } else if ([19, 20].includes(contraBetEvent.marketId)) {
              // OU
              const tdou = element.querySelector('td.col-ou[data-period="0"]');
              if (!tdou) continue;
              let param = tdou.querySelector("div.hdp span");
              param = calculateParam(param?.innerText);
              if (param != contraBetEvent.marketParam) continue; // skip if is not the event
              if (
                contraBetEvent.marketId == 19 &&
                tdou.querySelector('a[data-team-type="0"]') != null
              )
                return tdou.querySelector('a[data-team-type="0"]'); // home win
              if (
                contraBetEvent.marketId == 20 &&
                tdou.querySelector('a[data-team-type="1"]') != null
              )
                return tdou.querySelector('a[data-team-type="1"]'); // away win
            }
          } else if (contraBetEvent.periodId == 10) {
            // 1st Half
            if ([11, 12, 13].includes(contraBetEvent.marketId)) {
              // 1X2
              const td1X2_firstHalf = element.querySelector(
                'td.col-1x2[data-period="1"]',
              );
              if (!td1X2_firstHalf) continue;
              if (
                contraBetEvent.marketId == 11 &&
                !td1X2_firstHalf.querySelector('a[data-team-type="0"]')
              )
                return td1X2_firstHalf.querySelector('a[data-team-type="0"]'); // home win
              if (
                contraBetEvent.marketId == 13 &&
                !td1X2_firstHalf.querySelector('a[data-team-type="1"]')
              )
                return td1X2_firstHalf.querySelector('a[data-team-type="1"]'); // away win
              if (
                contraBetEvent.marketId == 12 &&
                !td1X2_firstHalf.querySelector('a[data-team-type="2"]')
              )
                return td1X2_firstHalf.querySelector('a[data-team-type="2"]'); // draw
            } else if ([17, 18].includes(contraBetEvent.marketId)) {
              // HDP (Asian Handicap)
              const tdhdp_firstHalf = element.querySelector(
                'td.col-hdp[data-period="1"]',
              );
              if (!tdhdp_firstHalf) continue;
              let param = tdhdp_firstHalf.querySelectorAll("div.hdp span");
              let team1Handicap = false;
              if (param[0].innerText.trim()) {
                param = calculateParam(param[0].innerText);
                team1Handicap = true;
              } else {
                param = calculateParam(param[1].innerText);
              }
              if (team1Handicap && contraBetEvent.marketId == 17)
                param = param * -1;
              if (param != contraBetEvent.marketParam) continue; // skip if is not the event
              if (
                contraBetEvent.marketId == 17 &&
                tdhdp_firstHalf.querySelector('a[data-team-type="0"]') != null
              )
                return tdhdp_firstHalf.querySelector('a[data-team-type="0"]'); // home win
              else if (
                contraBetEvent.marketId == 18 &&
                tdhdp_firstHalf.querySelector('a[data-team-type="1"]') != null
              )
                return tdhdp_firstHalf.querySelector('a[data-team-type="1"]'); // away win
            } else if ([19, 20].includes(contraBetEvent.marketId)) {
              // OU
              const tdou_firstHalf = element.querySelector(
                'td.col-ou[data-period="1"]',
              );
              if (!tdou_firstHalf) continue;
              let param = tdou_firstHalf.querySelector("div.hdp span");
              param = calculateParam(param?.innerText);
              if (param != contraBetEvent.marketParam) continue; // skip if is not the event
              if (
                contraBetEvent.marketId == 19 &&
                tdou_firstHalf.querySelector('a[data-team-type="0"]') != null
              )
                return tdou_firstHalf.querySelector('a[data-team-type="0"]'); // home win
              if (
                contraBetEvent.marketId == 20 &&
                tdou_firstHalf.querySelector('a[data-team-type="1"]') != null
              )
                return tdou_firstHalf.querySelector('a[data-team-type="1"]'); // away win
            }
          }
        }
        return null;
      },
      contraBetEvent,
      leagueIdMap,
    );

    // click on found bet event
    if (!targetItemHandle)
      throw new Error("Bet event not found, empty handler");
    const targetItemElement = await targetItemHandle.evaluateHandle(
      (element) => element,
    );
    if (!targetItemElement.asElement())
      throw new Error("Bet event not found, empty element");
    console.log("ps3838 - Clicking event: " + getCurrentTime());

    await targetItemElement.asElement().click(); // still have some issue here, sometimes not found/clicked
    console.log("ps3838 - Clicked event: " + getCurrentTime());

    // Wait for the odds to be present in the DOM
    await page.waitForSelector("span.odds", { timeout: 5000 });

    // Use page.$eval to select the element and get its text content
    let newOdds = await page.$eval("span.odds", (element) => {
      // Ensure the element has exactly one class, which is 'abc'
      if (element.classList.length === 1) {
        return element.textContent;
      }
      return null;
    });

    if (!newOdds) throw new Error("Odds not found");
    newOdds = parseFloat(newOdds.trim());
    let noVigOdds = contraBetEvent.referenceNoVigOdds;
    if (newOdds != contraBetEvent.referenceOdds) {
      // recalculate no vig odds
      noVigOdds =
        (newOdds * contraBetEvent.referenceNoVigOdds) /
        contraBetEvent.referenceOdds;
    }

    console.log(
      `ps3838 - No Vig Odds retrieved ${noVigOdds}: ` + getCurrentTime(),
    );

    const [minStake, maxStake] = await Promise.all([
      page.$eval(".min-value", (el) => el.innerText),
      page.$eval(".max-value", (el) => el.innerText),
    ]);

    const closeButton = await page.waitForSelector("div.remove-icon", {
      timeout: 5000,
    });
    await closeButton.click();
    return console.log("this is test delayed 10seconds", {
      referenceFinalOdds: newOdds,
      referenceFinalNoVigOdds: noVigOdds,
      minStake,
      maxStake,
    });
  } catch (error) {
    console.log("3838 - Failed to ticket");
    console.error(error);
    throw error; // Re-throw the error for proper handling upstream
  }
}

function createDelayedTicketEventQueue() {
  const queue = [];
  let isProcessing = false;
  let queueId = 0;
  function logQueue() {
    console.log(
      `Current Queue (${queue.length} items):`,
      queue.map((item) => item.id),
    );
  }

  function startQueueLogging() {
    setInterval(() => {
      console.log("\n--- Queue Status Update ---");
      logQueue();
      console.log(`Is Processing: ${isProcessing}`);
      console.log("---------------------------\n");
    }, 1000);
  }

  async function enqueue(betEvent) {
    return new Promise((resolve, reject) => {
      const id = ++queueId;
      console.log(
        `[${new Date().toISOString()}] Adding to queue: Bet Event ${id}`,
      );
      queue.push({ id, betEvent, resolve, reject });
      logQueue();
      if (!isProcessing) {
        processQueue();
      }
    });
  }

  async function processQueue() {
    if (isProcessing || queue.length === 0) return;

    isProcessing = true;
    console.log(`3838 [${new Date().toISOString()}] Started processing queue`);

    while (queue.length > 0) {
      const { id, betEvent, resolve, reject } = queue.shift();
      console.log(
        `3838 [${new Date().toISOString()}] Processing: Bet Event ${id}`,
      );
      logQueue();

      try {
        console.log(
          `3838 [${new Date().toISOString()}] Calling ticketEvent for Bet Event ${id}`,
        );
        const result = await delayedTicketContra3838(betEvent);
        console.log(
          `3838 [${new Date().toISOString()}] Completed: Bet Event ${id}`,
        );
        resolve(result);
      } catch (error) {
        console.error(
          `3838 [${new Date().toISOString()}] Error processing Bet Event ${id}:`,
          error,
        );
        reject(error);
      }
    }

    isProcessing = false;
    console.log(`3838 [${new Date().toISOString()}] Finished processing queue`);
  }

  // startQueueLogging();
  return { enqueue };
}

const delayedTicketingQueue = createDelayedTicketEventQueue();

module.exports = {
  setupDelayed3838,
  delayedTicketContra3838,
  delayedTicketingQueue,
};
