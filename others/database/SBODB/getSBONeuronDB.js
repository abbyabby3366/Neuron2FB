const fs = require("fs").promises;

function getSBONeuronDB() {
  const url =
    "https://sheets.googleapis.com/v4/spreadsheets/1T49_O9EzUS0LYdSjuIcEaw5U0LU_OxEK4FBtiEol618/values/data?alt=json&key=AIzaSyAt6d03my-EAidZrRhZ6zmuyXr3Es_6fmQ";

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      let dataValues = data.values;
      let leagueNames = dataValues
        .map((arr) => (arr = { leagueId: arr[0], leagueName: arr[3] }))
        .filter((el) => el.leagueName !== undefined);
      leagueNames.shift();

      let SBOConfirmedArray = leagueNames.map((el) => el.leagueName);
      console.log("current SBO confirmed leagues: ", SBOConfirmedArray.length);

      fs.writeFile(
        "./SBODB/output/SBOConfirmedLeagues.json",
        JSON.stringify(leagueNames),
      );
      return data;
    })
    .catch(function (error) {
      console.log(error);
    });
}
module.exports = { getSBONeuronDB };

//test json https://docs.google.com/spreadsheets/d/1ncMU0qybf7Qn8bi1KsgoGIhJ_H_cTiJiePjGfrq6No8/edit#gid=0
