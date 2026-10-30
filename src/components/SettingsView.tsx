import { useState } from "react";
import type { StoreApi } from "../store";
import type { Lang, Period, RestaurantId, Settings, Store, Templates, Theme } from "../types";
import { WEEKDAY_LABELS, weekdayName } from "../dates";
import { workingDaysOf } from "../workdays";
import { useI18n } from "../i18n";
import WorkingDays from "./WorkingDays";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export default function SettingsView(props: { s: StoreApi; store: Store }) {
  const { s, store } = props;
  const { t, role, period: periodName } = useI18n();
  const [settings, setSettings] = useState<Settings>(() => clone(store.settings));
  const [templates, setTemplates] = useState<Templates>(() => clone(store.templates));
  const [newRole, setNewRole] = useState("");

  // Language and theme save immediately (they're also in the top bar), so
  // they never count as unsaved changes and Save never overwrites them.
  const withPrefs = (x: Settings): Settings => ({
    ...x,
    language: store.settings.language,
    theme: store.settings.theme,
  });
  const dirty =
    JSON.stringify(withPrefs(settings)) !== JSON.stringify(store.settings) ||
    JSON.stringify(templates) !== JSON.stringify(store.templates);

  const save = () => {
    s.saveSettings(withPrefs(settings));
    s.saveTemplates(templates);
  };
  const setPref = (patch: { language?: Lang; theme?: Theme }) =>
    s.saveSettings({ ...store.settings, ...patch });

  const setTpl = (r: RestaurantId, period: Period, patch: Partial<Templates["templates"]["a"]["morning"]>) =>
    setTemplates((x) => ({
      templates: { ...x.templates, [r]: { ...x.templates[r], [period]: { ...x.templates[r][period], ...patch } } },
    }));

  const seatCount = (r: RestaurantId, period: Period, roleId: string) =>
    templates.templates[r][period].seats.find((x) => x.role === roleId)?.count ?? 0;

  const setSeat = (r: RestaurantId, period: Period, roleId: string, count: number) => {
    const seats = settings.roles
      .map((ro) => ({ role: ro, count: ro === roleId ? count : seatCount(r, period, ro) }))
      .filter((x) => x.count > 0);
    setTpl(r, period, { seats });
  };

  const addRole = () => {
    const id = newRole.trim().toLowerCase();
    if (!id || settings.roles.includes(id)) return;
    setSettings({ ...settings, roles: [...settings.roles, id] });
    setNewRole("");
  };

  const removeRole = (roleId: string) => {
    const holders = store.people.filter((p) => p.roles.includes(roleId)).length;
    if (holders > 0) {
      window.alert(
        t("{n} people have the {role} role. Remove it from them first.", { n: holders, role: role(roleId) }),
      );
      return;
    }
    setSettings({ ...settings, roles: settings.roles.filter((r) => r !== roleId) });
    for (const r of ["a", "b"] as RestaurantId[])
      for (const p of ["morning", "evening"] as Period[])
        setTpl(r, p, { seats: templates.templates[r][p].seats.filter((x) => x.role !== roleId) });
  };

  return (
    <div className="settings">
      <div className="settings-bar">
        <span className="muted small">
          {t(
            "Staffing and working-day changes apply to weeks you haven't touched yet. Weeks already saved keep their seats — use “Edit seats” or “Working days” in the planner for those.",
          )}
        </span>
        <div className="spacer" />
        <button
          className="secondary"
          disabled={!dirty}
          onClick={() => {
            setSettings(clone(store.settings));
            setTemplates(clone(store.templates));
          }}
        >
          {t("Discard")}
        </button>
        <button className="primary" disabled={!dirty} onClick={save}>
          {t("Save settings")}
        </button>
      </div>

      <section className="card">
        <h3>{t("Appearance")}</h3>
        <p className="muted small">{t("These apply right away.")}</p>
        <div className="form">
          <label className="field">
            <span>{t("Language")}</span>
            <select
              value={store.settings.language ?? "en"}
              onChange={(e) => setPref({ language: e.target.value as Lang })}
            >
              <option value="en">English</option>
              <option value="he">עברית</option>
            </select>
          </label>
          <label className="field">
            <span>{t("Theme")}</span>
            <select
              value={store.settings.theme ?? "system"}
              onChange={(e) => setPref({ theme: e.target.value as Theme })}
            >
              {(["system", "light", "dark"] as Theme[]).map((m) => (
                <option key={m} value={m}>
                  {t(`theme.${m}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <h3>{t("General")}</h3>
        <div className="form">
          {settings.restaurants.map((r, i) => (
            <label key={r.id} className="field">
              <span>{t("Restaurant {id} name", { id: r.id.toUpperCase() })}</span>
              <input
                value={r.name}
                dir="auto"
                onChange={(e) => {
                  const restaurants = [...settings.restaurants];
                  restaurants[i] = { ...r, name: e.target.value };
                  setSettings({ ...settings, restaurants });
                }}
              />
            </label>
          ))}
          <label className="field">
            <span>{t("Week starts on")}</span>
            <select
              value={settings.weekStartsOn ?? 0}
              onChange={(e) => setSettings({ ...settings, weekStartsOn: Number(e.target.value) })}
            >
              {WEEKDAY_LABELS.map((d, i) => (
                <option key={d} value={i}>
                  {weekdayName(i)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("Default hour cap / week (soft)")}</span>
            <input
              type="number"
              min={1}
              value={settings.hourCap}
              onChange={(e) => setSettings({ ...settings, hourCap: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="field full check">
            <input
              type="checkbox"
              checked={settings.defaultNoDoubles}
              onChange={(e) => setSettings({ ...settings, defaultNoDoubles: e.target.checked })}
            />
            {t("New people: no double shifts by default")}
          </label>
          <label className="field full">
            <span>{t("PDF / WhatsApp footer (manager contact)")}</span>
            <input
              value={settings.pdfFooter}
              dir="auto"
              onChange={(e) => setSettings({ ...settings, pdfFooter: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h3>{t("Working days")}</h3>
        <p className="muted small">
          {t(
            "The usual week. New weeks start from this; change a single week (a holiday, or when Shabbat ends later) with “Working days” in the Planner. Evening start blank = the restaurant's usual evening time.",
          )}
        </p>
        <WorkingDays
          rows={WEEKDAY_LABELS.map((_, i) => ({
            key: String(i),
            label: weekdayName(i),
            day: workingDaysOf(settings)[String(i)] ?? { mode: "both" },
          }))}
          eveningDefault={templates.templates.a.evening.start}
          onChange={(key, day) =>
            setSettings({ ...settings, workingDays: { ...workingDaysOf(settings), [key]: day } })
          }
        />
      </section>

      <section className="card">
        <h3>{t("Roles")}</h3>
        <div className="chips">
          {settings.roles.map((r) => (
            <span key={r} className="chip on">
              {role(r)}
              <button className="icon tiny" onClick={() => removeRole(r)} aria-label={t("Remove {d}", { d: role(r) })}>
                ×
              </button>
            </span>
          ))}
          <input
            placeholder={t("New role")}
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRole()}
          />
          <button className="secondary" onClick={addRole} disabled={!newRole.trim()}>
            {t("Add role")}
          </button>
        </div>
      </section>

      <div className="two">
        {settings.restaurants.map((r) => (
          <section key={r.id} className="card">
            <h3>{t("{name} · shifts and staffing", { name: r.name })}</h3>
            {(["morning", "evening"] as Period[]).map((period) => {
              const tp = templates.templates[r.id][period];
              return (
                <div key={period} className="tpl">
                  <div className="tpl-head">
                    <b>{periodName(period)}</b>
                    <input type="time" value={tp.start} onChange={(e) => setTpl(r.id, period, { start: e.target.value })} />
                    <span>–</span>
                    <input type="time" value={tp.end} onChange={(e) => setTpl(r.id, period, { end: e.target.value })} />
                  </div>
                  <div className="seats">
                    {settings.roles.map((ro) => (
                      <label key={ro} className="seatcount">
                        <span>{role(ro)}</span>
                        <input
                          type="number"
                          min={0}
                          max={9}
                          value={seatCount(r.id, period, ro)}
                          onChange={(e) => setSeat(r.id, period, ro, Math.max(0, Number(e.target.value) || 0))}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
