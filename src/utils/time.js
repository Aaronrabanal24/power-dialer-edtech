export const STATE_TO_TZ = {
  AL:"America/Chicago", AK:"America/Anchorage", AZ:"America/Phoenix", AR:"America/Chicago",
  CA:"America/Los_Angeles", CO:"America/Denver", CT:"America/New_York", DE:"America/New_York",
  FL:"America/New_York", GA:"America/New_York", HI:"Pacific/Honolulu", ID:"America/Denver",
  IL:"America/Chicago", IN:"America/New_York", IA:"America/Chicago", KS:"America/Chicago",
  KY:"America/New_York", LA:"America/Chicago", ME:"America/New_York", MD:"America/New_York",
  MA:"America/New_York", MI:"America/New_York", MN:"America/Chicago", MS:"America/Chicago",
  MO:"America/Chicago", MT:"America/Denver", NE:"America/Chicago", NV:"America/Los_Angeles",
  NH:"America/New_York", NJ:"America/New_York", NM:"America/Denver", NY:"America/New_York",
  NC:"America/New_York", ND:"America/Chicago", OH:"America/New_York", OK:"America/Chicago",
  OR:"America/Los_Angeles", PA:"America/New_York", RI:"America/New_York", SC:"America/New_York",
  SD:"America/Chicago", TN:"America/Chicago", TX:"America/Chicago", UT:"America/Denver",
  VT:"America/New_York", VA:"America/New_York", WA:"America/Los_Angeles", WV:"America/New_York",
  WI:"America/Chicago", WY:"America/Denver",
};

export const getLocalTime = (timezone) => {
  try {
    return new Date().toLocaleTimeString("en-US", { timeZone: timezone, hour12: true, hour:"numeric", minute:"2-digit" });
  } catch {
    return new Date().toLocaleTimeString("en-US", { hour12: true, hour:"numeric", minute:"2-digit" });
  }
};

export const getLocalHour = (timezone) => {
  try {
    const hh = new Date().toLocaleTimeString("en-US", { timeZone: timezone, hour12: false, hour:"2-digit" });
    return parseInt(hh, 10);
  } catch {
    return new Date().getHours();
  }
};

export const callWindowForTitle = (title) => {
  const t = (title || "").toLowerCase();
  const windows = {
    "distance ed": { start: 10, end: 16 },
    lms: { start: 10, end: 16 },
    ada: { start: 11, end: 15 },
    accessibility: { start: 11, end: 15 },
    testing: { start: 9, end: 15 },
    instructional: { start: 10, end: 16 },
  };
  for (const [key, win] of Object.entries(windows)) if (t.includes(key)) return win;
  return { start: 9, end: 16 };
};

export const tzBucket = (tz) => {
  if (!tz) return "Other";
  if (tz.includes("Los_Angeles")) return "Pacific";
  if (tz.includes("Denver") || tz.includes("Phoenix")) return "Mountain";
  if (tz.includes("Chicago")) return "Central";
  if (tz.includes("New_York")) return "Eastern";
  if (tz.includes("Halifax")) return "Atlantic";
  return "Other";
};