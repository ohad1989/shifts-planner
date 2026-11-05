import { dayLabel, formatWeekRange, shortDate, weekDates } from "./dates";
import { PERIODS, slotsFor } from "./week";
import { assignmentTimes, periodOpen } from "./workdays";
import { periodLabel, roleLabel, translate } from "./i18n";
import type { Lang, Person, RestaurantId, Settings, Templates, WeekRecord } from "./types";

export function weekSummaryText(opts: {
  week: WeekRecord;
  restaurantId: RestaurantId;
  settings: Settings;
  people: Person[];
  templates: Templates;
  lang?: Lang;
}): string {
  const lang = opts.lang ?? "en";
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const restaurant = opts.settings.restaurants.find(
    (r) => r.id === opts.restaurantId,
  );
  const nameById = new Map(opts.people.map((p) => [p.id, p.name]));
  const tpl = opts.templates.templates[opts.restaurantId];
  const lines = [
    `*${restaurant?.name ?? opts.restaurantId} · ${formatWeekRange(opts.week.weekStart, lang)}*`,
    `${periodLabel(lang, "morning")} ${tpl.morning.start}–${tpl.morning.end} · ${periodLabel(lang, "evening")} ${tpl.evening.start}–${tpl.evening.end}`,
  ];
  const opens: string[] = [];
  for (const date of weekDates(opts.week.weekStart)) {
    lines.push("", `*${dayLabel(date, lang)} ${shortDate(date, lang)}*`);
    const day = opts.week.days?.[date];
    if (day?.mode === "closed") {
      lines.push(t("Closed"));
      continue;
    }
    for (const period of PERIODS) {
      if (day && !periodOpen(day, period)) continue;
      const slots = slotsFor(opts.week, opts.restaurantId, date, period);
      const filled = slots
        .filter((s) => s.personId)
        .map((s) => {
          const tm = assignmentTimes(s, opts.templates, opts.week.days);
          const hours = tm.custom ? ` ${tm.start}–${tm.end}` : "";
          return `${nameById.get(s.personId ?? "") ?? "?"} (${roleLabel(lang, s.role)}${hours})`;
        });
      const from =
        period === "evening" && day?.eveningStart ? ` (${t("from {time}", { time: day.eveningStart })})` : "";
      lines.push(`${periodLabel(lang, period)}${from}: ${filled.length ? filled.join(", ") : "—"}`);
      for (const s of slots.filter((s) => !s.personId)) {
        opens.push(`${dayLabel(date, lang)} ${periodLabel(lang, period)} ${roleLabel(lang, s.role)}`);
      }
    }
  }
  if (opens.length) lines.push("", `${t("OPEN")}: ${opens.join(", ")}`);
  if (opts.settings.pdfFooter) lines.push("", opts.settings.pdfFooter);
  return lines.join("\n");
}
