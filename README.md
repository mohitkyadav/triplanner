# Triplanner ✈️

A fast, offline-first PWA for planning trips day by day. All data lives on your
device — nothing ever leaves it — and can be exported and imported as JSON.

## Features

- **Trips → days → plans** — create a trip (days are auto-generated from the
  date range), then fill each day with flights, hotel check-ins/outs and places.
- **Trip mode** — the view for the days of the trip itself: the plan you are on
  *now*, the plan that comes *next*, how long it is until then, a directions
  link for the hop, and one tap to mark a plan done or skipped. Two plans that
  start at the same time are flagged, and plans that started earlier without a
  result are collected under "Not marked yet". Reach it from the trip banner or
  the header (➤ icon). A plan keeps a start time and nothing more — the app
  never guesses how long a plan runs, so the plan you are on is simply the one
  that started last.
- **14 place types** — restaurant, museum, park, landmark, café, nightlife,
  beach, shopping, activity, work and more, each with notes ("what to eat
  here…"), an optional time, and a maps link.
- **Maps links** — paste a Google or Apple Maps link and the card shows the
  matching provider icon.
- **Airline names & logos** — type a flight number ("LH 1178") and the app
  derives the airline: the name comes from a bundled offline dataset, the
  logo from a keyless CDN (see below). Shown on flight cards, the trip banner
  and live in the flight form.
- **Computed hotel stays** — add a check-in and a check-out; the days in
  between automatically show a subdued "Staying at …" strip.
- **Smart trip banner** — the trip card surfaces the arrival flight and the
  final departure flight when you've added them.
- **Drag to reorder** — smoothly re-arrange the order of places within a day
  (touch friendly, via dnd-kit).
- **Done / skipped** — tap the circle on any plan to cycle planned → done →
  skipped (skipped plans show struck-through and dimmed).
- **Costs & budget** — give any plan an optional cost and the trip a currency;
  each day shows its subtotal and the trip banner shows the total (skipped
  plans don't count).
- **Day routes** — the route icon on a day header opens all of that day's
  stops as a Google Maps directions route, in order. No API key needed.
- **Share via link or QR** — the whole trip is compressed into the link
  itself (nothing is uploaded). Small trips fit a single QR any camera can
  open; big trips show an *animated* multi-part QR that the built-in scanner
  (QR icon on the home screen) reassembles — works for any trip size, offline.
- **Add to calendar** — export the trip as an `.ics` file: one all-day event
  for the trip plus an event for every timed plan.
- **Undo deletes** — deleting a plan, day or trip shows an Undo toast instead
  of being unrecoverable.
- **Packing list** — a per-trip checklist that lives above the days
  (tap to expand, check things off as you pack).
- **Lives in the present** — opening a trip that spans today smoothly scrolls
  to the current day; past days are dimmed until you hover them.
- **Light / Dark / System theme** — switcher on the home screen; the choice is
  persisted, applied before first paint (no flash), and "System" tracks the OS
  live.
- **Export / import** — back up everything or a single trip as a JSON file.
  Importing a file with a known trip id updates that trip; new ids are added.
- **Keeps your trips safe** — see [Durability](#durability) below: an automatic
  backup file, a second copy on the device, storage protection and an install
  nudge, all in one card on the home screen.
- **PWA** — installable, works fully offline after the first visit.

## Stack

Vite · React 18 · Tailwind CSS v4 · dnd-kit · vite-plugin-pwa · qrcode +
jsQR (lazy-loaded only when sharing/scanning)

## Development

```bash
npm install
npm run dev       # dev server
npm run build     # production build → dist/
npm run preview   # serve the production build locally
```

## Durability

`localStorage` alone is not enough for a trip plan: the write can fail when the
quota is full, and browsers clear the storage of a page the user did not install
(iOS Safari after 7 days without a visit). `src/lib/backup.js` therefore keeps
three defences, weakest first:

1. **`navigator.storage.persist()`** — asked for at every start, and offered
   again as a button. Chrome answers from its own engagement rules; Firefox
   prompts; Safari gives the guarantee only to an installed app.
2. **An IndexedDB copy** — written 1.2 s after every change. It survives a
   failed or damaged `localStorage` write. When `localStorage` comes back with
   *nothing readable*, the app restores from this copy on its own and says so.
   A user who deleted every trip is safe: the copy follows deletions, so only a
   missing or damaged key triggers the restore.
3. **An automatic backup file** — the user picks one file through the File
   System Access API and the app rewrites it 5 s after every change, plus once
   more when the tab is hidden. This is the only copy that outlives the browser
   profile. Chrome and Edge only; the card falls back to the install nudge and a
   manual export elsewhere.

Both writes are debounced and flushed on `visibilitychange`/`pagehide`. Every
step fails softly — a private window may refuse IndexedDB completely, and the
app stays usable.

## Airline names & logos

- **Names** are fully offline: `src/lib/airlines-data.js` maps IATA codes to
  airline names (970 airlines, generated from the OpenFlights database by
  `node scripts/gen-airlines.mjs` — rerun it to refresh, overrides live in the
  script).
- **Logos** load from Kiwi.com's keyless CDN
  (`images.kiwi.com/airlines/128/{IATA}.png`) — square symbol-only marks, no
  watermark, no key, no signup. It's an informal public CDN (no SLA), which
  is fine here because the UI never depends on it: if a logo can't load, the
  card falls back to the ✈️ emoji.
- Logos are runtime-cached by the service worker, so they keep working
  offline after they've been seen once.

## Deploying to Netlify

`netlify.toml` already configures the build (`npm run build` → `dist`), the SPA
fallback and caching headers. Either:

- **Git-based (recommended):** push this repo to GitHub/GitLab, then in
  Netlify choose *Add new site → Import an existing project* and pick the repo.
  Every push deploys automatically.
- **CLI:** `npx netlify-cli login`, then `npx netlify-cli init` once and
  `npx netlify-cli deploy --prod` to ship.

## Data format

Exports look like:

```json
{
  "app": "triplanner",
  "version": 1,
  "exportedAt": "2026-07-28T10:00:00.000Z",
  "trips": [
    {
      "id": "…",
      "name": "Summer in Portugal",
      "destination": "Lisbon",
      "startDate": "2026-08-01",
      "endDate": "2026-08-05",
      "days": [
        {
          "id": "…",
          "date": "2026-08-01",
          "title": "",
          "items": [
            { "id": "…", "type": "flight", "flightNo": "LH 1178", "direction": "arrival", "location": "Lisbon LIS", "time": "10:35", "title": "", "mapsUrl": "", "notes": "", "cost": 120 },
            { "id": "…", "type": "hotel", "hotelAction": "check-in", "title": "Hotel Alfama", "time": "15:00", "mapsUrl": "", "notes": "", "cost": 240 },
            { "id": "…", "type": "restaurant", "title": "Cervejaria Ramiro", "time": "13:00", "mapsUrl": "", "notes": "Garlic prawns, tiger shrimp" }
          ]
        }
      ],
      "currency": "EUR",
      "packing": [{ "id": "…", "text": "Passport", "done": false }]
    }
  ]
}
```

`cost` (number) and `currency` (ISO 4217 code) are optional; `packing` is the
trip's checklist.

Storage: `localStorage` key `triplanner:v1`, mirrored to the `snapshot` record
of the `kv` store in the `triplanner` IndexedDB database (see
[Durability](#durability)).

## Share format

Share links look like `https://…/#/share/<payload>` where `<payload>` is the
export JSON for one trip, deflate-raw-compressed and base64url-encoded, with a
`1.` scheme prefix (`0.` = uncompressed fallback for browsers without
`CompressionStream`). Decoding happens entirely on the receiving device.

QR codes carry the share URL directly when it fits (≤ 1200 chars). Bigger
payloads are split into 800-char chunks and shown as an animated sequence of
frames — `TQR:<id>:<index>:<total>:<chunk>` — which the in-app scanner
collects in any order until the set is complete.
