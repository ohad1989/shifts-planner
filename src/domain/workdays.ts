import { weekDates, weekdayIndex } from "./dates";
import type {
  Assignment,
  DayMode,
  Period,
  PeriodTemplate,
  RestaurantId,
  Settings,
  Templates,
  WeekRecord,
  WorkingDay,
} from "./types";

/** Sun–Thu full days, Friday closed, Saturday evening only once Shabbat is over. */
export const DEFAULT_WORKING_DAYS: Record<string, WorkingDay> = {
  "0": { mode: "both" },
  "1": { mode: "both" },
  "2": { mode: "both" },
  "3": { mode: "both" },
  "4": { mode: "both" },
  "5": { mode: "closed" },
  "6": { mode: "evening", eveningStart: "19:00" },
};

export const DAY_MODES: DayMode[] = ["both", "morning", "evening", "closed"];

export function workingDaysOf(settings: Settings): Record<string, WorkingDay> {
  return settings.workingDays ?? DEFAULT_WORKING_DAYS;
}

/** The settings default for each date of the week. */
export function defaultWeekDays(
  weekStart: string,
  settings: Settings,
): Record<string, WorkingDay> {
  const byWeekday = workingDaysOf(settings);
  const days: Record<string, WorkingDay> = {};
  for (const date of weekDates(weekStart)) {
    days[date] = { ...(byWeekday[String(weekdayIndex(date))] ?? { mode: "both" }) };
  }
  return days;
}

export function dayPlan(
  week: WeekRecord,
  settings: Settings,
  date: string,
): WorkingDay {
  return (
    week.days?.[date] ??
    workingDaysOf(settings)[String(weekdayIndex(date))] ?? { mode: "both" }
  );
}

export function periodOpen(day: WorkingDay, period: Period): boolean {
  return day.mode === "both" || day.mode === period;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Hours between two HH:MM times; an end at or before the start runs past midnight. */
export function spanHours(start: string, end: string): number {
  let m = toMinutes(end) - toMinutes(start);
  if (m <= 0) m += 24 * 60;
  return Math.round((m / 60) * 100) / 100;
}

type TimedSeat = Pick<Assignment, "restaurantId" | "period" | "date"> &
  Partial<Pick<Assignment, "customStart" | "customEnd">>;

/** The times this seat is actually worked: custom hours, else the day's shift times. */
export function assignmentTimes(
  a: TimedSeat,
  templates: Templates,
  days?: Record<string, WorkingDay>,
): { start: string; end: string; custom: boolean } {
  const base = periodTimes(templates, a.restaurantId, a.period, days?.[a.date]);
  return {
    start: a.customStart ?? base.start,
    end: a.customEnd ?? base.end,
    custom: a.customStart != null || a.customEnd != null,
  };
}

export function assignmentHours(
  a: TimedSeat,
  templates: Templates,
  days?: Record<string, WorkingDay>,
): number {
  const t = assignmentTimes(a, templates, days);
  return spanHours(t.start, t.end);
}

/** Shift times for one day, applying the day's evening start override. */
export function periodTimes(
  templates: Templates,
  restaurantId: RestaurantId,
  period: Period,
  day?: WorkingDay,
): Pick<PeriodTemplate, "start" | "end"> {
  const t = templates.templates[restaurantId][period];
  if (period === "evening" && day?.eveningStart) {
    return { start: day.eveningStart, end: t.end };
  }
  return { start: t.start, end: t.end };
}
