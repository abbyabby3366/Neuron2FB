const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const https = require("https");

// Function to download image from URL
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        const writeStream = fs.createWriteStream(filepath);
        response.pipe(writeStream);

        writeStream.on("finish", () => {
          writeStream.close();
          resolve();
        });

        writeStream.on("error", reject);
      })
      .on("error", reject);
  });
}

async function readGoogleSheet(
  download = true,
  idStartFrom = 1,
  spreadsheetId,
  sheetName,
) {
  const startTime = Date.now();
  try {
    console.log("Reading Google Sheets ID and sheet name...");
    console.log(`Spreadsheet ID: ${spreadsheetId}`);
    console.log(`Sheet Name: ${sheetName}\n`);

    // Create downloads directory if it doesn't exist
    const downloadDir = path.join(__dirname, "downloads");
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    }

    // Load credentials from the JSON file
    const credentials = require("./credentials.json");

    // Create a JWT client with full access scopes
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    );

    // Create the Google Sheets API client
    const sheets = google.sheets({ version: "v4", auth });

    // Read data from the spreadsheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:Z`, // Read all columns
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log("No data found.");
      return;
    }

    // Get header rows (1st and 2nd rows)
    const headerRow1 = rows[0];
    const headerRow2 = rows[1];
    // console.log('Found header rows:', { headerRow1, headerRow2 });

    // Find the indices of the columns we need from the first header row
    const columnIndices = {
      cover_image: headerRow1.indexOf("cover_image"),
      cover_image_title: headerRow1.indexOf("cover_image_title"),
      cover_image_subtitle: headerRow1.indexOf("cover_image_subtitle"),
    };

    // Verify all required columns are found
    for (const [column, index] of Object.entries(columnIndices)) {
      if (index === -1) {
        throw new Error(`Required column '${column}' not found in headers`);
      }
    }

    // Log the found indices
    console.log("Column indices:", JSON.stringify(columnIndices, null, 2));

    // Process the data starting from the 4th row (index 3)
    const data = [];
    for (let i = 3; i < rows.length; i++) {
      const row = rows[i];
      const imageUrl = row[columnIndices.cover_image];
      const title = row[columnIndices.cover_image_title];
      const subtitle = row[columnIndices.cover_image_subtitle];

      if (!imageUrl || !title || !subtitle) {
        console.log(`Skipping row ${i + 1} due to missing data:`, {
          imageUrl,
          title,
          subtitle,
        });
        continue;
      }

      const id = (data.length + idStartFrom).toString();
      const filename = `o${id}.jpg`; // Simple number as filename
      const filepath = path.join(downloadDir, filename);

      try {
        if (download) {
          console.log(`Downloading image ${id} from ${imageUrl}`);
          await downloadImage(imageUrl, filepath);
          console.log(`Successfully downloaded image ${id}`);
        }

        data.push({
          id,
          image: filepath,
          cover_image_title: title,
          cover_image_subtitle: subtitle,
        });
      } catch (error) {
        console.error(`Failed to download image ${id}:`, error.message);
      }
    }

    // Count data and display ID range
    const dataCount = data.length;
    const startId = data.length > 0 ? data[0].id : "N/A";
    const endId = data.length > 0 ? data[data.length - 1].id : "N/A";
    console.log(`\nData Summary:`);
    console.log(`Total entries: ${dataCount}`);
    console.log(`ID Range: ${startId} to ${endId}\n`);

    // Calculate and display time elapsed
    const endTime = Date.now();
    const timeElapsed = (endTime - startTime) / 1000; // Convert to seconds
    console.log(`Time elapsed: ${timeElapsed.toFixed(2)} seconds\n`);

    // Write to JSON file
    fs.writeFileSync("sheet_data.json", JSON.stringify(data, null, 2));
    console.log("Data has been written to sheet_data.json");
  } catch (error) {
    console.error("Error reading Google Sheet:", error);
  }
}

