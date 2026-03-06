const { scrape: scrapeSBO } = require("../run/scrape/sbo");
const { scrape: scrapeHGA } = require("../run/scrape/hga");
const { scrape: scrapeIBC } = require("../run/scrape/ibc");
const { scrape: scrapeISN } = require("../run/scrape/isn");
const { scrape: scrapeObet } = require("../run/scrape/obet");
const { scrape3838: scrape3838 } = require("../run/scrape/ps3838");

const performScrape = async (acc, pages) => {
  const page = pages[acc];
  if (!page) return;
  if (acc.startsWith("sbo")) return await scrapeSBO(page, acc);
  if (acc.startsWith("hga")) return await scrapeHGA(page, acc);
  if (acc.startsWith("ibc")) return await scrapeIBC(page, acc);
  if (acc.startsWith("isn")) return await scrapeISN(page, acc);
  if (acc.startsWith("ps3838")) return await scrape3838(page, acc);
  if (acc.startsWith("obet")) return await scrapeObet(page, acc);
};

module.exports = { performScrape };
