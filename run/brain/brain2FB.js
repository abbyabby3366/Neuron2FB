const fs = require("fs");
const {
  startSession,
  readData,
  writeData,
  deleteData,
} = require("../../mongodb/db");
const _ = require("lodash");
const { fuzzMatch } = require("../../utils/fuzzMatch");
const { MARKET_IDS, PERIOD_IDS, filterData } = require("./brain2FBFilter");
const { exportFuzzMatchAnalysis } = require("./exportFuzzMatchAnalysis");

const brain2FB = async (targetAcc, referenceAcc, fb2ConfigId) => {
  let pendingBetList = [];
  let session;

  try {
    session = await startSession();
    const currentTime = new Date();
    await session.withTransaction(async () => {
      // Helper to load params for filtering
      const loadParams = (accName) => {
        try {
          const path = `./TargetBookie/${accName}.json`;
          if (fs.existsSync(path)) {
            const data = JSON.parse(fs.readFileSync(path, "utf-8"));
            if (data && data.brainParams) return data;
          }
        } catch (e) {}
        return null;
      };

      const targetBrainParams = loadParams(targetAcc).brainParams;
      const refBrainParams = loadParams(referenceAcc).brainParams;
      const fb2Config = loadParams(`2fb${fb2ConfigId}`);
      const brainParams = fb2Config.brainParams;
      const successBetListKey = fb2Config.successBetListKey;

      const targetAccFilter = { acc: targetAcc };
      const referenceAccFilter = { acc: referenceAcc };
      // Read data from MongoDB for BOTH sides
      let [
        data_reference,
        data_target,
        targetSuccessBetList,
        targetTempFailBetList,
        referenceSuccessBetList,
        referenceTempFailBetList,
        waitingBetList,
        successBetListGlobal,
      ] = await Promise.all([
        readData("data_target", referenceAccFilter),
        readData("data_target", targetAccFilter),
        readData("successBetList", targetAccFilter),
        readData("tempFailBetList", targetAccFilter),
        readData("successBetList", referenceAccFilter),
        readData("tempFailBetList", referenceAccFilter),
        readData("waitingBetList"),
        readData("successBetList"),
      ]);

      console.log(
        `Before filter ${targetAcc} length: ${data_target.length}, ${referenceAcc} length: ${data_reference.length}`,
      );

      // Process and filter data using their OWN rules and OWN histories
      let beforeTarget = data_target.length;
      let beforeRef = data_reference.length;

      data_reference = filterData(
        data_reference,
        referenceAcc,
        refBrainParams,
        currentTime,
        referenceSuccessBetList,
        referenceTempFailBetList,
        waitingBetList,
        successBetListGlobal,
      );
      data_target = filterData(
        data_target,
        targetAcc,
        targetBrainParams,
        currentTime,
        targetSuccessBetList,
        targetTempFailBetList,
        waitingBetList,
        successBetListGlobal,
      );

      console.log(
        `1st pass (acc filter) | ${targetAcc}: ${beforeTarget} → ${data_target.length} (-${beforeTarget - data_target.length}) | ${referenceAcc}: ${beforeRef} → ${data_reference.length} (-${beforeRef - data_reference.length})`,
      );

      // Second filter pass using 2fb config brainParams
      // If successBetListKey exists, use it to share success bets across configs with the same key
      let keySuccessBetList = successBetListGlobal;
      if (successBetListKey) {
        keySuccessBetList = await readData("successBetList", {
          successBetListKey,
        });
      }

      beforeTarget = data_target.length;
      beforeRef = data_reference.length;

      data_reference = filterData(
        data_reference,
        referenceAcc,
        brainParams,
        currentTime,
        keySuccessBetList,
        referenceTempFailBetList,
        waitingBetList,
        successBetListGlobal,
      );
      data_target = filterData(
        data_target,
        targetAcc,
        brainParams,
        currentTime,
        keySuccessBetList,
        targetTempFailBetList,
        waitingBetList,
        successBetListGlobal,
      );

      console.log(
        `2nd pass (2fb filter) | ${targetAcc}: ${beforeTarget} → ${data_target.length} (-${beforeTarget - data_target.length}) | ${referenceAcc}: ${beforeRef} → ${data_reference.length} (-${beforeRef - data_reference.length})`,
      );

      // Find matching entries and calculate overvalue (Malay Odds Sum)
      for (let entry of data_target) {
        let contraMarketId;
        let contraParam;

        if (entry.marketId === 19) {
          contraMarketId = 20;
          contraParam = entry.marketParam;
        } else if (entry.marketId === 20) {
          contraMarketId = 19;
          contraParam = entry.marketParam;
        } else if (entry.marketId === 17) {
          contraMarketId = 18;
          contraParam = entry.marketParam * -1;
        } else if (entry.marketId === 18) {
          contraMarketId = 17;
          contraParam = entry.marketParam * -1;
        } else {
          continue;
        }

        // Find the matching contra entry in data_reference
        const contraEntry = data_reference.find(
          (ref) =>
            ref.sportId === entry.sportId &&
            ref.periodId === entry.periodId &&
            ref.marketId === contraMarketId &&
            // Use a small fixed precision to handle float comparison robustly (e.g., 0.25, 0.75, etc.)
            Math.abs(parseFloat(ref.marketParam) - parseFloat(contraParam)) <
              0.001 &&
            (!brainParams.matchLeagueBoolean ||
              ref.leagueId === entry.leagueId) &&
            fuzzMatch(entry, ref, brainParams.fuzzMatchMinScore),
        );

        if (contraEntry) {
          // Helper to get button ID based on bookie
          const getBtnId = (entryObj, accountName) => {
            if (accountName.startsWith("ps3838")) return entryObj.buttonId3838;
            if (accountName.startsWith("isn")) return entryObj.buttonIdISN;
            if (accountName.startsWith("sbo")) return entryObj.buttonIdSbo;
            if (accountName.startsWith("hga")) return entryObj.buttonIdHGA;
            if (accountName.startsWith("ibc")) return entryObj.buttonIdIBC;
            if (accountName.startsWith("obet")) return entryObj.buttonIdObet;
            return entryObj.buttonId;
          };

          const targetOdds = parseFloat(entry.odds);
          const referenceOdds = parseFloat(contraEntry.odds);

          const targetBtnId = getBtnId(entry, targetAcc);
          const referenceBtnId = getBtnId(contraEntry, referenceAcc);

          // Strict Malay Odds Range Checks (-1 to 1, excluding 0)
          const isTargetValidMalay =
            targetOdds !== 0 && targetOdds <= 1 && targetOdds >= -1;
          const isReferenceValidMalay =
            referenceOdds !== 0 && referenceOdds <= 1 && referenceOdds >= -1;

          if (!isTargetValidMalay || !isReferenceValidMalay) {
            console.warn(
              `[${targetAcc} vs ${referenceAcc}] Odds detected outside -1 and 1 range. Target: ${targetOdds}, Reference: ${referenceOdds}. Might be non-Malay odds, skipping entry.`,
            );
            continue;
          }

          // Check if one selection is positive and one is negative
          const hasPositiveAndNegative =
            (targetOdds > 0 && referenceOdds < 0) ||
            (targetOdds < 0 && referenceOdds > 0);

          if (!hasPositiveAndNegative) continue;

          const ev = targetOdds + referenceOdds;

          if (ev > brainParams.minEV && ev < brainParams.maxEV) {
            const { _id: targetId, ...targetEntryWithoutId } = entry;
            const { _id: referenceId, ...referenceEntryWithoutId } =
              contraEntry;

            pendingBetList.push({
              target: {
                ...targetEntryWithoutId,
                buttonId: targetBtnId,
                acc: targetAcc,
                // Reference info: checking the OTHER bookie (referenceAcc) for the hedge side
                referenceButtonId: referenceBtnId,
                referenceOdds: contraEntry.odds,
                referenceVig: contraEntry.vig,
                referenceNoVigOdds: contraEntry.noVigOdds,
                referenceNoVigIncreased: contraEntry.noVigIncreased,
                referenceHomeName: contraEntry.homeName,
                referenceAwayName: contraEntry.awayName,
                referenceScrapedTime: contraEntry.timeScraped,
                overvalue: ev, //just for easier reference
              },
              reference: {
                ...referenceEntryWithoutId,
                buttonId: referenceBtnId,
                acc: referenceAcc,
                // Reference info: checking the OTHER bookie (targetAcc) for the target side
                referenceButtonId: targetBtnId,
                referenceOdds: entry.odds,
                referenceVig: entry.vig,
                referenceNoVigOdds: entry.noVigOdds,
                referenceNoVigIncreased: entry.noVigIncreased,
                referenceHomeName: entry.homeName,
                referenceAwayName: entry.awayName,
                referenceScrapedTime: entry.timeScraped,
                overvalue: ev,
              },
              ev: ev,
              overvalue: ev,
            });
          }
        }
      }

      pendingBetList = _.orderBy(pendingBetList, ["overvalue"], ["desc"]);

      // Export Fuzz Match Analysis
      await exportFuzzMatchAnalysis(
        data_target,
        data_reference,
        targetAcc,
        referenceAcc,
        brainParams,
      );
    });
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    if (session) {
      session.endSession();
    }
  }

  return pendingBetList;
};

module.exports = { brain2FB };
