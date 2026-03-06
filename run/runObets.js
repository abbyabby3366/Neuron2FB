const fsSync = require("fs");
const fs = require("fs").promises;
const { checkBrowserAndPage } = require("../utils/checkBrowserAndPage");
const { clearPendingBetList } = require("../utils/clearPendingBetList");
const { SBB } = require("../utils/SBB");
const { SBBContra } = require("../utils/SBBContra");
const { setupBookie } = require("../utils/setupBookie");
const { createTicketEventQueue } = require("../utils/createTicketEventQueue");

// initialise pages only once (even if i runObet multiple times)
let browsers = {};
let pages = {};
let isSetupReady = {};
let lastStartTime = {};
let ticketEventQueueObet = createTicketEventQueue();

// Set up accounts one by one to prevent crashing
const setupObets = async (args) => {
  for (const accNo of args) {
    if (!isSetupReady[`obet${accNo}`]) {
      let acc = `obet${accNo}`;
      await setupBookie(acc, browsers, pages, isSetupReady);
      lastStartTime[accNo] = new Date();
    }
  }
};

const runObets = async ([...args]) => {
  clearPendingBetList();
  setupObets(args);
  checkBrowserAndPage(
    "obet",
    isSetupReady,
    browsers,
    pages,
    lastStartTime,
    args,
  );

  //run main loop
  while (true) {
    const readyAccounts = args.filter(
      (accNo) => isSetupReady[`obet${accNo}`] === true,
    );

    if (readyAccounts.length > 0) {
      for (const accNo of readyAccounts) {
        let acc = `obet${accNo}`;
        try {
          let params = JSON.parse(
            fsSync.readFileSync(`TargetBookie/${acc}.json`, "utf-8"),
          );
          if (isSetupReady[acc] === true) {
            //check again if there is account (because of delay)
            await SBB((refAcc = "ps38380"), acc, pages, isSetupReady);
            // await SBBContra(refAcc = 'ps38380', acc, pages, isSetupReady);
            await new Promise((resolve) =>
              setTimeout(resolve, params.msBetweenSBB),
            );
          }
        } catch (e) {
          console.log(
            `Obet - Caught error for ${acc}, continuing... Error: ${e.message}`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } else {
      // console.log('Obet - No accounts ready now');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

const getDataObet = () => {
  return { browsers, pages, isSetupReady, ticketEventQueueObet };
};

module.exports = { runObets, browsers, pages, isSetupReady, getDataObet };
