import type { Lang, Period, Templates, RestaurantId } from "./types";

export const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

const HE_WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// The UI language for date labels. App sets it each render; the PDF passes "en".
let dateLang: Lang = "en";
export function setDateLang(lang: Lang): void {
  dateLang = lang;
}

const localeOf = (lang: Lang) => (lang === "he" ? "he-IL" : "en-GB");

export function weekdayName(i: number, lang: Lang = dateLang): string {
  return lang === "he" ? HE_WEEKDAYS[i] : WEEKDAY_LABELS[i];
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfWeekSunday(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

export function startOfWeek(d: Date, startsOn: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (copy.getDay() - startsOn + 7) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

export function addDays(iso: string, n: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

export function dayLabel(iso: string, lang: Lang = dateLang): string {
  return weekdayName(weekdayIndex(iso), lang);
}

export function shortDate(iso: string, lang: Lang = dateLang): string {
  return parseIsoDate(iso).toLocaleDateString(localeOf(lang), {
    day: "numeric",
    month: "short",
  });
}

export function weekDates(weekStart: string): string[] {
  const start = parseIsoDate(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toIsoDate(d);
  });
}

export function weekdayIndex(iso: string): number {
  return parseIsoDate(iso).getDay();
}

export function hoursForPeriod(
  templates: Templates,
  restaurantId: RestaurantId,
  period: Period,
  eveningStart?: string,
): number {
  const t = templates.templates[restaurantId][period];
  const start = period === "evening" && eveningStart ? eveningStart : t.start;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = t.end.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

export function formatWeekRange(weekStart: string, lang: Lang = dateLang): string {
  const days = weekDates(weekStart);
  const a = parseIsoDate(days[0]);
  const b = parseIsoDate(days[6]);
  const fmt = (d: Date) =>
    d.toLocaleDateString(localeOf(lang), { day: "numeric", month: "short" });
  return `${fmt(a)} – ${fmt(b)} ${b.getFullYear()}`;
}
