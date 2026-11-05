import { weekDates } from "./dates";
import { periodOpen } from "./workdays";
import type {
  Assignment,
  Period,
  RestaurantId,
  Templates,
  WeekRecord,
  WorkingDay,
} from "./types";

export const PERIODS: Period[] = ["morning", "evening"];
export const RESTAURANTS: RestaurantId[] = ["a", "b"];

function templateSeats(
  weekStart: string,
  templates: Templates,
  restaurantId: RestaurantId,
  date: string,
  period: Period,
): Assignment[] {
  const seats: Assignment[] = [];
  for (const need of templates.templates[restaurantId][period].seats) {
    for (let seatIndex = 0; seatIndex < need.count; seatIndex++) {
      seats.push({
        id: `${weekStart}:${restaurantId}:${date}:${period}:${need.role}:${seatIndex}`,
        restaurantId,
        date,
        period,
        role: need.role,
        seatIndex,
        personId: null,
        override: false,
        overrideReason: "",
      });
    }
  }
  return seats;
}

/** Seats come from the templates, only for the periods each working day is open. */
export function emptyWeek(
  weekStart: string,
  templates: Templates,
  days: Record<string, WorkingDay>,
): WeekRecord {
  const assignments: Assignment[] = [];
  for (const date of weekDates(weekStart)) {
    for (const restaurantId of RESTAURANTS) {
      for (const period of PERIODS) {
        if (!periodOpen(days[date] ?? { mode: "both" }, period)) continue;
        assignments.push(...templateSeats(weekStart, templates, restaurantId, date, period));
      }
    }
  }
  return {
    weekStart,
    status: { a: "draft", b: "draft" },
    assignments,
    lastArrangeReport: null,
    published: {},
    days,
  };
}

/**
 * A week that already exists in weeks.json keeps its own seats (including
 * seats you added or removed by hand). Only a week that has never been saved
 * is generated from the staffing templates and the default working days.
 */
export function ensureWeek(
  existing: WeekRecord | undefined,
  weekStart: string,
  templates: Templates,
  defaultDays: Record<string, WorkingDay>,
): WeekRecord {
  if (!existing) return emptyWeek(weekStart, templates, defaultDays);
  // Weeks saved before working days existed were generated with every day open.
  const days =
    existing.days ??
    Object.fromEntries(weekDates(weekStart).map((d) => [d, { mode: "both" as const }]));
  return {
    ...existing,
    days,
    weekStart,
    status: existing.status ?? { a: "draft", b: "draft" },
    published: existing.published ?? {},
    lastArrangeReport: existing.lastArrangeReport ?? null,
  };
}

export function slotsFor(
  week: WeekRecord,
  restaurantId: RestaurantId,
  date: string,
  period: Period,
): Assignment[] {
  return week.assignments
    .filter(
      (a) =>
        a.restaurantId === restaurantId &&
        a.date === date &&
        a.period === period,
    )
    .sort((x, y) => x.role.localeCompare(y.role) || x.seatIndex - y.seatIndex);
}

export function setSlot(
  week: WeekRecord,
  slotId: string,
  patch: Partial<
    Pick<Assignment, "personId" | "override" | "overrideReason" | "customStart" | "customEnd">
  >,
): WeekRecord {
  return {
    ...week,
    assignments: week.assignments.map((a) =>
      a.id === slotId ? { ...a, ...patch } : a,
    ),
  };
}

export function addSeat(
  week: WeekRecord,
  restaurantId: RestaurantId,
  date: string,
  period: Period,
  role: string,
): WeekRecord {
  const same = week.assignments.filter(
    (a) =>
      a.restaurantId === restaurantId &&
      a.date === date &&
      a.period === period &&
      a.role === role,
  );
  const seatIndex = same.reduce((m, a) => Math.max(m, a.seatIndex + 1), 0);
  let id = `${week.weekStart}:${restaurantId}:${date}:${period}:${role}:${seatIndex}`;
  while (week.assignments.some((a) => a.id === id)) id += "+";
  return {
    ...week,
    assignments: [
      ...week.assignments,
      {
        id,
        restaurantId,
        date,
        period,
        role,
        seatIndex,
        personId: null,
        override: false,
        overrideReason: "",
      },
    ],
  };
}

/**
 * Change one day's working plan for this week, at both restaurants: periods
 * that close lose their seats (and anyone on them); periods that open get
 * the template seats.
 */
export function setWorkingDay(
  week: WeekRecord,
  templates: Templates,
  date: string,
  day: WorkingDay,
  currentDays: Record<string, WorkingDay>,
): WeekRecord {
  let assignments = week.assignments;
  for (const restaurantId of RESTAURANTS) {
    for (const period of PERIODS) {
      const here = (a: Assignment) =>
        a.restaurantId === restaurantId && a.date === date && a.period === period;
      if (!periodOpen(day, period)) {
        assignments = assignments.filter((a) => !here(a));
      } else if (!assignments.some(here)) {
        assignments = [
          ...assignments,
          ...templateSeats(week.weekStart, templates, restaurantId, date, period),
        ];
      }
    }
  }
  return { ...week, assignments, days: { ...currentDays, [date]: day } };
}

/** People who would lose a seat if this day's plan changed. */
export function assignedOnClosing(
  week: WeekRecord,
  date: string,
  day: WorkingDay,
): Assignment[] {
  return week.assignments.filter(
    (a) => a.date === date && a.personId != null && !periodOpen(day, a.period),
  );
}

export function removeSeat(week: WeekRecord, slotId: string): WeekRecord {
  return {
    ...week,
    assignments: week.assignments.filter((a) => a.id !== slotId),
  };
}

export function hasAssignments(
  week: WeekRecord,
  restaurants: RestaurantId[],
): boolean {
  return week.assignments.some(
    (a) => restaurants.includes(a.restaurantId) && a.personId != null,
  );
}
