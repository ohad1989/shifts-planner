import { weekdayIndex } from "./dates";
import { assignmentHours } from "./workdays";
import type {
  Assignment,
  Period,
  Person,
  RestaurantId,
  Templates,
  WorkingDay,
} from "./types";

export type Occupancy = {
  assignments: Assignment[];
  templates: Templates;
  hourCap: number;
  /** The week's working days, so a late Saturday evening counts its real hours. */
  days?: Record<string, WorkingDay>;
};

export const DEFAULT_PRIORITY = 3;
export const priorityOf = (p: Person): number => p.priority ?? DEFAULT_PRIORITY;

export function daysWorked(
  personId: string,
  assignments: Assignment[],
): Set<string> {
  const days = new Set<string>();
  for (const a of assignments) {
    if (a.personId === personId) days.add(a.date);
  }
  return days;
}

export function hoursWorked(
  personId: string,
  assignments: Assignment[],
  templates: Templates,
  days?: Record<string, WorkingDay>,
): number {
  let h = 0;
  for (const a of assignments) {
    if (a.personId === personId) h += assignmentHours(a, templates, days);
  }
  return Math.round(h * 100) / 100;
}

function consecutiveRun(days: string[], extra?: string): number {
  const set = new Set(days);
  if (extra) set.add(extra);
  const sorted = [...set].sort();
  if (sorted.length === 0) return 0;
  let max = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00");
    const cur = new Date(sorted[i] + "T00:00:00");
    const diff = (cur.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      run += 1;
      max = Math.max(max, run);
    } else {
      run = 1;
    }
  }
  return max;
}

export function ineligibleReasons(
  person: Person,
  slot: {
    restaurantId: RestaurantId;
    date: string;
    period: Period;
    role: string;
  },
  occ: Occupancy,
  ignoreAssignmentId?: string,
): string[] {
  const reasons: string[] = [];
  const others = occ.assignments.filter(
    (a) => a.id !== ignoreAssignmentId && a.personId === person.id,
  );

  if (!person.active) reasons.push("Inactive");
  if (!person.roles.includes(slot.role)) {
    reasons.push(`Not a ${slot.role}`);
  }

  if (person.homeRestaurantId !== slot.restaurantId && !person.canCoverOther) {
    reasons.push("Not assigned to this restaurant");
  }

  if (person.unavailableDates.includes(slot.date)) {
    reasons.push("Unavailable this date");
  }

  const limit = person.weekdayLimits[String(weekdayIndex(slot.date))] ?? "any";
  if (limit === "off") reasons.push("Off this weekday");
  if (limit === "morning" && slot.period !== "morning") {
    reasons.push("Mornings only this day");
  }
  if (limit === "evening" && slot.period !== "evening") {
    reasons.push("Evenings only this day");
  }

  const overlap = others.find(
    (a) => a.date === slot.date && a.period === slot.period,
  );
  if (overlap) reasons.push("Already on this period");

  if (person.noDoubles) {
    const otherPeriod = others.find(
      (a) => a.date === slot.date && a.period !== slot.period,
    );
    if (otherPeriod) reasons.push("Double shift blocked");
  }

  const days = daysWorked(person.id, others);
  const alreadyThisDay = days.has(slot.date);
  if (
    person.maxDaysPerWeek != null &&
    !alreadyThisDay &&
    days.size >= person.maxDaysPerWeek
  ) {
    reasons.push(`Already ${person.maxDaysPerWeek} days this week`);
  }

  if (person.maxConsecutiveDays != null) {
    const run = consecutiveRun([...days], slot.date);
    if (run > person.maxConsecutiveDays) {
      reasons.push(`Max ${person.maxConsecutiveDays} consecutive days`);
    }
  }

  return reasons;
}

export function hourWarning(
  person: Person,
  slot: Pick<Assignment, "restaurantId" | "period" | "date"> &
    Partial<Pick<Assignment, "customStart" | "customEnd">>,
  occ: Occupancy,
  ignoreAssignmentId?: string,
): string | null {
  const others = occ.assignments.filter(
    (a) => a.id !== ignoreAssignmentId && a.personId === person.id,
  );
  const cap = person.maxHoursPerWeek ?? occ.hourCap;
  const next =
    Math.round(
      (hoursWorked(person.id, others, occ.templates, occ.days) +
        assignmentHours(slot, occ.templates, occ.days)) *
        100,
    ) / 100;
  if (next > cap) return `${next}h would exceed ${cap}h cap`;
  return null;
}
