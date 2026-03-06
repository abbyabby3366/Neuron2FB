const fs = require("fs").promises;
const util = require("util");
const exec = util.promisify(require("child_process").exec);

/**
 * Forcefully closes a Puppeteer browser and cleans up its data.
 * @param {object} browser - The Puppeteer browser instance.
 * @param {string} acc - The account identifier (e.g., 'sbo1').
 */

async function cleanupBrowser(browser, acc) {
  if (!browser) {
    console.log(`No browser instance to clean up for ${acc}.`);
    return;
  }

  const pid = browser.process()?.pid;
  const path = browser
    .process()
    ?.spawnargs.find((arg) => arg.startsWith("--user-data-dir="));
  const userDataDir = path ? path.split("=")[1] : null;

  console.log(`Cleaning up for ${acc}...`);

  try {
    await browser.close();
    console.log(`Browser for ${acc} closed gracefully.`);
  } catch (e) {
    console.error(
      `Error during graceful browser close for ${acc}: ${e.message}. Proceeding with forceful cleanup.`,
    );
  }

  if (pid) {
    try {
      if (process.platform === "win32") {
        await exec(`taskkill /PID ${pid} /F /T`);
      } else {
        await exec(`kill -9 ${pid}`);
      }
      // console.log(`Forcefully terminated process tree for PID: ${pid} (${acc}).`);
    } catch (e) {
      // It's possible the process is already gone, so we log this as a warning.
      // console.warn(`Could not kill process ${pid} for ${acc}. It might have already been terminated: ${e.message}`);
    }
  } else {
    // console.warn(`No PID found for ${acc}'s browser. Skipping process termination.`);
  }

  if (userDataDir) {
    try {
      await fs.rm(userDataDir, { recursive: true, force: true });
      // console.log(`Removed user data directory for ${acc}: ${userDataDir}`);
    } catch (e) {
      // console.error(`Failed to remove user data directory for ${acc} at ${userDataDir}: ${e.message}`);
    }
  } else {
    // console.warn(`No user data directory found for ${acc}. Skipping directory removal.`);
  }
}

module.exports = { cleanupBrowser };
