import { useState } from "react";
import type { StoreApi } from "../store";
import type { Person, RestaurantId, Store, WeekRecord } from "../types";
import { daysWorked, hourWarning, hoursWorked, ineligibleReasons, priorityOf } from "../eligibility";
import { slotLabel } from "../arrange";
import { setSlot } from "../week";
import { assignmentTimes, periodTimes, spanHours } from "../workdays";
import { ltr, useI18n } from "../i18n";
import Modal from "./Modal";

export default function SlotPicker(props: {
  s: StoreApi;
  store: Store;
  week: WeekRecord;
  slotId: string;
  rName: (id: RestaurantId) => string;
  onClose: () => void;
  onEditPerson: (personId: string) => void;
}) {
  const { s, store, week, slotId, rName, onClose, onEditPerson } = props;
  const { t, lang, reason } = useI18n();
  const slot = week.assignments.find((a) => a.id === slotId);
  const [showAll, setShowAll] = useState(false);
  const [overrideFor, setOverrideFor] = useState<Person | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [filter, setFilter] = useState("");
  const initial = slot ? assignmentTimes(slot, store.templates, week.days) : null;
  const [start, setStart] = useState(initial?.start ?? "");
  const [end, setEnd] = useState(initial?.end ?? "");

  if (!slot || !initial) return null;
  const occ = {
    assignments: week.assignments,
    templates: store.templates,
    hourCap: store.settings.hourCap,
    days: week.days,
  };
  const usual = periodTimes(store.templates, slot.restaurantId, slot.period, week.days?.[slot.date]);
  const current = slot.personId ? store.people.find((p) => p.id === slot.personId) : undefined;
  // Candidates are judged on the shift's usual hours: custom hours belong to whoever holds the seat.
  const plainSlot = { ...slot, customStart: undefined, customEnd: undefined };
  const others = week.assignments.filter((a) => a.id !== slot.id);

  const rows = store.people
    .filter((p) => p.id !== slot.personId)
    .filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()))
    .map((p) => {
      const reasons = ineligibleReasons(p, slot, occ, slot.id);
      return {
        p,
        reasons,
        warn: hourWarning(p, plainSlot, occ, slot.id),
        days: daysWorked(p.id, others).size,
        hours: hoursWorked(p.id, others, store.templates, week.days),
        home: p.homeRestaurantId === slot.restaurantId,
        hasRole: p.roles.includes(slot.role),
      };
    });

  const eligible = rows
    .filter((r) => r.reasons.length === 0)
    .sort(
      (a, b) =>
        Number(b.home) - Number(a.home) ||
        Number(!!a.warn) - Number(!!b.warn) ||
        priorityOf(a.p) - priorityOf(b.p) ||
        a.days - b.days ||
        a.p.name.localeCompare(b.p.name),
    );
  const blocked = rows
    .filter((r) => r.reasons.length > 0 && r.p.active)
    .filter((r) => showAll || r.hasRole)
    .sort(
      (a, b) =>
        Number(b.hasRole) - Number(a.hasRole) ||
        a.reasons.length - b.reasons.length ||
        a.p.name.localeCompare(b.p.name),
    );
  const hiddenCount = rows.filter((r) => r.reasons.length > 0 && r.p.active && !r.hasRole).length;

  // A new person on the seat starts from the usual hours.
  const assign = (p: Person | null, override = false, why = "") => {
    s.saveWeek(
      setSlot(week, slot.id, {
        personId: p ? p.id : null,
        override,
        overrideReason: override ? why : "",
        customStart: undefined,
        customEnd: undefined,
      }),
    );
    onClose();
  };

  const saveHours = (customStart?: string, customEnd?: string) => {
    s.saveWeek(setSlot(week, slot.id, { customStart, customEnd }));
    onClose();
  };
  const hoursValid = /^\d\d:\d\d$/.test(start) && /^\d\d:\d\d$/.test(end) && start !== end;
  const hoursChanged = start !== initial.start || end !== initial.end;
  const isUsual = start === usual.start && end === usual.end;
  const weekHours = current
    ? hoursWorked(current.id, others, store.templates, week.days) + (hoursValid ? spanHours(start, end) : 0)
    : 0;

  const capDays = (p: Person) => (p.maxDaysPerWeek == null ? "" : `/${p.maxDaysPerWeek}`);

  return (
    <Modal title={slotLabel(slot, rName, lang)} onClose={onClose} wide>
      {overrideFor ? (
        <div className="override-form">
          <p>{t("Assign {name} anyway? This breaks:", { name: overrideFor.name })}</p>
          <ul className="reasons">
            {ineligibleReasons(overrideFor, slot, occ, slot.id).map((r) => (
              <li key={r}>{reason(r)}</li>
            ))}
          </ul>
          <label className="field">
            <span>{t("Reason (shown on the publish checklist)")}</span>
            <input
              autoFocus
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder={t("e.g. Agreed by phone, swap with Dani")}
            />
          </label>
          <div className="row-end">
            <button className="secondary" onClick={() => setOverrideFor(null)}>
              {t("Back")}
            </button>
            <button
              className="danger"
              disabled={!overrideReason.trim()}
              onClick={() => assign(overrideFor, true, overrideReason.trim())}
            >
              {t("Confirm override")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="current">
            <div>
              <div className="muted small">{t("Currently")}</div>
              <div className="cur-name">
                {current ? current.name : slot.personId ? t("Unknown person") : t("Open")}
                {slot.override && (
                  <span className="pill override">
                    {t("Override: {reason}", { reason: slot.overrideReason })}
                  </span>
                )}
              </div>
            </div>
            <div className="current-actions">
              {current && (
                <button className="secondary" onClick={() => onEditPerson(current.id)}>
                  {t("Edit worker")}
                </button>
              )}
              {slot.personId && (
                <button className="secondary" onClick={() => assign(null)}>
                  {t("Unassign")}
                </button>
              )}
            </div>
          </div>

          {current && (
            <div className="hours-box">
              <div className="hours-head">
                <b>{t("Hours for {name}", { name: current.name })}</b>
                <span className="muted small">
                  {t("Usual shift {time}", { time: ltr(`${usual.start}–${usual.end}`) })}
                </span>
              </div>
              <div className="hours-row">
                <label className="field">
                  <span>{t("Start")}</span>
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                </label>
                <label className="field">
                  <span>{t("End")}</span>
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                </label>
                <div className="hours-total">
                  <b>{hoursValid ? spanHours(start, end) : "—"}</b> {t("h this shift")}
                  <div className="muted small">
                    {t("{h}h this week", { h: Math.round(weekHours * 100) / 100 })}
                  </div>
                </div>
                <div className="spacer" />
                {initial.custom && (
                  <button className="link" onClick={() => saveHours(undefined, undefined)}>
                    {t("Back to usual hours")}
                  </button>
                )}
                <button
                  className="primary"
                  disabled={!hoursValid || !hoursChanged}
                  onClick={() =>
                    isUsual ? saveHours(undefined, undefined) : saveHours(start, end)
                  }
                >
                  {t("Save hours")}
                </button>
              </div>
            </div>
          )}

          <input
            className="search"
            placeholder={t("Filter by name…")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />

          <h5>{t("Eligible ({n})", { n: eligible.length })}</h5>
          {eligible.length === 0 && (
            <p className="muted small">{t("Nobody can take this seat without breaking a rule.")}</p>
          )}
          <ul className="people-list">
            {eligible.map((r) => (
              <li key={r.p.id}>
                <button className="person ok" onClick={() => assign(r.p)}>
                  <span className="pn">
                    {r.p.name}
                    <span className={`pill prio p${priorityOf(r.p)}`} title={t("Priority")}>
                      P{priorityOf(r.p)}
                    </span>
                  </span>
                  <span className="tags">
                    {!r.home && <span className="pill cover">{t("Cover")}</span>}
                    {r.warn && <span className="pill soft">{reason(r.warn)}</span>}
                    <span className="muted small">
                      {t("{days} days · {hours}h", { days: `${r.days}${capDays(r.p)}`, hours: r.hours })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <h5>{t("Not eligible ({n})", { n: blocked.length })}</h5>
          <ul className="people-list">
            {blocked.map((r) => (
              <li key={r.p.id}>
                <div className="person blocked">
                  <span className="pn">{r.p.name}</span>
                  <span className="why">{r.reasons.map(reason).join(" · ")}</span>
                  <button
                    className="link"
                    onClick={() => {
                      setOverrideReason("");
                      setOverrideFor(r.p);
                    }}
                  >
                    {t("Override…")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && (
            <button className="link" onClick={() => setShowAll((v) => !v)}>
              {showAll
                ? t("Hide {n} people without this role", { n: hiddenCount })
                : t("Show {n} people without this role", { n: hiddenCount })}
            </button>
          )}
        </>
      )}
    </Modal>
  );
}
