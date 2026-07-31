import { airlineFromFlightNo } from './airlines'
import { daysBetween } from './dates'

/* Reads a booking confirmation (.ics) into plans.

   Airlines, hotels, rail operators and the booking sites all attach a calendar
   invite to the confirmation mail. It is structured, so the app does not have
   to guess: this file turns the events into plans, and the user approves them
   before anything is saved.

   Only the parts of RFC 5545 that a confirmation uses are read. Times are
   taken as written on the clock — a flight leaves at the time printed on the
   ticket, whatever time zone the file names. A time in UTC is the one case
   that must be converted, and the preview marks those rows. */

/* ---------- RFC 5545 ---------- */

// A long property is folded over several lines; a continuation starts with a
// space or a tab.
const unfold = text => text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '')

const unescapeText = v => v.replace(/\\([nN,;\\])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c))

// Splits at the first colon that is not inside a quoted parameter, because
// TZID="Europe/Lisbon" may hold one.
function splitAtColon(line) {
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') quoted = !quoted
    else if (c === ':' && !quoted) return [line.slice(0, i), line.slice(i + 1)]
  }
  return null
}

function splitParams(text) {
  const parts = []
  let quoted = false
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') quoted = !quoted
    else if (c === ';' && !quoted) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

// One object per VEVENT: { SUMMARY: { value, params }, … }. A nested block
// (VALARM carries its own DESCRIPTION) is skipped, so it cannot overwrite the
// event's own properties.
export function parseIcs(text) {
  const events = []
  let event = null
  let skipping = null

  for (const raw of unfold(String(text)).split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (skipping) {
      if (line === `END:${skipping}`) skipping = null
      continue
    }
    if (line === 'BEGIN:VEVENT') {
      event = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (event) events.push(event)
      event = null
      continue
    }
    if (!event) continue
    if (line.startsWith('BEGIN:')) {
      skipping = line.slice(6)
      continue
    }
    const split = splitAtColon(line)
    if (!split) continue
    const [head, value] = split
    const [name, ...params] = splitParams(head)
    event[name.toUpperCase()] = {
      value: unescapeText(value),
      params: Object.fromEntries(
        params.map(p => {
          const eq = p.indexOf('=')
          return eq < 0 ? [p.toUpperCase(), ''] : [p.slice(0, eq).toUpperCase(), p.slice(eq + 1).replace(/^"|"$/g, '')]
        }),
      ),
    }
  }
  return events
}

const pad = n => String(n).padStart(2, '0')

// { date: 'YYYY-MM-DD', time: 'HH:MM' | '', fromUtc } or null.
export function parseIcsDate(field) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec((field?.value ?? '').trim())
  if (!m) return null
  const [, y, mo, d, hh, mm, , zulu] = m
  if (!hh) return { date: `${y}-${mo}-${d}`, time: '' } // an all-day event
  if (zulu) {
    // The only form the app must convert. It lands on the reader's own clock,
    // which is what a calendar app would show too.
    const local = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm))
    return {
      date: `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`,
      time: `${pad(local.getHours())}:${pad(local.getMinutes())}`,
      fromUtc: true,
    }
  }
  // Floating, or carrying a TZID: the clock time is the local time of the stop.
  return { date: `${y}-${mo}-${d}`, time: `${hh}:${mm}` }
}

/* ---------- what kind of booking is this ---------- */

/* Words that name the kind of booking. "Coach" is left out on purpose: a train
   has coaches too. A number that follows a service name ("ICE 701") carries no
   closing word boundary, so those patterns are written separately. */
const KEYWORDS = [
  [
    'train',
    /\b(train|railway|rail travel|hbf|hauptbahnhof|sncf|deutsche bahn|db navigator|trenitalia|italo|renfe|eurostar|thalys|amtrak|via rail|ns international|sbb|öbb)\b|\b(ice|tgv|railjet)\s?\d/i,
  ],
  ['bus', /\b(bus|flixbus|megabus|greyhound|blablacar|national express|bus station|coach station)\b/i],
  ['hotel', /\b(hotel|hostel|airbnb|apartment|apartamento|guest ?house|b&b|bed and breakfast|booking\.com|agoda|vrbo|check[\s-]?in|check[\s-]?out)\b/i],
  ['restaurant', /\b(restaurant|opentable|thefork|table for|dinner reservation|lunch reservation)\b/i],
]
const FLIGHT_WORDS = /\b(flight|airline|airways|boarding pass|airport)\b/i

// A flight number only counts when its code names a real airline, so "Gate A 12"
// or "Hotel 4" cannot pass for one.
export function detectFlightNo(text) {
  for (const m of String(text ?? '')
    .toUpperCase()
    .matchAll(/\b([A-Z][A-Z0-9]|\d[A-Z])[\s-]?(\d{1,4})\b/g)) {
    if (airlineFromFlightNo(`${m[1]}${m[2]}`)) return `${m[1]} ${m[2]}`
  }
  return null
}

