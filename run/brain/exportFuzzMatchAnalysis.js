const fs = require("fs");
const { fuzzMatch } = require("../../utils/fuzzMatch");

const exportFuzzMatchAnalysis = async (
  data_target,
  data_reference,
  targetAcc,
  referenceAcc,
  brainParams,
) => {
  try {
    const results = {
      matches: [],
      unmatchedTarget: [],
      unmatchedReference: [],
      metadata: {
        targetAcc,
        referenceAcc,
        timestamp: new Date().toISOString(),
      },
    };

    const getUniqueKey = (entry) =>
      `${entry.leagueName} ${entry.homeName} ${entry.awayName}`.toLowerCase();

    const matchedTargetIndices = new Set();
    const matchedReferenceIndices = new Set();

    // 1. Find matches
    for (let i = 0; i < data_target.length; i++) {
      const target = data_target[i];
      for (let j = 0; j < data_reference.length; j++) {
        const reference = data_reference[j];
        if (fuzzMatch(target, reference, brainParams.fuzzMatchMinScore)) {
          results.matches.push({
            key: getUniqueKey(target),
            targetLeague: target.leagueName,
            targetHome: target.homeName,
            targetAway: target.awayName,
            refLeague: reference.leagueName,
            refHome: reference.homeName,
            refAway: reference.awayName,
          });
          matchedTargetIndices.add(i);
          matchedReferenceIndices.add(j);
        }
      }
    }

    // 2. Find unmatched
    data_target.forEach((entry, index) => {
      if (!matchedTargetIndices.has(index)) {
        results.unmatchedTarget.push({
          key: getUniqueKey(entry),
          leagueName: entry.leagueName,
          homeName: entry.homeName,
          awayName: entry.awayName,
        });
      }
    });

    data_reference.forEach((entry, index) => {
      if (!matchedReferenceIndices.has(index)) {
        results.unmatchedReference.push({
          key: getUniqueKey(entry),
          leagueName: entry.leagueName,
          homeName: entry.homeName,
          awayName: entry.awayName,
        });
      }
    });

    // 3. Unique and Count
    const uniqueAndCount = (arr) => {
      const counts = {};
      const unique = [];
      arr.forEach((item) => {
        if (!counts[item.key]) {
          counts[item.key] = 0;
          unique.push(item);
        }
        counts[item.key]++;
      });
      return unique.map((item) => ({ ...item, count: counts[item.key] }));
    };

    results.matches = uniqueAndCount(results.matches);
    results.unmatchedTarget = uniqueAndCount(results.unmatchedTarget);
    results.unmatchedReference = uniqueAndCount(results.unmatchedReference);

    // 4. Save to files
    const reportsDir = "run/brain/reports";
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const jsonPath = `${reportsDir}/fuzz_match_results.json`;
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    const htmlPath = `${reportsDir}/fuzz_match_results.html`;
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fuzz Match Analysis</title>
    <style>
        body { font-family: 'Inter', sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1, h2 { color: #38bdf8; }
        .card { background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 30px; border: 1px solid #334155; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #334155; }
        th { background: #334155; color: #94a3b8; }
        tr:hover { background: #1e293b; }
        .count-badge { background: #38bdf8; color: #0f172a; padding: 2px 8px; border-radius: 9999px; font-weight: bold; font-size: 0.8rem; }
        .section-header { display: flex; justify-content: space-between; align-items: center; }
        .summary { display: flex; gap: 20px; margin-bottom: 20px; }
        .summary-item { background: #334155; padding: 10px 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Fuzz Match Analysis</h1>
        <div class="summary" id="summary"></div>
        
        <div class="card">
            <div class="section-header">
                <h2>Successful Matches</h2>
                <span id="match-count" class="count-badge">0</span>
            </div>
            <table id="match-table">
                <thead>
                    <tr>
                        <th>Count</th>
                        <th>Target (League | Home | Away)</th>
                        <th>Reference (League | Home | Away)</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>

        <div class="card">
            <div class="section-header">
                <h2>Unmatched Target (Acc: <span id="target-acc"></span>)</h2>
                <span id="target-count" class="count-badge">0</span>
            </div>
            <table id="target-table">
                <thead>
                    <tr>
                        <th>Count</th>
                        <th>League</th>
                        <th>Home</th>
                        <th>Away</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>

        <div class="card">
            <div class="section-header">
                <h2>Unmatched Reference (Acc: <span id="reference-acc"></span>)</h2>
                <span id="reference-count" class="count-badge">0</span>
            </div>
            <table id="reference-table">
                <thead>
                    <tr>
                        <th>Count</th>
                        <th>League</th>
                        <th>Home</th>
                        <th>Away</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    </div>

    <script>
        fetch('fuzz_match_results.json')
            .then(res => res.json())
            .then(data => {
                document.getElementById('target-acc').textContent = data.metadata.targetAcc;
                document.getElementById('reference-acc').textContent = data.metadata.referenceAcc;
                
                const summaryHtml = \`
                    <div class="summary-item">Target: <b>\${data.metadata.targetAcc}</b></div>
                    <div class="summary-item">Reference: <b>\${data.metadata.referenceAcc}</b></div>
                    <div class="summary-item">Time: <b>\${new Date(data.metadata.timestamp).toLocaleString()}</b></div>
                \`;
                document.getElementById('summary').innerHTML = summaryHtml;

                const renderTable = (tableId, countId, items, rowGenerator) => {
                    const tbody = document.querySelector(\`#\${tableId} tbody\`);
                    document.getElementById(countId).textContent = items.length;
                    items.forEach(item => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = rowGenerator(item);
                        tbody.appendChild(tr);
                    });
                };

                renderTable('match-table', 'match-count', data.matches, item => \`
                    <td><span class="count-badge">\${item.count}</span></td>
                    <td>\${item.targetLeague} | \${item.targetHome} | \${item.targetAway}</td>
                    <td>\${item.refLeague} | \${item.refHome} | \${item.refAway}</td>
                \`);

                renderTable('target-table', 'target-count', data.unmatchedTarget, item => \`
                    <td><span class="count-badge">\${item.count}</span></td>
                    <td>\${item.leagueName}</td>
                    <td>\${item.homeName}</td>
                    <td>\${item.awayName}</td>
                \`);

                renderTable('reference-table', 'reference-count', data.unmatchedReference, item => \`
                    <td><span class="count-badge">\${item.count}</span></td>
                    <td>\${item.leagueName}</td>
                    <td>\${item.homeName}</td>
                    <td>\${item.awayName}</td>
                \`);
            });
    </script>
</body>
</html>
    `;
    fs.writeFileSync(htmlPath, htmlContent);
    // console.log(`Fuzz match reports generated in ${reportsDir}`);
  } catch (err) {
    console.error("Error exporting fuzz match analysis:", err);
  }
};

module.exports = { exportFuzzMatchAnalysis };
