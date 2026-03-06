const fs = require("fs").promises;
const _ = require("lodash");

function getRawDB() {
  //https://docs.google.com/spreadsheets/d/1T49_O9EzUS0LYdSjuIcEaw5U0LU_OxEK4FBtiEol618/edit#gid=0
  const url =
    "https://sheets.googleapis.com/v4/spreadsheets/1T49_O9EzUS0LYdSjuIcEaw5U0LU_OxEK4FBtiEol618/values/raw?alt=json&key=AIzaSyAt6d03my-EAidZrRhZ6zmuyXr3Es_6fmQ";
  fetch(url)
    .then(function (response) {
      //can console.log(response) or console.log(response.status) //200 = success
      //return response.text (in string format)
      //console.log(response)
      return response.json(); //(in json format)
    })

    .then(function (allData) {
      //console.log(JSON.parse(data));
      let data = allData.values;
      let leagueIdArray = data[0];
      let leagueArray = data[1];
      let leagueDetail = {};
      let leagueJSON = [];

      //get league
      for (let i = 0; i < leagueArray.length; i++) {
        leagueDetail.leagueId = leagueIdArray[i];
        leagueDetail.leagueName = leagueArray[i];
        leagueJSON.push(leagueDetail);
        leagueDetail = {};
      }
      console.log(leagueJSON);
      //remove empty leagues
      _.remove(leagueJSON, (el) => el.leagueName === "");
      return leagueJSON;
    })
    .then((leagueJSON) => {
      console.log(
        "total leagues get from 'raw' sheets API: ",
        leagueJSON.length,
      );
      fs.writeFile(
        "./NeuronDB/output/leagueJSONDB.json",
        JSON.stringify(leagueJSON),
      );
      //3838 db is same as neurondb for now
      fs.writeFile(
        "./3838DB/output/3838ConfirmedLeagues.json",
        JSON.stringify(leagueJSON),
      );
    })

    .catch(function (error) {
      console.log(error);
    });
}

module.exports = { getRawDB };
