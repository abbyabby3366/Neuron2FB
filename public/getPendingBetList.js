let isLoaded = false;

document.addEventListener("DOMContentLoaded", function () {
  const path = window.location.pathname;
  const acc = path.startsWith("/pending/") ? path.split("/")[2] : null;
  // console.log('acc:', acc);
  if (!acc) document.getElementById("settings").remove();

  function fetchData() {
    fetchAndDisplayLinks();
    const url = acc ? `/api/pending/${acc}` : "/api/pending";
    // console.log(url);

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        //sort data by overvalue
        data.pendingBetListSBO.sort((a, b) => b.overvalue - a.overvalue);

        const tablePendingBetList = document.getElementById("data-table");
        tablePendingBetList.innerHTML = "";

        data.pendingBetListSBO.forEach((row) => {
          const tr = document.createElement("tr");

          // Create table cells
          const tdActions = document.createElement("td");
          const button1 = document.createElement("button");
          button1.textContent = "Bet";
          button1.onclick = () => callApi(`/bet`, row);
          tdActions.appendChild(button1);
          tr.appendChild(tdActions);

          const acc = document.createElement("td");
          acc.textContent = row.acc;
          tr.appendChild(acc);

          const tdOvervalue = document.createElement("td");
          tdOvervalue.textContent = (row.overvalue * 100).toFixed(2) + "%";
          tr.appendChild(tdOvervalue);

          const tdLeagueName = document.createElement("td");
          tdLeagueName.textContent = row.leagueName;
          tr.appendChild(tdLeagueName);

          const tdHomeName = document.createElement("td");
          tdHomeName.textContent = row.homeName;
          tr.appendChild(tdHomeName);

          const tdAwayName = document.createElement("td");
          tdAwayName.textContent = row.awayName;
          tr.appendChild(tdAwayName);

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

          const tdRefOdds = document.createElement("td");
          tdRefOdds.textContent =
            row.referenceOdds + " (" + row.referenceNoVigOdds + ")";
          tr.appendChild(tdRefOdds);

          const tdButtonId3838 = document.createElement("td");
          tdButtonId3838.textContent = row.buttonId3838;
          tr.appendChild(tdButtonId3838);

          const tdTimeScraped = document.createElement("td");
          tdTimeScraped.textContent = row.timeScraped;
          tr.appendChild(tdTimeScraped);

          const tdReferenceTimeScraped = document.createElement("td");
          tdReferenceTimeScraped.textContent = row.referenceScrapedTime;
          tr.appendChild(tdReferenceTimeScraped);

          tablePendingBetList.appendChild(tr);
        });

        // Update Auto Bet button
        updateAutoBetButton(data.autoBet);

        // Update cooldown input
        saveCooldownInput(data.cooldownTimeInSeconds);

        // Update last refresh time
        updateLastRefreshTime();
      })
      .catch((error) => console.error("Error fetching data:", error));
  }

  function updateAutoBetButton(autoBet) {
    const toggleButton = document.getElementById("toggleButton");
    toggleButton.innerText = autoBet ? "Auto Bet On" : "Auto Bet Off";
    toggleButton.style.color = autoBet ? "green" : "red";
    toggleButton.style.backgroundColor = autoBet ? "lightgreen" : "pink";
  }

  function saveCooldownInput(cooldownTime) {
    if (!isLoaded) {
      const cooldownInput = document.getElementById("cooldownInput");
      cooldownInput.value = cooldownTime;
      isLoaded = true;
    }
  }

  function updateLastRefreshTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById("lastRefresh").textContent =
      `Last Refresh: ${timeString}`;
  }

  fetchData(); // Initial fetch
  setInterval(fetchData, 1000); // Fetch every 1 second
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

// Function to fetch the list of files and create links
function fetchAndDisplayLinks() {
  fetch("/api/targetbookie-files")
    .then((response) => response.json())
    .then((files) => {
      const linksDiv = document.getElementById("links");
      linksDiv.innerHTML = ""; // Clear any existing content

      files.forEach((file) => {
        if (file.endsWith(".json")) {
          const linkName = file.replace(".json", "");
          const link = document.createElement("a");
          link.href = `/pending/${linkName}`;
          link.textContent = linkName;
          link.className = "file-link";
          linksDiv.appendChild(link);
        }
      });

      // If no files, the CSS will handle displaying the "No files" message
    })
    .catch((error) => {
      console.error("Error fetching file list:", error);
      const linksDiv = document.getElementById("links");
      linksDiv.textContent = "Error loading files";
    });
}

document.getElementById("toggleButton").addEventListener("click", async () => {
  const path = window.location.pathname;
  const acc = path.startsWith("/pending/") ? path.split("/")[2] : null;
  if (!acc) return;

  try {
    const toggleButton = document.getElementById("toggleButton");
    const response = await fetch(`/api/toggle/${acc}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error("Network response was not ok " + response.statusText);
    }
  } catch (error) {
    console.log(error);
  }
});

document.getElementById("saveButton").addEventListener("click", () => {
  const path = window.location.pathname;
  const acc = path.startsWith("/pending/") ? path.split("/")[2] : null;
  if (!acc) return;

  const cooldownTime = Number(document.getElementById("cooldownInput").value);
  if (isNaN(cooldownTime) || cooldownTime <= 0) {
    alert("Please enter a valid number");
    return;
  }

  fetch(`/api/save-cooldown/${acc}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cooldownTimeInSeconds: cooldownTime }),
  })
    .then((response) => response.text())
    .then((data) => {
      alert(data);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
});

// Cooldown
const ws = new WebSocket("ws://localhost:8080");
console.log(ws);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  const path = window.location.pathname;
  const acc = path.startsWith("/pending/") ? path.split("/")[2] : null;
  if (!acc) return;
  if (acc === data.acc) {
    document.getElementById("timer").textContent = data.remainingTime;
  }
};

ws.onopen = () => {
  console.log("Connected to WebSocket server");
};

ws.onclose = () => {
  console.log("Disconnected from WebSocket server");
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};
