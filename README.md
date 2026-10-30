# Shift Planner

Offline, manager-only weekly shift planner for two restaurants (see `REQUIREMENTS.md`).

## Run

```
npm install          # once, needs internet
npm run dev          # then open http://localhost:5173
```

After `npm install`, everything runs with the network off. All data lives in `data/*.json`;
the Vite dev server includes a tiny local file service (`/api/data/*.json`) that reads and
writes those files. Every edit is written immediately. Back up the `data` folder to back up
everything.

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

`npm run test:arrange` runs the arrange rules against the current `data/` files and
checks the §14 success criteria (no 4th day for max-3 people, period limits, no doubles,
no cover overlap, edits survive "Fill open only", deterministic).
