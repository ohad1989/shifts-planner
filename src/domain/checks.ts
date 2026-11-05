import { slotLabel } from "./arrange";
import { hoursWorked, ineligibleReasons } from "./eligibility";
import { translate, translateReason } from "./i18n";
import type {
  Assignment,
  Lang,
  Person,
  RestaurantId,
  Settings,
  Templates,
  WeekRecord,
} from "./types";

export type Checklist = {
  open: string[];
  overrides: string[];
  hourWarnings: string[];
  conflicts: string[];
};

/** Pre-publish checklist for one restaurant (hours/conflicts consider both). */
export function publishChecklist(opts: {
  week: WeekRecord;
  restaurantId: RestaurantId;
  people: Person[];
  templates: Templates;
  settings: Settings;
  lang?: Lang;
}): Checklist {
  const { week, restaurantId, people, templates, settings } = opts;
  const lang = opts.lang ?? "en";
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const name = (id: RestaurantId) =>
    settings.restaurants.find((r) => r.id === id)?.name ?? id;
  const label = (a: Assignment) => slotLabel(a, name, lang);
  const byId = new Map(people.map((p) => [p.id, p]));
  const mine = week.assignments.filter((a) => a.restaurantId === restaurantId);
  const occ = { assignments: week.assignments, templates, hourCap: settings.hourCap, days: week.days };

  const open = mine.filter((a) => !a.personId).map(label);
  const overrides = mine
    .filter((a) => a.personId && a.override)
    .map(
      (a) =>
        `${label(a)} — ${byId.get(a.personId!)?.name ?? "?"}: ${a.overrideReason || t("no reason")}`,
    );

  const conflicts: string[] = [];
  for (const a of mine) {
    if (!a.personId || a.override) continue;
    const p = byId.get(a.personId);
    if (!p) {
      conflicts.push(`${label(a)} — ${t("unknown person")}`);
      continue;
    }
    const r = ineligibleReasons(p, a, occ, a.id);
    if (r.length)
      conflicts.push(`${label(a)} — ${p.name}: ${r.map((x) => translateReason(lang, x)).join(", ")}`);
  }

  const hourWarnings: string[] = [];
  const ids = new Set(mine.map((a) => a.personId).filter(Boolean) as string[]);
  for (const id of ids) {
    const p = byId.get(id);
    if (!p) continue;
    const h = hoursWorked(id, week.assignments, templates, week.days);
    const capH = p.maxHoursPerWeek ?? settings.hourCap;
    if (h > capH) hourWarnings.push(t("{name}: {h}h (cap {cap}h)", { name: p.name, h, cap: capH }));
  }

  return { open, overrides, hourWarnings, conflicts };
}
