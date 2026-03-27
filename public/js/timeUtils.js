export function parseTimeToMinutes(timeStr) {
  const h = parseInt(timeStr.substring(0, 2), 10);
  const m = parseInt(timeStr.substring(2, 4), 10);
  return h * 60 + m;
}

export function isWithinWindows(windows) {
  if (!windows || !Array.isArray(windows) || windows.length === 0) return true;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const window of windows) {
    const [startStr, endStr] = window.split("-");
    const start = parseTimeToMinutes(startStr);
    const end = parseTimeToMinutes(endStr);

    if (start <= end) {
      if (nowMinutes >= start && nowMinutes < end) return true;
    } else {
      if (nowMinutes >= start || nowMinutes < end) return true;
    }
  }

  return false;
}
