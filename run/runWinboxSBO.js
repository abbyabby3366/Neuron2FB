const fsSync = require("fs");
const fs = require("fs").promises;

const { autoBetRestraints } = require("../utils/autobetRestraints");
const { launchWinboxSBO } = require("./setup/winboxSbo/launch");
const { login } = require("./setup/winboxSbo/login");
// const { setupPage } = require('./setup/winboxSbo/setup');
// const { scrape } = require('./scrape/sbo');
// const { brain } = require('./brain/brain');
// const { autoBetSbo } = require('./autobet/autobetSbo');
// const { checkCooldownStatus, isCoolingDownObj } = require('../utils/isCoolingDown');
// const { startSession, readData, writeData, updateData, deleteData } = require('../mongodb/db');

let pages = {};

const runWinboxSBO = async (accNo) => {
  let acc = `winboxsbo${accNo}`;

  try {
    browser3 = await launchWinboxSBO(acc); //browser2
    let startTime = Date.now();

    try {
      const user = userAccountList[accNo];
      console.log("SBO Login Credential: ", accNo, user.username);

      let defaultPage = await browser3.newPage();
      // pages[acc] = page;
      await login(defaultPage, browser3, user);
      // await setupPage(page);

      // let intervalId = setInterval(async () => {
      //   await scrape(page, acc);
      //   const pendingBetList = await brain(acc);
      //   await fs.writeFile('pendingBetList_sbo.json', JSON.stringify(pendingBetList ?? []));

      //   let isCoolingDown = checkCooldownStatus(acc);
      //   let autoBetRestraint = await autoBetRestraints(acc, isCoolingDown);
      //   if (autoBetRestraint) return; // if is not on cooldown & auto bet toggle is on

      //   if (pendingBetList.length > 0) {
      //     await autoBetSbo(page, pendingBetList[0])
      //   }
      //   // mergeSBOand3838();
      // }, 2000); // 2 seconds interval

      // // Wait for the full restart interval
      // let restartInterval = JSON.parse(fsSync.readFileSync(`TargetBookie/${acc}.json`)).targetBrowserRestartIntervalInMins;
      // let randomWait = Math.floor(Math.random() * 3) - 1; //-1-2
      // await new Promise(resolve => setTimeout(resolve, (restartInterval + randomWait) * 60 * 1000));

      // clearInterval(intervalId);
    } catch (err) {
      console.log(err);
      // console.error('Error in runSBO:', ' likely proxy error');
      // const elapsedTime = (Date.now() - startTime) / 1000; // in seconds
      // if (elapsedTime < 15 * 60) { // If error occurred before 15 minutes
      //   // await checkProxyAndNotify(credentials.SBOProxy, err);
      //   console.log('Time elasped less than 15 minutes');
      // }
    } finally {
      // console.log(`SBO - Restarting after ${restartInterval} minutes....`);
      // await browser.close();
    }

    // let randomTime = Math.floor(Math.random() * 10) + 10; //10-20
    // console.log('Restaring now, waiting for ' + randomTime + ' random seconds');
    // await new Promise(resolve => setTimeout(resolve, randomTime * 1000));
  } catch (err) {
    console.log("Error in main > runWinboxSBO", err);
  }
};

module.exports = { runWinboxSBO, pages };
