import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { dayLabel, formatWeekRange, shortDate, weekDates } from "./dates";
import { PERIODS, slotsFor } from "./week";
import { assignmentTimes, periodOpen } from "./workdays";
import type {
  Person,
  RestaurantId,
  Settings,
  Templates,
  WeekRecord,
} from "./types";

// The built-in PDF fonts only cover Latin-1; map common symbols so they print.
function pdfSafe(s: string): string {
  return s
    .replace(/[→⇒]/g, "->")
    .replace(/[←]/g, "<-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-");
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function downloadWeekPdf(opts: {
  week: WeekRecord;
  restaurantId: RestaurantId;
  settings: Settings;
  people: Person[];
  templates: Templates;
}): void {
  const restaurant = opts.settings.restaurants.find(
    (r) => r.id === opts.restaurantId,
  );
  const nameById = new Map(opts.people.map((p) => [p.id, p.name]));
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const title = restaurant?.name ?? opts.restaurantId;
  const status = opts.week.status[opts.restaurantId];

  doc.setFontSize(16);
  // Built-in fonts are Latin-1 only, so the PDF is always in English.
  doc.text(pdfSafe(`${title} - ${formatWeekRange(opts.week.weekStart, "en")}`), 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    `Generated ${new Date().toLocaleString("en-GB")}  |  ${status === "published" ? "Published" : "DRAFT"}`,
    14,
    22,
  );
  doc.setTextColor(0);

  const dates = weekDates(opts.week.weekStart);
  const body: string[][] = [];
  for (const period of PERIODS) {
    const t = opts.templates.templates[opts.restaurantId][period];
    const row = [`${cap(period)}\n${t.start}-${t.end}`];
    for (const date of dates) {
      const day = opts.week.days?.[date];
      if (day && !periodOpen(day, period)) {
        row.push("Closed");
        continue;
      }
      const slots = slotsFor(opts.week, opts.restaurantId, date, period);
      const byRole = new Map<string, string[]>();
      for (const s of slots) {
        const tm = assignmentTimes(s, opts.templates, opts.week.days);
        const hours = s.personId && tm.custom ? ` (${tm.start}-${tm.end})` : "";
        const who = s.personId ? (nameById.get(s.personId) ?? "?") + hours : "OPEN";
        byRole.set(s.role, [...(byRole.get(s.role) ?? []), who]);
      }
      const lines = [...byRole.entries()].map(
        ([role, names]) => `${cap(role)}: ${names.join(", ")}`,
      );
      if (period === "evening" && day?.eveningStart) lines.unshift(`From ${day.eveningStart}`);
      row.push(pdfSafe(lines.join("\n") || "-"));
    }
    body.push(row);
  }

  autoTable(doc, {
    startY: 27,
    head: [["Shift", ...dates.map((d) => `${dayLabel(d, "en")}\n${shortDate(d, "en")}`)]],
    body,
    styles: { fontSize: 8.5, valign: "top", cellPadding: 2.2, lineColor: 200, lineWidth: 0.2 },
    headStyles: { fillColor: [33, 37, 41], textColor: 255 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 26 } },
    didParseCell: (data) => {
      if (data.section === "body" && String(data.cell.raw).includes("OPEN")) {
        data.cell.styles.textColor = [176, 32, 32];
      }
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 180;
  const footer = opts.settings.pdfFooter || "";
  if (footer) {
    doc.setFontSize(9);
    doc.text(pdfSafe(footer), 14, Math.min(finalY + 8, 200));
  }
  doc.save(`${title.replace(/\s+/g, "-")}-${opts.week.weekStart}.pdf`);
}
