import { addDays, format, parseISO, subDays } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const KST = "Asia/Seoul";

export function getWeekStartSaturday(date: Date = new Date()): Date {
  const kstDate = toZonedTime(date, KST);
  const day = kstDate.getDay();
  const daysFromSaturday = day === 6 ? 0 : day + 1;
  const saturday = subDays(kstDate, daysFromSaturday);
  saturday.setHours(0, 0, 0, 0);
  return fromZonedTime(saturday, KST);
}

export function getWeekStartSunday(date: Date = new Date()): Date {
  return getWeekStartSaturday(date);
}

export function getWeekKey(date: Date = new Date()): string {
  return format(getWeekStartSaturday(date), "yyyy-MM-dd");
}

export function getCurrentWeekKey(): string {
  return getWeekKey(new Date());
}

export function getWeekLabel(weekKey: string): string {
  const start = parseISO(weekKey);
  const end = addDays(start, 6);
  return `${format(start, "M/d")} ~ ${format(end, "M/d")} 주간`;
}

export function listRecentWeekKeys(count = 12): string[] {
  const keys: string[] = [];
  let cursor = new Date();
  for (let i = 0; i < count; i++) {
    keys.push(getWeekKey(cursor));
    cursor = subDays(getWeekStartSaturday(cursor), 7);
  }
  return keys;
}
