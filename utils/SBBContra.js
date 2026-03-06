const { checkCooldownStatus, isCoolingDownObj } = require("./isCoolingDown");
const { autoBetRestraints } = require("./autobetRestraints");
const { getProceedSBB } = require("./proceedSBB");
const { scrape: scrapeSBO } = require("../run/scrape/sbo");
const { scrape: scrapeHGA } = require("../run/scrape/hga");
const { scrape: scrapeIBC } = require("../run/scrape/ibc");
const { scrape: scrapeISN } = require("../run/scrape/isn");
const { scrape3838: scrape3838 } = require("../run/scrape/ps3838");
const { brainv2 } = require("../run/brain/brainv2");
const { autoBetSbo } = require("../run/autobet/autobetSBOContraPS3838");
// const { autoBetSbo } = require('../run/autobet/autobetSBO');
const { autoBetHGA } = require("../run/autobet/autobetHGA");
const { autoBetIbc } = require("../run/autobet/autobetIBC");
const { autoBetISN } = require("../run/autobet/autobetISN");
const { autoBetPS3838 } = require("../run/autobet/autobetPS3838");
const { autoBetObet } = require("../run/autobet/autobetObet");

const isAutoBettingObj = {};
const SBBContra = async (refAcc, acc, pages, isSetupReady) => {
  //if acc not ready, skip
  if (!isSetupReady[acc]) return console.log(`${acc} not ready yet`);
  if (isAutoBettingObj[acc])
    return console.log(`${acc} is autobetting, skipping`);

  try {
    let scrapeStatus;
    if (acc.startsWith("sbo")) scrapeStatus = await scrapeSBO(pages[acc], acc);
    if (acc.startsWith("hga")) scrapeStatus = await scrapeHGA(pages[acc], acc);
    if (acc.startsWith("ibc")) scrapeStatus = await scrapeIBC(pages[acc], acc);
    if (acc.startsWith("isn")) scrapeStatus = await scrapeISN(pages[acc], acc);
    if (acc.startsWith("ps3838"))
      scrapeStatus = await scrape3838(pages[acc], acc);
    if (acc.startsWith("obet"))
      scrapeStatus = await scrapeObet(pages[acc], acc);
    // if (!scrapeStatus.status) throw new Error(`Scrape failed in SBB for ${acc}`);

    const pendingBetList = await brainv2(refAcc, acc);

    let isCoolingDown = checkCooldownStatus(acc);
    let autoBetRestraint = await autoBetRestraints(acc, isCoolingDown);
    if (autoBetRestraint) return; // if is not on cooldown & auto bet toggle is on
    if (pendingBetList.length > 0) {
      if (acc.startsWith("sbo"))
        autoBetSbo(pages[acc], pendingBetList[0], refAcc);
      else if (acc.startsWith("hga"))
        autoBetHGA(pages[acc], pendingBetList[0], refAcc);
      else if (acc.startsWith("ibc"))
        autoBetIbc(pages[acc], pendingBetList[0], refAcc);
      else if (acc.startsWith("isn"))
        autoBetISN(pages[acc], pendingBetList[0], refAcc);
      else if (acc.startsWith("ps3838"))
        autoBetPS3838(pages[acc], pendingBetList[0], refAcc);
      else if (acc.startsWith("obet"))
        autoBetObet(pages[acc], pendingBetList[0], refAcc);

      while (true) {
        // console.log('inside while loop, waiting proceedSBB to be true', getProceedSBB());
        if (getProceedSBB()) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return console.log(
        `Autobetting ${acc} on going, can move on to next acc SBB`,
      );
    }
    return { status: true, message: "SBB done" };
  } catch (err) {
    console.log(`${acc} error in SBB:`, err);
    return { status: false, message: "SBB failed" };
  }
};

module.exports = { SBBContra, isAutoBettingObj };
