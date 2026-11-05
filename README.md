# Shift Planner

Weekly shift planner for two restaurants, for the manager (see `REQUIREMENTS.md`).
Cross-platform app built with Expo: iOS, Android and web from one codebase.

## Run it

```bash
npm install
npm start
```

Then press `w` for web, or scan the QR code with Expo Go on a phone (`npm run web`,
`npm run ios` and `npm run android` go straight to one platform).

All data is stored on the device, in an SQLite database (`expo-sqlite`). On the web
it lives in the browser's storage for this site. Nothing is sent to a server. A fresh
install starts from the empty starter files in `data-example/`.

## Moving data between devices, and from the old desktop version

Settings → **Backup**:

- **Export backup** saves a `.backup.json` file with all staff, settings and weeks
  (on a phone, the share sheet opens so you can save it to Files, Drive, email…).
- **Import backup…** replaces everything on this device with a backup file.

Data from the earlier desktop version (the private `data/` folder, either
`data/shift-planner.db` or `data/*.json`) can be turned into a backup file:

```bash
npm run export:backup
```

Then import that file in the app. Backup files hold real staff data: keep them out
of git (`*.backup.json` and `data/` are git-ignored, and the repo is public).

## Using it

- **Planner**: pick a restaurant and week, tap **Arrange both restaurants** (or one).
  Tap any seat to reassign, unassign, override (needs a reason) or set custom hours.
  Tick **Edit seats** to add or remove a seat for one day. **Working days** changes
  which shifts run this week.
- **Publish**: checklist (conflicts, open seats, overrides, hour warnings), Publish /
  Reopen, PDF, table for Excel (CSV), and WhatsApp text.
- **People**: staff, roles, cover flag, priority and all restrictions.
- **Settings**: names, week start, hour cap, footer, usual working days, roles,
  shift times and seat counts, language, theme, backup.

The header switches language (English / Hebrew, right-to-left) and theme.

PDF: on iOS and Android the roster is rendered by the system and can show Hebrew. On
the web it is made with jsPDF, whose built-in fonts are Latin-1 only, so it is in
English.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:arrange -- <backup-file>
```

`npm test` runs the storage tests against Node's SQLite. `test:arrange` checks the
solver against the §14 success criteria on real data: a backup file, or the desktop
`data/` folder when no file is given.

## Builds

- Web: `npm run build:web` writes a static site to `dist/`. `expo-sqlite` on the web
  needs these response headers on every page (the dev server already sends them):
  - `Cross-Origin-Embedder-Policy: credentialless`
  - `Cross-Origin-Opener-Policy: same-origin`
- iOS / Android: build with EAS (`npx eas-cli@latest build`), or `npx expo run:ios|android`
  locally. `ios/` and `android/` are generated, never edited by hand.

## Layout

- `src/app/`: screens (Expo Router tabs: Planner, Publish, People, Settings)
- `src/domain/`: scheduling rules, solver, dates, checks, exports text, translations (no framework code)
- `src/data/`: on-device SQLite database, the store hook, backups
- `src/ui/`: shared components, theme, app state
- `src/export/`: PDF, files and clipboard, with `.web.ts` versions for the browser
- `scripts/`: Node scripts (solver check, backup export)
