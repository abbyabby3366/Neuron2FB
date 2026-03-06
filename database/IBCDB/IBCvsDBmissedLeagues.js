const fs = require("fs");

function matchIBCleagueName() {
  let dataLeagueDB = JSON.parse(
    fs.readFileSync("./IBCDB/output/IBCConfirmedLeagues.json"),
  );
  let leagueIBCArray = JSON.parse(
    fs.readFileSync("./IBCDB/scrapedIBCLeagues.json"),
  );

  console.log("-------------IBC--------------");
  console.log(leagueIBCArray);

  const leagueDBArray = dataLeagueDB.map((el) => el.leagueName.trim());

  //check exact match
  for (const league of leagueIBCArray) {
    const index = leagueDBArray.findIndex((el) => league.includes(el));
    if (index !== -1) {
      console.log("Element found at index:", index);
    } else {
      console.log(`Element not found: ${league}`);
      //write to old file

      const readData = fs.readFileSync(
        "./IBCDB/output/IBCmissedLeagues.txt",
        "utf-8",
      );
      const cells = readData.split(",");
      cells.push(league);
      const newCells = Array.from(new Set(cells));
      fs.writeFileSync(
        "./IBCDB/output/IBCmissedLeagues.txt",
        newCells.toString(),
        "utf-8",
      );
    }
  }
}

module.exports = { matchIBCleagueName };

// setInterval(matchIBCleagueName,3000)
