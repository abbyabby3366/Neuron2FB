const fs = require("fs");

// Read the JSON file
const jsonData = JSON.parse(fs.readFileSync("./analysis.json", "utf8"));

// Current time
const now = new Date();

// Filter bets from the past 36 hours
const recentBets = jsonData.filter((bet) => {
  const betTime = new Date(bet.betPlacedTime);
  const hoursDiff = (now - betTime) / (1000 * 60 * 60);
  return hoursDiff <= 36;
});

// Function to calculate statistics
function calculateStats(array) {
  const sorted = array.sort((a, b) => a - b);
  return {
    average: array.reduce((a, b) => a + b, 0) / array.length,
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

// Extract stakes, EVs, and bettedOdds
const stakes = recentBets.map((bet) => bet.stake);
const evs = recentBets.map((bet) => bet.finalOvervalue);
const bettedOdds = recentBets.map((bet) => bet.bettedOdds);

// Calculate statistics
const stakeStats = calculateStats(stakes);
const evStats = calculateStats(evs);
const oddsStats = calculateStats(bettedOdds);

console.log("Stake Statistics:");
console.log(stakeStats);

console.log("\nEV Statistics:");
console.log(evStats);

console.log("\nBetted Odds Statistics:");
console.log(oddsStats);

// Calculate time differences with 8-hour offset
const timeDiffs = recentBets.map((bet) => {
  const betTime = new Date(bet.betPlacedTime);
  const referenceTime = new Date(bet.referenceTickettedTime);

  // Add 8 hours (28800000 milliseconds) to betTime
  betTime.setTime(betTime.getTime() + 28800000);

  return Math.abs(referenceTime - betTime) / 1000; // absolute difference in seconds
});

const timeDiffStats = calculateStats(timeDiffs);

console.log("\nTime Difference Statistics (in seconds, after 8-hour offset):");
console.log(timeDiffStats);

// Count match-up occurrences
const matchUpCounts = {};
recentBets.forEach((bet) => {
  const matchUp = `${bet.homeName} vs ${bet.awayName}`;
  matchUpCounts[matchUp] = (matchUpCounts[matchUp] || 0) + 1;
});

// Count the frequency of each occurrence count
const occurrenceDistribution = {};
Object.values(matchUpCounts).forEach((count) => {
  occurrenceDistribution[count] = (occurrenceDistribution[count] || 0) + 1;
});

console.log("\nMatch-up Occurrence Distribution:");
Object.entries(occurrenceDistribution)
  .sort(([a], [b]) => Number(a) - Number(b))
  .forEach(([occurrences, count]) => {
    console.log(`${count} match-up(s) occurred ${occurrences} time(s)`);
  });

// Sort EVs, time differences, odds, and stakes
const sortedEvs = evs.sort((a, b) => a - b);
const sortedTimeDiffs = timeDiffs.sort((a, b) => a - b);
const sortedOdds = bettedOdds.sort((a, b) => a - b);
const sortedStakes = stakes.sort((a, b) => a - b);

// Function to create HTML with embedded chart
function createChartHtml(data, labels, title, yAxisLabel, chartType = "line") {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>${title}</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body>
        <canvas id="myChart"></canvas>
        <script>
        const ctx = document.getElementById('myChart').getContext('2d');
        new Chart(ctx, {
            type: '${chartType}',
            data: {
                labels: ${JSON.stringify(labels)},
                datasets: [{
                    label: '${title}',
                    data: ${JSON.stringify(data)},
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '${yAxisLabel}'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Bet Number (Sorted)'
                        }
                    }
                }
            }
        });
        </script>
    </body>
    </html>
    `;
}

// Create and save EV chart
const evLabels = sortedEvs.map((_, index) => index + 1);
const evChartHtml = createChartHtml(sortedEvs, evLabels, "Sorted EVs", "EV");
fs.writeFileSync("ev_chart.html", evChartHtml);

// Create and save time difference chart
const timeDiffLabels = sortedTimeDiffs.map((_, index) => index + 1);
const timeDiffChartHtml = createChartHtml(
  sortedTimeDiffs,
  timeDiffLabels,
  "Time Differences (After 8-hour Offset)",
  "Seconds",
);
fs.writeFileSync("time_diff_chart.html", timeDiffChartHtml);

// Create and save match-up occurrence distribution chart
const occurrenceLabels = Object.keys(occurrenceDistribution).sort(
  (a, b) => Number(a) - Number(b),
);
const occurrenceData = occurrenceLabels.map(
  (label) => occurrenceDistribution[label],
);
const occurrenceChartHtml = createChartHtml(
  occurrenceData,
  occurrenceLabels,
  "Match-up Occurrence Distribution",
  "Number of Match-ups",
  "bar",
);
fs.writeFileSync("occurrence_distribution_chart.html", occurrenceChartHtml);

// Create and save sorted odds chart
const oddsLabels = sortedOdds.map((_, index) => index + 1);
const oddsChartHtml = createChartHtml(
  sortedOdds,
  oddsLabels,
  "Sorted Odds",
  "Odds",
);
fs.writeFileSync("odds_chart.html", oddsChartHtml);

// Create and save sorted stakes chart
const stakeLabels = sortedStakes.map((_, index) => index + 1);
const stakeChartHtml = createChartHtml(
  sortedStakes,
  stakeLabels,
  "Sorted Stakes",
  "Stake Amount",
);
fs.writeFileSync("stake_chart.html", stakeChartHtml);

console.log(
  "Charts have been generated: ev_chart.html, time_diff_chart.html, occurrence_distribution_chart.html, odds_chart.html, and stake_chart.html",
);
