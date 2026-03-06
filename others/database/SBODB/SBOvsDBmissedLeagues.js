const fs = require("fs");

function matchSBOleagueName() {
  let dataLeagueDB = JSON.parse(
    fs.readFileSync("./SBODB/output/SBOConfirmedLeagues.json"),
  );
  let leagueSBOArray = JSON.parse(
    fs.readFileSync("./SBODB/scrapedSBOLeagues.json"),
  );

  console.log("-------------SBO--------------");
  console.log(leagueSBOArray);

  const leagueDBArray = dataLeagueDB.map((el) => el.leagueName.trim());

  //check exact match
  for (const league of leagueSBOArray) {
    const index = leagueDBArray.findIndex((el) => league.includes(el));
    if (index !== -1) {
      console.log("Element found at index:", index);
    } else {
      console.log(`Element not found: ${league}`);
      //write to old file

      const readData = fs.readFileSync(
        "./SBODB/output/SBOmissedLeagues.txt",
        "utf-8",
      );
      const cells = readData.split(",");
      cells.push(league);
      const newCells = Array.from(new Set(cells));
      fs.writeFileSync(
        "./SBODB/output/SBOmissedLeagues.txt",
        newCells.toString(),
        "utf-8",
      );
    }
  }
}

module.exports = { matchSBOleagueName };

// setInterval(matchSBOleagueName,3000)
