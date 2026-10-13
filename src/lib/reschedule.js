import { addDaysISO, daysBetween } from './dates'
import { makeDay, sortDays } from './store'

/* Brings a trip's days in line with new trip dates.

     mode 'shift'  every dated day moves by as many days as the start moved,
                   so the plans travel with the trip
     mode 'keep'   the plans stay on their dates

   Then every date of the new range gets a day, and empty days outside the
   range go away. A day outside the range that holds plans or a label is
   kept — the caller tells the user — so nothing planned is lost. */
export function rescheduleDays(trip, { startDate, endDate }, mode = 'shift') {
  let days = trip.days
  const shift = mode === 'shift' && trip.startDate && startDate ? daysBetween(trip.startDate, startDate) : 0
  if (shift) days = days.map(d => (d.date ? { ...d, date: addDaysISO(d.date, shift) } : d))

  if (!startDate) return { days: sortDays(days), outside: 0, shift }

  const last = endDate && endDate >= startDate ? endDate : startDate
  const within = date => date >= startDate && date <= last
  const have = new Set(days.map(d => d.date))
  const count = Math.min(daysBetween(startDate, last) + 1, 90)
  const added = []
  for (let i = 0; i < count; i++) {
    const date = addDaysISO(startDate, i)
    if (!have.has(date)) added.push(makeDay(date))
  }
  days = [...days, ...added].filter(d => !d.date || within(d.date) || d.items.length > 0 || d.title)
  const outside = days.filter(d => d.date && !within(d.date)).length
  return { days: sortDays(days), outside, shift }
}
