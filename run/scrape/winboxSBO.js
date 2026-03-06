const { addMethod, mulMethod, powMethod } = require("../utils/noVigOdds");

async function scrape(page) {
  try {
    const result = await page.evaluate(
      async (powMethodString, leagueIdMap = []) => {
        const powMethod = eval(`(${powMethodString})`);
        const calculateParam = (str) => {
          const result =
            str.split("-").length > 1
              ? str.split("-").reduce((sum, num) => sum + parseFloat(num), 0) /
                2
              : parseFloat(str);
          return Math.abs(result);
        };

        const allLeagueName = [];
        let dataJson = [];
        const liveBetDiv = document.getElementById("odds-display-live");
        if (liveBetDiv) {
          const sportId = 7; // Soccer
          const periodIdRegularTime = 4;
          const periodId1stHalf = 10;
          let timeScraped = new Date().toLocaleString();

          const data = {
            bookmakerId: 3,
            leagueId: null,
            leagueName: null,
            homeName: null,
            awayName: null,
            startedAt: null,
            sportId: sportId,
            sportIdDescription: "Soccer",
            timeScraped,
          };
          // let leagueName, homeName, awayName, time ;
          const tBodies = Array.from(liveBetDiv.getElementsByTagName("tbody"));
          for (const tbody of tBodies) {
            if (
              tbody.hasAttribute("class") &&
              tbody.hasAttribute("onmouseout") &&
              tbody.hasAttribute("onmouseover")
            ) {
              const tempTableData = [];
              const rows = tbody.getElementsByTagName("tr");
              for (let i = 0; i < rows.length; i++) {
                const row = rows[i]; // should have 2-3 rows each table

                // Get team name
                const teamNameTd =
                  row.getElementsByClassName("team-name-column") ?? null;
                if (
                  teamNameTd &&
                  teamNameTd[0] &&
                  teamNameTd[0]?.innerText.trim()
                ) {
                  const tempName = teamNameTd[0]?.innerText.trim().split("\n");
                  data.homeName = tempName[0];
                  data.awayName = tempName[1];
                }

                // Get market odds and param
                const hdpCells = row.querySelectorAll(".odds-hdp.odds-wrap");
                if (hdpCells[0] && hdpCells[0].innerText) {
                  // HDP full time
                  const currentCell = hdpCells[0];
                  const oddSpan = currentCell.querySelector("span.odds");
                  const paramSpan = currentCell.querySelector("span.hdp-point");
                  const odds = oddSpan?.innerText.trim();
                  const param = paramSpan?.innerText.trim();
                  const tempData = {
                    buttonIdWinbox: oddSpan?.id,
                    ...data,
                    periodId: periodIdRegularTime,
                    periodIdDescription: "regular time",
                    marketParam: param ? calculateParam(param) * -1 : null,
                    odds: odds ? parseFloat(odds) : null,
                    noVigOdds: null, // noVigOdds[0] powMethod(3, homeWin, awayWin, draw);
                  };
                  if (i == 0) {
                    tempData.marketId = 17;
                    tempData.marketIdDescription = "Asian Handicap1(%s)";
                  } else {
                    tempData.marketId = 18;
                    tempData.marketIdDescription = "Asian Handicap2(%s)";
                  }
                  tempTableData.push(tempData);
                }
                if (hdpCells[1] && hdpCells[1].innerText) {
                  // HDP half time
                  const currentCell = hdpCells[1];
                  const oddSpan = currentCell.querySelector("span.odds");
                  const paramSpan = currentCell.querySelector("span.hdp-point");
                  const odds = oddSpan?.innerText.trim();
                  const param = paramSpan?.innerText.trim();
                  const tempData = {
                    buttonIdWinbox: oddSpan?.id,
                    ...data,
                    periodId: periodId1stHalf,
                    periodIdDescription: "half time",
                    marketParam: param ? calculateParam(param) * -1 : null,
                    odds: odds ? parseFloat(odds) : null,
                    noVigOdds: null, // noVigOdds[0] powMethod(3, homeWin, awayWin, draw);
                  };
                  if (i == 0) {
                    tempData.marketId = 17;
                    tempData.marketIdDescription = "Asian Handicap1(%s)";
                  } else {
                    tempData.marketId = 18;
                    tempData.marketIdDescription = "Asian Handicap2(%s)";
                  }
                  tempTableData.push(tempData);
                }

                const ouCells = row.querySelectorAll(".odds-ou.odds-wrap");
                if (ouCells[0] && ouCells[0].innerText) {
                  // OU full time
                  const currentCell = ouCells[0];
                  const oddSpan = currentCell.querySelector("span.odds");
                  const paramSpan = currentCell.querySelector("span.hdp-point");
                  const odds = oddSpan?.innerText.trim();
                  const param = paramSpan?.innerText.trim();
                  const tempData = {
                    buttonIdWinbox: oddSpan?.id,
                    ...data,
                    periodId: periodIdRegularTime,
                    periodIdDescription: "regular time",
                    marketParam: param ? calculateParam(param) * -1 : null,
                    odds: odds ? parseFloat(odds) : null,
                    noVigOdds: null, // noVigOdds[0] powMethod(3, homeWin, awayWin, draw);
                  };
                  if (i == 0) {
                    tempData.marketId = 19;
                    tempData.marketIdDescription = "Total Over(%s)";
                  } else {
                    tempData.marketId = 20;
                    tempData.marketIdDescription = "Total Under(%s)";
                  }
                  tempTableData.push(tempData);
                }
                if (ouCells[1] && ouCells[1].innerText) {
                  // OU half time
                  const currentCell = ouCells[1];
                  const oddSpan = currentCell.querySelector("span.odds");
                  const paramSpan = currentCell.querySelector("span.hdp-point");
                  const odds = oddSpan?.innerText.trim();
                  const param = paramSpan?.innerText.trim();
                  const tempData = {
                    buttonIdWinbox: oddSpan?.id,
                    ...data,
                    periodId: periodId1stHalf,
                    periodIdDescription: "half time",
                    marketParam: param ? calculateParam(param) * -1 : null,
                    odds: odds ? parseFloat(odds) : null,
                    noVigOdds: null, // noVigOdds[0] powMethod(3, homeWin, awayWin, draw);
                  };
                  if (i == 0) {
                    tempData.marketId = 19;
                    tempData.marketIdDescription = "Total Over(%s)";
                  } else {
                    tempData.marketId = 20;
                    tempData.marketIdDescription = "Total Under(%s)";
                  }
                  tempTableData.push(tempData);
                }

                const _1x2Cells = row.querySelectorAll("td.BBN, .BTN"); // skip index 0 for A1X2;
                if (_1x2Cells[3] && _1x2Cells[3].innerText.trim()) {
                  // 1X2 full time
                  const currentCell = _1x2Cells[3];
                  const oddSpan = currentCell.querySelector("span.odds");
                  const odds = oddSpan?.innerText.trim();
                  const tempData = {
                    buttonIdWinbox: oddSpan?.id,
                    ...data,
                    periodId: periodIdRegularTime,
                    periodIdDescription: "regular time",
                    odds: odds ? parseFloat(odds) : null,
                    noVigOdds: null, // noVigOdds[0] powMethod(3, homeWin, awayWin, draw);
                  };
                  if (i == 0) {
                    tempData.marketId = 11;
                    tempData.marketIdDescription = "1";
                  } else if (i == 1) {
                    tempData.marketId = 13;
                    tempData.marketIdDescription = "2";
                  } else {
                    tempData.marketId = 12;
                    tempData.marketIdDescription = "Draw";
                  }
                  tempTableData.push(tempData);
                }
                if (_1x2Cells[6] && _1x2Cells[6].innerText.trim()) {
                  // 1X2 half time
                  const currentCell = _1x2Cells[6];
                  const oddSpan = currentCell.querySelector("span.odds");
                  const odds = oddSpan?.innerText.trim();
                  const tempData = {
                    buttonIdWinbox: oddSpan?.id,
                    ...data,
                    periodId: periodId1stHalf,
                    periodIdDescription: "half time",
                    odds: odds ? parseFloat(odds) : null,
                    noVigOdds: null, // noVigOdds[0] powMethod(3, homeWin, awayWin, draw);
                  };
                  if (i == 0) {
                    tempData.marketId = 11;
                    tempData.marketIdDescription = "1";
                  } else if (i == 1) {
                    tempData.marketId = 13;
                    tempData.marketIdDescription = "2";
                  } else {
                    tempData.marketId = 12;
                    tempData.marketIdDescription = "Draw";
                  }
                  tempTableData.push(tempData);
                }
              }

              // Compile table data, add to dataJson
              const market1ft = tempTableData.find(
                (x) => x.marketId == 11 && x.periodId == periodIdRegularTime,
              );
              const marketXft = tempTableData.find(
                (x) => x.marketId == 12 && x.periodId == periodIdRegularTime,
              );
              const market2ft = tempTableData.find(
                (x) => x.marketId == 13 && x.periodId == periodIdRegularTime,
              );
              if (market1ft && marketXft && market2ft) {
                const noVigOdds = powMethod(
                  3,
                  market1ft.odds,
                  marketXft.odds,
                  market2ft.odds,
                );
                market1ft.noVigOdds = noVigOdds[0];
                marketXft.noVigOdds = noVigOdds[1];
                market2ft.noVigOdds = noVigOdds[2];
              }

              const marketOverft = tempTableData.find(
                (x) => x.marketId == 19 && x.periodId == periodIdRegularTime,
              );
              const marketUnderft = tempTableData.find(
                (x) => x.marketId == 20 && x.periodId == periodIdRegularTime,
              );
              if (marketOverft && marketUnderft) {
                const noVigOdds = powMethod(
                  2,
                  marketOverft.odds,
                  marketUnderft.odds,
                );
                marketOverft.noVigOdds = noVigOdds[0];
                marketUnderft.noVigOdds = noVigOdds[1];

                if (marketOverft.marketParam)
                  marketUnderft.marketParam = marketOverft.marketParam * -1;
                else marketOverft.marketParam = marketUnderft.marketParam * -1;
              }

              const marketAH1ft = tempTableData.find(
                (x) => x.marketId == 17 && x.periodId == periodIdRegularTime,
              );
              const marketAH2ft = tempTableData.find(
                (x) => x.marketId == 18 && x.periodId == periodIdRegularTime,
              );
              if (marketAH1ft && marketAH2ft) {
                const noVigOdds = powMethod(
                  2,
                  marketAH1ft.odds,
                  marketAH2ft.odds,
                );
                marketAH1ft.noVigOdds = noVigOdds[0];
                marketAH2ft.noVigOdds = noVigOdds[1];

                if (marketAH1ft.marketParam)
                  marketAH2ft.marketParam = marketAH1ft.marketParam * -1;
                else marketAH1ft.marketParam = marketAH2ft.marketParam * -1;
              }

              const market1ht = tempTableData.find(
                (x) => x.marketId == 11 && x.periodId == periodId1stHalf,
              );
              const marketXht = tempTableData.find(
                (x) => x.marketId == 12 && x.periodId == periodId1stHalf,
              );
              const market2ht = tempTableData.find(
                (x) => x.marketId == 13 && x.periodId == periodId1stHalf,
              );
              if (market1ht && marketXht && market2ht) {
                const noVigOdds = powMethod(
                  3,
                  market1ht.odds,
                  marketXht.odds,
                  market2ht.odds,
                );
                market1ht.noVigOdds = noVigOdds[0];
                marketXht.noVigOdds = noVigOdds[1];
                market2ht.noVigOdds = noVigOdds[2];
              }

              const marketOverht = tempTableData.find(
                (x) => x.marketId == 19 && x.periodId == periodId1stHalf,
              );
              const marketUnderht = tempTableData.find(
                (x) => x.marketId == 20 && x.periodId == periodId1stHalf,
              );
              if (marketOverht && marketUnderht) {
                const noVigOdds = powMethod(
                  2,
                  marketOverht.odds,
                  marketUnderht.odds,
                );
                marketOverht.noVigOdds = noVigOdds[0];
                marketUnderht.noVigOdds = noVigOdds[1];

                if (marketOverht.marketParam)
                  marketUnderht.marketParam = marketOverht.marketParam * -1;
                else marketOverht.marketParam = marketUnderht.marketParam * -1;
              }

              const marketAH1ht = tempTableData.find(
                (x) => x.marketId == 17 && x.periodId == periodId1stHalf,
              );
              const marketAH2ht = tempTableData.find(
                (x) => x.marketId == 18 && x.periodId == periodId1stHalf,
              );
              if (marketAH1ht && marketAH2ht) {
                const noVigOdds = powMethod(
                  2,
                  marketAH1ht.odds,
                  marketAH2ht.odds,
                );
                marketAH1ht.noVigOdds = noVigOdds[0];
                marketAH2ht.noVigOdds = noVigOdds[1];

                if (marketAH1ht.marketParam)
                  marketAH2ht.marketParam = marketAH1ht.marketParam * -1;
                else marketAH1ht.marketParam = marketAH2ht.marketParam * -1;
              }

              dataJson = [...dataJson, ...tempTableData];
            } else {
              const leagueNameSpan =
                tbody.getElementsByClassName("league-name") ?? null;
              if (leagueNameSpan && leagueNameSpan[0]) {
                data.leagueName = leagueNameSpan[0]?.innerText.trim();
                const confirmedLeague = leagueIdMap.find((i) =>
                  i.leagueName
                    .trim()
                    .toLowerCase()
                    .includes(data.leagueName?.trim().toLowerCase()),
                );
                data.leagueId = confirmedLeague
                  ? confirmedLeague.leagueId
                  : null;
              }
            }
          }
        }
        console.log(dataJson);
        return dataJson;
      },
      powMethod.toString(),
      leagueIdMap,
    );
    return result;
  } catch (error) {
    console.log("winbox sbo - Error in scraping:", error.message);
  }
}
