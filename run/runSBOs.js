const fsSync = require("fs");
const fs = require("fs").promises;
const { checkBrowserAndPage } = require("../utils/checkBrowserAndPage");
const { clearPendingBetList } = require("../utils/clearPendingBetList");
const { SBB } = require("../utils/SBB");
const { SBBContra } = require("../utils/SBBContra");
const { SBBContraTwoAccounts } = require("../utils/SBBSurebet");
const { setupBookie } = require("../utils/setupBookie");
const { createTicketEventQueue } = require("../utils/createTicketEventQueue");

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

const runSBOs = async ([...args]) => {
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
            await SBB((refAcc = "ps38380"), acc, pages, isSetupReady);
            // await SBBContra(refAcc = 'ps38380', acc, pages, isSetupReady);
            // await SBBContraTwoAccounts(refAcc = 'ps38380', acc, pages, isSetupReady);
            await new Promise((resolve) =>
              setTimeout(resolve, params.msBetweenSBB),
            );
          }
        } catch (e) {
          console.log(
            `SBO - Caught error for ${acc}, continuing... Error: ${e.message}`,
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

async function extractTableData(page, accNo) {
  try {
    await page.evaluate(() => {
      document
        .querySelector(
          "#shared-component > header > div.csaHeader-area > div > div.csaHeader-content-top > ul > li:nth-child(2) > a",
        )
        .click();
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await page.waitForSelector(".statement-date", { timeout: 3000 });

    // Extract the data using page.evaluate
    const tableData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".statement-item"));
      return rows.map((row) => {
        const date = row.querySelector(".statement-date").innerText;
        const remark = row.querySelector(".statement-remark").innerText;
        const winLoss = row.querySelector(".statement-item-number").innerText;
        const commission = row.querySelectorAll(".statement-item-number")[1]
          .innerText;
        const runningTotal = row.querySelectorAll(".statement-item-number")[2]
          .innerText;

        return { date, remark, winLoss, commission, runningTotal };
      });
    });

    console.table(tableData);
    fsSync.writeFileSync(
      `TargetBookie/statementSBO${accNo}.json`,
      JSON.stringify(tableData.reverse()),
    );

    return tableData;
  } catch (error) {
    console.log(`Error in extractTableData for ${accNo}:`, error);
  }
}

const getDataSBO = () => {
  return { browsers, pages, isSetupReady, ticketEventQueueSBO };
};

module.exports = { runSBOs, browsers, pages, isSetupReady, getDataSBO };
