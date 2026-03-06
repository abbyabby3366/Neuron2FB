const fs = require("fs");
const _ = require("lodash");
const fuzz = require("fuzzball");
const Papa = require("papaparse");

let SBOLeaguesArray = JSON.parse(fs.readFileSync("scrapedSBOLeagues.json"));
let DBLeagues = JSON.parse(
  fs.readFileSync("../neuronDB/output/leagueJSONDB.json"),
);
let SBOConfirmedLeagues = JSON.parse(
  fs.readFileSync("./output/SBOConfirmedLeagues.json"),
);

//remove useless leagues for now
_.remove(SBOLeaguesArray, (el) => el.includes("e-Football"));
_.remove(SBOLeaguesArray, (el) => el.includes("Winner"));
_.remove(SBOLeaguesArray, (el) => el.includes("WINNER"));
_.remove(SBOLeaguesArray, (el) => el.includes("Which team"));

//remove confirmed leagues from Array of ALL SBO leagues
for (let SBOConfirmedObj of SBOConfirmedLeagues) {
  _.remove(SBOLeaguesArray, (el) => el.includes(SBOConfirmedObj.leagueName));
}

fs.writeFileSync("output/SBOUnconfirmed.json", JSON.stringify(SBOLeaguesArray));
console.log("SBOUnconfirmed.json file written");

//remove confirmed leagues from NeuronDB to avoid repeat
for (let SBOConfirmedObj of SBOConfirmedLeagues) {
  _.remove(DBLeagues, (el) => el.leagueId === SBOConfirmedObj.leagueId);
}

let scoreThreshold = -100;
let i = 0;
let highestScore = scoreThreshold + 1;
let SBOLeagueToBeRemoved;
let DBLeagueToBeRemoved;
while (highestScore > scoreThreshold) {
  i++;
  highestScore = scoreThreshold;

  for (let SBOLeague of SBOLeaguesArray) {
    var query = SBOLeague.replace(/playoff/i, "").replace(/-/gi, "");
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
        SBOLeagueToBeRemoved = SBOLeague;
        DBLeagueToBeRemoved = leagueDetails.leagueName;
      }
      //console.log("Popping",SBOLeagueToBeRemoved,'||',DBLeagueToBeRemoved,highestScore)
    }
  }
  if (highestScore > scoreThreshold) {
    let bestMatch = _.remove(
      SBOLeaguesArray,
      (el) => el === SBOLeagueToBeRemoved,
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
    const filename = "output/SBOvsDBfuzzyScore.csv";
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
