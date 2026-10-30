import { useState } from "react";
import type { StoreApi } from "../store";
import type { Person, RestaurantId, Store, WeekdayLimit } from "../types";
import { WEEKDAY_LABELS, weekdayName } from "../dates";
import { useI18n } from "../i18n";
import { DEFAULT_PRIORITY, priorityOf } from "../eligibility";

const LIMITS: [WeekdayLimit, string][] = [
  ["any", "Any"],
  ["morning", "Mornings only"],
  ["evening", "Evenings only"],
  ["off", "Off"],
];

function newPerson(store: Store): Person {
  return {
    id: `p-${Date.now().toString(36)}`,
    name: "",
    homeRestaurantId: "a",
    roles: [],
    canCoverOther: false,
    active: true,
    noDoubles: store.settings.defaultNoDoubles,
    maxDaysPerWeek: null,
    maxHoursPerWeek: null,
    maxConsecutiveDays: null,
    weekdayLimits: { "0": "any", "1": "any", "2": "any", "3": "any", "4": "any", "5": "any", "6": "any" },
    unavailableDates: [],
    notes: "",
    priority: DEFAULT_PRIORITY,
  };
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "1 · first choice",
  2: "2 · high",
  3: "3 · normal",
  4: "4 · low",
  5: "5 · last choice",
};

function summary(p: Person, t: (k: string, v?: Record<string, string | number>) => string): string {
  const bits: string[] = [];
  const lim = Object.values(p.weekdayLimits);
  if (lim.every((l) => l === "morning" || l === "off") && lim.includes("morning")) bits.push(t("mornings"));
  else if (lim.every((l) => l === "evening" || l === "off") && lim.includes("evening")) bits.push(t("evenings"));
  const offs = Object.entries(p.weekdayLimits)
    .filter(([, l]) => l === "off")
    .map(([d]) => weekdayName(Number(d)));
  if (offs.length) bits.push(t("off {days}", { days: offs.join("/") }));
  if (p.maxDaysPerWeek != null) bits.push(t("max {n}d", { n: p.maxDaysPerWeek }));
  if (!p.noDoubles) bits.push(t("doubles ok"));
  return bits.join(" · ");
}

