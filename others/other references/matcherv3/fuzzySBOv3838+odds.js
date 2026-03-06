const fs = require("fs");
const Fuse = require("fuse.js");

function valueBets() {
  console.time("SBOvs3838matcher");

  let rawdata = fs.readFileSync("dataSBO.json");
  let dataSBO = JSON.parse(rawdata);
  let rawdata2 = fs.readFileSync("data3838.json");
  let data3838 = JSON.parse(rawdata2);

  //remove these leagues
  dataSBO = dataSBO.filter((obj) => {
    const hasString1 = obj.leagueName.includes("e-Football");
    const hasString2 = obj.leagueName.includes(
      "Which team will advance to next round",
    );
    const hasString3 = obj.leagueName.includes("3rd Place Winner");
    return !hasString1 && !hasString2 && !hasString3;
  });

  const keys = [
    { name: "leagueName", weight: 2 },
    { name: "homeTeam", weight: 1 },
    { name: "awayTeam", weight: 1 },
  ];
  const threshold = 0.9;

  for (let i = 0; i < dataSBO.length; i++) {
    const searchTerm = {
      leagueName: dataSBO[i].leagueName,
      homeTeam: dataSBO[i].homeTeam,
      awayTeam: dataSBO[i].awayTeam,
    };

    const fuse = new Fuse(data3838, {
      keys: keys,
      threshold: threshold,
      // Custom scoring function to consider all properties
      scoreFn: function (match) {
        return match.score; // Use the default score for overall match
      },
    });

    const results2 =
      fuse.search(searchTerm).length !== 0
        ? fuse.search(searchTerm)[0].item
        : {};

    //console.log(i,' SBO :',dataSBO[i],'|| Pin: ',results2)
    const [sboHome, sboAway] = getDNBNVodds(
      dataSBO[i].homeWin,
      dataSBO[i].awayWin,
    );
    const [ps3838Home, ps3838Away] = getDNBNVodds(
      results2.homeWin,
      results2.awayWin,
    );

    //console.log(sboHome)
    /* SUREBET
  if(compare2outcomes(sboHome,ps3838Away)) {
    console.log(i,'SBO Home',dataSBO[i].homeTeam,sboHome,'|| 3838 Away',results2.awayTeam,ps3838Away);
    console.log(dataSBO[i],results2)
  }
  if(compare2outcomes(sboAway,ps3838Home)) {
    console.log(i,'SBO Away',dataSBO[i].awayTeam,sboAway,'|| 3838 Home',results2.homeTeam,ps3838Home);
    console.log(dataSBO[i],results2)
  }*/

    //VALUEBET
    const [ps3838HomeNV, ps3838AwayNV, ps3838DrawNV] = get3WayNoVig(
      results2.homeWin,
      results2.awayWin,
      results2.draw,
    );

    const minOvervalue = -0.03;
    //compare SBO to 3838
    if (dataSBO[i].homeWin / ps3838HomeNV - 1 > minOvervalue) {
      const overvalue = (dataSBO[i].homeWin / ps3838HomeNV - 1) * 100;
      console.log(
        i,
        `SBO HOME overvalue by ${overvalue.toFixed(2)}% `,
        dataSBO[i],
      );
      console.log("3838 Home no vig odds = ", ps3838HomeNV.toFixed(2));
      console.log(results2);
    }

    if (dataSBO[i].awayWin / ps3838AwayNV - 1 > minOvervalue) {
      const overvalue = (dataSBO[i].awayWin / ps3838AwayNV - 1) * 100;
      console.log(
        i,
        `SBO Away overvalue by ${overvalue.toFixed(2)}% `,
        dataSBO[i],
      );
      console.log("3838 Away no vig odds = ", ps3838AwayNV.toFixed(2));
      console.log(results2);
    }

    if (dataSBO[i].draw / ps3838DrawNV - 1 > minOvervalue) {
      const overvalue = (dataSBO[i].draw / ps3838DrawNV - 1) * 100;
      console.log(
        i,
        `SBO Draw overvalue by ${overvalue.toFixed(2)}% `,
        dataSBO[i],
      );
      console.log("3838 Draw no vig odds = ", ps3838DrawNV.toFixed(2));
      console.log(results2);
    }
  }

  console.timeEnd("SBOvs3838matcher");
}

function getDNBNVodds(homeWin, awayWin) {
  const abc = 1 / homeWin + 1 / awayWin;
  const homeWin2 = homeWin * abc * 0.95;
  const awayWin2 = awayWin * abc * 0.95;
  return [homeWin2, awayWin2];
}

function compare2outcomes(home, away) {
  if (1 / (1 / home + 1 / away) >= 0.98) {
    return true;
  } else {
    return false;
  }
}

function get3WayNoVig(homeWin, awayWin, draw) {
  //assuming all equal vig
  const vigPlusOne = 1 / homeWin + 1 / awayWin + 1 / draw;
  return [homeWin * vigPlusOne, awayWin * vigPlusOne, draw * vigPlusOne];
}

setInterval(valueBets, 3000);
