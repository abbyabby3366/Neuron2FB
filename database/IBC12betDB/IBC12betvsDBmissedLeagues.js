const fs = require("fs");

function matchIBC12betleagueName() {
  let dataLeagueDB = JSON.parse(
    fs.readFileSync("./IBC12betDB/output/IBC12betConfirmedLeagues.json"),
  );
  let leagueIBC12betArray = JSON.parse(
    fs.readFileSync("./IBC12betDB/scrapedIBC12betLeagues.json"),
  );

  console.log("-------------IBC12bet--------------");
  console.log(leagueIBC12betArray);

  const leagueDBArray = dataLeagueDB.map((el) => el.leagueName.trim());

  //check exact match
  for (const league of leagueIBC12betArray) {
    const index = leagueDBArray.findIndex((el) => league.includes(el));
    if (index !== -1) {
      console.log("Element found at index:", index);
    } else {
      console.log(`Element not found: ${league}`);
      //write to old file

      const readData = fs.readFileSync(
        "./IBC12betDB/output/IBC12betmissedLeagues.txt",
        "utf-8",
      );
      const cells = readData.split(",");
      cells.push(league);
      const newCells = Array.from(new Set(cells));
      fs.writeFileSync(
        "./IBC12betDB/output/IBC12betmissedLeagues.txt",
        newCells.toString(),
        "utf-8",
      );
    }
  }
}

module.exports = { matchIBC12betleagueName };

// setInterval(matchIBC12betleagueName,3000)
