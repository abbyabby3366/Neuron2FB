console.time("SBOvs3838matcher");
const fs = require("fs");
const Fuse = require("fuse.js");

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
const threshold = 0.6;

for (let i = 0; i < dataSBO.length; i++) {
  const searchTerm = {
    leagueName: dataSBO[i].leagueName,
    homeTeam: dataSBO[i].homeTeam,
    awayTeam: dataSBO[i].awayTeam,
  };

  const fuse = new Fuse(data3838, {
    keys: keys,
    threshold: threshold, //btw threshold here, 0.0 means completely exact match, 1.0 means will match anything

    // Custom scoring function to consider all properties
    // punat can ignore this first, i just copy gpt
    scoreFn: function (match) {
      return match.score; // Use the default score for overall match
    },
  });

  const results2 =
    fuse.search(searchTerm).length !== 0 ? fuse.search(searchTerm)[0].item : {};
  console.log(
    i,
    " SBO :",
    searchTerm.leagueName,
    searchTerm.homeTeam,
    searchTerm.awayTeam,
    "|| Pin: ",
    results2.leagueName,
    results2.homeTeam,
    results2.awayTeam,
  );
}

console.timeEnd("SBOvs3838matcher");
