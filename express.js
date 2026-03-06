require("dotenv").config();
const fs = require("fs");
const helmet = require("helmet");
const express = require("express");
const app = express();
const cors = require("cors");
const { main } = require("./index");
const { autoBetSbo } = require("./run/autobet/autobetSBO");
const { readData } = require("./mongodb/db");
const path = require("path");
// const { _, browsers, pages, isReady } = require('./run/runSBO.js');
const { runSBOs, browsers, pages, isSetupReady } = require("./run/runSBOs.js");
const { startNgrokTunnel } = require("./utils/ngrok");

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  res.removeHeader("Alt-Svc");
  res.removeHeader("Cf-Ray");
  res.removeHeader("Server");
  res.removeHeader("X-Powered-By");
  res.removeHeader("X-Render-Origin-Server");
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        connectSrc: ["'self'", "ws://localhost:8080"],
      },
    },
  }),
);
app.use(express.static("public")); // To serve static files like CSS

app.get("/pending", (req, res) => {
  res.sendFile(__dirname + "/public/pending.html");
});

app.get("/pending/:account", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pending.html"));
});

app.use("/success", (req, res) => {
  res.sendFile(__dirname + "/public/success.html");
});

app.use("/success/:account", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "success.html"));
});

app.use("/screen", (req, res) => {
  res.sendFile(__dirname + "/public/screen/screen.html");
});

// Function to get all pending bets
async function getAllPendingBets(req, res) {
  let pendingBetListSBO = [];
  try {
    // const filter = { acc: { $regex: '^sbo' } }; // Assuming SBO accounts start with 'sbo'
    // pendingBetListSBO = await readData('pendingBetList', filter);
    pendingBetListSBO = await readData("pendingBetList");
    // console.log(`Retrieved ${pendingBetListSBO.length} pending bets for SBO`);
  } catch (error) {
    console.error("Error retrieving pendingBetListSBO:", error);
  }
  res.send({ pendingBetListSBO });
}

// Function to get pending bets for a specific SBO account
async function getSpecificPendingBets(req, res) {
  const acc = req.params.account;
  let pendingBetListSBO = [];
  let autobet_params_json = {};

  try {
    const filter = { acc: acc };
    pendingBetListSBO = await readData("pendingBetList", filter);
    // console.log(`Retrieved ${pendingBetListSBO.length} pending bets for ${acc}`);
  } catch (error) {
    console.error(`Error retrieving pendingBetListSBO for ${acc}:`, error);
  }

  try {
    autobet_params_json = JSON.parse(
      fs.readFileSync(`./TargetBookie/${acc}.json`, "utf-8"),
    );
  } catch (error) {
    console.error(`Error reading autobet params file for ${acc}:`, error);
  }

  res.send({
    pendingBetListSBO,
    autoBet: autobet_params_json.autoBet,
    cooldownTimeInSeconds: autobet_params_json.cooldownTimeInSeconds,
  });
}

// Endpoint to get data from MongoDB and JSON file
app.get("/api/pending", getAllPendingBets);

// Endpoint to get pending bets for a specific SBO account
app.get("/api/pending/:account", getSpecificPendingBets);

// Function to get all success bets
async function getAllSuccessBets(req, res) {
  let successBetListSBO = [];
  try {
    successBetListSBO = await readData("successBetList");
    // console.log(`Retrieved ${successBetListSBO.length} ALL success bets for SBO`);
  } catch (error) {
    console.error("Error retrieving successBetListSBO:", error);
  }
  res.send({ successBetListSBO });
}

// Function to get success bets for a specific SBO account
async function getSpecificSuccessBets(req, res) {
  const acc = req.params.account;
  console.log("acc:", acc);
  let successBetListSBO = [];

  try {
    const filter = { acc: acc };
    successBetListSBO = await readData("successBetList", filter);
    // console.log(`Retrieved ${successBetListSBO.length} specific success bets for ${acc}`);
  } catch (error) {
    console.error(`Error retrieving successBetListSBO for ${acc}:`, error);
  }

  res.send({
    successBetListSBO,
  });
}

// Endpoint to get all success bets
app.get("/api/success", getAllSuccessBets);

// Endpoint to get success bets for a specific SBO account
app.get("/api/success/:account", getSpecificSuccessBets);

app.get("/api/screen", (req, res) => {
  const screenList = JSON.parse(
    fs.readFileSync("./public/screen/finalScreen.json", "utf-8"),
  );
  res.send(screenList);
});

