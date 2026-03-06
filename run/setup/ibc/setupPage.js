async function setupPage(page) {
  console.log("IBC - preparing to setup");
  let status = false;

  try {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await page.waitForSelector(
      "#header > header > div.c-header__option > div.c-btn-group > div.c-dropdown.c-dropdown--Decimal > div.c-dropdown__btn",
      { timeout: 60000 },
    );

    //change to eu odds
    await page.evaluate(() => {
      const oddsChange = document.querySelector(
        "#header > header > div.c-header__option > div.c-btn-group > div.c-dropdown.c-dropdown--Decimal > div.c-dropdown__btn",
      );
      if (!oddsChange) throw new Error("Element OddsChange not found");
      element.click();

      const euOdds = document.querySelector("#oddsType_Decimal > span");
      if (!euOdds) throw new Error("Element EU Odds not found");
      euOdds.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    //click live markets
    await page.evaluate(() => {
      const element = document.querySelector(
        '.c-side-nav__header[title="Sports"] ~ div.c-side-nav__tabs div.c-side-nav__tab[title="Live"]',
      );
      if (!element) throw new Error("Live tab element not found");
      element.click();
    });

    //show only soccer
    await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      document.querySelector("#menu_all > label > i").click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      document.querySelector("#sport1 > label > i").click();
    });

    //choose main market
    await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      document
        .querySelector(
          "#mainArea > div > div.c-odds-page__header > div.c-odds-page__option > div.c-dropdown.c-dropdown--right > div.c-dropdown__btn",
        )
        .click();
      await new Promise((resolve) => setTimeout(resolve, 200));
      document.querySelector("#marketType_Main > span").click();
    });

    // await page.waitForSelector('div.c-match__odds.c-match__odds--more-lines > a.c-btn.c-btn--more-lines');
    // Select all matching elements
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await page.evaluate(() => {
      const popupPanel = document.querySelector("div#popupPanel");
      if (popupPanel) {
        const okBtn = popupPanel.querySelector(".c-btn-group .c-btn.c-btn--primary");
        if (okBtn) okBtn.click();
      }
    });


    console.log("IBC - setup completed: " + new Date());

    status = true;
  } catch (e) {
    console.log(e);
  }

  try {
    //close rejected bets if any
    await page.evaluate(async () => {
      while (true) {
        const handle = document.querySelector(
          "div.myBets div.bet.rejected.live span.btn-content",
        );
        if (!handle) break;
        console.log("IBC - closing a rejected bet...");
        handle.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    });
  } catch (e) {
    console.log(e);
  }

  return status;
}

module.exports = { setupPage };
