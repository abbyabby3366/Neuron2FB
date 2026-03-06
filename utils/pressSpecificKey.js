const pressSpecificKey = (message, key) => {
  console.log(message);
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (chunk) => {
      if (chunk.toString() === key) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve();
      }
    });
  });
};

module.exports = { pressSpecificKey };
