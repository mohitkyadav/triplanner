import { catById, titleFor } from './categories'
import { addDaysISO } from './dates'

// iCalendar (RFC 5545) export. Timed plans become 1-hour events in floating
// local time (no timezone suffix), which calendar apps show at the trip's
// wall-clock time. The trip itself becomes one all-day banner event.

const esc = s =>
  String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// Content lines must stay within 75 octets; continuation lines start with a
// space. Splitting at 60 code points keeps multi-byte text safely under.
function fold(line) {
  const parts = []
  let rest = line
  while (rest.length > 60) {
    parts.push(rest.slice(0, 60))
    rest = ' ' + rest.slice(60)
  }
  parts.push(rest)
  return parts.join('\r\n')
}

const dateBasic = iso => iso.replaceAll('-', '')
const dtstamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

function vevent(fields) {
  const lines = ['BEGIN:VEVENT']
  for (const [k, v] of fields) if (v) lines.push(fold(`${k}:${v}`))
  lines.push('END:VEVENT')
  return lines
}

export function tripToICS(trip) {
  const stamp = dtstamp()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Triplanner//Triplanner 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${esc(trip.name)}`),
  ]

  if (trip.startDate) {
    const end = addDaysISO(trip.endDate || trip.startDate, 1) // DTEND is exclusive
    lines.push(
      ...vevent([
        ['UID', `${trip.id}@triplanner`],
        ['DTSTAMP', stamp],
        ['DTSTART;VALUE=DATE', dateBasic(trip.startDate)],
        ['DTEND;VALUE=DATE', dateBasic(end)],
        ['SUMMARY', esc(`🧳 ${trip.name}`)],
        ['LOCATION', trip.destination && esc(trip.destination)],
      ]),
    )
  }

  for (const day of trip.days) {
    if (!day.date) continue
    for (const item of day.items) {
      if (!item.time || item.status === 'skipped') continue
      const [h, m] = item.time.split(':').map(Number)
      const start = `${dateBasic(day.date)}T${item.time.replace(':', '')}00`
      const endDate = h + 1 > 23 ? addDaysISO(day.date, 1) : day.date
      const end = `${dateBasic(endDate)}T${String((h + 1) % 24).padStart(2, '0')}${String(m).padStart(2, '0')}00`
      lines.push(
        ...vevent([
          ['UID', `${item.id}@triplanner`],
          ['DTSTAMP', stamp],
          ['DTSTART', start],
          ['DTEND', end],
          ['SUMMARY', esc(`${catById(item.type).emoji} ${titleFor(item)}`)],
          ['LOCATION', esc(item.location || (item.type !== 'flight' && item.title) || '')],
          ['DESCRIPTION', item.notes && esc(item.notes)],
          ['URL', item.mapsUrl && esc(item.mapsUrl)],
        ]),
      )
    }
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
