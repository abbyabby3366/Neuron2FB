const getCurrentTime = () => {
  return new Date()
    .toISOString()
    .replace("T", " ")
    .replace("Z", "")
    .replace(
      /\.\d{3}/,
      `.${new Date().getMilliseconds().toString().padStart(3, "0")}`,
    );
};

module.exports = { getCurrentTime };
