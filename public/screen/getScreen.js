const _ = require("lodash");
const fuzz = require("fuzzball");
const fs = require("fs");
const { fuzzMatch } = require("../../utils/fuzzMatch");

function mergeSBOand3838() {
  let data_ps3838 = [];
  let data_Sbo = [];
  try {
    data_ps3838 = JSON.parse(
      fs.readFileSync("./data/data_ps3838.json", "utf-8"),
    );
    data_Sbo = JSON.parse(fs.readFileSync("./data/data_Sbo.json", "utf-8"));

    let dataStaleTimeInSeconds = 15;
    //only display data that is not stale
    data_Sbo = data_Sbo.filter(
      (entry) =>
        new Date() - new Date(entry.timeScraped) <
        dataStaleTimeInSeconds * 1000,
    );
    data_ps3838 = data_ps3838.filter(
      (entry) =>
        new Date() - new Date(entry.timeScraped) <
        dataStaleTimeInSeconds * 1000,
    );
  } catch {}

  let overlap = [];
  let nonOverlapSbo = [];
  let nonOverlap3838 = [...data_ps3838];
  let finalScreen = [...data_Sbo];
  for (let i = 0; i < data_Sbo.length; i++) {
    let entry = data_Sbo[i];
    let overlap3838 = data_ps3838.find(
      (entryReference) =>
        entry.sportId === entryReference.sportId &&
        entry.periodId === entryReference.periodId &&
        entry.marketId === entryReference.marketId &&
        entry.marketParam === entryReference.marketParam &&
        fuzzMatch(entry, entryReference, (minScore = 60)),
    );
    if (overlap3838) {
      overlap.push({ entry, overlap3838 });
      finalScreen[i].odds = [overlap3838.odds, entry.odds];
      finalScreen[i].homeName = [overlap3838.homeName, entry.homeName];
      finalScreen[i].awayName = [overlap3838.awayName, entry.awayName];
      _.remove(nonOverlap3838, (obj) => _.isEqual(obj, overlap3838));
    } else {
      finalScreen[i].odds = [null, entry.odds];
      finalScreen[i].homeName = ["-", entry.homeName];
      finalScreen[i].awayName = ["-", entry.awayName];
    }
  }
  for (const entry3838 of nonOverlap3838) {
    entry3838.odds = [entry3838.odds, null];
    entry3838.homeName = [entry3838.homeName, "-"];
    entry3838.awayName = [entry3838.awayName, "-"];
    finalScreen.push(entry3838);
  }

  //remove all entries which have the league name that starts with 'e-'
  finalScreen = finalScreen.filter(
    (entry) => !entry.leagueName.startsWith("e-"),
  );

  // console.log('screen length:', finalScreen.length)
  fs.writeFileSync(
    "./public/screen/finalScreen.json",
    JSON.stringify(finalScreen),
    "utf-8",
  );
}

module.exports = { mergeSBOand3838 };

//first, find overlap
// merge into one entry
//sort according to sbo teams
