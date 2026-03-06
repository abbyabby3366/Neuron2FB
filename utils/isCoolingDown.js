const { broadcast } = require("./webSocket");

let isCoolingDownObj = {};
let cooldownInterval = {};

function startCooldown(seconds, acc) {
  if (isCoolingDownObj[acc]) {
    console.log("Auto betting is on cooldown.");
    return;
  }

  isCoolingDownObj[acc] = true;
  console.log(`${acc} - Cooldown started.`);

  let remainingTime = seconds;

  cooldownInterval[acc] = setInterval(() => {
    remainingTime -= 1;
    broadcast(JSON.stringify({ acc, remainingTime }));

    if (remainingTime <= 0) {
      clearInterval(cooldownInterval[acc]);
      isCoolingDownObj[acc] = false;
      console.log(`Cooldown for ${acc} ended.`);
      console.log("isCoolingDownObj", isCoolingDownObj);
      broadcast(JSON.stringify({ acc, remainingTime: 0 }));
    }
  }, 1000);
}

function checkCooldownStatus(acc) {
  // console.log('checking cooldown status for', acc, 'isCoolingDown=', isCoolingDownObj);
  // console.log('checkCooldownStatus, is returning isCoolingDownObj[acc]:', isCoolingDownObj[acc]);
  // console.log('check cooldownInterval', cooldownInterval)
  return isCoolingDownObj[acc];
}

module.exports = { startCooldown, checkCooldownStatus, isCoolingDownObj };
