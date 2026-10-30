import { dayLabel, formatWeekRange, shortDate, weekDates } from "./dates";
import { periodLabel, roleLabel, translate } from "./i18n";
import { PERIODS, slotsFor } from "./week";
import { assignmentHours, assignmentTimes, periodOpen, periodTimes } from "./workdays";
import type { Lang, Person, RestaurantId, Settings, Templates, WeekRecord } from "./types";

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const csvRow = (cells: (string | number)[]) => cells.map(csvCell).join(",");

/**
 * The week's roster for one restaurant as a table (shift × role rows, one
 * column per day), followed by hours per worker. CSV with a BOM so Excel
 * opens Hebrew names correctly.
 */
export function weekTableCsv(opts: {
  week: WeekRecord;
  restaurantId: RestaurantId;
  settings: Settings;
  people: Person[];
  templates: Templates;
  lang: Lang;
}): string {
  const { week, restaurantId, settings, people, templates, lang } = opts;
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const restaurant = settings.restaurants.find((r) => r.id === restaurantId)?.name ?? restaurantId;
  const nameById = new Map(people.map((p) => [p.id, p.name]));
  const dates = weekDates(week.weekStart);
  const status = week.status[restaurantId] === "published" ? t("Published") : t("Draft");

  const lines: string[] = [
    csvRow([`${restaurant} · ${formatWeekRange(week.weekStart, lang)} · ${status}`]),
    csvRow([t("Shift"), t("Role"), ...dates.map((d) => `${dayLabel(d, lang)} ${shortDate(d, lang)}`)]),
  ];

  for (const period of PERIODS) {
    const usual = periodTimes(templates, restaurantId, period);
    const perDay = dates.map((d) => slotsFor(week, restaurantId, d, period));
    const roles = [
      ...settings.roles,
      ...new Set(perDay.flat().map((a) => a.role).filter((r) => !settings.roles.includes(r))),
    ];
    for (const role of roles) {
      const depth = Math.max(0, ...perDay.map((slots) => slots.filter((a) => a.role === role).length));
      for (let i = 0; i < depth; i++) {
        const cells = dates.map((date, di) => {
          const day = week.days?.[date];
          if (day && !periodOpen(day, period)) return t("Closed");
          const seat = perDay[di].filter((a) => a.role === role)[i];
          if (!seat) return "";
          if (!seat.personId) return t("OPEN");
          const name = nameById.get(seat.personId) ?? "?";
          const tm = assignmentTimes(seat, templates, week.days);
          const differs = tm.start !== usual.start || tm.end !== usual.end;
          return differs ? `${name} (${tm.start}-${tm.end})` : name;
        });
        lines.push(
          csvRow([
            `${periodLabel(lang, period)} ${usual.start}-${usual.end}`,
            roleLabel(lang, role),
            ...cells,
          ]),
        );
      }
    }
  }

  // hours per worker at this restaurant
  const totals = new Map<string, { days: Set<string>; shifts: number; hours: number }>();
  for (const a of week.assignments) {
    if (a.restaurantId !== restaurantId || !a.personId) continue;
    const row = totals.get(a.personId) ?? { days: new Set(), shifts: 0, hours: 0 };
    row.days.add(a.date);
    row.shifts += 1;
    row.hours += assignmentHours(a, templates, week.days);
    totals.set(a.personId, row);
  }
  lines.push("", csvRow([t("Hours at {name}", { name: restaurant })]));
  lines.push(csvRow([t("Worker"), t("Days"), t("Shifts"), t("Hours")]));
  const sorted = [...totals.entries()].sort(([a], [b]) =>
    (nameById.get(a) ?? a).localeCompare(nameById.get(b) ?? b),
  );
  for (const [id, r] of sorted) {
    lines.push(csvRow([nameById.get(id) ?? "?", r.days.size, r.shifts, Math.round(r.hours * 100) / 100]));
  }

  if (settings.pdfFooter) lines.push("", csvRow([settings.pdfFooter]));
  return lines.join("\r\n");
}

export function downloadWeekTable(opts: Parameters<typeof weekTableCsv>[0]): void {
  const csv = "﻿" + weekTableCsv(opts);
  const restaurant =
    opts.settings.restaurants.find((r) => r.id === opts.restaurantId)?.name ?? opts.restaurantId;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${restaurant.replace(/\s+/g, "-")}-${opts.week.weekStart}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
