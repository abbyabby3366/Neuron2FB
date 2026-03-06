const fs = require("fs");

const data = JSON.parse(fs.readFileSync("NeuronDBAllLeagues.json", "utf-8"));
const data_ps3838 = JSON.parse(fs.readFileSync("data_ps3838.json", "utf-8"));
const data_Sbo = JSON.parse(fs.readFileSync("data_Sbo.json", "utf-8"));

const getLeagueId = (entry, bookMakerId) => {
  const foundEntry = data.find((arr) => entry.includes(arr[bookMakerId + 1])); // Find the first matching element //use include because some 3838 names have Group A, B, C, D behind their leagues
  return foundEntry ? foundEntry[0] : null; // Return ID if found, null otherwise
};

//bookmakerId --> ps3838 = 1, sbo = 2, winbox sbo = 3, ibc = 4, isn = 5, hga = 6
data_ps3838.forEach((el) => (el.leagueId = getLeagueId(el.leagueName, 1)));
data_Sbo.forEach((el) => (el.leagueId = getLeagueId(el.leagueName, 2)));
console.log(data_Sbo.leagueId);
