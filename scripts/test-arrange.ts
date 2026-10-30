// Run: npx tsx scripts/test-arrange.ts  — checks the §14 solver criteria on the app's data
// (read through the same store as the app; DATA_STORE picks the backend).
import path from "node:path";
import { createStore } from "../server/storage";
import { arrangeWeek } from "../src/arrange";
import { ineligibleReasons } from "../src/eligibility";
import { emptyWeek, setSlot } from "../src/week";
import { weekdayIndex } from "../src/dates";
import { defaultWeekDays } from "../src/workdays";
import type { PeopleFile, Settings, Templates } from "../src/types";

const store = createStore({ dataDir: path.resolve("data"), exampleDir: path.resolve("data-example") });
const settings = (await store.get("settings")) as Settings;
const people = ((await store.get("people")) as PeopleFile).people;
const templates = (await store.get("templates")) as Templates;
await store.close();
if (people.length === 0) {
  console.log("No staff yet (data/ is private and not in git). Run the app once and add staff first.");
  process.exit(0);
}
let fails = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };

const base = emptyWeek("2026-11-01", templates, defaultWeekDays("2026-11-01", settings));
const satEvening = base.assignments.filter((a) => a.date === "2026-11-07");
ok(!base.assignments.some((a) => a.date === "2026-11-06"), "Friday closed: no seats");
ok(satEvening.length > 0 && satEvening.every((a) => a.period === "evening"), "Saturday: evening seats only");
const t0 = Date.now();
const { week, report } = arrangeWeek({ week: base, people, templates, hourCap: settings.hourCap, scope: "both", mode: "replace-all" });
console.log(`arrange both: filled ${report.filled}, open ${report.leftOpen}, ${Date.now() - t0}ms`);
console.log("at max days:", report.atMaxDays.join(", "));
console.log("unused cover:", report.unusedCover?.join(", "));
for (const o of report.opens ?? []) console.log("  OPEN", o.label, "→", o.why.slice(0, 140));

const occ = { assignments: week.assignments, templates, hourCap: settings.hourCap, days: week.days };
let hardViolations = 0;
for (const a of week.assignments) if (a.personId) {
  const p = people.find((x) => x.id === a.personId)!;
  const r = ineligibleReasons(p, a, occ, a.id);
  if (r.length) { hardViolations++; console.log("  VIOLATION", a.id, p.name, r); }
}
ok(hardViolations === 0, "no hard-restriction violations anywhere");
for (const p of people) {
  const mine = week.assignments.filter((a) => a.personId === p.id);
  const days = new Set(mine.map((a) => a.date));
  if (p.maxDaysPerWeek != null) ok(days.size <= p.maxDaysPerWeek, `${p.name}: ${days.size} days ≤ max ${p.maxDaysPerWeek}`);
  for (const a of mine) {
    const lim = p.weekdayLimits[String(weekdayIndex(a.date))];
    if (lim === "evening" && a.period === "morning") ok(false, `${p.name} morning on evenings-only day ${a.date}`);
    if (lim === "off") ok(false, `${p.name} on off day ${a.date}`);
  }
  if (p.noDoubles) for (const d of days) ok(mine.filter((a) => a.date === d).length <= 1 || false, `${p.name} no double on ${d}`);
  const slots = new Set<string>();
  for (const a of mine) { const k = `${a.date}:${a.period}`; if (slots.has(k)) ok(false, `${p.name} double-booked ${k}`); slots.add(k); }
}
const aya = week.assignments.filter((a) => a.personId === "p-aya" && weekdayIndex(a.date) === 5);
ok(aya.every((a) => a.period === "evening"), "Aya (evenings only Fri) never on Friday morning");

// edit survives fill-open
const target = week.assignments.find((a) => a.restaurantId === "a" && a.role === "chef" && a.personId)!;
const alt = people.find((p) => p.roles.includes("chef") && p.id !== target.personId && ineligibleReasons(p, target, { ...occ }, target.id).length === 0);
const edited = alt ? setSlot(week, target.id, { personId: alt.id }) : setSlot(week, target.id, { personId: null });
const again = arrangeWeek({ week: edited, people, templates, hourCap: settings.hourCap, scope: "both", mode: "fill-open" }).week;
ok(again.assignments.find((a) => a.id === target.id)!.personId === edited.assignments.find((a) => a.id === target.id)!.personId, "manual edit survives Fill open only");

// one restaurant arrange keeps other locked
const onlyB = arrangeWeek({ week, people, templates, hourCap: settings.hourCap, scope: "b", mode: "replace-all" }).week;
ok(onlyB.assignments.filter((a) => a.restaurantId === "a").every((a) => a.personId === week.assignments.find((x) => x.id === a.id)!.personId), "arranging B leaves A untouched");

// priority: moving one worker to 1 never gives them fewer days than at 5
let moved = 0;
let prioOk = true;
for (const p of people.filter((x) => x.active)) {
  const daysAt = (priority: number) => {
    const ps = people.map((x) => ({ ...x, priority: x.id === p.id ? priority : 3 }));
    const w = arrangeWeek({ week: base, people: ps, templates, hourCap: settings.hourCap, scope: "both", mode: "replace-all" }).week;
    return new Set(w.assignments.filter((a) => a.personId === p.id).map((a) => a.date)).size;
  };
  const hi = daysAt(1), lo = daysAt(5);
  if (hi < lo) { prioOk = false; console.log(`  PRIORITY ${p.name}: P1 ${hi} days < P5 ${lo} days`); }
  if (hi > lo) moved++;
}
ok(prioOk, `priority 1 never gets fewer days than priority 5 (${moved} workers gain days at P1)`);

// determinism
const again2 = arrangeWeek({ week: base, people, templates, hourCap: settings.hourCap, scope: "both", mode: "replace-all" }).week;
ok(JSON.stringify(again2.assignments) === JSON.stringify(week.assignments), "deterministic re-run");
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
