const fs = require("fs").promises;
const _ = require("lodash");

function getRawDB() {
  //https://docs.google.com/spreadsheets/d/1T49_O9EzUS0LYdSjuIcEaw5U0LU_OxEK4FBtiEol618/edit#gid=0
  // const url = "https://sheets.googleapis.com/v4/spreadsheets/1T49_O9EzUS0LYdSjuIcEaw5U0LU_OxEK4FBtiEol618/values/raw?alt=json&key=AIzaSyAt6d03my-EAidZrRhZ6zmuyXr3Es_6fmQ"

  const url =
    "https://sheets.googleapis.com/v4/spreadsheets/1v7FNoPKoz8f-CMM-Ei2S2cKpMYLqjyBXkDBt3AGzwrk/values/raw?alt=json&key=AIzaSyAt6d03my-EAidZrRhZ6zmuyXr3Es_6fmQ";

  fetch(url)
    .then(function (response) {
      //can console.log(response) or console.log(response.status) //200 = success
      //return response.text (in string format)
      //console.log(response)
      return response.json(); //(in json format)
    })

    .then(function (allData) {
      console.log(allData);
    })

    .catch(function (error) {
      console.log(error);
    });
}

getRawDB();
module.exports = { getRawDB };
