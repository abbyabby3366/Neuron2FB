const fs = require("fs");
const _ = require("lodash");
const fuzz = require("fuzzball");
const Papa = require("papaparse");

let HGALeaguesArray = JSON.parse(fs.readFileSync("scrapedHGALeagues.json"));
let DBLeagues = JSON.parse(
  fs.readFileSync("../neuronDB/output/leagueJSONDB.json"),
);
let HGAConfirmedLeagues = JSON.parse(
  fs.readFileSync("./output/HGAConfirmedLeagues.json"),
);

//remove useless leagues for now
_.remove(HGALeaguesArray, (el) => el.includes("e-Football"));
_.remove(HGALeaguesArray, (el) => el.includes("Winner"));
_.remove(HGALeaguesArray, (el) => el.includes("WINNER"));
_.remove(HGALeaguesArray, (el) => el.includes("Which team"));

//remove confirmed leagues from Array of ALL HGA leagues
for (let HGAConfirmedObj of HGAConfirmedLeagues) {
  _.remove(HGALeaguesArray, (el) => el.includes(HGAConfirmedObj.leagueName));
}

fs.writeFileSync("output/HGAUnconfirmed.json", JSON.stringify(HGALeaguesArray));
console.log("HGAUnconfirmed.json file written");

//remove confirmed leagues from NeuronDB to avoid repeat
for (let HGAConfirmedObj of HGAConfirmedLeagues) {
  _.remove(DBLeagues, (el) => el.leagueId === HGAConfirmedObj.leagueId);
}

let scoreThreshold = -100;
let i = 0;
let highestScore = scoreThreshold + 1;
let HGALeagueToBeRemoved;
let DBLeagueToBeRemoved;
while (highestScore > scoreThreshold) {
  i++;
  highestScore = scoreThreshold;

  for (let HGALeague of HGALeaguesArray) {
    var query = HGALeague.replace(/playoff/i, "").replace(/-/gi, "");
    var choices = DBLeagues;
    var options = {
      scorer: fuzz.token_set_ratio, // any function that takes two values and returns a score, default: ratio
      processor: function (choice) {
        return choice["leagueName"];
      }, //takes choice object, returns string, default: no processor. Must supply if choices are not already strings.
      limit: 1, // max number of top results to return, default: no limit / 0.
      cutoff: 60, // lowest score to return, default: 0
      unsorted: false, // results won't be sorted if true, default: false. If true limit will be ignored.
      useCollator: true,
    };

    var results = fuzz.extract(query, choices, options);
    var results2 = results[0];

    if (results2) {
      var score = results2[1];
      var index = results2[2];
      var leagueDetails = results2[0];

      if (score > highestScore) {
        highestScore = score;
        HGALeagueToBeRemoved = HGALeague;
        DBLeagueToBeRemoved = leagueDetails.leagueName;
      }
      //console.log("Popping",HGALeagueToBeRemoved,'||',DBLeagueToBeRemoved,highestScore)
    }
  }
  if (highestScore > scoreThreshold) {
    let bestMatch = _.remove(
      HGALeaguesArray,
      (el) => el === HGALeagueToBeRemoved,
    );
    let bestMatch2 = _.remove(
      DBLeagues,
      (el) => el.leagueName === DBLeagueToBeRemoved,
    );
    //console.log(i,'REMOVED',bestMatch,'||',bestMatch2,'||',highestScore)

    let csvArray = [
      bestMatch2[0].leagueId,
      bestMatch2[0].leagueName,
      bestMatch[0],
      highestScore,
    ];
    //console.log(csvArray)
    const filename = "output/HGAvsDBfuzzyScore.csv";
    const csvString = Papa.unparse([csvArray]);
    console.log(csvString);

    // Open the CSV file for appending (create if it doesn't exist)
    fs.appendFileSync(filename, csvString + "\n", (err) => {
      if (err) {
        console.error("Error appending data:", err);
      }
      console.log("Data appended successfully!");
    });
  }
}

//for each element
//fuzzy search

//sort the score
//match accoridng to lowest score first

//and then all the way up
