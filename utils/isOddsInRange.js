/**
 * Check if odds fall within any of the configured ranges.
 * Supports new format: oddsRanges: [[min1, max1], [min2, max2], ...]
 * Falls back to legacy: minOdds / maxOdds
 */
function isOddsInRange(odds, brainParams) {
  const parsed = parseFloat(odds);

  // New format: array of [min, max] pairs
  if (Array.isArray(brainParams.oddsRanges) && brainParams.oddsRanges.length > 0) {
    return brainParams.oddsRanges.some(([min, max]) => parsed >= min && parsed <= max);
  }

  // Legacy fallback
  if (brainParams.minOdds !== undefined && brainParams.maxOdds !== undefined) {
    return parsed >= brainParams.minOdds && parsed <= brainParams.maxOdds;
  }

  return true;
}

function formatOddsRangeForLog(brainParams) {
  if (Array.isArray(brainParams.oddsRanges) && brainParams.oddsRanges.length > 0) {
    return "Ranges: " + JSON.stringify(brainParams.oddsRanges);
  }
  return "Min: " + brainParams.minOdds + " Max: " + brainParams.maxOdds;
}

module.exports = { isOddsInRange, formatOddsRangeForLog };
