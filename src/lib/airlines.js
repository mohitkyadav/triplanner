import { AIRLINES } from './airlines-data'

// Airline identity is derived from the flight number ("LH 1178" → LH →
// Lufthansa) — no lookup API. Names come from the bundled OpenFlights
// dataset; logos from Kiwi.com's keyless CDN (square symbol-only marks).
// The UI always falls back to the category emoji when an image can't load
// (e.g. offline before the service worker has cached it).

// IATA airline designator: two alphanumerics (at least one letter), followed
// by the numeric flight part, e.g. "LH1178", "U2 456", "9W-123".
const FLIGHT_RE = /^([A-Z][A-Z0-9]|[0-9][A-Z])[ -]?\d{1,4}[A-Z]?$/

export function airlineFromFlightNo(flightNo) {
  const m = (flightNo || '').trim().toUpperCase().match(FLIGHT_RE)
  if (!m) return null
  const iata = m[1]
  const name = AIRLINES[iata]
  return name ? { iata, name } : null
}

// One canonical 128×128 (2× retina for the largest chip) image per airline —
// every UI spot shares the same URL, so the service worker caches one file.
export const airlineLogoUrl = iata => `https://images.kiwi.com/airlines/128/${iata}.png`
