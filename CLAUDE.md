# Shift Planner — project context and handoff

Manager-only, offline app for weekly shift planning across two restaurants.
Cross-platform (iOS, Android, web) with Expo, built the same way as the `shalev-gym` app.
The spec is in `REQUIREMENTS.md` (v1.3). Read it before making functional changes.
Expo-specific rules are in `AGENTS.md` (Expo changes every SDK: check the versioned docs).

## Stack and run

- Expo SDK 58 + Expo Router + React Native 0.88 + react-native-web, TypeScript (strict).
- `npm install` → `npm start` (press `w` for web, or scan the QR code with Expo Go).
- `npm run typecheck`, `npm run lint`, `npm test` (jest-expo) — run all three before declaring work done.
- `npm run test:arrange -- <backup-file>` runs `scripts/test-arrange.ts`, which checks the solver against the §14 success criteria on real data (a backup file, or the old desktop `data/` folder).
- `npm run build:web` exports a static site to `dist/`. Native builds go through EAS; `ios/` and `android/` are generated, never edited.
- Add Expo packages with `npx expo install <pkg>`, not `npm install`.

## Persistence (important)

- Data is four JSON documents: `settings`, `people`, `templates` and `weeks`, one row each in table `documents` of the on-device SQLite database `shift-planner.db` (`expo-sqlite`; on the web it uses the browser's storage via wasm, which needs the COEP/COOP headers set in `metro.config.js`).
- `src/data/db.ts`: `Db` type, `migrate()` (versioned with `PRAGMA user_version`; never edit a shipped migration). `src/data/documents.ts`: `getDoc`/`putDoc`/`loadAll`, plus backup files (`makeBackup`, `parseBackup`, `restoreAll`).
- A missing document is seeded from `data-example/` (`src/data/seed.ts`), which holds empty starter files only.
- `src/data/useStore.ts` (the `useStore` hook) keeps an in-memory copy and writes every change back immediately. Writes are queued per document so they land in order. `replaceAll` restores a backup.
- Moving data: Settings → Backup exports/imports a `.backup.json`. `npm run export:backup` turns the old desktop `data/` folder (`shift-planner.db` or `*.json`) into one.
- Don't use localStorage or AsyncStorage as storage, and never embed staff or week data in source.
- `data/`, `*.backup.json` are git-ignored (the GitHub repo is public). Never commit real data.

## Source map

| File | Role |
|---|---|
| `src/domain/types.ts` | All data types (Settings, Person, Templates, Assignment, WeekRecord, ArrangeReport, PublishedSnapshot) |
| `src/domain/dates.ts` | ISO date helpers, `startOfWeek(d, startsOn)`, `dayLabel`, `shortDate`, `hoursForPeriod` |
| `src/domain/eligibility.ts` | `ineligibleReasons()` checks the hard rules: role, home/cover, unavailable date, weekday limit, same-period overlap, no-doubles, max days, max consecutive. `hourWarning()` checks the soft hour cap |
| `src/domain/arrange.ts` | One-shot greedy solver `arrangeWeek()` plus `slotLabel()` |
| `src/domain/week.ts` | `emptyWeek`, `ensureWeek`, `slotsFor`, `setSlot`, `addSeat`, `removeSeat`, `hasAssignments`, `setWorkingDay` |
| `src/domain/checks.ts` | `publishChecklist()` lists open seats, overrides, hour warnings and conflicts |
| `src/domain/whatsapp.ts` | `weekSummaryText()` builds the WhatsApp text |
| `src/domain/table.ts` | `weekTableCsv()`: roster grid + hours per worker |
| `src/domain/workdays.ts` | Default working days, `defaultWeekDays`, `periodOpen`, `periodTimes`, `assignmentHours` |
| `src/domain/i18n.ts` | `translate`, `HE` strings, `translateReason`, `ltr()` (pure; the React hook is `src/ui/i18n.ts`) |
| `src/app/_layout.tsx` | Root: SQLiteProvider, store loading, theme/language, bottom tabs |
| `src/app/index.tsx` | Planner: week grid (scrolls sideways on phones), Arrange + Replace all / Fill open only, coverage row, Edit seats, Working days, arrange report |
| `src/app/publish.tsx` | Checklist, Publish / Republish / Reopen, PDF, CSV, copy WhatsApp text |
| `src/app/people.tsx` | Staff list and editor (side by side when wide, list → editor on phones). `/people?id=` opens a person |
| `src/app/settings.tsx` | Appearance, general, working days, roles, shift times and seat counts, backup |
| `src/ui/AppState.tsx` | Shared state: store, selected restaurant, week offset, current week, `rName` |
| `src/ui/kit.tsx` | Buttons, chips, `Choice` (instead of `<select>`), `TimeInput` (HH:MM), `Check`, `Sheet` (modal), `Collapsible` |
| `src/ui/SlotPicker.tsx` | Seat dialog: eligible people, ineligible with reasons, unassign, override with a required reason, custom hours |
| `src/ui/WeekBar.tsx`, `WorkingDays.tsx`, `HeaderPrefs.tsx` | Restaurant/week switcher, per-day editor, header language/theme/save state |
| `src/ui/dialogs.ts` | `confirmAsync` / `notify`: `window.confirm` on web, `Alert` on native |
| `src/ui/theme.ts` | Light/dark palettes; `Settings.theme` overrides the system scheme |
| `src/export/pdf.ts` / `pdf.web.ts` | Native: HTML → `expo-print` → share sheet (Hebrew works). Web: jsPDF, English only (Latin-1 fonts) |
| `src/export/share.ts` / `share.web.ts` | Save/share a text file, copy to clipboard, pick a file |

## Solver behaviour (`arrangeWeek`)

- Scope is `"a"`, `"b"` or `"both"`. Mode is `"replace-all"` or `"fill-open"`.
- Assignments outside the scope are never changed and count as locked constraints.
- The loop works on the most-constrained open seat first, meaning the one with the fewest eligible people.
- Candidates are ranked in this order: home before cover, then not over the hour cap, then `Person.priority` (1 first … 5 last, missing = 3, see `priorityOf`), then most remaining day capacity, then fewest days so far, then name. The seat picker sorts eligible people the same way.
- Every placement passes `ineligibleReasons`. The solver never uses overrides. It is deterministic.
- The report records filled count, leftOpen, atMaxDays, unusedCover, and `opens[]` with a per-person reason for each seat left open.
- With the seeded data and the default working days it fills all 66 seats.

## Language, theme, custom hours, table export

- `src/domain/i18n.ts`: English text is the translation key; `HE` holds Hebrew. `useI18n()` (`src/ui/i18n.ts`) gives `t`, `role`, `period`, `reason`, `rtl`. Rule messages from `eligibility.ts` stay English and are rewritten for Hebrew by regex in `translateReason`, so keep those in sync when adding a rule. `ltr()` keeps time ranges left-to-right inside Hebrew.
- `Settings.language` / `Settings.theme` save immediately (top bar or Settings → Appearance). The root view sets `direction: rtl` for Hebrew (and `<html lang dir>` on web); use logical style props (`paddingStart`, `borderEndWidth`, …). Dates use `setDateLang`. The web PDF is always English; the native PDF follows the language.
- `Assignment.customStart/customEnd` override a seat's hours (seat dialog → "Hours for …"). Hours everywhere go through `assignmentHours` in `workdays.ts` (ends at/before start run past midnight). Reassigning a seat or Replace all clears them.
- `src/domain/table.ts` builds the CSV; Publish → "Download table (Excel)" saves it with a UTF-8 BOM (download on web, share sheet on phones).

## Working days

- `Settings.workingDays` (keyed "0"–"6") is the usual week. When it's missing, `DEFAULT_WORKING_DAYS` in `src/workdays.ts` applies: Sun–Thu both shifts, Friday closed, Saturday evening only from 19:00 (after Shabbat).
- Each `WeekRecord.days` (keyed by ISO date) is a copy made when the week is first generated. The Planner's "Working days" dialog edits it for one week (`setWorkingDay` in `week.ts` removes or adds that day's seats at both restaurants).
- `eveningStart` overrides the template evening start for that day. Hours (`hoursForPeriod`, `Occupancy.days`), the PDF and the WhatsApp text all use it.
- Weeks saved before this feature have no `days`; `ensureWeek` treats them as every day open.

