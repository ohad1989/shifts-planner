# Shift Planner — Requirements (v1)

**Product:** a manager-only **offline** React app to plan weekly shifts for two restaurants, enforce staff restrictions, **auto-fill a week in one shot**, then let you edit, and send the published roster as a PDF and a WhatsApp-ready summary.

**Owner:** אוהד (software engineer, restaurant manager)

**Status:** Draft v1.3 — auto-arrange then edit; exactly two shifts per restaurant (morning, evening).

---

## 1. Problem

You manage two restaurants. Each runs **morning** and **evening** only. Staff are mostly dedicated to one location, with a small group who can cover both. People have real limits: mornings only, evenings only, no doubles, only a few days a week. You want the app to **propose a legal week in one action**, then you tweak names — not to place every slot by hand from a blank grid.

## 2. Goals

1. Each restaurant has **exactly two shifts every day: Morning and Evening**.
2. Keep a single staff list with a **home restaurant**, **one or more roles**, and an optional **can cover the other location** flag.
3. Attach **structured restrictions** to each person and enforce them in auto-arrange and in manual edits.
4. **One-shot arrange:** fill a week (one restaurant or both) from restrictions and required slots, then you edit.
5. Publish: lock, **PDF**, **WhatsApp-ready text**.
6. **Fully offline**. Data only in JSON files. English UI.

## 3. Non-goals (v1)

- Staff login, availability self-service, swap requests, or time clock
- Payroll, tips, POS, or punch-in
- Extra shift periods (lunch split, late night, events) — only morning and evening
- Continuous/live re-optimization while you type (arrange is explicit, one shot)
- Labor-law engines beyond the restriction types in §6
- Native mobile wrappers
- Multi-manager permissions, accounts, or cloud sync
- Hebrew UI
- WhatsApp Business API

## 4. Users and access

| Role | Access |
|------|--------|
| Manager (you) | Full: people, restrictions, staffing needs, arrange, edit, publish, PDF, WhatsApp copy |
| Staff | None in-app. They receive PDF / WhatsApp text |

No authentication. Single-user, local data on this machine.

## 5. Offline

The app is an **offline-first local tool**, not a website that needs a server.

Must:

- Work with **network off** for planning, auto-arrange, people, publish, PDF, and copy-to-clipboard
- Persist **only** in JSON files on disk (see §13). No IndexedDB, no `localStorage` as source of truth
- Survive close / reopen / reboot / browser cache wipe
- Never call a remote API for core features (including arrange — solver runs in-process)
- Generate PDFs entirely in the client

WhatsApp sharing uses the phone/desktop WhatsApp app: copy text or attach the downloaded PDF.

## 6. Staff restrictions

Restrictions are **data**. Auto-arrange must obey them. Manual assign must obey them the same way.

### 6.1 Time of day per weekday

For each person, for each day Sun–Sat:

| Value | Meaning |
|-------|---------|
| Any | Morning or evening (default) |
| Mornings only | Morning shift only that day |
| Evenings only | Evening shift only that day |
| Off | Must not work that day |

Morning vs evening is the shift **period**, not inferred from the clock.

### 6.2 No double shifts

Per person (default **on**):

- Must not work **morning and evening on the same calendar day**, at the same restaurant or the other one.

Global default for new people. Per-person override if someone may do doubles.

### 6.3 Max working days per week

Per person: integer 1–7, or empty = no cap.

Example: **3** → at most three distinct days with any assignment that week (across both restaurants). Auto-arrange must not schedule a 4th day.

### 6.4 Max hours per week

Per person or global default (default **40**). Soft: warn, still allowed unless you later make it hard.

### 6.5 Other structured limits (v1)

| Constraint | Example |
|------------|---------|
| Specific days off (recurring) | Off every Friday |
| One-off date unavailable | 5 Nov — exam / vacation |
| Max consecutive days | 3 in a row then a day off |
| Roles allowed | on the person record |

### 6.6 Enforcement

**Hard (arrange never violates; picker blocks unless override):** period, off day, no-doubles, max days, overlap across restaurants, missing role, home restaurant (unless cover).

**Soft:** hour cap.

Manual **Override** (confirm + reason) is allowed after arrange. Publish lists overrides. Auto-arrange itself **does not** use overrides.

## 7. Locations, people, roles

### 7.1 Restaurants

Two locations, user-renameable. Defaults: `Restaurant A`, `Restaurant B`.

### 7.2 People

- Full name
- Home restaurant (`A` or `B`)
- **Roles (one or more)**
- Optional **can cover other location**
- Active / inactive
- Restrictions (§6)
- Optional notes

Assign only at home restaurant unless cover is on.

### 7.3 Roles

A person can hold **multiple roles**. A slot asks for **one** role.

**Seeded:** Bartender, Grillman, Chef. Role list is editable in settings.

## 8. Shifts: morning and evening only

Every restaurant, every day of the week:

| Period | Default hours (editable in settings) |
|--------|--------------------------------------|
| Morning | `11:00–16:00` |
| Evening | `16:00–23:00` |

No third shift. No one-off extra periods in v1. Hours and **how many of each role** you need can differ per restaurant (and optionally per weekday), but the periods are only these two.

### 8.1 Staffing need (slots)

