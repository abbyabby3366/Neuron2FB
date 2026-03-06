const fs = require("fs").promises;

function getJSON() {
  const url =
    "https://sheets.googleapis.com/v4/spreadsheets/1ncMU0qybf7Qn8bi1KsgoGIhJ_H_cTiJiePjGfrq6No8/values/abcd?alt=json&key=AIzaSyAt6d03my-EAidZrRhZ6zmuyXr3Es_6fmQ";

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
      return leagueJSON;
    })
    .then((leagueJSON) => {
      fs.writeFile("leagueJSONDB.json", JSON.stringify(leagueJSON));
    })

    .catch(function (error) {
      console.log(error);
      //throw new error (this can?)
    });
}

getJSON();

//test json https://docs.google.com/spreadsheets/d/1ncMU0qybf7Qn8bi1KsgoGIhJ_H_cTiJiePjGfrq6No8/edit#gid=0
