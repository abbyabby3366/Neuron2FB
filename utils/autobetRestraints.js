const fsSync = require("fs");

//if autoBetRestraints = true, then i dont bet
//if a is true, or b is true, then return true
async function autoBetRestraints(acc, a = false, b = false, c = false) {
  let autobet_params = JSON.parse(
    fsSync.readFileSync(`TargetBookie/${acc}.json`, "utf-8"),
  );
  const isAutoBettingDisabled = !autobet_params.autoBet;
  return a || b || c || isAutoBettingDisabled;
}

module.exports = { autoBetRestraints };