const numOrNull = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function People(props: {
  s: StoreApi;
  store: Store;
  rName: (id: RestaurantId) => string;
  /** Open this person first (e.g. coming from a seat in the planner). */
  initialId?: string | null;
}) {
  const { s, store, rName, initialId } = props;
  const { t, role } = useI18n();
  const first = store.people.find((p) => p.id === initialId) ?? store.people[0];
  const [selectedId, setSelectedId] = useState<string | null>(first?.id ?? null);
  const [draft, setDraft] = useState<Person | null>(first ? { ...first } : null);
  const [isNew, setIsNew] = useState(false);
  const [q, setQ] = useState("");
  const [newDate, setNewDate] = useState("");

  const dirty =
    draft != null &&
    (isNew || JSON.stringify(draft) !== JSON.stringify(store.people.find((p) => p.id === draft.id)));

  const select = (p: Person) => {
    if (dirty && !window.confirm(t("Discard unsaved changes to this person?"))) return;
    setSelectedId(p.id);
    setDraft({ ...p, weekdayLimits: { ...p.weekdayLimits }, unavailableDates: [...p.unavailableDates] });
    setIsNew(false);
  };

  const add = () => {
    if (dirty && !window.confirm(t("Discard unsaved changes to this person?"))) return;
    const p = newPerson(store);
    setDraft(p);
    setSelectedId(p.id);
    setIsNew(true);
  };

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return window.alert(t("Name is required."));
    if (draft.roles.length === 0) return window.alert(t("Pick at least one role."));
    const clean = { ...draft, name: draft.name.trim() };
    const people = isNew
      ? [...store.people, clean]
      : store.people.map((p) => (p.id === clean.id ? clean : p));
    s.savePeople(people);
    setDraft(clean);
    setIsNew(false);
  };

  const remove = () => {
    if (!draft) return;
    if (isNew) {
      setDraft(null);
      setSelectedId(null);
      setIsNew(false);
      return;
    }
    const used = Object.values(store.weeks.weeks).some((w) =>
      w.assignments.some((a) => a.personId === draft.id),
    );
    const msg = used
      ? t("Delete {name}? They will be unassigned from every week. (Tip: marking them inactive keeps history.)", {
          name: draft.name,
        })
      : t("Delete {name}?", { name: draft.name });
    if (!window.confirm(msg)) return;
    s.savePeople(store.people.filter((p) => p.id !== draft.id));
    if (used) {
      const weeks = Object.fromEntries(
        Object.entries(store.weeks.weeks).map(([k, w]) => [
          k,
          {
            ...w,
            assignments: w.assignments.map((a) =>
              a.personId === draft.id
                ? { ...a, personId: null, override: false, overrideReason: "", customStart: undefined, customEnd: undefined }
                : a,
            ),
          },
        ]),
      );
      s.saveAllWeeks(weeks);
    }
    setDraft(null);
    setSelectedId(null);
  };

  const set = <K extends keyof Person>(k: K, v: Person[K]) => draft && setDraft({ ...draft, [k]: v });

  const list = store.people
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.homeRestaurantId.localeCompare(b.homeRestaurantId) || Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  return (
    <div className="people">
      <aside className="plist">
        <div className="plist-head">
          <input className="search" placeholder={t("Search staff…")} value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="primary" onClick={add}>
            {t("+ Add")}
          </button>
        </div>
        {(["a", "b"] as RestaurantId[]).map((r) => {
          const group = list.filter((p) => p.homeRestaurantId === r);
          if (!group.length) return null;
          return (
            <div key={r}>
              <div className="group-label">
                {rName(r)}{" "}
                <span className="muted">· {t("{n} active", { n: group.filter((p) => p.active).length })}</span>
              </div>
              <ul>
                {group.map((p) => (
                  <li key={p.id}>
                    <button
                      className={"pitem" + (p.id === selectedId ? " active" : "") + (p.active ? "" : " inactive")}
                      onClick={() => select(p)}
                    >
                      <span className="pn">
                        {p.name}
                        <span className={`pill prio p${priorityOf(p)}`} title={t("Priority")}>
                          P{priorityOf(p)}
                        </span>
                        {p.canCoverOther && <span className="pill cover">{t("Cover")}</span>}
                      </span>
                      <span className="muted small">
                        {p.roles.map(role).join(", ")}
                        {summary(p, t) && ` · ${summary(p, t)}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </aside>

      <section className="peditor">
        {!draft ? (
          <p className="muted">{t("Select a person or add a new one.")}</p>
        ) : (
          <>
            <div className="editor-head">
              <h3>{isNew ? t("New person") : draft.name || t("Unnamed")}</h3>
              <div className="spacer" />
              <button className="danger ghost" onClick={remove}>
                {isNew ? t("Cancel") : t("Delete")}
              </button>
              <button className="primary" disabled={!dirty} onClick={save}>
                {t("Save")}
              </button>
            </div>

            <div className="form">
              <label className="field">
                <span>{t("Full name")}</span>
                <input value={draft.name} onChange={(e) => set("name", e.target.value)} dir="auto" />
              </label>
              <label className="field">
                <span>{t("Home restaurant")}</span>
                <select
                  value={draft.homeRestaurantId}
                  onChange={(e) => set("homeRestaurantId", e.target.value as RestaurantId)}
                >
                  {store.settings.restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{t("Priority")}</span>
                <select
                  value={priorityOf(draft)}
                  onChange={(e) => set("priority", Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {t(PRIORITY_LABELS[n])}
                    </option>
                  ))}
                </select>
              </label>
              <p className="field full muted small prio-hint">
                {t(
                  "Arrange gives shifts to higher-priority workers first (1 = first choice), up to their max days. Home staff still come before cover staff, and people under their hour cap before those over it.",
                )}
              </p>

              <div className="field full">
                <span>{t("Roles")}</span>
                <div className="chips">
                  {store.settings.roles.map((r) => (
                    <label key={r} className={draft.roles.includes(r) ? "chip on" : "chip"}>
                      <input
                        type="checkbox"
                        checked={draft.roles.includes(r)}
                        onChange={(e) =>
                          set(
                            "roles",
                            e.target.checked ? [...draft.roles, r] : draft.roles.filter((x) => x !== r),
                          )
                        }
                      />
                      {role(r)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="field full toggles">
                <label className="check">
                  <input type="checkbox" checked={draft.active} onChange={(e) => set("active", e.target.checked)} />
                  {t("Active")}
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={draft.canCoverOther}
                    onChange={(e) => set("canCoverOther", e.target.checked)}
                  />
                  {t("Can cover {name}", { name: rName(draft.homeRestaurantId === "a" ? "b" : "a") })}
                </label>
                <label className="check">
                  <input type="checkbox" checked={draft.noDoubles} onChange={(e) => set("noDoubles", e.target.checked)} />
                  {t("No double shifts (morning + evening same day)")}
                </label>
              </div>

              <label className="field">
                <span>{t("Max working days / week")}</span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  placeholder={t("No cap")}
                  value={draft.maxDaysPerWeek ?? ""}
                  onChange={(e) => set("maxDaysPerWeek", numOrNull(e.target.value))}
                />
              </label>
              <label className="field">
                <span>{t("Max consecutive days")}</span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  placeholder={t("No cap")}
                  value={draft.maxConsecutiveDays ?? ""}
                  onChange={(e) => set("maxConsecutiveDays", numOrNull(e.target.value))}
                />
              </label>
              <label className="field">
                <span>{t("Max hours / week (soft)")}</span>
                <input
                  type="number"
                  min={1}
                  placeholder={t("Default {n}", { n: store.settings.hourCap })}
                  value={draft.maxHoursPerWeek ?? ""}
                  onChange={(e) => set("maxHoursPerWeek", numOrNull(e.target.value))}
                />
              </label>

              <div className="field full">
                <span>{t("Time of day per weekday")}</span>
                <div className="weekdays">
                  {WEEKDAY_LABELS.map((key, i) => {
                    const v = draft.weekdayLimits[String(i)] ?? "any";
                    return (
                      <label key={key} className={`wd ${v}`}>
                        <b>{weekdayName(i)}</b>
                        <select
                          value={v}
                          onChange={(e) =>
                            set("weekdayLimits", { ...draft.weekdayLimits, [String(i)]: e.target.value as WeekdayLimit })
                          }
                        >
                          {LIMITS.map(([val, txt]) => (
                            <option key={val} value={val}>
                              {t(txt)}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="field full">
                <span>{t("One-off unavailable dates")}</span>
                <div className="dates">
                  {[...draft.unavailableDates].sort().map((d) => (
                    <span key={d} className="chip on">
                      {d}
                      <button
                        className="icon tiny"
                        onClick={() => set("unavailableDates", draft.unavailableDates.filter((x) => x !== d))}
                        aria-label={t("Remove {d}", { d })}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  <button
                    className="secondary"
                    disabled={!newDate || draft.unavailableDates.includes(newDate)}
                    onClick={() => {
                      set("unavailableDates", [...draft.unavailableDates, newDate]);
                      setNewDate("");
                    }}
                  >
                    {t("Add date")}
                  </button>
                </div>
              </div>

              <label className="field full">
                <span>{t("Notes")}</span>
                <textarea rows={2} value={draft.notes} onChange={(e) => set("notes", e.target.value)} dir="auto" />
              </label>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
