const fsSync = require("fs");
const fs = require("fs").promises;
const { checkBrowserAndPage } = require("../utils/checkBrowserAndPage");
const { clearPendingBetList } = require("../utils/clearPendingBetList");
const { SBB } = require("../utils/SBB");
const { SBBContra } = require("../utils/SBBContra");
const { SBBSurebet } = require("../utils/SBBSurebet");
const { setupBookie } = require("../utils/setupBookie");
const { createTicketEventQueue } = require("../utils/createTicketEventQueue");
const { surebetSBOPS3838 } = require("../run/autobet/surebetSBOPS3838");

//running SBO includes scrapeBrainBet
// initialise pages only once (even if i runSBO multiple times)
let browsers = {};
let pages = {};
let isSetupReady = {};
let lastStartTime = {};
let ticketEventQueueSBO = createTicketEventQueue();

// Set up accounts one by one to prevent crashing
const setupSBOs = async (args) => {
  for (const accNo of args) {
    if (!isSetupReady[`sbo${accNo}`]) {
      let acc = `sbo${accNo}`;
      await setupBookie(acc, browsers, pages, isSetupReady);
      lastStartTime[accNo] = new Date();
    }
  }
};

const runSurebetSBOPS3838 = async ([...args]) => {
  clearPendingBetList();
  setupSBOs(args);
  checkBrowserAndPage(
    "sbo",
    isSetupReady,
    browsers,
    pages,
    lastStartTime,
    args,
  );

  //run main loop
  while (true) {
    const readyAccounts = args.filter(
      (accNo) => isSetupReady[`sbo${accNo}`] === true,
    );

    if (readyAccounts.length > 0) {
      for (const accNo of readyAccounts) {
        let acc = `sbo${accNo}`;
        try {
          let params = JSON.parse(
            fsSync.readFileSync(`TargetBookie/${acc}.json`, "utf-8"),
          );
          if (isSetupReady[acc] === true) {
            //check again if there is account (because of delay)
            // await SBB(refAcc = 'ps38380', acc, pages, isSetupReady);
            // await SBBContra(refAcc = 'ps38380', acc, pages, isSetupReady);

            await SBBSurebet((refAcc = "ps38380"), acc, pages, isSetupReady);
            await new Promise((resolve) =>
              setTimeout(resolve, params.msBetweenSBB),
            );
          }
        } catch (e) {
          console.log(
            `SBO - Caught error for ${acc}, continuing... Error: ${e}`,
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

const getDataSBO = () => {
  return { browsers, pages, isSetupReady, ticketEventQueueSBO };
};

module.exports = {
  runSurebetSBOPS3838,
  browsers,
  pages,
  isSetupReady,
  getDataSBO,
};