const CHECK_IN = /check[\s-]?in/i
const CHECK_OUT = /check[\s-]?out/i

// Leaves the hotel name alone: "Check-in: Hotel Alfama" → "Hotel Alfama".
const cleanTitle = s =>
  String(s ?? '')
    .replace(/^\s*(check[\s-]?in|check[\s-]?out|arrival|departure)\s*[:—–-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

/* The title names the kind of booking, so it is read first. Only then is a
   flight number looked for — otherwise a coach number such as "FlixBus N4412"
   passes for a flight, because N4 is a real airline code. The rest of the event
   is a weaker signal, read last. */
function classify(summary, description, location) {
  for (const [type, re] of KEYWORDS) if (re.test(summary)) return { type }
  const flightNo = detectFlightNo(summary) ?? detectFlightNo(description)
  if (flightNo) return { type: 'flight', flightNo }
  const rest = `${description} ${location}`
  for (const [type, re] of KEYWORDS) if (re.test(rest)) return { type }
  if (FLIGHT_WORDS.test(`${summary} ${rest}`)) return { type: 'flight' }
  return { type: 'other' }
}

/* ---------- events → plans ---------- */

const notesFor = (description, url) =>
  [String(description ?? '').trim(), url && `Booking: ${url}`].filter(Boolean).join('\n').slice(0, 600)

/* Reads a file into rows the preview can show:
     { key, date, time, item, fromUtc, duplicate }
   `trip` decides the direction of a flight and marks a plan the trip already
   holds. Throws when the file carries nothing usable. */
export function readBooking(text, trip) {
  const events = parseIcs(text)
  if (events.length === 0) throw new Error('this file holds no calendar events')

  const rows = []
  for (const [index, event] of events.entries()) {
    const start = parseIcsDate(event.DTSTART)
    if (!start) continue
    const end = parseIcsDate(event.DTEND)
    const summary = (event.SUMMARY?.value ?? '').trim()
    const description = (event.DESCRIPTION?.value ?? '').trim()
    const location = (event.LOCATION?.value ?? '').trim()
    const url = (event.URL?.value ?? '').trim()
    const notes = notesFor(description, url)
    const kind = classify(summary, description, location)
    const key = `${event.UID?.value ?? index}-${kind.type}`

    if (kind.type === 'flight') {
      // A flight event runs from take-off to landing. The trip's last day is a
      // way home; anything earlier brings the traveller in.
      const isDeparture = Boolean(trip?.endDate) && start.date >= trip.endDate
      const when = !isDeparture && end?.time ? end : start
      rows.push({
        key,
        date: when.date,
        time: when.time,
        fromUtc: Boolean(when.fromUtc),
        item: {
          type: 'flight',
          flightNo: kind.flightNo,
          direction: isDeparture ? 'departure' : 'arrival',
          location,
          title: cleanTitle(summary),
          time: when.time,
          place: '',
          notes,
        },
      })
      continue
    }

    if (kind.type === 'hotel') {
      const explicit = CHECK_OUT.test(summary) ? 'check-out' : CHECK_IN.test(summary) ? 'check-in' : null
      const nights = end?.date ? daysBetween(start.date, end.date) : 0
      const title = cleanTitle(summary) || 'Hotel'
      const hotel = (action, when, suffix) => ({
        key: `${key}-${action}`,
        date: when.date,
        time: when.time,
        fromUtc: Boolean(when.fromUtc),
        item: { type: 'hotel', hotelAction: action, title, time: when.time, place: location, notes: suffix ? notes : '' },
      })
      // One event covering the whole stay becomes a check-in and a check-out.
      if (!explicit && nights >= 1) {
        rows.push(hotel('check-in', start, true), hotel('check-out', { date: end.date, time: end.time }, false))
      } else {
        rows.push(hotel(explicit ?? 'check-in', start, true))
      }
      continue
    }

    rows.push({
      key,
      date: start.date,
      time: start.time,
      fromUtc: Boolean(start.fromUtc),
      item: {
        type: kind.type,
        title: cleanTitle(summary) || 'Booking',
        time: start.time,
        place: location,
        notes,
      },
    })
  }

  if (rows.length === 0) throw new Error('no event in this file carries a date')

  // A confirmation often arrives twice. A plan that matches one already in the
  // trip starts unticked instead of making a copy.
  const seen = new Set(
    (trip?.days ?? []).flatMap(d =>
      d.items.map(i => `${d.date}|${i.type}|${(i.title ?? '').trim().toLowerCase()}|${i.time ?? ''}`),
    ),
  )
  for (const row of rows) {
    row.duplicate = seen.has(`${row.date}|${row.item.type}|${row.item.title.trim().toLowerCase()}|${row.time}`)
  }
  return rows
}
