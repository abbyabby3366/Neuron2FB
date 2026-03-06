try {
  let targetButtonId = fsSync.readFileSync("targetButtonId.txt", "utf8");
  while (!targetButtonId) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    targetButtonId = fsSync.readFileSync("targetButtonId.txt", "utf8");
  }
  console.log("targetButtonId found: ", targetButtonId);

  const targetItemHandle = await page.evaluateHandle((id) => {
    let buttonHandle = document.getElementById(id);
    if (buttonHandle) return buttonHandle;
    else return null;
  }, targetButtonId);

  if (!targetItemHandle.asElement())
    throw new Error(
      "Winbox SBO - Bet event not found by targetButtonId = ",
      targetButtonId,
      ", empty handler",
    );

  console.log("Winbox SBO - Clicking event: " + getCurrentTime());
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await targetItemHandle.asElement().click(); //asElement is optional, but got typescript safety
  console.log("Winbox SBO - Clicked event: " + getCurrentTime());
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // wait for ticket body to load
  let odds = await page.waitForSelector(
    "div.selection-body.ticket-mp-body div.ticket-content div.ticket-option span.odds",
  );
  console.log("ticket body loaded");

  try {
    const oddsChangedPopUp =
      "div.swal2-popup.swal2-modal.swal2-show h2.swal2-title";
    let headerText = await page.$eval(
      oddsChangedPopUp,
      (header) => header.textContent,
      { timeout: 1000 },
    );
    if (headerText.includes("changed"))
      console.log("Odds changed popup detected");
    else throw new Error("Odds changed popup not detected");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await page.$eval("button.swal2-confirm", (el) => el.click());
    console.log("Clicked the OK button");
  } catch (error) {
    console.log("No odds changed popup detected");
  }
  await new Promise((resolve) => setTimeout(resolve, 50));

  //click on submit button
  await page.$eval("#tk\\:tk\\:submittc", (el) => el.click());
  console.log("Clicked the submit button");
  await new Promise((resolve) => setTimeout(resolve, 50));

  try {
    // Wait for the captcha div to appear
    const captchaSelector = "div.swal2-popup.swal2-modal.swal2-show";
    let captchaDiv = await page.waitForSelector(captchaSelector, {
      timeout: 1000,
    });
    if (captchaDiv) {
      console.log("Captcha popup detected");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Find the image element
      const imageElement = await page.$("img.swal2-image");
      if (imageElement) console.log("Captcha image found");
      if (!imageElement) {
        console.log("Captcha image not found, skipping process");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("performing base64 data extraction");
      // Option 2: Extract base64 data of the image
      const base64Data = await page.evaluate(async (img) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL("image/png").split(",")[1];
      }, imageElement);
      console.log("Base64 data extracted");
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log("Saving captcha image from base64 data");
      await fs.writeFile("captcha_from_base64.png", base64Data, "base64");
      console.log("Captcha image saved from base64 data");

      // Perform OCR
      const worker = await createWorker("eng");
      const {
        data: { text },
      } = await worker.recognize("captcha_from_base64.png");
      await worker.terminate();
      const numbersOnly = text.replace(/\D/g, "");
      console.log("Original OCR result:", text);
      console.log("Numbers only:", numbersOnly);

      // Input the OCR result into the captcha field
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await page.click("input.swal2-input");
      console.log("Clicked the input box");

      await new Promise((resolve) => setTimeout(resolve, 300));
      console.log("now typing...");
      await page.type("input.swal2-input", text, { delay: 150 });
      console.log(
        'Entered OCR result into captcha field, now trying to press "enter" if needed',
      );

      const selectorExists = await page
        .waitForSelector("button.swal2-confirm", {
          timeout: 500,
          visible: true,
        })
        .then(() => true)
        .catch(() => false);

      if (selectorExists) {
        console.log(`Selector 'confirm captcha' found. Pressing Enter.`);
        await page.keyboard.press("Enter");
      } else {
        console.log(
          `Selector 'confirm captcha' not found within 1000 ms. Continuing...`,
        );
      }
    }
    // Click the submit button
    // await new Promise(resolve => setTimeout(resolve, 1000));
    // await page.click('button.swal2-confirm');
    // console.log('Clicked the submit button');
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    console.log("Now I should be checking if bets have entered");
    console.log("----------------------------------------------");
  }

  // Wait for the green dialog box

  await page.waitForFunction(
    () => {
      const element = document.querySelector(
        "div.selection-body.ticket-mp-body div.ticket-content span#ticket-successful-msg",
      );
      return element && element.innerText.includes("processed");
    },
    { timeout: 5000 },
  );
  console.log("Green dialog box appeared: " + getCurrentTime());

  //get ref number
  const refNumber = await page.evaluate(() => {
    const refNumber = document.querySelector(
      "div.selection-body.ticket-mp-body div.ticket-content div.ticket-bet-receipt td",
    );
    console.log("Ref number:", refNumber.textContent);
    return refNumber.textContent;
  });

  console.log("Ref number:", refNumber);

  await page.waitForFunction(
    () => {
      const element = document.querySelector(
        "div.selection-body.ticket-mp-body div.ticket-content span#ticket-successful-msg",
      );
      return !element;
    },
    { timeout: 100000 },
  );
  console.log("Green dialog box disappeared: " + getCurrentTime());

  //find betted odds
  bettedOdds = await page.evaluate(async (refNumber) => {
    // let mostRecentBetFound = false; let mostRecentBet; let odds;
    // while (!mostRecentBetFound) {
    //   await new Promise(resolve => setTimeout(resolve, 100));
    //   const recentBets = document.querySelectorAll('div.my-bet-block div.pending-bet-wrap div.my-bet-item');
    //   for (let i = 0; i < recentBets.length; i++) {
    //     targettedBet = recentBets[i];
    //     if (targettedBet && targettedBet.innerText.trim().length > 0) {
    //       const ref = targettedBet.querySelector('span').innerText;
    //       console.log('ref:', ref)
    //       console.log('refNumber:', refNumber)
    //       console.log('ref to string:', ref.toString())
    //       console.log('refNumber to string:', refNumber.toString())
    //       if (ref.toString() === refNumber.toString()) {
    //         console.log('ref number matched')
    //         mostRecentBetFound = true;
    //         mostRecentBet = targettedBet;
    //       }
    //     }
    //   }
    // }

    //find the most recent bet by id
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const mostRecentBetRef = document.getElementById(refNumber);
      console.log("finding most recent bet by refNumber...");
      if (mostRecentBetRef) {
        console.log("Most recent bet found. Ref Number:", refNumber);
        break;
      }
    }

    let bettedOdds;
    //wait for the new div to appear just in case
    await new Promise((resolve) => setTimeout(resolve, 300));
    while (true) {
      let statusSpan = document
        .getElementById(refNumber)
        .querySelector("span.mini-bet-list-status");
      let status = statusSpan.innerText;
      if (status === "Waiting") {
        console.log(status, ". Most recent bet is waiting" + new Date());
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      } else if (status === "Running") {
        console.log(status, ". Most recent bet is running" + new Date());
        bettedOdds =
          statusSpan.parentNode.parentNode.querySelector(
            "span.mini-bet-odds",
          ).innerText;
        break;
      } else {
        console.log(
          status,
          ". Most recent bet is not waiting or running, likely got rejected",
        );
        break;
      }
    }

    return bettedOdds;
  }, refNumber);

  console.log("Betted odds:", parseFloat(bettedOdds));
} catch (error) {
  console.error(error);
}
