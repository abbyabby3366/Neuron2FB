const fuzz = require("fuzzball");

function fuzzMatch(entry, entryReference, minScore = 60) {
  let a = fuzz.token_set_ratio(entry.homeName, entryReference.homeName);
  let b = fuzz.token_set_ratio(entry.awayName, entryReference.awayName);
  let c = fuzz.token_set_ratio(entry.homeName, entryReference.awayName);
  let d = fuzz.token_set_ratio(entry.awayName, entryReference.homeName);
  return Math.max(a + b, c + d) > minScore * 2 || a > 95 || b > 95;
}

module.exports = { fuzzMatch };
