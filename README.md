# Triplanner ✈️

A fast, offline-first PWA for planning trips day by day. All data lives in your
browser's localStorage — nothing ever leaves your device — and can be exported
and imported as JSON.

## Features

- **Trips → days → plans** — create a trip (days are auto-generated from the
  date range), then fill each day with flights, hotel check-ins/outs and places.
- **14 place types** — restaurant, museum, park, landmark, café, nightlife,
  beach, shopping, activity, work and more, each with notes ("what to eat
  here…"), an optional time, and a maps link.
- **Maps links** — paste a Google or Apple Maps link and the card shows the
  matching provider icon.
- **Computed hotel stays** — add a check-in and a check-out; the days in
  between automatically show a subdued "Staying at …" strip.
- **Smart trip banner** — the trip card surfaces the arrival flight and the
  final departure flight when you've added them.
- **Drag to reorder** — smoothly re-arrange the order of places within a day
  (touch friendly, via dnd-kit).
- **Export / import** — back up everything or a single trip as a JSON file.
  Importing a file with a known trip id updates that trip; new ids are added.
- **PWA** — installable, works fully offline after the first visit.

## Stack

Vite · React 18 · Tailwind CSS v4 · dnd-kit · vite-plugin-pwa

## Development

```bash
npm install
npm run dev       # dev server
npm run build     # production build → dist/
npm run preview   # serve the production build locally
npm run icons     # regenerate PNG icons in public/ (zero-dependency script)
```

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
            { "id": "…", "type": "flight", "flightNo": "LH 1178", "direction": "arrival", "location": "Lisbon LIS", "time": "10:35", "title": "", "mapsUrl": "", "notes": "" },
            { "id": "…", "type": "hotel", "hotelAction": "check-in", "title": "Hotel Alfama", "time": "15:00", "mapsUrl": "", "notes": "" },
            { "id": "…", "type": "restaurant", "title": "Cervejaria Ramiro", "time": "", "mapsUrl": "", "notes": "Garlic prawns, tiger shrimp" }
          ]
        }
      ]
    }
  ]
}
```

Storage key: `triplanner:v1`.
