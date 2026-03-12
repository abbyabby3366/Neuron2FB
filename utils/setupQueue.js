const { setupBookie } = require("../utils/setupBookie");

const setupQueue = [];
let isProcessingQueue = false;

const processSetupQueue = async () => {
  if (isProcessingQueue || setupQueue.length === 0) return;

  isProcessingQueue = true;
  console.log("setupQueue", setupQueue);
  const { acc, resolve } = setupQueue.shift();

  try {
    let getData;
    console.log(`Setting up ${acc} now from queue`);
    const { getData2FB } = require("../run/run2FB");
    getData = getData2FB;
    // if (acc.startsWith("sbo")) {
    //   const { getDataSBO } = require("../run/runSBOs");
    //   getData = getDataSBO;
    // } else if (acc.startsWith("ibc")) {
    //   const { getDataIBC } = require("../run/runIBCs");
    //   getData = getDataIBC;
    // } else if (acc.startsWith("hga")) {
    //   const { getDataHGA } = require("../run/runHGAs");
    //   getData = getDataHGA;
    // } else if (acc.startsWith("isn")) {
    //   const { getDataISN } = require("../run/runISNs");
    //   getData = getDataISN;
    // } else if (acc.startsWith("ps")) {
    //   const { getDataPS3838 } = require("../run/runPS3838s");
    //   getData = getDataPS3838;
    // } else if (acc.startsWith("obet")) {
    //   const { getDataObet } = require("../run/runObets");
    //   getData = getDataObet;
    // }

    const { browsers, pages, isSetupReady } = getData();
    setupBookie(acc, browsers, pages, isSetupReady); //can add await here, if dont want to run in parallel
    resolve();
  } catch (error) {
    console.error(`Error in setupSBO for ${acc}:`, error);
  } finally {
    isProcessingQueue = false;
    processSetupQueue(); // Process next item in queue
  }
};

const queueSetup = (acc) => {
  return new Promise((resolve) => {
    setupQueue.push({ acc, resolve });
    processSetupQueue();
  });
};

module.exports = { queueSetup };
