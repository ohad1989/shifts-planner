import { daysWorked, hourWarning, ineligibleReasons, priorityOf } from "./eligibility";
import type {
  ArrangeReport,
  Assignment,
  Lang,
  Person,
  RestaurantId,
  Templates,
  WeekRecord,
} from "./types";
import { dayLabel, shortDate } from "./dates";
import { periodLabel, roleLabel } from "./i18n";

function scopeRestaurants(scope: RestaurantId | "both"): RestaurantId[] {
  return scope === "both" ? ["a", "b"] : [scope];
}

export function slotLabel(
  a: Pick<Assignment, "date" | "restaurantId" | "period" | "role">,
  restaurantName?: (id: RestaurantId) => string,
  lang: Lang = "en",
): string {
  const r = restaurantName ? restaurantName(a.restaurantId) : a.restaurantId.toUpperCase();
  return `${dayLabel(a.date, lang)} ${shortDate(a.date, lang)} · ${r} · ${periodLabel(lang, a.period)} · ${roleLabel(lang, a.role)}`;
}

/**
 * One-shot greedy solver.
 *
 * - Never violates a hard restriction: every placement passes ineligibleReasons().
 * - Assignments outside the scope are left untouched and act as locked constraints.
 * - Most-constrained slot first (fewest eligible people), so scarce seats get
 *   filled before flexible people are used up elsewhere.
 * - Home staff before cover staff; then people who stay under the hour cap;
 *   then priority (1 first … 5 last); then the most remaining day-capacity;
 *   then fewest days so far; then name.
 * - Fully deterministic for the same input.
 */
export function arrangeWeek(opts: {
  week: WeekRecord;
  people: Person[];
  templates: Templates;
  hourCap: number;
  scope: RestaurantId | "both";
  mode: "fill-open" | "replace-all";
}): { week: WeekRecord; report: ArrangeReport } {
  const restaurants = scopeRestaurants(opts.scope);
  const assignments: Assignment[] = opts.week.assignments.map((a) => {
    if (opts.mode === "replace-all" && restaurants.includes(a.restaurantId)) {
      return {
        ...a,
        personId: null,
        override: false,
        overrideReason: "",
        customStart: undefined,
        customEnd: undefined,
      };
    }
    return { ...a };
  });

  const active = opts.people.filter((p) => p.active);
  const occ = {
    assignments,
    templates: opts.templates,
    hourCap: opts.hourCap,
    days: opts.week.days,
  };

  const open: number[] = [];
  assignments.forEach((a, i) => {
    if (restaurants.includes(a.restaurantId) && a.personId == null) open.push(i);
  });
  // chronological, then restaurant, period, role — stable tie-break
  open.sort((x, y) => {
    const a = assignments[x];
    const b = assignments[y];
    return (
      a.date.localeCompare(b.date) ||
      a.restaurantId.localeCompare(b.restaurantId) ||
      (a.period === b.period ? 0 : a.period === "morning" ? -1 : 1) ||
      a.role.localeCompare(b.role) ||
      a.seatIndex - b.seatIndex
    );
  });

  let filled = 0;
  const remaining = new Set(open);

  for (;;) {
    let bestIdx = -1;
    let bestCands: Person[] = [];
    for (const idx of open) {
      if (!remaining.has(idx)) continue;
      const slot = assignments[idx];
      const cands = active.filter(
        (p) => ineligibleReasons(p, slot, occ).length === 0,
      );
      if (cands.length === 0) continue;
      if (bestIdx === -1 || cands.length < bestCands.length) {
        bestIdx = idx;
        bestCands = cands;
      }
    }
    if (bestIdx === -1) break;

    const slot = assignments[bestIdx];
    const scored = bestCands.map((p) => {
      const days = daysWorked(p.id, assignments).size;
      return {
        p,
        home: p.homeRestaurantId === slot.restaurantId,
        overHours: hourWarning(p, slot, occ) != null,
        priority: priorityOf(p),
        capacity: (p.maxDaysPerWeek ?? 7) - days,
        days,
      };
    });
    scored.sort(
      (a, b) =>
        Number(b.home) - Number(a.home) ||
        Number(a.overHours) - Number(b.overHours) ||
        a.priority - b.priority ||
        b.capacity - a.capacity ||
        a.days - b.days ||
        a.p.name.localeCompare(b.p.name),
    );
    assignments[bestIdx] = { ...slot, personId: scored[0].p.id };
    remaining.delete(bestIdx);
    filled += 1;
  }

  // ---- report
  const openSlots = open.filter((i) => assignments[i].personId == null);
  const opens = openSlots.map((i) => {
    const slot = assignments[i];
    const relevant = active.filter(
      (p) =>
        p.roles.includes(slot.role) &&
        (p.homeRestaurantId === slot.restaurantId || p.canCoverOther),
    );
    let why: string;
    if (relevant.length === 0) {
      why = `No active ${slot.role} who works at this restaurant`;
    } else {
      why = relevant
        .map((p) => {
          const r = ineligibleReasons(p, slot, occ);
          return `${p.name}: ${r[0] ?? "available"}`;
        })
        .join("; ");
    }
    return { id: slot.id, label: slotLabel(slot), why };
  });

  const atMaxDays = active
    .filter((p) => {
      if (p.maxDaysPerWeek == null) return false;
      return daysWorked(p.id, assignments).size >= p.maxDaysPerWeek;
    })
    .map((p) => p.name);

  const unusedCover = active
    .filter((p) => p.canCoverOther)
    .filter(
      (p) =>
        !assignments.some(
          (a) => a.personId === p.id && a.restaurantId !== p.homeRestaurantId,
        ),
    )
    .map((p) => {
      const d = daysWorked(p.id, assignments).size;
      const cap = p.maxDaysPerWeek == null ? "" : `/${p.maxDaysPerWeek}`;
      return `${p.name} (${d}${cap} days, home only)`;
    });

  const report: ArrangeReport = {
    at: new Date().toISOString(),
    scope: opts.scope,
    mode: opts.mode,
    filled,
    leftOpen: openSlots.length,
    atMaxDays,
    unusedCover,
    opens,
  };

  const status = { ...opts.week.status };
  for (const r of restaurants) status[r] = "draft";

  return {
    week: { ...opts.week, assignments, lastArrangeReport: report, status },
    report,
  };
}
