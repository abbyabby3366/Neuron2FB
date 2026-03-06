const { deleteData } = require("../mongodb/db");

//clear pendingBetList_sbo while initiliasing
async function clearPendingBetList() {
  try {
    const deleteResult = await deleteData("pendingBetList");
    console.log(
      `Initialising runSBO. Total of ${deleteResult.deletedCount} cleared from pendingBetList.`,
    );
  } catch (error) {
    console.error("Error clearing pendingBetList:", error);
  }
}

module.exports = { clearPendingBetList };
