# Shift Planner — project context and handoff

Offline, manager-only React app for weekly shift planning across two restaurants.
The spec is in `REQUIREMENTS.md` (v1.3). Read it before making functional changes.

## Stack and run

- React 19 + Vite 7 + TypeScript (strict). jsPDF + jspdf-autotable for PDFs.
- `npm install` (once, online) → `npm run dev` → http://localhost:5173
- `npm run build` runs `tsc -b && vite build`. `npm run preview` serves the build.
- `npm run test:arrange` runs `npx tsx scripts/test-arrange.ts`, which checks the solver against the §14 success criteria using the real `data/*.json` files.

## Persistence (important)

- The source of truth is the JSON files in `data/`: `settings.json`, `people.json`, `templates.json` and `weeks.json`.
- `vite.config.ts` contains a small middleware plugin (`dataFileApi`). It serves `GET` and `PUT /api/data/<file>.json` in both dev and preview. Writes go to a `.tmp` file that is then renamed, and errors return a 500.
- `src/api.ts` is the fetch client. `src/store.ts` (the `useStore` hook) keeps an in-memory copy of the files and writes every change back immediately. Writes are queued per file so they land in order.
- Don't use localStorage or IndexedDB as storage, and never embed staff or week data in source.
- `data/` is git-ignored (the GitHub repo is public). `dataFileApi` copies a missing file from `data-example/` on first GET. Never commit real data.

## Source map

| File | Role |
|---|---|
| `src/types.ts` | All data types (Settings, Person, Templates, Assignment, WeekRecord, ArrangeReport, PublishedSnapshot) |
| `src/dates.ts` | ISO date helpers, `startOfWeek(d, startsOn)`, `dayLabel`, `shortDate`, `hoursForPeriod` |
| `src/eligibility.ts` | `ineligibleReasons()` checks the hard rules: role, home/cover, unavailable date, weekday limit, same-period overlap, no-doubles, max days, max consecutive. `hourWarning()` checks the soft hour cap |
| `src/arrange.ts` | One-shot greedy solver `arrangeWeek()` plus `slotLabel()` |
| `src/week.ts` | `emptyWeek`, `ensureWeek`, `slotsFor`, `setSlot`, `addSeat`, `removeSeat`, `hasAssignments` |
| `src/checks.ts` | `publishChecklist()` lists open seats, overrides, hour warnings and conflicts |
| `src/pdf.ts` | `downloadWeekPdf()`, a landscape A4 roster for one restaurant |
| `src/whatsapp.ts` | `weekSummaryText()` builds the WhatsApp text |
| `src/App.tsx` | Tabs (Planner, Publish, People, Settings), restaurant switcher and week navigation |
| `src/components/Planner.tsx` | Week grid, Arrange buttons and the Replace all / Fill open only dialog, coverage strip, Edit seats mode, arrange report |
| `src/components/SlotPicker.tsx` | Seat modal: eligible people, ineligible people with reasons, unassign, override with a required reason |
| `src/components/People.tsx` | Staff list and editor for every restriction field |
| `src/components/Publish.tsx` | Checklist, Publish / Republish / Reopen, PDF, copy WhatsApp text |
| `src/components/SettingsView.tsx` | Restaurant names, week start, hour cap, no-doubles default, footer, roles, per-restaurant times and seat counts |
| `src/components/Modal.tsx` | Generic modal |
| `src/workdays.ts` | Default working days, `defaultWeekDays`, `periodOpen`, `periodTimes` |
| `src/components/WorkingDays.tsx` | Per-day editor (open shifts + evening start) used by Settings and the Planner dialog |
| `src/styles.css` | All styling, with CSS variables for light and dark mode |

## Solver behaviour (`arrangeWeek`)

- Scope is `"a"`, `"b"` or `"both"`. Mode is `"replace-all"` or `"fill-open"`.
- Assignments outside the scope are never changed and count as locked constraints.
- The loop works on the most-constrained open seat first, meaning the one with the fewest eligible people.
- Candidates are ranked in this order: home before cover, then not over the hour cap, then `Person.priority` (1 first … 5 last, missing = 3, see `priorityOf`), then most remaining day capacity, then fewest days so far, then name. The seat picker sorts eligible people the same way.
- Every placement passes `ineligibleReasons`. The solver never uses overrides. It is deterministic.
- The report records filled count, leftOpen, atMaxDays, unusedCover, and `opens[]` with a per-person reason for each seat left open.
- With the seeded data and the default working days it fills all 66 seats.

