function EUtoEU(euOdds) {
  return euOdds;
}

// Convert Malay odds to European (decimal) odds
function MYtoEU(malayOdds) {
  if (malayOdds >= 0) {
    return malayOdds + 1;
  } else {
    return 1 - 1 / malayOdds;
  }
}

// Convert Hong Kong odds to European (decimal) odds
function HKtoEU(hkOdds) {
  return hkOdds + 1;
}

// Convert Indonesian odds to European (decimal) odds
function IDtoEU(indoOdds) {
  if (indoOdds >= 0) {
    return indoOdds + 1;
  } else {
    return 1 / Math.abs(indoOdds) + 1;
  }
}

// Convert American odds to European (decimal) odds
function UStoEU(americanOdds) {
  if (americanOdds > 0) {
    return americanOdds / 100 + 1;
  } else return 100 / Math.abs(americanOdds) + 1;
}

// Convert Fractional odds to European (decimal) odds
function FracToEU(numerator, denominator) {
  return numerator / denominator + 1;
}

module.exports = { EUtoEU, MYtoEU, HKtoEU, IDtoEU, UStoEU, FracToEU };
