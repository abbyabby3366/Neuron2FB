const { EUtoEU, MYtoEU, HKtoEU, IDtoEU, UStoEU } = require("./oddsConverter");
const fsSync = require("fs");
const { ticketEventPS3838 } = require("../run/autobet/ticketPS3838");
const { ticketEventSBO } = require("../run/autobet/ticketSBO");
const { ticketEventHGA } = require("../run/autobet/ticketHGA");
const { ticketEventIBC } = require("../run/autobet/ticketIBC");
const { ticketEventISN } = require("../run/autobet/ticketISN");
const { ticketEventObet } = require("../run/autobet/ticketObet");

function createTicketEventQueue() {
  const queue = [];
  let isProcessing = false;
  let queueId = 0;

  function logQueue(acc) {
    console.log(
      `${acc} ticketting Queue status: ${queue.length} items`,
      queue.map((item) => item.id),
    );
  }

  async function enqueue(page, acc, betEvent, closeTicket, targetReference) {
    return new Promise((resolve, reject) => {
      const id = ++queueId;
      queue.push({
        id,
        page,
        acc,
        betEvent,
        closeTicket,
        targetReference,
        resolve,
        reject,
      });

      if (!isProcessing) processQueue();
    });
  }

  async function processQueue() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;
    let acc_temp;

    while (queue.length > 0) {
      let {
        id,
        page,
        acc,
        betEvent,
        closeTicket,
        targetReference,
        resolve,
        reject,
      } = queue.shift();
      logQueue(acc);
      acc_temp = acc;
      try {
        const result = await ticketEvent(
          page,
          acc,
          betEvent,
          closeTicket,
          targetReference,
        );
        resolve(result);
      } catch (error) {
        console.error(`Error processing Bet Event ${id}:`, error);
        reject(error);
      }
    }

    isProcessing = false;
    logQueue(acc_temp); // Log the queue one last time when it's empty
  }

  return { enqueue };
}

function ticketEvent(
  page,
  acc,
  betEvent,
  closeTicket = false,
  targetReference,
) {
  let params = JSON.parse(
    fsSync.readFileSync(`TargetBookie/${acc}.json`, "utf-8"),
  );
  let oddsType = params.oddsType;
  let convertToEUString;
  if (oddsType == "EU") {
    convertToEUString = EUtoEU.toString();
  } else if (oddsType == "ID") {
    convertToEUString = IDtoEU.toString();
  } else if (oddsType == "MY") {
    convertToEUString = MYtoEU.toString();
  } else if (oddsType == "HK") {
    convertToEUString = HKtoEU.toString();
  } else if (oddsType == "IN") {
    convertToEUString = IDtoEU.toString();
  } else if (oddsType == "US") {
    convertToEUString = UStoEU.toString();
  }

  if (acc.startsWith("isn"))
    return ticketEventISN(
      page,
      acc,
      betEvent,
      convertToEUString,
      closeTicket,
      targetReference,
    );
  else if (acc.startsWith("sbo"))
    return ticketEventSBO(
      page,
      acc,
      betEvent,
      convertToEUString,
      closeTicket,
      targetReference,
    );
  else if (acc.startsWith("hga"))
    return ticketEventHGA(
      page,
      acc,
      betEvent,
      convertToEUString,
      closeTicket,
      targetReference,
    );
  else if (acc.startsWith("ibc"))
    return ticketEventIBC(
      page,
      acc,
      betEvent,
      convertToEUString,
      closeTicket,
      targetReference,
    );
  else if (acc.startsWith("ps"))
    return ticketEventPS3838(
      page,
      acc,
      betEvent,
      convertToEUString,
      closeTicket,
      targetReference,
    );
  else if (acc.startsWith("obet"))
    return ticketEventObet(
      page,
      acc,
      betEvent,
      convertToEUString,
      closeTicket,
      targetReference,
    );
}

module.exports = { createTicketEventQueue };