// Define headers for MongoDB data
const MONGODB_HEADERS = [
  // Basic Match Information
  "_id",
  "bookmakerId",
  "acc",
  "leagueId",
  "leagueName",
  "homeName",
  "awayName",
  "startedAt",
  "sportId",
  "sportIdDescription",
  "timeScraped",

  // Period and Market Information
  "periodId",
  "periodIdDescription",
  "marketId",
  "marketIdDescription",
  "marketParam",

  // Odds Information
  "unconvertedOdds",
  "odds",
  "noVigOdds",
  "vig",
  "noVigIncreased",
  "referenceButtonId",
  "referenceContraButtonId",
  "referenceOdds",
  "referenceNoVigOdds",
  "referenceVig",
  "referenceNoVigIncreased",

  // Team Reference Information
  "referenceHomeName",
  "referenceAwayName",
  "referenceScrapedTime",

  // Value and Stake Information
  "overvalue",
  "tickettedRefVig",
  "maxStake",
  "minStake",
  "referenceMaxStake",
  "referenceMinStake",

  // Ticketed Information
  "unconvertedTickettedOdds",
  "tickettedOddsEU",
  "referenceTickettedOdds",
  "referenceTickettedNoVigOdds",
  "stake",

  // Timestamps
  "betTickettedTime",
  "referenceTickettedTime",
  "betEnteredTime",
  "bettedOdds",
  "finalOvervalue",
  "betPlacedTime",
];

async function writeHeadersToSheet(spreadsheetId, sheetName) {
  try {
    const credentials = require("./credentials.json");
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    );

    const sheets = google.sheets({ version: "v4", auth });

    // First check if headers exist
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!1:1`,
    });

    const existingHeaders = headerResponse.data.values?.[0];

    // Only write headers if they don't exist or are different
    if (
      !existingHeaders ||
      !existingHeaders.every(
        (header, index) => header === MONGODB_HEADERS[index],
      )
    ) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!1:1`,
        valueInputOption: "RAW",
        resource: {
          values: [MONGODB_HEADERS],
        },
      });
    }
    return null;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

async function getLastRow(sheets, spreadsheetId, sheetName) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:A`,
    });

    const values = response.data.values;
    if (!values || values.length === 0) {
      return 1;
    }
    return values.length + 1;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

async function writeToGoogleSheet(
  data,
  append = true,
  spreadsheetId,
  sheetName,
) {
  try {
    await writeHeadersToSheet(spreadsheetId, sheetName);
    const credentials = require("./credentials.json");
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    );

    const sheets = google.sheets({ version: "v4", auth });
    const values = data.map((item) =>
      MONGODB_HEADERS.map((header) => item[header] ?? ""),
    );

    const startRow = append
      ? await getLastRow(sheets, spreadsheetId, sheetName)
      : 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A${startRow}`,
      valueInputOption: "RAW",
      resource: {
        values: values,
      },
    });

    console.log(`Successfully wrote ${values.length} rows to the sheet`);
    return true;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

// Function to read mock data
function readMockData() {
  try {
    const mockData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "mockData.json"), "utf8"),
    );
    return mockData.mockData;
  } catch (error) {
    console.error("Error reading mockData.json:", error);
    throw error;
  }
}

// Test function to write mock data
async function testWriteMockData(spreadsheetId, sheetName) {
  try {
    console.log("Starting mock data write test...");
    const mockData = readMockData();
    console.log(`Read ${mockData.length} mock records`);

    // Write headers first
    await writeHeadersToSheet(spreadsheetId, sheetName);
    console.log("Headers written successfully");

    // Write mock data
    const result = await writeToGoogleSheet(
      mockData,
      true,
      spreadsheetId,
      sheetName,
    );
    console.log(
      "Mock data write test completed:",
      result ? "Success" : "Failed",
    );
    return result;
  } catch (error) {
    console.error("Error in testWriteMockData:", error);
    throw error;
  }
}

// Modify the existing readGoogleSheet call to be commented out by default
// readGoogleSheet(download = false, idStartFrom = 5);

module.exports = {
  MONGODB_HEADERS,
  writeToGoogleSheet,
  readGoogleSheet,
  testWriteMockData, // Export the test function
};