app.get("/api/toggle/:account", (req, res) => {
  let acc = req.params.account;
  try {
    const autobet_params = JSON.parse(
      fs.readFileSync(`./TargetBookie/${acc}.json`, "utf-8"),
    );
    autobet_params.autoBet = !autobet_params.autoBet;
    fs.writeFileSync(
      `./TargetBookie/${acc}.json`,
      JSON.stringify(autobet_params),
    );
    console.log(`${acc} auto bet toggled: ` + autobet_params.autoBet);
    res.send(autobet_params.autoBet);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/save-cooldown/:account", (req, res) => {
  let acc = req.params.account;
  let { cooldownTimeInSeconds } = req.body;

  try {
    const autobet_params = JSON.parse(
      fs.readFileSync(`./TargetBookie/${acc}.json`, "utf-8"),
    );
    if (isNaN(Number(cooldownTimeInSeconds))) {
      return res.status(400).send("Invalid cooldown time");
    }
    autobet_params.cooldownTimeInSeconds = Number(cooldownTimeInSeconds);
    fs.writeFileSync(
      `./TargetBookie/${acc}.json`,
      JSON.stringify(autobet_params),
    );
    res.json({
      success: true,
      message: `Cooldown time = ${Number(cooldownTimeInSeconds)} updated for ${acc}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/targetbookie-files", (req, res) => {
  const targetBookiePath = path.resolve(__dirname, "TargetBookie");
  // console.log('Attempting to read directory:', targetBookiePath);

  fs.readdir(targetBookiePath, (err, files) => {
    if (err) {
      console.error("Error reading directory:", err);
      return res
        .status(500)
        .json({ error: "Unable to read directory", details: err.message });
    }
    // Filter out files that include the word "data"
    const filteredFiles = files.filter(
      (file) => !file.toLowerCase().includes("data"),
    );

    // console.log('Filtered files:', filteredFiles);
    res.json(filteredFiles);
  });
});

app.get("/close", (req, res) => {
  closeBrowser(res);
});

app.post("/getNoVig", async (req, res) => {
  ticketEvent(req.body);
  res.status(200).send(req.body);
});

app.post("/bet", async (req, res) => {
  const acc = req.body.acc;
  console.log("Manual Betting acc:", acc);

  // Retrieve the index parameter from the request
  autoBetSbo(pages[acc], req.body);
  res.status(200).send(true);
});

// save params to local file
app.post("/api/save-params/", (req, res) => {
  let params = req.body;
  console.log("Received POST request for params:", params);

  try {
    fs.writeFileSync(
      `./TargetBookie/sbo0.json`,
      JSON.stringify(params.SBO_param, null, 2),
    );
    fs.writeFileSync(
      `./TargetBookie/ps38380.json`,
      JSON.stringify(params.PS3838_params, null, 2),
    );

    let mainParams = {
      instance_id: params.instance_id,
      webhook_ip: params.webhook_ip,
      run: params.run,
    };
    fs.writeFileSync(`./mainParams.json`, JSON.stringify(mainParams, null, 2));

    console.log(
      "Parameters updated successfully for sbo0 and ps38380 and main params",
    );

    res.json({
      success: true,
      message: `Parameters updated successfully for sbo0 and ps38380`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.send("Hello xiren");
});

app.listen(PORT, "0.0.0.0", async () => {
  try {
    console.log(`Main() is running on http://localhost:${PORT}`);
    // await startNgrokTunnel();
    // await sendInitialParams();
    await main();
  } catch (err) {
    console.log("Catching error from express,", err);
  }
});

//read initial params and send out
const sendInitialParams = async () => {
  const params = require("./mainParams.json");
  const sboParams = require("./TargetBookie/sbo0.json");
  const ps3838Params = require("./TargetBookie/ps38380.json");
  params.SBO_param = sboParams;
  params.PS3838_params = ps3838Params;

  await fetch("https://nw.neuron.my/request-in/", {
    method: "POST",
    headers: {
      "X-API-KEY": "neuronwinapikey",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  console.log("Initial params sent to nw.neuron.my successfully");

  // console.log('params:', params)
};

const closeBrowser = async (res) => {
  try {
    if (browsers) {
      await browsers[Object.keys(browsers)[0]].close();
      res.status(200).send(true);
    }
  } catch (e) {
    console.error(e);
    res.status(500).send(false);
  }
};

async function exitApp() {
  if (browsers) {
    // Close all browser instances
    for (const browser of Object.values(browsers)) {
      await browser.close();
    }
  }
}

// Capture exit signals to close the browser before exiting
process.on("exit", () => {
  exitApp();
});

process.on("SIGINT", () => {
  exitApp();
  process.exit(0);
});

process.on("SIGTERM", () => {
  exitApp();
  process.exit(0);
});

process.on("SIGUSR2", () => {
  exitApp();
  process.kill(process.pid, "SIGUSR2");
});
