import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const formatInputTime = (timestamp: number, tz: string) => {
  if (tz === "Local") return new Date(timestamp - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  try {
    return formatInTimeZone(timestamp, tz, "yyyy-MM-dd'T'HH:mm");
  } catch(e) {
    return new Date(timestamp - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
};

const parseInputTime = (val: string, tz: string) => {
  if (tz === "Local") return new Date(val).getTime();
  try {
    return fromZonedTime(val, tz).getTime();
  } catch(e) {
    return new Date(val).getTime();
  }
};

console.log(formatInputTime(Date.now(), "America/New_York"));
console.log(parseInputTime("2026-04-20T10:00", "America/New_York"));
