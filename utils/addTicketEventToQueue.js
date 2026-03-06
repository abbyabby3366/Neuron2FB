const { getCurrentTime } = require("./getCurrentTime");

async function addTicketEventToQueue(
  acc,
  betEvent,
  closeTicket,
  targetReference,
) {
  let referenceTicketData;

  const { getData2FB } = require("../run/run2FB");
  const {
    pages,
    ticketEventQueuePS,
    ticketEventQueueISN,
    ticketEventQueueSBO,
    ticketEventQueueObet,
    ticketEventQueueIBC,
    ticketEventQueueHGA,
  } = getData2FB();

  if (acc.startsWith("isn")) {
    // const { getDataISN } = require("../run/runISNs");
    // const { pages, ticketEventQueueISN } = getDataISN();
    if (!pages[acc])
      throw new Error(`${acc} page not found or not initialized`);
    console.log("Ticketing isn for new odds: " + getCurrentTime());
    referenceTicketData = await ticketEventQueueISN.enqueue(
      pages[acc],
      acc,
      betEvent,
      closeTicket,
      targetReference,
    );
  } else if (acc.startsWith("ps")) {
    // const { getDataPS3838 } = require("../run/runPS3838s");
    // const { pages, ticketEventQueuePS } = getDataPS3838();
    if (!pages[acc])
      throw new Error(`${acc} page not found or not initialized`);
    console.log("Ticketing ps3838 for new odds: " + getCurrentTime());
    referenceTicketData = await ticketEventQueuePS.enqueue(
      pages[acc],
      acc,
      betEvent,
      closeTicket,
      targetReference,
    );
  } else if (acc.startsWith("sbo")) {
    // const { getDataSBO } = require("../run/runSBOs");
    // // const { getDataSBO } = require('../run/runSurebetSBOPS3838');
    // const { pages, ticketEventQueueSBO } = getDataSBO();
    if (!pages[acc])
      throw new Error(`${acc} page not found or not initialized`);
    console.log("Ticketing sbo for new odds: " + getCurrentTime());
    referenceTicketData = await ticketEventQueueSBO.enqueue(
      pages[acc],
      acc,
      betEvent,
      closeTicket,
      targetReference,
    );
  } else if (acc.startsWith("hga")) {
    // const { getDataHGA } = require("../run/runHGAs");
    // const { pages, ticketEventQueueHGA } = getDataHGA();
    if (!pages[acc])
      throw new Error(`${acc} page not found or not initialized`);
    console.log("Ticketing hga for new odds: " + getCurrentTime());
    referenceTicketData = await ticketEventQueueHGA.enqueue(
      pages[acc],
      acc,
      betEvent,
      closeTicket,
      targetReference,
    );
  } else if (acc.startsWith("ibc")) {
    // const { getDataIBC } = require("../run/runIBCs");
    // const { pages, ticketEventQueueIBC } = getDataIBC();
    if (!pages[acc])
      throw new Error(`${acc} page not found or not initialized`);
    console.log("Ticketing ibc for new odds: " + getCurrentTime());
    referenceTicketData = await ticketEventQueueIBC.enqueue(
      pages[acc],
      acc,
      betEvent,
      closeTicket,
      targetReference,
    );
  } else if (acc.startsWith("obet")) {
    // const { getDataObet } = require("../run/runObets");
    // const { pages, ticketEventQueueObet } = getDataObet();
    if (!pages[acc])
      throw new Error(`${acc} page not found or not initialized`);
    console.log("Ticketing Obet for new odds: " + getCurrentTime());
    referenceTicketData = await ticketEventQueueObet.enqueue(
      pages[acc],
      acc,
      betEvent,
      closeTicket,
      targetReference,
    );
  }

  return referenceTicketData;
}

module.exports = { addTicketEventToQueue };
