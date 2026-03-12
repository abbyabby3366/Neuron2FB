const _ = require("lodash");

/**
 * Returns an object containing the keys that are different between oldObj and newObj.
 * Only includes keys from newObj that have changed or are new.
 */
function getObjectDiff(oldObj, newObj) {
  const diff = {};

  if (!oldObj || typeof oldObj !== 'object') return newObj;

  for (const key in newObj) {
    if (!_.isEqual(oldObj[key], newObj[key])) {
      if (_.isPlainObject(newObj[key]) && _.isPlainObject(oldObj[key])) {
        const nestedDiff = getObjectDiff(oldObj[key], newObj[key]);
        if (Object.keys(nestedDiff).length > 0) {
          diff[key] = nestedDiff;
        }
      } else {
        diff[key] = newObj[key];
      }
    }
  }

  return diff;
}

module.exports = { getObjectDiff };
