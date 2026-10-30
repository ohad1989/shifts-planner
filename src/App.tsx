import { useEffect, useMemo, useState } from "react";
import { useStore } from "./store";
import { addDays, formatWeekRange, setDateLang, startOfWeek, toIsoDate } from "./dates";
import { ensureWeek } from "./week";
import { defaultWeekDays } from "./workdays";
import { I18nContext, translate } from "./i18n";
import type { Lang, RestaurantId, Theme } from "./types";
import Planner from "./components/Planner";
import People from "./components/People";
import Publish from "./components/Publish";
import SettingsView from "./components/SettingsView";

type Tab = "planner" | "people" | "publish" | "settings";

const THEME_NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const THEME_ICON: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };

export default function App() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("planner");
  const [restaurantId, setRestaurantId] = useState<RestaurantId>("a");
  const [weekOffset, setWeekOffset] = useState(0);
  const [personToEdit, setPersonToEdit] = useState<string | null>(null);

  const lang: Lang = s.store?.settings.language ?? "en";
  const theme: Theme = s.store?.settings.theme ?? "system";
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  setDateLang(lang);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === "he" ? "rtl" : "ltr";
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [lang, theme]);

  const weekStart = useMemo(() => {
    if (!s.store) return "";
    const base = toIsoDate(startOfWeek(new Date(), s.store.settings.weekStartsOn ?? 0));
    return addDays(base, weekOffset * 7);
  }, [s.store, weekOffset]);

  if (!s.store) {
    return (
      <div className="boot">
        {s.error ? (
          <>
            <h2>{t("Can't read the data files")}</h2>
            <p>{s.error}</p>
            <p className="muted">
              {t("Start the app with")} <code>npm run dev</code>{" "}
              {t("from the app folder so the local file service is running.")}
            </p>
            <button onClick={() => void s.reload()}>{t("Retry")}</button>
          </>
        ) : (
          <p className="muted">{t("Loading…")}</p>
        )}
      </div>
    );
  }

  const store = s.store;
  const week = ensureWeek(
    store.weeks.weeks[weekStart],
    weekStart,
    store.templates,
    defaultWeekDays(weekStart, store.settings),
  );
  const rName = (id: RestaurantId) =>
    store.settings.restaurants.find((r) => r.id === id)?.name ?? id.toUpperCase();

  const showWeekBar = tab === "planner" || tab === "publish";
  const setPref = (patch: { language?: Lang; theme?: Theme }) =>
    s.saveSettings({ ...store.settings, ...patch });

  const editPerson = (id: string) => {
    setPersonToEdit(id);
    setTab("people");
  };

  return (
    <I18nContext.Provider value={lang}>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="logo" aria-hidden>
              ◐
            </span>
            {t("Shift Planner")}
          </div>
          <nav className="tabs">
            {(
              [
                ["planner", "Planner"],
                ["publish", "Publish"],
                ["people", "People"],
                ["settings", "Settings"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? "tab active" : "tab"}
                onClick={() => setTab(id)}
              >
                {t(label)}
              </button>
            ))}
          </nav>
          <div className={s.saving ? "savestate busy" : "savestate"}>
            {s.saving
              ? t("Saving…")
              : s.savedAt
                ? t("Saved {time}", {
                    time: s.savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
                  })
                : t("All data on disk")}
          </div>
          <div className="prefs">
            <div className="seg small-seg" role="group" aria-label={t("Language")}>
              {(["en", "he"] as Lang[]).map((l) => (
                <button
                  key={l}
                  className={lang === l ? "active" : ""}
                  onClick={() => setPref({ language: l })}
                  lang={l}
                >
                  {l === "en" ? "EN" : "עב"}
                </button>
              ))}
            </div>
            <button
              className="icon theme-toggle"
              onClick={() => setPref({ theme: THEME_NEXT[theme] })}
              title={t("Theme: {mode}", { mode: t(`theme.${theme}`) })}
              aria-label={t("Theme: {mode}", { mode: t(`theme.${theme}`) })}
            >
              {THEME_ICON[theme]}
            </button>
          </div>
        </header>

        {s.error && (
          <div className="banner error">
            {s.error}
            <button className="link" onClick={s.clearError}>
              {t("Dismiss")}
            </button>
          </div>
        )}

        {showWeekBar && (
          <div className="weekbar">
            <div className="seg">
              {store.settings.restaurants.map((r) => (
                <button
                  key={r.id}
                  className={restaurantId === r.id ? "active" : ""}
                  onClick={() => setRestaurantId(r.id)}
                >
                  {r.name}
                  <span className={`pill ${week.status[r.id]}`}>
                    {week.status[r.id] === "published" ? t("Published") : t("Draft")}
                  </span>
                </button>
              ))}
            </div>
            <div className="weeknav">
              <button className="icon" onClick={() => setWeekOffset((w) => w - 1)} aria-label={t("Previous week")}>
                ‹
              </button>
              <strong>{formatWeekRange(weekStart)}</strong>
              <button className="icon" onClick={() => setWeekOffset((w) => w + 1)} aria-label={t("Next week")}>
                ›
              </button>
              {weekOffset !== 0 && (
                <button className="link" onClick={() => setWeekOffset(0)}>
                  {t("This week")}
                </button>
              )}
            </div>
          </div>
        )}

        <main>
          {tab === "planner" && (
            <Planner
              s={s}
              store={store}
              week={week}
              restaurantId={restaurantId}
              rName={rName}
              onEditPerson={editPerson}
            />
          )}
          {tab === "publish" && (
            <Publish s={s} store={store} week={week} restaurantId={restaurantId} rName={rName} />
          )}
          {tab === "people" && (
            <People
              key={personToEdit ?? "people"}
              s={s}
              store={store}
              rName={rName}
              initialId={personToEdit}
            />
          )}
          {tab === "settings" && <SettingsView s={s} store={store} />}
        </main>
      </div>
    </I18nContext.Provider>
  );
}
