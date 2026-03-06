const _ = require("lodash"); // Make sure to install lodash if you haven't already

function createDataChangeChecker() {
  let lastChangedTime;
  let previousData;

  function checkDataChange(newData) {
    const currentTime = Date.now();

    // Remove time-related properties before comparison
    const cleanNewData = newData.map((item) =>
      _.omit(item, ["startedAt", "timeScraped"]),
    );
    const cleanPreviousData = previousData
      ? previousData.map((item) => _.omit(item, ["startedAt", "timeScraped"]))
      : null;

    // 1. Both arrays are empty (don't compare)
    if (
      Array.isArray(cleanPreviousData) &&
      cleanPreviousData.length === 0 &&
      cleanNewData.length === 0
    ) {
      // console.log('No live data found');
      return;
    }

    // 2. Arrays are different and both have length > 0
    if (
      JSON.stringify(cleanNewData) !== JSON.stringify(cleanPreviousData) &&
      cleanNewData.length > 0
    ) {
      lastChangedTime = currentTime;
      // console.log('3838 - Data changed at:', new Date(currentTime).toLocaleString());
      previousData = JSON.parse(JSON.stringify(newData)); // Store original data with time properties
      return;
    }

    // 3. One minute has passed and data hasn't changed
    if (
      currentTime - lastChangedTime > 60 * 2 * 1000 &&
      JSON.stringify(cleanNewData) === JSON.stringify(cleanPreviousData)
    ) {
      console.log(
        "3838 - WARNING: Data has not changed for 2 minutes",
        new Date(currentTime).toLocaleString(),
      );
      // lastChangedTime = currentTime; (uncomment to reset timer to avoid continuous notifications)
    }

    // Update previousData if it's null (first run) or if it's different from newData
    if (
      previousData === null ||
      JSON.stringify(cleanNewData) !== JSON.stringify(cleanPreviousData)
    ) {
      previousData = JSON.parse(JSON.stringify(newData)); // Store original data with time properties
    }
  }

  return checkDataChange;
}

module.exports = createDataChangeChecker;
