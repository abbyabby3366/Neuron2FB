const { checkCooldownStatus } = require("./isCoolingDown");
const { autoBetRestraints } = require("./autobetRestraints");
const { getProceedSBB, setProceedSBB } = require("../utils/proceedSBB");
const { performScrape } = require("./performScrape");

const { brain2FB } = require("../run/brain/brain2FB");
const { autoBetSbo } = require("../run/autobet/autobetSBO2FB");
const { autoBetHGA } = require("../run/autobet/autobetHGA");
const { autoBetIbc } = require("../run/autobet/autobetIBC");
const { autoBetISN } = require("../run/autobet/autobetISN");
const { autoBetObet } = require("../run/autobet/autobetObet");
const { autoBetPS3838 } = require("../run/autobet/autobetPS3838");
const _ = require("lodash");
const { deleteData, writeData } = require("../mongodb/db");
const fs = require("fs");

const isAutoBettingObj = {};
const configCooldownObj = {};
//Automated betting by scraping reference accounts, braining and executing bets on ONE target account.
const SBB2FB = async (
  targetAcc,
  referenceAccsGroup,
  pages,
  isSetupReady,
  fb2ConfigId,
) => {
  // if targetAcc not ready, skip
  if (!isSetupReady[targetAcc])
    return console.log(`${targetAcc} not ready yet`);
  if (isAutoBettingObj[targetAcc])
    return console.log(`${targetAcc} is autobetting, skipping`);

  try {
    await performScrape(targetAcc, pages);

    // 2. Iterate through Reference Accounts and collect ALL bets
    let allPendingBets = [];
    for (const referenceAcc of referenceAccsGroup) {
      if (!isSetupReady[referenceAcc] || isAutoBettingObj[referenceAcc])
        continue;

      await performScrape(referenceAcc, pages);

      const pairBets = await brain2FB(targetAcc, referenceAcc, fb2ConfigId);
      if (pairBets && pairBets.length > 0) {
        allPendingBets.push(...pairBets);
      }
    }

    // 3. Sort by overvalue (highest first) and update DB
    allPendingBets = _.orderBy(allPendingBets, ["overvalue"], ["desc"]);

    await deleteData("pendingBetList", { "target.acc": targetAcc });
    if (allPendingBets.length > 0) {
      await writeData("pendingBetList", allPendingBets);
    }

    // 4. Console log summary (optional but helpful)
    try {
      const config = JSON.parse(
        fs.readFileSync(`./TargetBookie/2fb${fb2ConfigId}.json`, "utf-8"),
      );
      if (config.brainParams?.consoleLogPendingBetList) {
        console.log(
          `${targetAcc} vs [${referenceAccsGroup.join(", ")}] -------------- TOTAL PENDING BETS: ${allPendingBets.length} -----------`,
        );
      }
    } catch (e) {}

    // 5. Place the SINGLE best bet
    if (allPendingBets.length > 0) {
      // Check config-level cooldown
      if (configCooldownObj[fb2ConfigId]) {
        console.log(`2fb${fb2ConfigId} config is cooling down, skipping`);
        return;
      }

      let isCoolingDown = checkCooldownStatus(targetAcc);
      console.log("isCoolingDown", isCoolingDown);
      if (isCoolingDown) return;
      console.log("targetAcc", targetAcc);

      // Check autobet from 2fb config
      const fb2Config = JSON.parse(
        fs.readFileSync(`./TargetBookie/2fb${fb2ConfigId}.json`, "utf-8"),
      );
      const isFb2AutobetDisabled = !fb2Config.autobet;

      let autoBetRestraint = await autoBetRestraints(
        targetAcc,
        isCoolingDown,
        isFb2AutobetDisabled,
      );
      console.log("isCoolingDown", isCoolingDown);
      console.log("isFb2AutobetDisabled", isFb2AutobetDisabled);
      console.log("autoBetRestraint", autoBetRestraint);
      if (autoBetRestraint) return;

      const bestBet = allPendingBets[0];
      const targetSide = bestBet.target;
      const referenceSide = bestBet.reference;
      const refAcc = referenceSide.acc;

      console.log(
        `Found best bet: ${targetAcc} (${targetSide.odds}) vs ${refAcc} (${referenceSide.odds}) | EV: ${bestBet.overvalue}`,
      );

      // Reset proceed flag before betting
      setProceedSBB(false);

      // Bet on Target account
      const sbKey = fb2Config.successBetListKey;
      if (targetAcc.startsWith("sbo"))
        autoBetSbo(pages[targetAcc], targetSide, refAcc, sbKey, fb2ConfigId);
      if (targetAcc.startsWith("hga"))
        autoBetHGA(pages[targetAcc], targetSide, refAcc, sbKey);
      if (targetAcc.startsWith("ibc"))
        autoBetIbc(pages[targetAcc], targetSide, refAcc, sbKey);
      if (targetAcc.startsWith("isn"))
        autoBetISN(pages[targetAcc], targetSide, refAcc, sbKey);
      if (targetAcc.startsWith("ps3838"))
        autoBetPS3838(pages[targetAcc], targetSide, refAcc, sbKey);
      if (targetAcc.startsWith("obet"))
        autoBetObet(pages[targetAcc], targetSide, refAcc, sbKey);

      // Bet on Reference account
      // if (refAcc.startsWith("sbo"))
      //   autoBetSbo(pages[refAcc], referenceSide, targetAcc);
      // if (refAcc.startsWith("hga"))
      //   autoBetHGA(pages[refAcc], referenceSide, targetAcc);
      // if (refAcc.startsWith("ibc"))
      //   autoBetIbc(pages[refAcc], referenceSide, targetAcc);
      // if (refAcc.startsWith("isn"))
      //   autoBetISN(pages[refAcc], referenceSide, targetAcc);
      // if (refAcc.startsWith("ps3838"))
      //   autoBetPS3838(pages[refAcc], referenceSide, targetAcc);
      // if (refAcc.startsWith("obet"))
      //   autoBetObet(pages[refAcc], referenceSide, targetAcc);

      while (true) {
        if (getProceedSBB()) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      console.log(`SBB2FB Autobetting ${targetAcc} vs ${refAcc} done.`);

      return { status: true, message: "SBB2FB best bet placed" };
    }
    return { status: true, message: "SBB2FB done (no bets)" };
  } catch (error) {
    console.error(`Error in SBB2FB for ${targetAcc}:`, error);
    return { status: false, message: "SBB2FB failed" };
  }
};

module.exports = { SBB2FB, isAutoBettingObj, configCooldownObj };
