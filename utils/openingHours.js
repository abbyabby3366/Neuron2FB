const fs = require("fs");

/**
 * Parse "HHmm" string to minutes since midnight.
 * e.g. "0930" → 570, "2300" → 1380
 */
function parseTimeToMinutes(timeStr) {
  const h = parseInt(timeStr.substring(0, 2), 10);
  const m = parseInt(timeStr.substring(2, 4), 10);
  return h * 60 + m;
}

/**
 * Check if current time is within any of the given windows.
 * @param {string[]} windows - Array of "HHmm-HHmm" strings, e.g. ["0900-1200", "1400-2300"]
 * @returns {boolean} true if now is within at least one window
 */
function isWithinWindows(windows) {
  if (!windows || !Array.isArray(windows) || windows.length === 0) return true;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const window of windows) {
    const [startStr, endStr] = window.split("-");
    const start = parseTimeToMinutes(startStr);
    const end = parseTimeToMinutes(endStr);

    if (start <= end) {
      // Normal window e.g. "0900-1800"
      if (nowMinutes >= start && nowMinutes < end) return true;
    } else {
      // Overnight window e.g. "2200-0600"
      if (nowMinutes >= start || nowMinutes < end) return true;
    }
  }

  return false;
}

/**
 * Check if an account is within its opening hours (intersection of 2fb and account-level).
 * Both levels must be satisfied. Missing/empty = always open for that level.
 * @param {string} acc - Account ID e.g. "sbo0"
 * @param {string} fb2ConfigId - 2fb config ID e.g. "0"
 * @returns {boolean}
 */
function isAccWithinOpeningHours(acc, fb2ConfigId) {
  // Read 2fb-level opening hours
  let fb2Windows = [];
  try {
    const fb2Config = JSON.parse(
      fs.readFileSync(`TargetBookie/2fb${fb2ConfigId}.json`, "utf-8"),
    );
    fb2Windows = fb2Config.openingHours || [];
  } catch (e) {}

  // Read account-level opening hours
  let accWindows = [];
  try {
    const accConfig = JSON.parse(
      fs.readFileSync(`TargetBookie/${acc}.json`, "utf-8"),
    );
    accWindows = accConfig.openingHours || [];
  } catch (e) {}

  // Intersection: both must pass (empty = always open)
  return isWithinWindows(fb2Windows) && isWithinWindows(accWindows);
}

module.exports = { isWithinWindows, isAccWithinOpeningHours };
