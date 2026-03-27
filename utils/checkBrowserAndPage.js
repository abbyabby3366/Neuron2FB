const fsSync = require("fs");
const { isMemoryLimitReached } = require("./isMemoryLimitReached");
const { queueSetup } = require("./setupQueue");
const { cleanupBrowser } = require("./cleanupBrowser");
const { isAccWithinOpeningHours } = require("./openingHours");

const pendingRestartSince = {};

const checkBrowserAndPage = async (
  bookie,
  isSetupReady,
  browsers,
  pages,
  lastStartTime,
  [...args],
  fb2ConfigId = "",
) => {
  // Check every 5 seconds if it's time to restart the browser or if the page is closed
  setInterval(async () => {
    const currentTime = new Date();
    for (const accNo of args) {
      const acc = `${bookie}${accNo}`;

      const hoursCheck = isAccWithinOpeningHours(acc, fb2ConfigId);

      // Opening hours check — close browser if outside hours
      if (isSetupReady[acc] === true && !hoursCheck.isOpen) {
        console.log(`[HOURS] ${acc} outside opening hours, closing browser (Blocked by ${hoursCheck.reason})`);
        await cleanupBrowser(browsers[acc], acc);
        isSetupReady[acc] = "hours_closed";
        continue;
      }

      // Recovery: re-setup account when back within opening hours
      if (isSetupReady[acc] === "hours_closed" && hoursCheck.isOpen) {
        console.log(`[HOURS] ${acc} back within opening hours, queueing setup`);
        isSetupReady[acc] = "ongoing";
        queueSetup(acc);
        lastStartTime[accNo] = new Date();
        continue;
      }

      let params;
      try {
        params = JSON.parse(
          await fsSync.promises.readFile(`TargetBookie/${acc}.json`, "utf-8")
        );
      } catch (e) {
        console.error(`[checkBrowserAndPage] Error reading TargetBookie/${acc}.json:`, e.message);
        continue;
      }

      let shouldRestartForInterval = false;

      if (
        isSetupReady[acc] === true &&
        currentTime - lastStartTime[accNo] >
          params.targetBrowserRestartIntervalInMins * 60 * 1000
      ) {
        const { isAutoBettingObj } = require("./SBB2FB");
        if (isAutoBettingObj[acc]) {
          if (!pendingRestartSince[acc]) {
            pendingRestartSince[acc] = currentTime;
            console.log(
              `[RESTART MGR] ${acc} restart requested, but autobetting is active. Waiting...`
            );
          } else if (currentTime - pendingRestartSince[acc] > 60 * 1000) {
            console.log(
              `[RESTART MGR] ${acc} autobetting wait timeout (1 min) reached. Forcing restart.`
            );
            delete pendingRestartSince[acc];
            shouldRestartForInterval = true;
          }
        } else {
          if (pendingRestartSince[acc]) {
            console.log(
              `[RESTART MGR] ${acc} finished autobetting. Proceeding with pending restart.`
            );
            delete pendingRestartSince[acc];
          }
          shouldRestartForInterval = true;
        }
      } else {
        if (pendingRestartSince[acc]) {
          delete pendingRestartSince[acc];
        }
      }

      if (shouldRestartForInterval) {
        console.log(
          `${bookie} ${accNo} browser restart interval of ${params.targetBrowserRestartIntervalInMins} mins reached, restarting browser`,
        );
        await cleanupBrowser(browsers[acc], acc);
        isSetupReady[acc] = false;
        console.log(
          `${bookie} ${accNo} browser closed, waiting 3 seconds before resetting up`,
        );
        setTimeout(() => {
          queueSetup(acc);
          lastStartTime[accNo] = new Date(); // Reset the start time for this account
        }, 3000);
      } else if (
        isSetupReady[acc] === true &&
        (!pages[acc] || pages[acc].isClosed())
      ) {
        console.log(
          `${bookie} ${accNo} page detected to be closed, marking as not ready`,
        );
        await cleanupBrowser(browsers[acc], acc);
        isSetupReady[acc] = false;
        console.log(
          `${bookie} ${accNo} page closed, waiting 5 seconds before resetting up`,
        );
        setTimeout(() => {
          isSetupReady[acc] = "ongoing";
          queueSetup(acc);
          lastStartTime[accNo] = new Date(); // Reset the start time for this account
        }, 5000);
      } else if (
        isSetupReady[acc] === true &&
        (await isMemoryLimitReached(pages[acc], 0.9))
      ) {
        console.log(
          `${bookie} ${accNo} - Memory limit exceeded, restarting...`,
        );
        await cleanupBrowser(browsers[acc], acc);
        isSetupReady[acc] = false;
        console.log(
          `${bookie} ${accNo} page closed, waiting 5 seconds before resetting up`,
        );
        setTimeout(() => {
          queueSetup(acc);
          lastStartTime[accNo] = new Date(); // Reset the start time for this account
        }, 5000);
      } else if (isSetupReady[acc] === true && acc.startsWith("hga")) {
        const mainElement = await pages[acc].$("#main");
        if (!mainElement) {
          console.log(
            `${bookie} ${accNo} - div#main element not found, restarting...`,
          );
          await cleanupBrowser(browsers[acc], acc);
          isSetupReady[acc] = false;
          console.log(
            `${bookie} ${accNo} page closed, waiting 5 seconds before resetting up`,
          );
          setTimeout(() => {
            queueSetup(acc);
            lastStartTime[accNo] = new Date(); // Reset the start time for this account
          }, 5000);
        }
      } else if (isSetupReady[acc] === true && acc.startsWith("ibc")) {
        const mainAreaElement = await pages[acc].$("#mainArea");
        if (!mainAreaElement) {
          console.log(
            `${bookie} ${accNo} - div#mainArea element not found, restarting...`,
          );
          await cleanupBrowser(browsers[acc], acc);
          isSetupReady[acc] = false;
          console.log(
            `${bookie} ${accNo} page closed, waiting 5 seconds before resetting up`,
          );
          setTimeout(() => {
            queueSetup(acc);
            lastStartTime[accNo] = new Date(); // Reset the start time for this account
          }, 5000);
        }
      } else if (isSetupReady[acc] === true && acc.startsWith("ps")) {
        const mainAreaElement = await pages[acc].$("#wrapper");
        if (!mainAreaElement) {
          console.log(
            `${bookie} ${accNo} - div#wrapper element not found, restarting...`,
          );
          await cleanupBrowser(browsers[acc], acc);
          isSetupReady[acc] = false;
          console.log(
            `${bookie} ${accNo} page closed, waiting 5 seconds before resetting up`,
          );
          setTimeout(() => {
            queueSetup(acc);
            lastStartTime[accNo] = new Date(); // Reset the start time for this account
          }, 5000);
        }
      }
    }
  }, 5000);
};

module.exports = { checkBrowserAndPage };
