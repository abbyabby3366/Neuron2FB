let proceedSBB = false;

function getProceedSBB() {
  return proceedSBB;
}

function setProceedSBB(status) {
  proceedSBB = status;
}

module.exports = { getProceedSBB, setProceedSBB };
