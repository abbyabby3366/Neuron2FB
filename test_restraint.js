const { autoBetRestraints } = require("./utils/autobetRestraints");

async function test() {
  const result = await autoBetRestraints("sbo0", undefined, false);
  console.log("Result for sbo0, undefined, false:", result);
}

test();
