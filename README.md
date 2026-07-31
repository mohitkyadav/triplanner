# Triplanner ✈️

An offline-first PWA for planning trips day by day. Everything stays on your
device; nothing is uploaded.

## Features

- **Trips → days → plans** — days come from the date range; 15 plan types.
- **Trip mode** — during the trip: the plan you are on, what comes next, how
  long until then, directions for the hop, one tap to mark it done.
- **Import booking** — feed it the `.ics` from a flight, hotel or rail
  confirmation and it fills the days. Preview first, one Undo after.
- **Maps with no link to paste** — `place` takes any text: a Maps link opens
  that exact place, anything else gives a Google and an Apple search button.
  Empty falls back to the plan name plus the destination.
- **Airlines** — type `LH 1178` and the name and logo appear.
- **Hotel stays** — a check-in and a check-out make the days between show
  "Staying at …".
- **Share** — the trip travels inside the link, or as a QR code the built-in
  scanner reads. No server.
- **Backup** — an automatic backup file, a copy on the device, storage
  protection and an install prompt, in one card.
- Costs per plan/day/trip · day routes in Maps · calendar export · drag to
  reorder · undo deletes · packing list · light/dark/system · installable and
  fully offline.

## Development

```bash
npm install
npm run dev     # dev server
npm run build   # → dist/
```

Vite · React 18 · Tailwind v4 · dnd-kit · vite-plugin-pwa. `qrcode` and `jsQR`
load only when you share or scan.

Deploy: `netlify.toml` is ready — point Netlify at the repo, or run
`npx netlify-cli deploy --prod`.

## How it holds together

| Concern | Where |
|---|---|
| State | `lib/store.jsx` — one reducer, `localStorage` key `triplanner:v1` |
| Durability | `lib/backup.js` — IndexedDB copy after every change, plus an optional backup file (File System Access). Restores itself if `localStorage` is ever empty; follows deletions, so a delete stays deleted. |
| Booking reader | `lib/booking.js` — the RFC 5545 subset a confirmation uses. Times are taken as written; only UTC is converted, and flagged. |
| Map links | `lib/maps.js` — every map link, no API key |
| Trip mode | `lib/schedule.js` — a plan has a start time and nothing more, so no length is guessed |
| Airlines | `lib/airlines-data.js` — 970 IATA codes offline (`scripts/gen-airlines.mjs` refreshes). Logos from Kiwi.com's keyless CDN, falling back to ✈️. |

## Data format

Exports and share links carry:

```json
{
  "app": "triplanner", "version": 1,
  "trips": [{
    "id": "…", "name": "Summer in Portugal", "destination": "Lisbon",
    "startDate": "2026-08-01", "endDate": "2026-08-05", "currency": "EUR",
    "packing": [{ "id": "…", "text": "Passport", "done": false }],
    "days": [{
      "id": "…", "date": "2026-08-01", "title": "",
      "items": [
        { "id": "…", "type": "flight", "flightNo": "LH 1178", "direction": "arrival", "location": "Lisbon LIS", "time": "10:35", "place": "", "notes": "", "cost": 120 },
        { "id": "…", "type": "restaurant", "title": "Cervejaria Ramiro", "time": "13:00", "place": "Rua Ramiro 1", "notes": "Garlic prawns" }
      ]
    }]
  }]
}
```

`cost`, `status` (`done` / `skipped`) and `place` are optional. Importing a trip
whose `id` you already have updates it. Older data is migrated on load:
`mapsUrl` → `place`, `type: "transport"` → `"train"`.

A share link is this JSON, deflate-compressed and base64url-encoded in the URL
fragment, so it never reaches a server.
