const calculateParam = (str) => {
  if (!str) return null;
  const nums = str.split("/").map((s) => parseFloat(s.trim()));
  if (nums.length == 1) return nums[0];
  if (str.trim().startsWith("-") && nums[0] < 0 && nums.length > 1) {
    nums[1] = -Math.abs(nums[1]);
  }
  return (nums[0] + nums[1]) / 2;
};

// Your test case
const testString1 = "-0.5 / 1";
console.log(`Input: "${testString1}"`);
console.log(`Result: ${calculateParam(testString1)}`);
console.log("---");

// Another test case from scrape/hga.js
const testString2 = "0.5/1";
console.log(`Input: "${testString2}"`);
console.log(`Result: ${calculateParam(testString2)}`);
console.log("---");

const testString3 = "1";
console.log(`Input: "${testString3}"`);
console.log(`Result: ${calculateParam(testString3)}`);
console.log("---");

const testString4 = "-1";
console.log(`Input: "${testString4}"`);
console.log(`Result: ${calculateParam(testString4)}`);
console.log("---");

const testString5 = "-1 / -1.5";
console.log(`Input: "${testString5}"`);
console.log(`Result: ${calculateParam(testString5)}`);
console.log("---");

const testString6 = "0 / -0.5";
console.log(`Input: "${testString6}"`);
console.log(`Result: ${calculateParam(testString6)}`);
console.log("---");

// The original function from ticketHGA for comparison
const originalCalculateParam = (str) => {
  if (!str) return null;
  const nums = str.split("/").map(Number);
  if (nums.length == 1) return nums[0];
  if (str.startsWith("-")) nums[1] = -nums[1];
  return (nums[0] + nums[1]) / 2;
};

console.log("\n--- Original Function Results ---");
console.log(`Input: "${testString1}"`);
console.log(`Result: ${originalCalculateParam(testString1)}`);
console.log("---");
console.log(`Input: "${testString5}"`);
console.log(`Result: ${originalCalculateParam(testString5)}`);
console.log("---");
console.log(`Input: "${testString6}"`);
console.log(`Result: ${originalCalculateParam(testString6)}`);
console.log("---");
