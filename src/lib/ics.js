import { catById, flightRoute, titleFor } from './categories'
import { addDaysISO } from './dates'
import { placeUrl } from './maps'
import { endOf, fmtClock, startOf } from './schedule'

// iCalendar (RFC 5545) export, in floating local time (no timezone suffix),
// which calendar apps show at the trip's wall-clock time. A plan with an end
// time keeps it; one without becomes a 1-hour block, because a calendar event
// needs an end. Every timed plan carries a reminder — flights three hours
// ahead, the rest half an hour — so the phone does the reminding.
// The trip itself becomes one all-day banner event.

const REMINDER = { flight: '-PT3H' }
const DEFAULT_REMINDER = '-PT30M'

const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

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
const timeBasic = min => `${fmtClock(min).replace(':', '')}00`
const dtstamp = () =>
  new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

function vevent(fields, alarm) {
  const lines = ['BEGIN:VEVENT']
  for (const [k, v] of fields) if (v) lines.push(fold(`${k}:${v}`))
  if (alarm) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      fold(`DESCRIPTION:${alarm.text}`),
      `TRIGGER:${alarm.trigger}`,
      'END:VALARM',
    )
  }
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
      if (item.status === 'skipped') continue
      const startMin = startOf(item)
      if (startMin == null) continue
      const endMin = endOf(item) ?? startMin + 60
      const start = `${dateBasic(day.date)}T${timeBasic(startMin)}`
      // A plan can run past midnight, so the end may land on the next day.
      const end = `${dateBasic(addDaysISO(day.date, Math.floor(endMin / 1440)))}T${timeBasic(endMin)}`
      const summary = esc(`${catById(item.type).emoji} ${titleFor(item)}`)
      lines.push(
        ...vevent(
          [
            ['UID', `${item.id}@triplanner`],
            ['DTSTAMP', stamp],
            ['DTSTART', start],
            ['DTEND', end],
            ['SUMMARY', summary],
            ['LOCATION', esc((item.type === 'flight' ? flightRoute(item) : item.title) || '')],
            ['DESCRIPTION', item.notes && esc(item.notes)],
            // `place` can hold plain text, but URL: must be a real URL.
            ['URL', esc(placeUrl(trip, item) || '')],
          ],
          { text: summary, trigger: REMINDER[item.type] ?? DEFAULT_REMINDER },
        ),
      )
    }
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
