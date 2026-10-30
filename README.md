# Shift Planner

Offline, manager-only weekly shift planner for two restaurants (see `REQUIREMENTS.md`).

## Run

```
npm install          # once, needs internet
npm run dev          # then open http://localhost:5173
```

After `npm install`, everything runs with the network off. All data lives in `data/`; the
Vite server includes a tiny local data service (`/api/data/*.json`) that reads and writes it.
Every edit is written immediately. Back up the `data` folder to back up everything (stop the
app first so the SQLite files are consistent).

Storage backend, chosen with the `DATA_STORE` environment variable:

- `sqlite` (default): a single database file, `data/shift-planner.db`. Any existing
  `data/*.json` files are imported into it on first run.
- `json`: one file per document, `data/*.json` (the original format).
  PowerShell: `$env:DATA_STORE="json"; npm run dev`.

The backends share one interface (`server/storage/`), so another database can be added later
without changing the app.

`data/` holds real staff and schedule data, so it is git-ignored and never uploaded. On a fresh
clone, the first run creates the data from the empty starter files in `data-example/`.

For a production-style run: `npm run build && npm run preview`.

## Using it

- **Planner** – pick restaurant and week, click **Arrange both restaurants** (or one).
  Click any seat to reassign, unassign or override (needs a reason). Tick **Edit seats**
  to add or remove a seat for one day.
- **Publish** – checklist (conflicts, open seats, overrides, hour warnings), Publish /
  Reopen, Download PDF, Copy WhatsApp text.
- **People** – staff, roles, cover flag and all restrictions.
- **Settings** – names, week start, hours, staffing per period, roles, hour cap, footer.

## Solver check

`npm run test:arrange` runs the arrange rules against the current data and
checks the §14 success criteria (no 4th day for max-3 people, period limits, no doubles,
no cover overlap, edits survive "Fill open only", deterministic).