Per restaurant, per period, a list of required seats, e.g. Morning: 1 Chef, 1 Grillman, 1 Bartender. Evening may differ.

Empty seats after arrange stay **Open** for you to fill or leave.

### 8.2 Week

- Sunday–Saturday
- Status per restaurant per week: `Draft` | `Published`
- Reopen published → Draft. Republish overwrites the snapshot.

## 9. One-shot arrange, then edit

This is the main planning flow.

1. You keep people, restrictions, and staffing needs up to date.
2. You pick a week (and one restaurant or **both**).
3. You click **Arrange**.
4. The solver fills as many slots as it can **in one run**, without violating hard restrictions.
5. The grid is a normal **draft**: you change anyone, swap, unassign, override.
6. Arrange does **not** keep running in the background. It only runs when you click it.

### 9.1 What Arrange does

- Runs entirely on this machine (no API).
- Considers **both restaurants in one shot** when you choose both, so cover staff are not double-booked and no-doubles/max-days apply across sites.
- If you arrange **one** restaurant, existing assignments at the other restaurant are treated as **locked** constraints (do not steal people off the other site’s already filled slots).
- Prefers home-restaurant staff; uses cover people only when home staff cannot fill a seat.
- Spreads days reasonably (do not dump all of someone’s three days on Fri–Sun if other days are open), but **correctness beats fairness**.
- Leaves a slot **Open** rather than break a rule.
- After the run, shows a short report: filled count, remaining open slots, people at max days, unused cover staff.

### 9.2 What Arrange must not do

- Violate hard restrictions
- Invent a third shift
- Assign a role the person does not have
- Quietly override rules (that is only a manual action)

### 9.3 Re-running Arrange

If the week already has assignments, **Arrange** asks:

- **Replace all** — wipe this week’s assignments (this restaurant, or both if that was the scope) and fill from scratch
- **Fill open only** — keep your edits; only populate empty seats

Default: **Fill open only** if you already edited; **Replace all** if the week is empty.

### 9.4 Manual edit after arrange

Same grid as today:

- Click a slot → eligible people first, ineligible listed with reasons
- Unassign, swap (pick another eligible person)
- Add/remove a seat for that period (rare; staffing need is the default)

Your edits write to `data/weeks.json` immediately. They are never discarded unless you **Replace all**.

## 10. Planner UX

Primary view: **week grid**.

- Rows: **Morning**, **Evening** (only)
- Columns: Sun–Sat
- Cell: seats with name or “Open”
- Location switcher A | B
- **Arrange** (this restaurant | both restaurants)
- **Coverage strip:** the other restaurant that day

Publish remains a separate action after you are happy with the edit.

## 11. Publish and distribute

Checklist: open slots, overrides, hour warnings, conflicts.

PDF: restaurant, week, timestamp, day × Morning/Evening grouped by role, OPEN, footer.

WhatsApp: copy text; attach PDF yourself.

## 12. Settings

- Restaurant names
- Week start day
- Morning and evening **clock times** per restaurant
- Staffing need (role counts) per restaurant, per period (optional per weekday)
- Global hour cap
- Default “no double shifts”
- Manager contact for PDF footer
- Role list (seeded: Bartender, Grillman, Chef)

## 13. Data and tech

- **Stack:** React (Vite + TypeScript), local-only
- **Persistence:** JSON files on disk. The UI must not own a second copy of the data.
- **Arrange:** in-process solver, deterministic enough to re-run on the same JSON and explain opens
- **PDF:** client-side
- **No cloud, no login.** Tiny local process **only** to read/write JSON files.

### 13.1 File layout (source of truth)

| File | Contents |
|------|----------|
| `data/settings.json` | Restaurant names, week start, hour cap, default no-doubles, PDF footer, role list, schemaVersion |
| `data/people.json` | Staff: names, home, roles, cover, restrictions, notes, active |
| `data/templates.json` | Per restaurant: morning/evening times and default role counts |
| `data/weeks.json` | Draft and published weeks, assignments, overrides, last arrange report |

Do not embed staff or weeks in React source. Pretty-print JSON.

## 14. Success criteria (v1 done)

1. Airplane mode: arrange a week, edit a name, publish, PDF, WhatsApp copy.
2. Each restaurant grid has only Morning and Evening rows.
3. Arrange never places a 4th day for a “max 3 days” person, never places Friday morning for “evenings only on Friday”, never morning+evening the same day when doubles are forbidden.
4. After arrange, you change one slot; that edit remains until you choose Replace all.
5. Arrange both restaurants in one click does not overlap a cover person.
6. Edit a person in the UI → `data/people.json` updates; restart still shows it.

## 15. Open questions (defaults until you change them)

| Topic | Default in this spec |
|--------|----------------------|
| Restaurant real names | Placeholders A / B |
| Week start | Sunday |
| Morning / evening hours | 11:00–16:00 / 16:00–23:00 |
| Default seats per period | 1 Bartender, 1 Grillman, 1 Chef |
| Hour cap | 40 (soft) |
| Double-shift default | Forbidden |
| Combined vs separate PDF | Separate file per restaurant |

Reply with restaurant names, real hours, and how many bartender/grillman/chef you need on morning vs evening. Next after you approve: scaffold the app and the arrange + edit flow.