## Language, theme, custom hours, table export

- `src/i18n.ts`: English text is the translation key; `HE` holds Hebrew. `useI18n()` gives `t`, `role`, `period`, `reason`. Rule messages from `eligibility.ts` stay English and are rewritten for Hebrew by regex in `translateReason`, so keep those in sync when adding a rule. `ltr()` keeps time ranges left-to-right inside Hebrew.
- `Settings.language` / `Settings.theme` save immediately (top bar or Settings → Appearance). App sets `<html lang dir data-theme>`; CSS uses logical properties (`margin-inline-start`, etc.) for RTL. Dates use `setDateLang`; the PDF always passes `"en"` (Latin-1 fonts).
- `Assignment.customStart/customEnd` override a seat's hours (seat dialog → "Hours for …"). Hours everywhere go through `assignmentHours` in `workdays.ts` (ends at/before start run past midnight). Reassigning a seat or Replace all clears them.
- `src/table.ts` exports a UTF-8-BOM CSV (roster grid + hours per worker) from Publish → "Download table (Excel)".

## Working days

- `Settings.workingDays` (keyed "0"–"6") is the usual week. When it's missing, `DEFAULT_WORKING_DAYS` in `src/workdays.ts` applies: Sun–Thu both shifts, Friday closed, Saturday evening only from 19:00 (after Shabbat).
- Each `WeekRecord.days` (keyed by ISO date) is a copy made when the week is first generated. The Planner's "Working days" dialog edits it for one week (`setWorkingDay` in `week.ts` removes or adds that day's seats at both restaurants).
- `eveningStart` overrides the template evening start for that day. Hours (`hoursForPeriod`, `Occupancy.days`), the PDF and the WhatsApp text all use it.
- Weeks saved before this feature have no `days`; `ensureWeek` treats them as every day open.

## Work done in the first session (claude.ai, 2026-10-30)

The repo already had: the data files, `types`, `api`, `dates`, `eligibility`, `arrange`, `week`, `pdf`, `whatsapp`, `vite.config.ts` and the configs. It had no UI.

Added:
- `main.tsx`, `App.tsx`, `store.ts`, `checks.ts`, `styles.css`, all of `components/*`, `scripts/test-arrange.ts`, `README.md`, and the `test:arrange` npm script.

Changed:
- `arrange.ts` was rewritten to work most-constrained first and prefer people under the hour cap. Its report gained `unusedCover` and `opens`.
- `week.ts`: `ensureWeek` now returns a saved week unchanged instead of rebuilding it from templates, which used to delete hand-added seats. Seat add, remove and set helpers were added.
- `types.ts`: `weekStartsOn: number`; `ArrangeReport.unusedCover?` and `opens?`; `WeekRecord.published?` holds a snapshot per restaurant.
- `dates.ts` gained `startOfWeek`, `addDays`, `dayLabel` and `shortDate`.
- `pdf.ts` groups seats by role, colours OPEN seats red, places the footer after the table, marks drafts as DRAFT, and maps characters outside Latin-1.
- `whatsapp.ts` now includes shift times, day headers and the footer.
- `vite.config.ts` gained try/catch error handling and atomic writes.

## Verification status

- Done: the solver test passes every §14 check. The logic modules typecheck under strict tsc.
- Done: an end-to-end browser test passed on an esbuild bundle with jsPDF stubbed out. It covered arrange, picker, override, fill-open keeping edits, publish and lock, people save, settings, and dark mode.
- Done (2026-10-30, second session): Node 26 installed, `npm install`, `npm run build` pass (needed `@types/node` for `vite.config.ts`).
- **Not yet done:** checking the real jsPDF output.

## Known gaps / next steps

1. Run `npm install && npm run build && npm run test:arrange` and fix anything that fails.
2. Open a generated PDF and check the layout.
3. The PDF can't show Hebrew names because the built-in fonts are Latin-1 only. A Hebrew TTF would need to be embedded with `doc.addFileToVFS` and `addFont`. The rest of the app, the WhatsApp text and the table export are bilingual.
4. Optional per-weekday staffing (§8, §12) isn't implemented. Templates are per restaurant and per period only.
5. Max-consecutive-days is only checked within the current week, not across week boundaries.
6. The "Reopen" flow restores Draft but doesn't diff against the published snapshot. A diff could be shown in the UI.
7. Changes to staffing templates only affect weeks that haven't been saved yet. An "apply template to this week" action could be added.
8. There are no unit tests for the UI. Vitest and Testing Library are not installed.
