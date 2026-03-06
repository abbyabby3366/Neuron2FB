const {
  matchIBC12betleagueName,
} = require("./IBC12betDB/IBC12betvsDBmissedLeagues");
const { match3838leagueName } = require("./3838DB/3838vsDBmissedLeagues");
const { matchSBOleagueName } = require("./SBODB/SBOvsDBmissedLeagues");

match3838leagueName();
matchSBOleagueName();
matchIBC12betleagueName();

setInterval(() => {
  match3838leagueName();
  matchSBOleagueName();
  matchIBC12betleagueName();
}, 60000);