## History

- First sessions (2026-10-30): the web version (React + Vite, a local data API in `vite.config.ts`, storage behind a `DataStore` interface in `server/storage/`). The solver and rule modules moved to `src/domain/` unchanged, except that React and browser code left `i18n.ts` and `table.ts`.
- 2026-11-05: converted to a cross-platform Expo app modelled on `shalev-gym`. The Vite server, `server/storage/` and the HTML/CSS components were replaced by Expo Router screens, React Native components and on-device SQLite. Backup export/import replaces the shared `data/` folder.

## Verification status

- `npm run typecheck`, `npm run lint`, `npm test` pass. `npm run test:arrange` passes every §14 check on a synthetic 30-person backup (fills 66/66 seats).
- Web: end-to-end in Chromium (desktop and phone sizes): import backup, arrange, seat picker, unassign, data kept after reload, publish, PDF and CSV downloads, People editor, Hebrew RTL, dark mode. No console errors.
- iOS / Android: both bundles compile (`expo export`), but the app has **not** been run on a device or simulator yet. Check the PDF/CSV share sheet, backup import and the grid there.

## Known gaps / next steps

1. Run on a real phone (Expo Go) and check sharing, file import and layout.
2. The web PDF can't show Hebrew names (jsPDF Latin-1 fonts). Embedding a Hebrew TTF with `doc.addFileToVFS` and `addFont` would fix it; the native PDF already handles Hebrew.
3. No sync between devices: data is per device, moved with backup files. Supabase (as in `shalev-gym`) would be the next step for multi-device or multi-user.
4. Optional per-weekday staffing (§8, §12) isn't implemented. Templates are per restaurant and per period only.
5. Max-consecutive-days is only checked within the current week, not across week boundaries.
6. The "Reopen" flow restores Draft but doesn't diff against the published snapshot.
7. Changes to staffing templates only affect weeks that haven't been saved yet.
8. `REQUIREMENTS.md` still describes the original Vite/JSON-files stack (§5, §13); update it if the spec should follow the new platform.
9. No UI tests (React Native Testing Library is not installed).
