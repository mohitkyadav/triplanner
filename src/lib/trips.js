import { daysBetween, todayISO } from './dates'

/* Where a trip stands today, on the trip's own clock:
     { phase: 'ongoing', day }    day: 1-based day of the trip
     { phase: 'upcoming', in }    in: days until it starts
     { phase: 'past' }
     { phase: 'undated' } */
export function tripPhase(trip) {
  const today = todayISO(trip.timeZone)
  const dated = trip.days.map(d => d.date).filter(Boolean)
  const start = trip.startDate || dated[0]
  const end = trip.endDate || dated[dated.length - 1] || start
  if (!start) return { phase: 'undated' }
  if (today < start) return { phase: 'upcoming', in: daysBetween(today, start) }
  if (today > end) return { phase: 'past' }
  const index = trip.days.findIndex(d => d.date === today)
  return { phase: 'ongoing', day: index >= 0 ? index + 1 : daysBetween(start, today) + 1 }
}

const PHASES = ['ongoing', 'upcoming', 'undated', 'past']

/* The home screen's groups, in order, each sorted the way it is read:
   upcoming soonest first, past most recent first. */
export function groupTrips(trips) {
  const groups = Object.fromEntries(PHASES.map(p => [p, []]))
  for (const trip of trips) groups[tripPhase(trip).phase].push(trip)
  const start = t => t.startDate || t.days.find(d => d.date)?.date || ''
  groups.ongoing.sort((a, b) => start(a).localeCompare(start(b)))
  groups.upcoming.sort((a, b) => start(a).localeCompare(start(b)))
  groups.past.sort((a, b) => start(b).localeCompare(start(a)))
  return PHASES.map(phase => ({ phase, trips: groups[phase] })).filter(g => g.trips.length > 0)
}

// The trip "Today's trip" opens: the one under way, else the next one.
export function currentTrip(trips) {
  const groups = groupTrips(trips)
  return groups.find(g => g.phase === 'ongoing')?.trips[0] ?? groups.find(g => g.phase === 'upcoming')?.trips[0] ?? null
}

export function countdown(phase) {
  if (phase.phase === 'ongoing') return `Day ${phase.day} · under way`
  if (phase.phase !== 'upcoming') return ''
  if (phase.in === 1) return 'Tomorrow'
  if (phase.in < 14) return `In ${phase.in} days`
  if (phase.in < 60) return `In ${Math.round(phase.in / 7)} weeks`
  return `In ${Math.round(phase.in / 30)} months`
}
