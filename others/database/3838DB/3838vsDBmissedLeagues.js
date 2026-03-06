const fs = require("fs");

function match3838leagueName() {
  let dataLeagueDB = JSON.parse(
    fs.readFileSync("./3838DB/output/3838ConfirmedLeagues.json"),
  );
  let league3838Array = JSON.parse(
    fs.readFileSync("./3838DB/scraped3838Leagues.json"),
  );

  console.log("-------------3838--------------");
  console.log(league3838Array);

  const leagueDBArray = dataLeagueDB.map((el) => el.leagueName.trim());

  //check exact match
  for (const league of league3838Array) {
    const index = leagueDBArray.findIndex((el) => league.includes(el));
    if (index !== -1) {
      console.log("Element found at index:", index);
    } else {
      console.log(`Element not found: ${league}`);
      //write to old file

      const readData = fs.readFileSync(
        "./3838DB/output/3838missedLeagues.txt",
        "utf-8",
      );
      const cells = readData.split(",");
      cells.push(league);
      const cells2 = cells.map((el) => el.split(/ Group/gi)[0]);
      const newCells = Array.from(new Set(cells2));
      fs.writeFileSync(
        "./3838DB/output/3838missedLeagues.txt",
        newCells.toString(),
        "utf-8",
      );
    }
  }
}

module.exports = { match3838leagueName };

// setInterval(match3838leagueName,3000)
