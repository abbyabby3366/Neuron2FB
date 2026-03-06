const ngrok = require("ngrok");
const fs = require("fs");
const path = require("path");

async function startNgrokTunnel() {
  try {
    // Connect to the local server
    const url = await ngrok.connect({
      proto: "http",
      addr: 3000, // Your local server port
      authtoken: "", // Optional: add your ngrok authtoken if you have one
    });

    // Append the specific API endpoint
    const fullWebhookUrl = `${url}/api/save-params/`;

    console.log("Ngrok tunnel created:", fullWebhookUrl);

    // Construct the path to mainParams.json one directory up
    const mainParamsPath = path.join(__dirname, "..", "mainParams.json");

    // Read existing JSON file
    let mainParams;
    try {
      mainParams = JSON.parse(fs.readFileSync(mainParamsPath, "utf8"));
    } catch (readError) {
      // If file doesn't exist or is invalid, create a default structure
      mainParams = {
        instance_id: "ins001",
        webhook_ip: "",
        run: false,
      };
    }

    // Update the webhook_ip
    mainParams.webhook_ip = fullWebhookUrl;

    // Write updated JSON back to file
    fs.writeFileSync(
      mainParamsPath,
      JSON.stringify(mainParams, null, 2),
      "utf8",
    );

    console.log(`Ngrok URL saved to ${mainParamsPath}`);

    // Optional: Keep the process running
    process.on("SIGINT", async () => {
      await ngrok.disconnect();
      await ngrok.kill();
      process.exit();
    });
  } catch (error) {
    console.error("Error starting ngrok:", error);
  }
}

module.exports = { startNgrokTunnel };
// startNgrokTunnel();
