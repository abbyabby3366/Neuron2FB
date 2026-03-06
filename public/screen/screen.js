document.addEventListener("DOMContentLoaded", () => {
  function fetchData() {
    fetch("/api/screen")
      .then((response) => response.json())
      .then((data) => {
        const tableScreen = document.getElementById("data-table");
        tableScreen.innerHTML = "";

        data.forEach((row) => {
          const tr = document.createElement("tr");

          const tdLeagueName = document.createElement("td");
          tdLeagueName.textContent = row.leagueName;
          tr.appendChild(tdLeagueName);

          const td3838Teams = document.createElement("td");
          td3838Teams.textContent = row.homeName[0] + " / " + row.awayName[0];
          tr.appendChild(td3838Teams);

          const tdSBOTeams = document.createElement("td");
          tdSBOTeams.textContent = row.homeName[1] + " / " + row.awayName[1];
          tr.appendChild(tdSBOTeams);

          const tdPeriod = document.createElement("td");
          tdPeriod.textContent = row.periodIdDescription;
          tr.appendChild(tdPeriod);

          const tdMarket = document.createElement("td");
          let market = row.marketIdDescription;
          tdMarket.textContent = market.includes("%s")
            ? market.replace("%s", row.marketParam)
            : market;
          tr.appendChild(tdMarket);

          const tdBestOdds = document.createElement("td");
          tdBestOdds.textContent = Math.max(row.odds[0], row.odds[1]);
          tr.appendChild(tdBestOdds);

          const td3838Odds = document.createElement("td");
          td3838Odds.textContent = row.odds[0];
          tr.appendChild(td3838Odds);

          const tdSBOOdds = document.createElement("td");
          tdSBOOdds.textContent = row.odds[1];
          tr.appendChild(tdSBOOdds);

          tableScreen.appendChild(tr);
          console.log(tableScreen.innerHTML);
        });

        // Get the current time
        const now = new Date();
        const timeString = now.toLocaleTimeString();

        // Display the time
        document.getElementById("lastRefresh").textContent =
          `Last Refresh: ${timeString}`;
      });
  }
  fetchData(); // Initial fetch
  setInterval(fetchData, 1000); // Fetch every 1
});
