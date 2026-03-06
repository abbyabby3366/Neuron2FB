const fsSync = require("fs");
const fs = require("fs").promises;
const { checkBrowserAndPage } = require("../utils/checkBrowserAndPage");
const { clearPendingBetList } = require("../utils/clearPendingBetList");
const { SBB } = require("../utils/SBB");
const { setupBookie } = require("../utils/setupBookie");
const { createTicketEventQueue } = require("../utils/createTicketEventQueue");

let browsers = {};
let pages = {};
let isSetupReady = {};
let lastStartTime = {};
let ticketEventQueueHGA = createTicketEventQueue();

// Set up accounts one by one to prevent crashing
const setupHGAs = async (args) => {
  for (const accNo of args) {
    if (!isSetupReady[`hga${accNo}`]) {
      let acc = `hga${accNo}`;
      await setupBookie(acc, browsers, pages, isSetupReady);
      lastStartTime[accNo] = new Date();
    }
  }
};

const runHGAs = async ([...args]) => {
  clearPendingBetList();
  setupHGAs(args);
  checkBrowserAndPage(
    "hga",
    isSetupReady,
    browsers,
    pages,
    lastStartTime,
    args,
  );

  //run main loop
  while (true) {
    const readyAccounts = args.filter(
      (accNo) => isSetupReady[`hga${accNo}`] === true,
    );

    if (readyAccounts.length > 0) {
      for (const accNo of readyAccounts) {
        let acc = `hga${accNo}`;
        try {
          let params = JSON.parse(
            fsSync.readFileSync(`TargetBookie/${acc}.json`, "utf-8"),
          );
          if (isSetupReady[acc] === true) {
            //check again if there is account (because of delay)
            await SBB((refAcc = "ps38380"), acc, pages, isSetupReady);
            await new Promise((resolve) =>
              setTimeout(resolve, params.msBetweenSBB),
            );
          }
        } catch (e) {
          console.log(
            `HGA - Caught error for ${acc}, continuing... Error: ${e.message}`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } else {
      // console.log('HGA - No accounts ready now');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

const getDataHGA = () => {
  return { browsers, pages, isSetupReady, ticketEventQueueHGA };
};

// const ticketingQueue = createTicketEventQueue();

module.exports = { runHGAs, browsers, pages, isSetupReady, getDataHGA };
