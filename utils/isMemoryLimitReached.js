function isMemoryLimitReached(page, threshold = 0.9) {
  let memoryLimitReached = page.evaluate((threshold) => {
    if (window.performance && window.performance.memory) {
      const memory = window.performance.memory;
      const usedJSHeapSize = memory.usedJSHeapSize;
      const totalJSHeapSize = memory.totalJSHeapSize;
      const jsHeapSizeLimit = memory.jsHeapSizeLimit;
      // console.log('% = ', usedJSHeapSize / jsHeapSizeLimit)

      let isMemoryLimitReached = usedJSHeapSize > jsHeapSizeLimit * threshold;
      // console.log('isMemoryLimitReached', isMemoryLimitReached)
      return isMemoryLimitReached;
    } else {
      return false;
    }
  }, threshold);
  return memoryLimitReached;
}

module.exports = { isMemoryLimitReached };
