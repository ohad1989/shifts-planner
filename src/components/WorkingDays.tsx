import type { DayMode, WorkingDay } from "../types";
import { DAY_MODES } from "../workdays";
import { useI18n } from "../i18n";

const MODE_LABELS: Record<DayMode, string> = {
  both: "Both shifts",
  morning: "Morning only",
  evening: "Evening only",
  closed: "Closed",
};

/** One row per day: open periods, plus an optional late evening start. */
export default function WorkingDays(props: {
  rows: { key: string; label: string; sub?: string; day: WorkingDay }[];
  eveningDefault: string;
  onChange: (key: string, day: WorkingDay) => void;
  disabled?: boolean;
}) {
  const { rows, eveningDefault, onChange, disabled } = props;
  const { t } = useI18n();
  return (
    <div className="workdays">
      <div className="wd-head muted small">
        <span>{t("Day")}</span>
        <span>{t("Shifts")}</span>
        <span>{t("Evening starts")}</span>
      </div>
      {rows.map(({ key, label, sub, day }) => {
        const hasEvening = day.mode === "both" || day.mode === "evening";
        return (
          <div key={key} className={day.mode === "closed" ? "wd-row closed" : "wd-row"}>
            <span className="wd-day">
              <b>{label}</b>
              {sub && <span className="muted small"> {sub}</span>}
            </span>
            <select
              value={day.mode}
              disabled={disabled}
              onChange={(e) => onChange(key, { ...day, mode: e.target.value as DayMode })}
            >
              {DAY_MODES.map((m) => (
                <option key={m} value={m}>
                  {t(MODE_LABELS[m])}
                </option>
              ))}
            </select>
            <span className="wd-time">
              <input
                type="time"
                disabled={disabled || !hasEvening}
                value={day.eveningStart ?? ""}
                placeholder={eveningDefault}
                onChange={(e) =>
                  onChange(key, { ...day, eveningStart: e.target.value || undefined })
                }
              />
              {day.eveningStart && !disabled && hasEvening && (
                <button
                  className="link small"
                  title={t("Use the usual evening start ({time})", { time: eveningDefault })}
                  onClick={() => onChange(key, { mode: day.mode })}
                >
                  {t("usual")}
                </button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
