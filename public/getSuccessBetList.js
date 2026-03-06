document.addEventListener("DOMContentLoaded", function () {
  const path = window.location.pathname;
  const acc = path.startsWith("/success/") ? path.split("/")[2] : null;
  // console.log('acc:', acc);

  function fetchData() {
    const url = acc ? `/api/success/${acc}` : "/api/success";
    console.log(url);
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        const tableSuccessBetListSBO =
          document.getElementById("success-bet-table");
        tableSuccessBetListSBO.innerHTML = "";

        //invert it so that the latest bet is on top
        successBetListSBOInverted = [];
        for (let i = data.successBetListSBO.length - 1; i >= 0; i--) {
          successBetListSBOInverted.push(data.successBetListSBO[i]);
        }

        successBetListSBOInverted.forEach((row) => {
          const tr = document.createElement("tr");

          const tdBetPlacedTime = document.createElement("td");
          tdBetPlacedTime.textContent = row.betPlacedTime;
          tr.appendChild(tdBetPlacedTime);

          const tdTargetBookie = document.createElement("td");
          tdTargetBookie.textContent = row.acc;
          tr.appendChild(tdTargetBookie);

          const tdLeagueName = document.createElement("td");
          tdLeagueName.textContent = row.leagueName;
          tr.appendChild(tdLeagueName);

          const tdHomeAwayName = document.createElement("td");
          tdHomeAwayName.textContent = row.homeName + " / " + row.awayName;
          tr.appendChild(tdHomeAwayName);

          const td3838HomeAwayName = document.createElement("td");
          td3838HomeAwayName.textContent =
            row.referenceHomeName + " / " + row.referenceAwayName;
          tr.appendChild(td3838HomeAwayName);

          const tdPeriod = document.createElement("td");
          tdPeriod.textContent = row.periodIdDescription;
          tr.appendChild(tdPeriod);

          const tdMarket = document.createElement("td");
          let market = row.marketIdDescription;
          tdMarket.textContent = market.includes("%s")
            ? market.replace("%s", row.marketParam)
            : market;
          tr.appendChild(tdMarket);

          const tdOdds = document.createElement("td");
          tdOdds.textContent =
            row.unconvertedOdds + " / " + row.odds.toFixed(2);
          tr.appendChild(tdOdds);

          const tdBettedOdds = document.createElement("td");
          tdBettedOdds.textContent =
            row.bettedOdds + "(" + row.tickettedOddsEU + ")";
          tr.appendChild(tdBettedOdds);

          const tdRefOdds = document.createElement("td");
          tdRefOdds.textContent =
            row.referenceOdds + "(" + row.referenceNoVigOdds?.toFixed(2) + ")";
          tr.appendChild(tdRefOdds);

          const tdRefTickettedOdds = document.createElement("td");
          tdRefTickettedOdds.textContent =
            row.referenceTickettedOdds +
            "(" +
            row.referenceTickettedNoVigOdds?.toFixed(3) +
            ")";
          tr.appendChild(tdRefTickettedOdds);

          const tdFinalOvervalue = document.createElement("td");
          tdFinalOvervalue.textContent =
            (row.finalOvervalue * 100)?.toFixed(2) + "%";
          tr.appendChild(tdFinalOvervalue);

          const tdStake = document.createElement("td");
          tdStake.textContent = row.stake;
          tr.appendChild(tdStake);

          // const tdRefScrapedTime = document.createElement('td');
          // tdRefScrapedTime.textContent = row.referenceScrapedTime;
          // tr.appendChild(tdRefScrapedTime);

          // const tdRefTickettedTime = document.createElement('td');
          // tdRefTickettedTime.textContent = row.referenceTickettedTime;
          // tr.appendChild(tdRefTickettedTime);

          // const tdRefMinMaxStake = document.createElement('td');
          // tdRefMinMaxStake.textContent = row.referenceMinStake + " / " + row.referenceMaxStake;
          // tr.appendChild(tdRefMinMaxStake);

          tableSuccessBetListSBO.appendChild(tr);
        });

        // Get the current time
        const now = new Date();
        const timeString = now.toLocaleTimeString();

        // Display the time
        document.getElementById("lastRefresh").textContent =
          `Last Refresh: ${timeString}`;
      })
      .catch((error) => console.error("Error fetching data:", error));
  }

  fetchData(); // Initial fetch
  setInterval(fetchData, 1000); // Fetch every 1
});

function callApi(url, data) {
  console.log(new Date() + " : auto bet triggered");
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => response.json())
    .then((result) => {
      console.log("Success:", result);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
