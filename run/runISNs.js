const fsSync = require("fs");
const fs = require("fs").promises;
const { checkBrowserAndPage } = require("../utils/checkBrowserAndPage");
const { setupBookie } = require("../utils/setupBookie");
const { SBB } = require("../utils/SBB");
const { clearPendingBetList } = require("../utils/clearPendingBetList");
const { createTicketEventQueue } = require("../utils/createTicketEventQueue");

let browsers = {};
let pages = {};
let isSetupReady = {};
let lastStartTime = {};
let ticketEventQueueISN = createTicketEventQueue();

// Set up accounts one by one to prevent crashing
const setupISNs = async (args) => {
  for (const accNo of args) {
    if (!isSetupReady[`isn${accNo}`]) {
      let acc = `isn${accNo}`;
      await setupBookie(acc, browsers, pages, isSetupReady);
      lastStartTime[accNo] = new Date();
    }
  }
};

const runISNs = async ([...args]) => {
  clearPendingBetList();
  setupISNs(args);
  checkBrowserAndPage(
    "isn",
    isSetupReady,
    browsers,
    pages,
    lastStartTime,
    args,
  );

  //run main loop
  while (true) {
    const readyAccounts = args.filter(
      (accNo) => isSetupReady[`isn${accNo}`] === true,
    );

    if (readyAccounts.length > 0) {
      for (const accNo of readyAccounts) {
        let acc = `isn${accNo}`;

        try {
          let params = JSON.parse(
            fsSync.readFileSync(`TargetBookie/${acc}.json`, "utf-8"),
          );
          if (isSetupReady[acc] === true) {
            await SBB("ps38380", acc, pages, isSetupReady);
            await new Promise((resolve) =>
              setTimeout(resolve, params.msBetweenSBB),
            );
          }
        } catch (e) {
          console.log(
            `ISN - Caught error for ${acc}, continuing... Error: ${e.message}`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } else {
      // console.log('ISN - No accounts ready now');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

const getDataISN = () => {
  return { browsers, pages, isSetupReady, ticketEventQueueISN };
};

module.exports = { runISNs, browsers, pages, isSetupReady, getDataISN };
