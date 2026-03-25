const fs = require("fs");
const { checkBrowserAndPage } = require("../utils/checkBrowserAndPage");
const { clearPendingBetList } = require("../utils/clearPendingBetList");
const { setupBookie } = require("../utils/setupBookie");
const { createTicketEventQueue } = require("../utils/createTicketEventQueue");
const { SBB2FB } = require("../utils/SBB2FB");
const { isAccWithinOpeningHours } = require("../utils/openingHours");

let browsers = {};
let pages = {};
let isSetupReady = {};
let lastStartTime = {};
let ticketEventQueuePS = createTicketEventQueue();
let ticketEventQueueISN = createTicketEventQueue();
let ticketEventQueueSBO = createTicketEventQueue();
let ticketEventQueueIBC = createTicketEventQueue();
let ticketEventQueueObet = createTicketEventQueue();
let ticketEventQueueHGA = createTicketEventQueue();

// Set up accounts one by one
const setup2FB = async (accounts, delaySeconds = 0, fb2ConfigId = "") => {
  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    if (!isSetupReady[acc]) {
      // Check opening hours before setup
      if (!isAccWithinOpeningHours(acc, fb2ConfigId)) {
        console.log(`[HOURS] ${acc} outside opening hours, skipping setup`);
        continue;
      }
      // Delay between accounts (skip delay for the first one)
      if (i > 0 && delaySeconds > 0) {
        console.log(`Waiting ${delaySeconds}s before setting up ${acc}...`);
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }
      isSetupReady[acc] = "ongoing";
      await setupBookie(acc, browsers, pages, isSetupReady);
      lastStartTime[acc] = new Date();
    }
  }
};

const run2FB = async (args) => {
  try {
    const fb2ConfigId = args[0];
    const configPath = `TargetBookie/2fb${fb2ConfigId}.json`;

    if (!fs.existsSync(configPath)) {
      console.error(`Config file not found: ${configPath}`);
      return;
    }

    // Initial Config Load
    let config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    console.log(`Loaded 2FB config (${fb2ConfigId}):`, config);

    const targetAccsGroup = config.targetAccsGroup || [];
    const referenceAccsGroup = config.referenceAccsGroup || [];
    console.log("Setting up target accounts:", targetAccsGroup);
    console.log("Setting up reference accounts:", referenceAccsGroup);

    clearPendingBetList();

    // Setup accounts in two separate queues (target and reference) in background
    const setupDelay = config.delayBetweenSetupInSeconds || 0;
    setup2FB(targetAccsGroup, setupDelay, fb2ConfigId);
    setup2FB(referenceAccsGroup, setupDelay, fb2ConfigId);
    checkBrowserAndPage("", isSetupReady, browsers, pages, lastStartTime, [
      ...targetAccsGroup,
      ...referenceAccsGroup,
    ], fb2ConfigId);

    // Main Loop
    while (true) {
      // Live config reload
      try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch (e) {}

      if (!config.run) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      const readyTargets = targetAccsGroup.filter(
        (targetAcc) => isSetupReady[targetAcc] === true,
      );

      if (readyTargets.length > 0) {
        for (const targetAcc of readyTargets) {
          try {
            if (isSetupReady[targetAcc]) {
              // Skip if outside opening hours
              if (!isAccWithinOpeningHours(targetAcc, fb2ConfigId)) {
                continue;
              }
              // Run SBB2FB
              await SBB2FB(
                targetAcc,
                referenceAccsGroup,
                pages,
                isSetupReady,
                fb2ConfigId,
              );

              const delay = config.msBetweenSBB2FB || 0;
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          } catch (e) {
            console.error(`Error processing ${targetAcc}:`, e);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      } else {
        // Global loop delay when no accounts are ready
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error("Error in run2FB:", error);
  }
};

const getPages = () => {
  return pages;
};

const getData2FB = () => {
  return {
    browsers,
    pages,
    isSetupReady,
    ticketEventQueuePS,
    ticketEventQueueISN,
    ticketEventQueueSBO,
    ticketEventQueueIBC,
    ticketEventQueueObet,
    ticketEventQueueHGA,
  };
};

module.exports = {
  run2FB,
  browsers,
  pages,
  isSetupReady,
  getPages,
  getData2FB,
};
