const { getRawDB } = require("./NeuronDB/getRawDB");
const { getSBONeuronDB } = require("./SBODB/getSBONeuronDB");
const { getIBC12betNeuronDB } = require("./IBC12betDB/getIBC12betNeuronDB");

getRawDB();
getSBONeuronDB();
getIBC12betNeuronDB();
