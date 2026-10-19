# Triplanner ✈️

An offline-first PWA for planning trips day by day. Everything stays on your
device; signing in (optional) syncs your trips between devices.

## Features

- **Trips → days → plans** — days come from the date range; 15 plan types.
  Change the dates later and the days follow: the plans move with the trip,
  or keep their dates — your choice. Plans sit in time order.
- **Start and end times** — a plan can say when it ends; a flight is one plan
  from → to, leaving and landing. Overlaps are flagged.
- **Trip mode** — during the trip, on the trip's own clock (set a time zone
  per trip): the plan you are on, when it ends, what comes next, the free
  time between, directions for the hop, your documents, one tap to mark it
  done. The app shortcut "Today's trip" opens it directly.
- **Documents offline** — attach boarding passes, tickets and confirmations
  (PDF or photo) to a plan; they open with no signal.
- **Import booking** — feed it the `.ics` from a flight, hotel or rail
  confirmation and it fills the days. Preview first, one Undo after. On
  Android, share the file straight to the installed app; on desktop, open
  `.ics`/`.json` files with it.
- **Budget** — a budget target, planned vs paid, a breakdown by category,
  costs in other currencies (with your own exchange rates, so it works
  offline), and a split between travellers with who-owes-whom.
- **Weather** — a forecast on each day within 16 days, from Open-Meteo (no
  key; only the destination name is sent; can be turned off).
- **Maps with no link to paste** — `place` takes any text: a Maps link opens
  that exact place, anything else gives a Google and an Apple search button.
  Empty falls back to the plan name plus the destination.
- **Airlines** — type `LH 1178` and the name and logo appear.
- **Hotel stays** — a check-in and a check-out make the days between show
  "Staying at …".
- **Share** — the trip travels inside the link, or as a QR code the built-in
  scanner reads. No server. Leave out costs or notes if you like. Receiving a
  trip you already have offers *Keep both* or *Replace mine*.
- **Sync** — sign in with an emailed link and the trips follow you to every
  device. One account for all the chapri apps (Supabase project
  `chapri-apps`). Offline still works; changes go up when you are back.
  Documents stay on the device that added them.
- **Backup** — an automatic backup file, a copy on the device, storage
  protection and an install prompt, in one card.
- Costs per plan/day/trip · day routes in Maps · live flight status links ·
  calendar export with reminders · drag to reorder, or move a plan to another
  day from its form · undo (Ctrl/⌘+Z too) · packing list with ready-made lists
  and copy-from-another-trip · duplicate a trip · grouped home screen with
  countdowns · light/dark/system · installable, fully offline, and the app
  open in two tabs stays in sync. Phone Back closes dialogs; everything works
  from the keyboard.

## Development

```bash
npm install
npm run dev          # dev server
npm run build        # → dist/
npm test             # integration tests (Vitest + Testing Library, jsdom)
npm run lint         # ESLint
npm run format       # Prettier
npm run screenshots  # after a build: regenerate the install-prompt screenshots
```

Vite · React 18 · Tailwind v4 · dnd-kit · vite-plugin-pwa. `qrcode` and `jsQR`
load only when you share or scan. New app versions wait for a tap on
*Reload*, so an update never interrupts a form.

The tests in `src/test/` render the whole app on a seeded device and drive it
like a user; there are deliberately no unit tests.

Sync needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` — in
`.env.local` for dev, in the Netlify site's environment for deploys. Both are
public by design (row-level security guards the data); without them the app
runs with no sync. The schema lives in the `chapri-apps` repo.

Deploy: `netlify.toml` is ready — point Netlify at the repo, or run
`npx netlify-cli deploy --prod`.

## How it holds together

| Concern | Where |
|---|---|
| State | `lib/store.jsx` — one reducer, `localStorage` key `triplanner:v1`, written after a 250 ms pause (and at once when the tab hides). Another tab's save is taken over through the `storage` event. |
| Documents | `lib/files.js` — the files live in IndexedDB (`files` store), plans keep `{ id, name, type, size }`. Unreferenced files are cleared a day after they were added. |
| Dates | `lib/reschedule.js` — new trip dates shift or keep the days; empty days outside the range go, days with plans stay |
| Budget | `lib/money.js` — conversion with `trip.rates`, the split and the settle-up |
| Weather | `lib/weather.js` — Open-Meteo geocoding + forecast, cached for offline |
| Inbox | `lib/inbox.js` + `public/share-target-sw.js` — files shared to the app (share target) or opened with it (file handlers) |
| Sync | `lib/sync.jsx` — per-trip merge with the account (`triplanner_trips`): the side that changed wins, the newer edit if both did; deletes travel as tombstones. Uploads 2 s after an edit, on focus, on reconnect and every 5 min. |
| Durability | `lib/backup.js` — IndexedDB copy after every change, plus an optional backup file (File System Access). Restores itself if `localStorage` is ever empty; follows deletions, so a delete stays deleted. |
| Booking reader | `lib/booking.js` — the RFC 5545 subset a confirmation uses. Times are taken as written; only UTC is converted, and flagged. |
| Map links | `lib/maps.js` — every map link, no API key |
| Trip mode | `lib/schedule.js` — a plan has a start time and, when known, an end time; no length is ever guessed |
| Airlines | `lib/airlines-data.js` — 970 IATA codes offline (`scripts/gen-airlines.mjs` refreshes). Logos from Kiwi.com's keyless CDN, falling back to ✈️. |

## Data format

Exports and share links carry:

```json
{
  "app": "triplanner", "version": 1,
  "trips": [{
    "id": "…", "name": "Summer in Portugal", "destination": "Lisbon",
    "startDate": "2026-08-01", "endDate": "2026-08-05", "currency": "EUR",
    "timeZone": "Europe/Lisbon", "budget": 1500,
    "travellers": ["Ana", "Ben"], "rates": { "USD": 0.92 },
    "packing": [{ "id": "…", "text": "Passport", "done": false }],
    "days": [{
      "id": "…", "date": "2026-08-01", "title": "",
      "items": [
        { "id": "…", "type": "flight", "flightNo": "LH 1178", "from": "Berlin BER", "to": "Lisbon LIS", "time": "07:10", "endTime": "09:45", "place": "", "notes": "", "cost": 120, "paid": true, "paidBy": "Ana" },
        { "id": "…", "type": "restaurant", "title": "Cervejaria Ramiro", "time": "13:00", "endTime": "14:30", "place": "Rua Ramiro 1", "notes": "Garlic prawns", "cost": 40, "currency": "USD",
          "attachments": [{ "id": "…", "name": "booking.pdf", "type": "application/pdf", "size": 48213 }] }
      ]
    }]
  }]
}
```

`cost` (with `currency` when it differs from the trip's, `paid`, `paidBy`),
`endTime`, `status` (`done` / `skipped`), `place` and `attachments` are
optional; an `endTime` before `time` runs past midnight. `attachments` only
reference files kept on the device that added them. Importing a trip whose
`id` you already have asks whether to keep both or replace yours. Older data
is migrated on load: `mapsUrl` → `place`, `type: "transport"` → `"train"`, and
a flight's `direction` + `location` → `from`/`to` with its time as `time`
(departure) or `endTime` (arrival).

A share link is this JSON, deflate-compressed and base64url-encoded in the URL
fragment, so it never reaches a server.
