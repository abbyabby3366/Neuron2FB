const fsSync = require("fs");
const { launchSBO } = require("../run/setup/sbo/launch");
const { launchHGA } = require("../run/setup/hga/launch");
const { launchIBC } = require("../run/setup/ibc/launch");
const { launchISN } = require("../run/setup/isn/launch");
const { launch3838 } = require("../run/setup/ps3838/launch");
const { launchObet } = require("../run/setup/obet/launch");
const { login: loginSBO } = require("../run/setup/sbo/login");
const { login: loginHGA } = require("../run/setup/hga/login");
const { login: loginIBC } = require("../run/setup/ibc/login");
const { login: loginISN } = require("../run/setup/isn/login");
const { login: login3838 } = require("../run/setup/ps3838/login");
const { login: loginObet } = require("../run/setup/obet/login");
const { setupPage: setupPageSBO } = require("../run/setup/sbo/setupPage");
const { setupPage: setupPageHGA } = require("../run/setup/hga/setupPage");
const { setupPage: setupPageIBC } = require("../run/setup/ibc/setupPage");
const { setupPage: setupPageISN } = require("../run/setup/isn/setupPage");
const { setupPage: setupPage3838 } = require("../run/setup/ps3838/setupPage");
const { setupPage: setupPageObet } = require("../run/setup/obet/setupPage");
const { cleanupBrowser } = require("./cleanupBrowser");

const setupBookie = async (acc, browsers, pages, isSetupReady) => {
  console.log(`Setting up ${acc} now`);
  let retryCount = 0;
  const MAX_RETRIES = 3;
  let browser2;
  let login;
  let setupPage;

  while (retryCount < MAX_RETRIES) {
    try {
      if (acc.startsWith("sbo")) {
        browser2 = await launchSBO(acc);
        browsers[acc] = browser2;
        login = loginSBO;
        setupPage = setupPageSBO;
      } else if (acc.startsWith("hga")) {
        browser2 = await launchHGA(acc);
        browsers[acc] = browser2;
        login = loginHGA;
        setupPage = setupPageHGA;
      } else if (acc.startsWith("ibc")) {
        browser2 = await launchIBC(acc);
        browsers[acc] = browser2;
        login = loginIBC;
        setupPage = setupPageIBC;
      } else if (acc.startsWith("isn")) {
        browser2 = await launchISN(acc);
        browsers[acc] = browser2;
        login = loginISN;
        setupPage = setupPageISN;
      } else if (acc.startsWith("ps3838")) {
        browser2 = await launch3838(acc);
        browsers[acc] = browser2;
        login = login3838;
        setupPage = setupPage3838;
      } else if (acc.startsWith("obet")) {
        browser2 = await launchObet(acc);
        browsers[acc] = browser2;
        login = loginObet;
        setupPage = setupPageObet;
      }

      // const user = userAccountList[accNo];
      let params = JSON.parse(
        fsSync.readFileSync(`TargetBookie/${acc}.json`, "utf-8"),
      );
      const user = params.user;

      console.log(`${acc} Login Credential: `, acc, user.username);

      let page = await browser2.newPage();

      if (params.removeCSS || acc.startsWith("ps3838")) {
        await page.setRequestInterception(true);
        page.on("request", (req) => {
          // Block s2.adform.net requests for PS3838
          if (acc.startsWith("ps3838") && req.url().includes("s2.adform.net")) {
            console.log(`Blocking request to: ${req.url()}`);
            req.abort();
            return;
          }

          // Block CSS and other media requests if removeCSS is true
          if (
            params.removeCSS &&
            ["font", "media"].includes(req.resourceType())
          ) {
            req.abort();
          } else {
            req.continue();
          }
        });
      }

      pages[acc] = page;
      let loginStatus = await login(page, user);
      if (!loginStatus) throw new Error(`${acc} Login failed`);

      //this is for ps3838 initially
      if (params.removeCSS) {
        await page.evaluate(() => {
          for (let i = document.styleSheets.length - 1; i >= 0; i--) {
            document.styleSheets[i].disabled = true;
          }
        });
      }

      let setupStatus = await setupPage(page);
      if (!setupStatus) throw new Error(`${acc} SetupPage failed`);
      isSetupReady[acc] = true;

      console.log(`${acc} - setup done`);
      return { status: true };
    } catch (e) {
      // console.error(`Error in setup${acc} (Attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
      // browsers[acc]?.close();
      // retryCount++;

      console.error(
        `Error in setupBookie for ${acc} (Attempt ${retryCount + 1}/${MAX_RETRIES}):`,
        e,
      );
      await cleanupBrowser(browsers[acc], acc);
      retryCount++;

      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying setupSBO for ${acc} in 5 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  console.log(`Max retries reached for ${acc}. Setup failed.`);
  return { status: false, message: "Max retries reached" };
};

module.exports = { setupBookie };
