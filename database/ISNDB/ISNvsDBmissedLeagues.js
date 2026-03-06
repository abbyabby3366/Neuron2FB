const fs = require("fs");

function matchISNleagueName() {
  let dataLeagueDB = JSON.parse(
    fs.readFileSync("./ISNDB/output/ISNConfirmedLeagues.json"),
  );
  let leagueISNArray = JSON.parse(
    fs.readFileSync("./ISNDB/scrapedISNLeagues.json"),
  );

  console.log("-------------ISN--------------");
  console.log(leagueISNArray);

  const leagueDBArray = dataLeagueDB.map((el) => el.leagueName.trim());

  //check exact match
  for (const league of leagueISNArray) {
    const index = leagueDBArray.findIndex((el) => league.includes(el));
    if (index !== -1) {
      console.log("Element found at index:", index);
    } else {
      console.log(`Element not found: ${league}`);
      //write to old file

      const readData = fs.readFileSync(
        "./ISNDB/output/ISNmissedLeagues.txt",
        "utf-8",
      );
      const cells = readData.split(",");
      cells.push(league);
      const newCells = Array.from(new Set(cells));
      fs.writeFileSync(
        "./ISNDB/output/ISNmissedLeagues.txt",
        newCells.toString(),
        "utf-8",
      );
    }
  }
}

module.exports = { matchISNleagueName };

// setInterval(matchISNleagueName,3000)
