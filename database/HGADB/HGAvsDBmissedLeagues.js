const fs = require("fs");

function matchHGAleagueName() {
  let dataLeagueDB = JSON.parse(
    fs.readFileSync("./HGADB/output/HGAConfirmedLeagues.json"),
  );
  let leagueHGAArray = JSON.parse(
    fs.readFileSync("./HGADB/scrapedHGALeagues.json"),
  );

  console.log("-------------HGA--------------");
  console.log(leagueHGAArray);

  const leagueDBArray = dataLeagueDB.map((el) => el.leagueName.trim());

  //check exact match
  for (const league of leagueHGAArray) {
    const index = leagueDBArray.findIndex((el) => league.includes(el));
    if (index !== -1) {
      console.log("Element found at index:", index);
    } else {
      console.log(`Element not found: ${league}`);
      //write to old file

      const readData = fs.readFileSync(
        "./HGADB/output/HGAmissedLeagues.txt",
        "utf-8",
      );
      const cells = readData.split(",");
      cells.push(league);
      const newCells = Array.from(new Set(cells));
      fs.writeFileSync(
        "./HGADB/output/HGAmissedLeagues.txt",
        newCells.toString(),
        "utf-8",
      );
    }
  }
}

module.exports = { matchHGAleagueName };

// setInterval(matchHGAleagueName,3000)
