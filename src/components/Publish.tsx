import { useState } from "react";
import type { StoreApi } from "../store";
import type { RestaurantId, Store, WeekRecord } from "../types";
import { publishChecklist } from "../checks";
import { downloadWeekPdf } from "../pdf";
import { downloadWeekTable } from "../table";
import { weekSummaryText } from "../whatsapp";
import { useI18n } from "../i18n";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export default function Publish(props: {
  s: StoreApi;
  store: Store;
  week: WeekRecord;
  restaurantId: RestaurantId;
  rName: (id: RestaurantId) => string;
}) {
  const { s, store, week, restaurantId, rName } = props;
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const status = week.status[restaurantId];
  const snapshot = week.published?.[restaurantId];
  const check = publishChecklist({
    week,
    restaurantId,
    people: store.people,
    templates: store.templates,
    settings: store.settings,
    lang,
  });
  const exportOpts = {
    week,
    restaurantId,
    settings: store.settings,
    people: store.people,
    templates: store.templates,
  };
  const text = weekSummaryText({ ...exportOpts, lang });

  const publish = () => {
    if (
      check.conflicts.length &&
      !window.confirm(t("There are {n} conflicts. Publish anyway?", { n: check.conflicts.length }))
    )
      return;
    s.saveWeek({
      ...week,
      status: { ...week.status, [restaurantId]: "published" },
      published: {
        ...(week.published ?? {}),
        [restaurantId]: {
          at: new Date().toISOString(),
          assignments: week.assignments.filter((a) => a.restaurantId === restaurantId),
        },
      },
    });
  };
  const reopen = () => s.saveWeek({ ...week, status: { ...week.status, [restaurantId]: "draft" } });

  const sections: [string, string[], "bad" | "warn" | "info"][] = [
    [t("Conflicts"), check.conflicts, "bad"],
    [t("Open seats"), check.open, "warn"],
    [t("Overrides"), check.overrides, "info"],
    [t("Hour warnings"), check.hourWarnings, "warn"],
  ];

  return (
    <div className="publish">
      <section className="card">
        <div className="card-head">
          <h3>{t("Checklist · {name}", { name: rName(restaurantId) })}</h3>
          <div className="spacer" />
          {status === "published" ? (
            <>
              <span className="muted small">
                {t("Published {when}", {
                  when: snapshot ? new Date(snapshot.at).toLocaleString(lang === "he" ? "he-IL" : "en-GB") : "",
                })}
              </span>
              <button className="secondary" onClick={reopen}>
                {t("Reopen as draft")}
              </button>
            </>
          ) : (
            <button className="primary" onClick={publish}>
              {snapshot ? t("Republish") : t("Publish")}
            </button>
          )}
        </div>
        <div className="checks">
          {sections.map(([title, items, tone]) => (
            <details key={title} className={items.length ? `chk ${tone}` : "chk good"} open={items.length > 0 && items.length <= 8}>
              <summary>
                <span className="dot" />
                {title}
                <b>{items.length}</b>
              </summary>
              {items.length > 0 && (
                <ul>
                  {items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </details>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head wrap">
          <h3>{t("Share")}</h3>
          <div className="spacer" />
          <button className="secondary" onClick={() => downloadWeekPdf(exportOpts)}>
            {t("Download PDF")}
          </button>
          <button
            className="secondary"
            title={t("A table with the week's roster and hours per worker. Opens in Excel.")}
            onClick={() => downloadWeekTable({ ...exportOpts, lang })}
          >
            {t("Download table (Excel)")}
          </button>
          <button
            className="primary"
            onClick={async () => {
              const ok = await copyText(text);
              setCopied(ok);
              if (ok) setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? t("Copied ✓") : t("Copy WhatsApp text")}
          </button>
        </div>
        {status !== "published" && (
          <p className="muted small">{t("This week is still a draft — the PDF will be marked DRAFT.")}</p>
        )}
        {lang === "he" && <p className="muted small">{t("The PDF is in English (its fonts can't show Hebrew).")}</p>}
        <pre className="wa" dir="auto">{text}</pre>
      </section>
    </div>
  );
}
