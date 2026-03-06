const { launchLocalHost } = require("./setup/localhost/launch");

const runLocalHost = async () => {
  await launchLocalHost();
};

module.exports = { runLocalHost };
