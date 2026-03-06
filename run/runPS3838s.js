const fsSync = require("fs");
const fs = require("fs").promises;
const { checkBrowserAndPage } = require("../utils/checkBrowserAndPage");
const { clearPendingBetList } = require("../utils/clearPendingBetList");
const { SBB } = require("../utils/SBB");
const { setupBookie } = require("../utils/setupBookie");
const { scrape3838 } = require("./scrape/ps3838");
const { createTicketEventQueue } = require("../utils/createTicketEventQueue");

//running SBO includes scrapeBrainBet
// initialise pages only once (even if i runSBO multiple times)
let browsers = {};
let pages = {};
let isSetupReady = {};
let lastStartTime = {};
let ticketEventQueuePS = createTicketEventQueue();

// Set up accounts one by one to prevent crashing
const setupPS3838s = async (args) => {
  for (const accNo of args) {
    if (!isSetupReady[`ps3838${accNo}`]) {
      let acc = `ps3838${accNo}`;
      await setupBookie(acc, browsers, pages, isSetupReady);
      lastStartTime[accNo] = new Date();
    }
  }
};

const runPS3838s = async ([...args]) => {
  clearPendingBetList();
  setupPS3838s(args);
  checkBrowserAndPage(
    "ps3838",
    isSetupReady,
    browsers,
    pages,
    lastStartTime,
    args,
  );

  //run main loop
  while (true) {
    const readyAccounts = args.filter(
      (accNo) => isSetupReady[`ps3838${accNo}`] === true,
    );

    if (readyAccounts.length > 0) {
      for (const accNo of readyAccounts) {
        let acc = `ps3838${accNo}`;

        try {
          let params = JSON.parse(
            fsSync.readFileSync(`TargetBookie/${acc}.json`, "utf-8"),
          );
          if (isSetupReady[acc] === true) {
            //check again if there is account (because of delay)
            await SBB((refAcc = "sbo1"), acc, pages, isSetupReady);
            await new Promise((resolve) =>
              setTimeout(resolve, params.msBetweenSBB),
            );
          }
        } catch (e) {
          console.log(
            `PS3838 - Caught error for ${acc}, continuing... Error: ${e.message}`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } else {
      // console.log('SBO - No accounts ready now');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

const getPages = () => {
  return pages;
};

const getDataPS3838 = () => {
  return { browsers, pages, isSetupReady, ticketEventQueuePS };
};

module.exports = {
  runPS3838s,
  browsers,
  pages,
  isSetupReady,
  getPages,
  getDataPS3838,
};
