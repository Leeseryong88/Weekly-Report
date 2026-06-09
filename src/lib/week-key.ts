import { addDays, format, parseISO, subDays } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const KST = "Asia/Seoul";

export function getWeekStartSunday(date: Date = new Date()): Date {
  const kstDate = toZonedTime(date, KST);
  const day = kstDate.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const monday = subDays(kstDate, daysFromMonday);
  monday.setHours(0, 0, 0, 0);
  return fromZonedTime(monday, KST);
}

export function getWeekKey(date: Date = new Date()): string {
  return format(getWeekStartSunday(date), "yyyy-MM-dd");
}

export function getCurrentWeekKey(): string {
  return getWeekKey(new Date());
}

export function getWeekLabel(weekKey: string): string {
  const start = parseISO(weekKey);
  const end = addDays(start, 4);
  return `${format(start, "M/d")} ~ ${format(end, "M/d")} 주간`;
}

export function listRecentWeekKeys(count = 12): string[] {
  const keys: string[] = [];
  let cursor = new Date();
  for (let i = 0; i < count; i++) {
    keys.push(getWeekKey(cursor));
    cursor = subDays(getWeekStartSunday(cursor), 7);
  }
  return keys;
}
