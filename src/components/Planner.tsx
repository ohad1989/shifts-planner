import { useState } from "react";
import type { StoreApi } from "../store";
import type { Assignment, Period, RestaurantId, Store, WeekRecord, WorkingDay } from "../types";
import { dayLabel, shortDate, weekDates } from "../dates";
import {
  addSeat,
  assignedOnClosing,
  hasAssignments,
  PERIODS,
  removeSeat,
  setWorkingDay,
  slotsFor,
} from "../week";
import { arrangeWeek, slotLabel } from "../arrange";
import { hourWarning } from "../eligibility";
import { assignmentTimes, defaultWeekDays, periodOpen, periodTimes } from "../workdays";
import { ltr, useI18n } from "../i18n";
import Modal from "./Modal";
import SlotPicker from "./SlotPicker";
import WorkingDays from "./WorkingDays";

type Scope = RestaurantId | "both";

export default function Planner(props: {
  s: StoreApi;
  store: Store;
  week: WeekRecord;
  restaurantId: RestaurantId;
  rName: (id: RestaurantId) => string;
  onEditPerson: (personId: string) => void;
}) {
  const { s, store, week, restaurantId, rName, onEditPerson } = props;
  const { t, lang, role, reason, period: periodName } = useI18n();
  const other: RestaurantId = restaurantId === "a" ? "b" : "a";
  const dates = weekDates(week.weekStart);
  const nameById = new Map(store.people.map((p) => [p.id, p]));
  const locked = week.status[restaurantId] === "published";
  const anyPublished = week.status.a === "published" || week.status.b === "published";
  const days = week.days ?? {};
  const dayOf = (date: string): WorkingDay => days[date] ?? { mode: "both" };
  const occ = {
    assignments: week.assignments,
    templates: store.templates,
    hourCap: store.settings.hourCap,
    days: week.days,
  };

  const [picking, setPicking] = useState<Assignment | null>(null);
  const [askScope, setAskScope] = useState<Scope | null>(null);
  const [showReport, setShowReport] = useState(true);
  const [addingAt, setAddingAt] = useState<{ date: string; period: Period } | null>(null);
  const [editSeats, setEditSeats] = useState(false);
  const [editDays, setEditDays] = useState(false);

  const changeDay = (date: string, day: WorkingDay) => {
    const losing = assignedOnClosing(week, date, day);
    if (
      losing.length > 0 &&
      !window.confirm(
        t("{n} assigned seat(s) on {day} will be removed. Continue?", {
          n: losing.length,
          day: `${dayLabel(date)} ${shortDate(date)}`,
        }),
      )
    )
      return;
    s.saveWeek(setWorkingDay(week, store.templates, date, day, days));
  };

  const resetDays = () => {
    const usual = defaultWeekDays(week.weekStart, store.settings);
    const losing = dates.flatMap((d) => assignedOnClosing(week, d, usual[d]));
    if (
      losing.length > 0 &&
      !window.confirm(t("{n} assigned seat(s) will be removed. Continue?", { n: losing.length }))
    )
      return;
    let next = week;
    for (const d of dates) next = setWorkingDay(next, store.templates, d, usual[d], next.days ?? {});
    s.saveWeek(next);
  };

  const scopeList = (sc: Scope): RestaurantId[] => (sc === "both" ? ["a", "b"] : [sc]);
  const scopeName = (sc: Scope) => (sc === "both" ? t("both restaurants") : rName(sc));

  const runArrange = (scope: Scope, mode: "fill-open" | "replace-all") => {
    const { week: next } = arrangeWeek({
      week,
      people: store.people,
      templates: store.templates,
      hourCap: store.settings.hourCap,
      scope,
      mode,
    });
    s.saveWeek(next);
    setAskScope(null);
    setShowReport(true);
  };

  const onArrange = (scope: Scope) => {
    const rs = scopeList(scope);
    const pub = rs.filter((r) => week.status[r] === "published");
    if (pub.length) {
      window.alert(
        t("{names} is published for this week. Reopen it as a draft before arranging.", {
          names: pub.map(rName).join(t(" and ")),
        }),
      );
      return;
    }
    if (hasAssignments(week, rs)) setAskScope(scope);
    else runArrange(scope, "replace-all");
  };

  const reopen = () => {
    s.saveWeek({ ...week, status: { ...week.status, [restaurantId]: "draft" } });
  };

  const counts = (r: RestaurantId) => {
    const mine = week.assignments.filter((a) => a.restaurantId === r);
    return { filled: mine.filter((a) => a.personId).length, total: mine.length };
  };
  const cur = counts(restaurantId);
  const report = week.lastArrangeReport;
  const openLabel = (id: string, fallback: string) => {
    const a = week.assignments.find((x) => x.id === id);
    return a ? slotLabel(a, rName, lang) : fallback;
  };

  return (
    <div className="planner">
      <div className="toolbar">
        <div className="stat">
          <span className="big">
            {cur.filled}
            <span className="muted">/{cur.total}</span>
          </span>
          <span className="muted">{t("seats filled at {name}", { name: rName(restaurantId) })}</span>
        </div>
        <div className="spacer" />
        <button
          className="secondary"
          disabled={anyPublished}
          title={anyPublished ? t("Reopen both restaurants as drafts to change working days") : undefined}
          onClick={() => setEditDays(true)}
        >
          {t("Working days")}
        </button>
        <label className="check">
          <input
            type="checkbox"
            checked={editSeats}
            disabled={locked}
            onChange={(e) => setEditSeats(e.target.checked)}
          />
          {t("Edit seats")}
        </label>
        <button className="secondary" disabled={locked} onClick={() => onArrange(restaurantId)}>
          {t("Arrange {name}", { name: rName(restaurantId) })}
        </button>
        <button className="primary" onClick={() => onArrange("both")}>
          {t("Arrange both restaurants")}
        </button>
      </div>

      {locked && (
        <div className="banner info">
          {t("This week is published for {name} — the grid is locked.", { name: rName(restaurantId) })}
          <button className="link" onClick={reopen}>
            {t("Reopen as draft")}
          </button>
        </div>
      )}

      <div className="gridwrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="corner" />
              {dates.map((d) => {
                const day = dayOf(d);
                return (
                  <th key={d} className={day.mode === "closed" ? "dayclosed" : undefined}>
                    <div className="dname">{dayLabel(d)}</div>
                    <div className="ddate">{shortDate(d)}</div>
                    {day.mode === "closed" && <div className="dtag">{t("Closed")}</div>}
                    {day.mode !== "closed" && day.eveningStart && periodOpen(day, "evening") && (
                      <div className="dtag">{t("PM from {time}", { time: ltr(day.eveningStart) })}</div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => {
              const pt = periodTimes(store.templates, restaurantId, period);
              return (
                <tr key={period}>
                  <th className="rowhead">
                    <div className="pname">{periodName(period)}</div>
                    <div className="ptime">{ltr(`${pt.start}–${pt.end}`)}</div>
                  </th>
                  {dates.map((date) => {
                    const slots = slotsFor(week, restaurantId, date, period);
                    if (!periodOpen(dayOf(date), period) && slots.length === 0) {
                      return (
                        <td key={date} className="cell closedcell">
                          <span>{t("Closed")}</span>
                        </td>
                      );
                    }
                    return (
                      <td key={date} className={locked ? "cell locked" : "cell"}>
                        {slots.map((slot) => {
                          const p = slot.personId ? nameById.get(slot.personId) : undefined;
                          const warn = p ? hourWarning(p, slot, occ, slot.id) : null;
                          const times = assignmentTimes(slot, store.templates, week.days);
                          return (
                            <div key={slot.id} className="seatrow">
                              <button
                                className={
                                  "seat" +
                                  (p ? " filled" : " open") +
                                  (slot.override ? " override" : "") +
                                  (p && p.homeRestaurantId !== restaurantId ? " cover" : "")
                                }
                                disabled={locked}
                                onClick={() => setPicking(slot)}
                                title={
                                  slot.override
                                    ? t("Override: {reason}", { reason: slot.overrideReason })
                                    : warn
                                      ? reason(warn)
                                      : undefined
                                }
                              >
                                <span className="role">{role(slot.role)}</span>
                                <span className="who">
                                  {p ? p.name : slot.personId ? t("Unknown") : t("Open")}
                                </span>
                                {times.custom && p && (
                                  <span className="custom-time">{ltr(`${times.start}–${times.end}`)}</span>
                                )}
                                {slot.override && <span className="flag">!</span>}
                                {!slot.override && warn && <span className="flag soft">h</span>}
                              </button>
                              {editSeats && !locked && (
                                <button
                                  className="icon tiny"
                                  title={t("Remove this seat")}
                                  onClick={() => s.saveWeek(removeSeat(week, slot.id))}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {editSeats && !locked && (
                          <button
                            className="addseat"
                            onClick={() => setAddingAt({ date, period })}
                          >
                            {t("+ seat")}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="coverage">
              <th className="rowhead">
                <div className="pname">{rName(other)}</div>
                <div className="ptime">{t("same day")}</div>
              </th>
              {dates.map((date) => (
                <td key={date}>
                  {PERIODS.filter((period) => periodOpen(dayOf(date), period)).map((period) => {
                    const sl = slotsFor(week, other, date, period);
                    const f = sl.filter((a) => a.personId).length;
                    const crossers = sl
                      .map((a) => (a.personId ? nameById.get(a.personId) : undefined))
                      .filter((p) => p && p.homeRestaurantId === restaurantId)
                      .map((p) => p!.name.split(" ")[0]);
                    return (
                      <div key={period} className={f < sl.length ? "cov short" : "cov"}>
                        <span>{period === "morning" ? t("AM") : t("PM")}</span>
                        <span>
                          {f}/{sl.length}
                        </span>
                        {crossers.length > 0 && (
                          <span className="crossers" title={t("Your staff covering there")}>
                            ↗ {crossers.join(", ")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="legend muted">
        <span><i className="sw open" /> {t("Open")}</span>
        <span><i className="sw cover" /> {t("Cover from other site")}</span>
        <span><i className="sw override" /> {t("Override")}</span>
        <span><b className="flag soft">h</b> {t("Over hour cap")}</span>
        <span><span className="custom-time">{ltr("12:00–18:00")}</span> {t("Custom hours")}</span>
      </div>

      {report && showReport && (
        <section className="report">
          <div className="report-head">
            <h4>
              {t("Last arrange")} · {scopeName(report.scope)} ·{" "}
              {report.mode === "replace-all" ? t("replace all") : t("fill open only")}
            </h4>
            <span className="muted">
              {new Date(report.at).toLocaleString(lang === "he" ? "he-IL" : "en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button className="link" onClick={() => setShowReport(false)}>
              {t("Hide")}
            </button>
          </div>
          <div className="report-stats">
            <div>
              <b>{report.filled}</b> {t("filled")}
            </div>
            <div className={report.leftOpen ? "warn" : ""}>
              <b>{report.leftOpen}</b> {t("left open")}
            </div>
            <div>
              <b>{report.atMaxDays.length}</b> {t("at max days")}
            </div>
          </div>
          {report.opens && report.opens.length > 0 && (
            <details open>
              <summary>{t("Why seats stayed open")}</summary>
              <ul className="opens">
                {report.opens.map((o) => (
                  <li key={o.id}>
                    <b>{openLabel(o.id, o.label)}</b>
                    <div className="muted small">{reason(o.why)}</div>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {report.atMaxDays.length > 0 && (
            <details>
              <summary>{t("People at their max days")}</summary>
              <p className="small">{report.atMaxDays.join(", ")}</p>
            </details>
          )}
          {report.unusedCover && report.unusedCover.length > 0 && (
            <details>
              <summary>{t("Cover staff not used at the other site")}</summary>
              <p className="small">{reason(report.unusedCover.join(", "))}</p>
            </details>
          )}
        </section>
      )}

      {picking && (
        <SlotPicker
          s={s}
          store={store}
          week={week}
          slotId={picking.id}
          rName={rName}
          onClose={() => setPicking(null)}
          onEditPerson={(id) => {
            setPicking(null);
            onEditPerson(id);
          }}
        />
      )}

      {askScope && (
        <Modal
          title={t("This week already has assignments")}
          onClose={() => setAskScope(null)}
          footer={
            <>
              <button className="secondary" onClick={() => runArrange(askScope, "replace-all")}>
                {t("Replace all")}
              </button>
              <button className="primary" autoFocus onClick={() => runArrange(askScope, "fill-open")}>
                {t("Fill open only")}
              </button>
            </>
          }
        >
          <p>
            {t("Arranging")} <b>{scopeName(askScope)}</b>.
          </p>
          <ul className="choices">
            <li>
              <b>{t("Fill open only")}</b>{" "}
              {t("keeps every current assignment, including your edits, and only fills empty seats.")}
            </li>
            <li>
              <b>{t("Replace all")}</b>{" "}
              {t("clears this week's assignments at {where} and fills from scratch. Overrides and custom hours are removed too.", {
                where: scopeName(askScope),
              })}
            </li>
          </ul>
        </Modal>
      )}

      {editDays && (
        <Modal
          title={t("Working days this week")}
          onClose={() => setEditDays(false)}
          footer={
            <>
              <button className="secondary" onClick={resetDays}>
                {t("Reset to usual week")}
              </button>
              <button className="primary" autoFocus onClick={() => setEditDays(false)}>
                {t("Done")}
              </button>
            </>
          }
        >
          <p className="muted small">
            {t(
              "Applies to both restaurants for this week only. Closing a shift removes its seats; opening one adds the usual seats. The usual week is in Settings.",
            )}
          </p>
          <WorkingDays
            rows={dates.map((d) => ({ key: d, label: dayLabel(d), sub: shortDate(d), day: dayOf(d) }))}
            eveningDefault={periodTimes(store.templates, restaurantId, "evening").start}
            onChange={changeDay}
          />
        </Modal>
      )}

      {addingAt && (
        <Modal
          title={t("Add a seat · {day} {period}", {
            day: dayLabel(addingAt.date),
            period: periodName(addingAt.period),
          })}
          onClose={() => setAddingAt(null)}
        >
          <p className="muted">{t("Which role is this extra seat for?")}</p>
          <div className="rolepick">
            {store.settings.roles.map((r) => (
              <button
                key={r}
                className="secondary"
                onClick={() => {
                  s.saveWeek(addSeat(week, restaurantId, addingAt.date, addingAt.period, r));
                  setAddingAt(null);
                }}
              >
                {role(r)}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
