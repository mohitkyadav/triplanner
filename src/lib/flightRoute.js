import { useEffect, useState } from 'react'
import { callsign } from './airlines'

/* The airports a flight number usually flies between, from adsbdb.com — no
   API key, and the only thing sent is the flight number. The data comes from
   what plane spotters record, so it is a flight's usual route, not this
   day's schedule: no times, and an airline may have changed it. Answers are
   kept, so a number looked up once fills in offline too. */

const CACHE_KEY = 'triplanner:routes'
const FRESH_FOR = 30 * 24 * 60 * 60 * 1000
const WAIT_MS = 500

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {}
  } catch {
    return {}
  }
}

function writeCache(code, route) {
  try {
    const cache = readCache()
    cache[code] = { route, at: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // storage full or unavailable — the next lookup asks again
  }
}

// "Porto (OPO)", the way booking imports write an airport.
const airportName = a => (a.municipality ? `${a.municipality} (${a.iata_code})` : a.iata_code || a.name)

// { from, to } for a flight number, or null when adsbdb does not know it.
// Throws when the request fails, so an offline miss is not remembered.
export async function lookupFlightRoute(flightNo) {
  const code = callsign(flightNo)
  if (!code) return null
  const hit = readCache()[code]
  if (hit && Date.now() - hit.at < FRESH_FOR) return hit.route

  const res = await fetch(`https://api.adsbdb.com/v0/callsign/${code}`)
  if (!res.ok && res.status !== 404) throw new Error(`adsbdb answered ${res.status}`)
  const body = await res.json()
  const r = body?.response?.flightroute
  const route = r?.origin && r?.destination ? { from: airportName(r.origin), to: airportName(r.destination) } : null
  writeCache(code, route)
  return route
}

// The route for the flight number being typed, looked up once the typing
// pauses. Null until there is one.
export function useFlightRoute(flightNo) {
  const code = callsign(flightNo)
  const [found, setFound] = useState(null)

  useEffect(() => {
    if (!code) return
    let live = true
    const timer = setTimeout(() => {
      lookupFlightRoute(code)
        .then(route => live && setFound({ code, route }))
        .catch(() => {})
    }, WAIT_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [code])

  return found && found.code === code ? found.route : null
}
