import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { dayLabel, formatWeekRange, shortDate, weekDates } from '@/domain/dates';
import { periodLabel, roleLabel, translate } from '@/domain/i18n';
import type { Lang, Person, RestaurantId, Settings, Templates, WeekRecord } from '@/domain/types';
import { PERIODS, slotsFor } from '@/domain/week';
import { assignmentTimes, periodOpen } from '@/domain/workdays';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * On iOS and Android the roster is rendered from HTML by the system's print
 * engine, so unlike the web jsPDF version it can show Hebrew.
 */
export function weekRosterHtml(opts: {
  week: WeekRecord;
  restaurantId: RestaurantId;
  settings: Settings;
  people: Person[];
  templates: Templates;
  lang: Lang;
}): string {
  const { week, restaurantId, settings, people, templates, lang } = opts;
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const title = settings.restaurants.find((r) => r.id === restaurantId)?.name ?? restaurantId;
  const nameById = new Map(people.map((p) => [p.id, p.name]));
  const dates = weekDates(week.weekStart);
  const published = week.status[restaurantId] === 'published';

  const rows = PERIODS.map((period) => {
    const tp = templates.templates[restaurantId][period];
    const cells = dates.map((date) => {
      const day = week.days?.[date];
      if (day && !periodOpen(day, period)) return `<td class="closed">${esc(t('Closed'))}</td>`;
      const byRole = new Map<string, string[]>();
      for (const s of slotsFor(week, restaurantId, date, period)) {
        const tm = assignmentTimes(s, templates, week.days);
        const hours = s.personId && tm.custom ? ` <span class="ltr">(${tm.start}-${tm.end})</span>` : '';
        const who = s.personId
          ? esc(nameById.get(s.personId) ?? '?') + hours
          : `<span class="open">${esc(t('OPEN'))}</span>`;
        byRole.set(s.role, [...(byRole.get(s.role) ?? []), who]);
      }
      const lines = [...byRole.entries()].map(
        ([role, names]) => `<div><b>${esc(roleLabel(lang, role))}:</b> ${names.join(', ')}</div>`,
      );
      if (period === 'evening' && day?.eveningStart)
        lines.unshift(`<div class="muted">${esc(t('PM from {time}', { time: day.eveningStart }))}</div>`);
      return `<td>${lines.join('') || '-'}</td>`;
    });
    return `<tr><th>${esc(periodLabel(lang, period))}<br><span class="muted ltr">${tp.start}-${tp.end}</span></th>${cells.join('')}</tr>`;
  });

  return `<!doctype html>
<html lang="${lang}" dir="${lang === 'he' ? 'rtl' : 'ltr'}">
<head><meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: -apple-system, Roboto, "Segoe UI", Arial, sans-serif; color: #1d1f22; font-size: 10pt; }
  h1 { font-size: 16pt; margin: 0 0 2mm; }
  .sub { color: #5a5a5a; font-size: 9pt; margin-bottom: 4mm; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 0.3mm solid #c8c8c8; padding: 2mm; vertical-align: top; text-align: start; }
  thead th { background: #212529; color: #fff; }
  tbody th { width: 24mm; }
  .closed { color: #888; }
  .open { color: #b02020; font-weight: 700; }
  .muted { color: #777; font-weight: 400; }
  .ltr { direction: ltr; unicode-bidi: isolate; }
  .footer { margin-top: 5mm; font-size: 9pt; }
</style></head>
<body>
  <h1>${esc(title)} - ${esc(formatWeekRange(week.weekStart, lang))}</h1>
  <div class="sub">${esc(new Date().toLocaleString(lang === 'he' ? 'he-IL' : 'en-GB'))} | ${esc(published ? t('Published') : t('DRAFT'))}</div>
  <table>
    <thead><tr><th>${esc(t('Shift'))}</th>${dates
      .map((d) => `<th>${esc(dayLabel(d, lang))}<br>${esc(shortDate(d, lang))}</th>`)
      .join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>
  ${settings.pdfFooter ? `<div class="footer">${esc(settings.pdfFooter)}</div>` : ''}
</body></html>`;
}

export async function downloadWeekPdf(opts: Parameters<typeof weekRosterHtml>[0]): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: weekRosterHtml(opts) });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
